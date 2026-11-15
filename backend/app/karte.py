import base64
import json
import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
import shapefile
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import Field
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.warp import transform
from rasterio.windows import Window

from app.mission import horizontal_meters
from app.models import ApiModel, MarsCoordinate
from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, pandolf_watt
from app.routing import step_energy_joule
from app.terrain import MARS_GEOGRAPHIC, dem_pfad

karte = APIRouter(prefix="/api")

GAZETTEER = Path(__file__).resolve().parent.parent / "data" / "raw" / "nasa" / "gazetteer" / "MARS_nomenclature_center_pts.shp"
HIRISE_ORDNER = Path(os.environ.get("MARS_HIRISE_DIR", Path(__file__).resolve().parent.parent / "data" / "raw" / "hirise" / "MSR_TRN_HiRISE_soc_003_USGS_release_aug2024" / "mosaics"))
HIRISE_DTM = "MSR_hirise_soc_003_DTM_MOLATopography_DeltaGeoid_1m_Eqc_latTs0_lon0_Blend40.tif"
HIRISE_ORTHO = "MSR_hirise_soc_003_Orthomosaic_0.25m_Eqc_latTs0_lon0_First_NoBlend.tif"
MAX_HIRISE_HALB_METER = 1500.0
MAX_PATCH_HALBE_METER = 45000.0
MAX_PATCH_ZELLEN_JE_SEITE = 420
INFORMELLE_ORTE = [
    {"name": "Western Delta", "latitude": 18.51, "longitude": 77.39, "kind": "Delta (informal name, approximate position)", "diameter_km": 8.0, "official": False, "origin": "Informal name used by the Mars 2020 team for the western fan deposit.", "source_url": "https://science.nasa.gov/mission/mars-2020-perseverance/"},
]


class Place(ApiModel):
    name: str
    latitude: float
    longitude: float
    kind: str
    diameter_km: float
    official: bool
    origin: str
    source_url: str


class TerrainSample(ApiModel):
    latitude: float
    longitude: float
    has_data: bool
    elevation_meters: float | None = None
    slope_degrees: float | None = None
    dataset: str | None = None
    validated: bool | None = None
    aspect_degrees: float | None = None
    aspect_compass: str | None = None
    thermal_inertia: float | None = None
    geology_unit: str | None = None
    distance_to_landing_meters: float | None = None


class TerrainPatch(ApiModel):
    rows: int
    cols: int
    cell_meters: float
    west_x: float
    north_y: float
    sphere_radius_meters: float
    cos_standard_parallel: float
    min_elevation_meters: float
    max_elevation_meters: float
    gap_fraction: float
    elevations_base64: str


class ProfileRequest(ApiModel):
    waypoints: list[MarsCoordinate] = Field(min_length=2, max_length=400)


class RouteProfile(ApiModel):
    cumulative_meters: list[float]
    cumulative_seconds: list[float]
    cumulative_joules: list[float]
    slope_degrees: list[float]
    power_watts: list[float]


def _dem():
    pfad = dem_pfad()
    if not pfad.is_file():
        raise HTTPException(status_code=503, detail="The elevation model is not available.")
    return rasterio.open(pfad)


def _nachbar(name: str) -> Path:
    return dem_pfad().with_name(name)


@lru_cache(maxsize=1)
def _orte(grenzen: tuple[float, float, float, float]) -> list[Place]:
    west, sued, ost, nord = grenzen
    ergebnis = [Place(**ort) for ort in INFORMELLE_ORTE]
    if not GAZETTEER.is_file():
        return ergebnis
    leser = shapefile.Reader(str(GAZETTEER))
    for eintrag in leser.iterRecords():
        daten = eintrag.as_dict()
        laenge = float(daten["center_lon"]) % 360.0
        breite = float(daten["center_lat"])
        if not (west <= laenge <= ost and sued <= breite <= nord):
            continue
        ergebnis.append(
            Place(
                name=daten["name"],
                latitude=breite,
                longitude=laenge,
                kind=str(daten["type"]).split(",")[0],
                diameter_km=float(daten["diameter"] or 0.0),
                official=True,
                origin=str(daten.get("origin") or ""),
                source_url=str(daten.get("link") or "https://planetarynames.wr.usgs.gov/"),
            )
        )
    return sorted(ergebnis, key=lambda ort: -ort.diameter_km)


@karte.get("/places", response_model=list[Place], response_model_by_alias=True)
def places() -> list[Place]:
    with _dem() as src:
        xs = [src.bounds.left, src.bounds.right]
        ys = [src.bounds.bottom, src.bounds.top]
        lons, lats = transform(src.crs, MARS_GEOGRAPHIC, xs, ys)
    return _orte((lons[0], lats[0], lons[1], lats[1]))


@karte.get("/terrain/sample", response_model=TerrainSample, response_model_by_alias=True)
def terrain_sample(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=360)) -> TerrainSample:
    with _dem() as src:
        xs, ys = transform(MARS_GEOGRAPHIC, src.crs, [longitude], [latitude])
        row, col = src.index(xs[0], ys[0])
        leer = TerrainSample(latitude=latitude, longitude=longitude, has_data=False)
        if not (0 <= row < src.height and 0 <= col < src.width):
            return leer
        wert = float(src.read(1, window=Window(col, row, 1, 1))[0, 0])
        if wert < -1e30 or not math.isfinite(wert):
            return leer
        exposition = None
        steigung = None
        if 1 <= row < src.height - 1 and 1 <= col < src.width - 1:
            kern = src.read(1, window=Window(col - 1, row - 1, 3, 3)).astype(np.float64)
            if np.all(kern > -1e30):
                h = float(src.res[0])
                nach_osten = (kern[1, 2] - kern[1, 0]) / (2 * h)
                nach_norden = (kern[0, 1] - kern[2, 1]) / (2 * h)
                grad = math.hypot(nach_osten, nach_norden)
                if grad > math.tan(math.radians(1.0)):
                    exposition = (math.degrees(math.atan2(-nach_osten, -nach_norden)) + 360.0) % 360.0
                steigung = math.degrees(math.atan(grad))
    pfad = _nachbar("region_slope_20m.tif")
    if pfad.is_file():
        with rasterio.open(pfad) as slope:
            s = float(slope.read(1, window=Window(col, row, 1, 1))[0, 0])
            steigung = s if s > -9000 else steigung
    datensatz, geprueft = "USGS CTX DEM Jezero 20 m", True
    pfad = _nachbar("region_quelle_20m.tif")
    if pfad.is_file():
        with rasterio.open(pfad) as quelle:
            if int(quelle.read(1, window=Window(col, row, 1, 1))[0, 0]) == 2:
                datensatz, geprueft = "Caltech CTX multistrip NE Syrtis (resampled to 20 m, shifted, not rover-checked)", False
    himmelsrichtungen = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    abstand = horizontal_meters(MarsCoordinate(latitude=latitude, longitude=longitude), LANDEPLATZ)
    return TerrainSample(
        latitude=latitude, longitude=longitude, has_data=True, elevation_meters=round(wert, 1),
        slope_degrees=None if steigung is None else round(steigung, 1), dataset=datensatz, validated=geprueft,
        aspect_degrees=None if exposition is None else round(exposition, 0),
        aspect_compass=None if exposition is None else himmelsrichtungen[int(round(exposition / 45.0)) % 8],
        thermal_inertia=_thermik(latitude, longitude), geology_unit=_geologie(latitude, longitude),
        distance_to_landing_meters=round(abstand, 0),
    )


LANDEPLATZ = MarsCoordinate(latitude=18.44462715, longitude=77.45088572)
ROH_ORDNER = Path(__file__).resolve().parent.parent / "data" / "raw"


def _wert_aus(pfad: Path, latitude: float, longitude: float):
    if not pfad.is_file():
        return None
    with rasterio.open(pfad) as quelle:
        xs, ys = transform(MARS_GEOGRAPHIC, quelle.crs, [longitude], [latitude])
        zeile, spalte = quelle.index(xs[0], ys[0])
        if not (0 <= zeile < quelle.height and 0 <= spalte < quelle.width):
            return None
        wert = float(quelle.read(1, window=Window(spalte, zeile, 1, 1))[0, 0])
        if not math.isfinite(wert) or wert == quelle.nodata or wert < -1e30:
            return None
        return wert


def _thermik(latitude: float, longitude: float) -> float | None:
    wert = _wert_aus(ROH_ORDNER / "Jezero_Thermal_Inertia_v1.tiff", latitude, longitude)
    return None if wert is None or wert <= 0 else round(wert, 0)


@lru_cache(maxsize=1)
def _geologie_legende() -> dict[int, str]:
    pfad = ROH_ORDNER / "derived" / "geologie_legende.json"
    if not pfad.is_file():
        return {}
    return {int(e["klasse"]): f'{e["name"]} ({e["symbol"]})' for e in json.loads(pfad.read_text(encoding="utf-8"))}


def _geologie(latitude: float, longitude: float) -> str | None:
    klasse = _wert_aus(ROH_ORDNER / "derived" / "geologie_20m.tif", latitude, longitude)
    return None if klasse is None or klasse <= 0 else _geologie_legende().get(int(klasse))


def _fenster(src, latitude: float, longitude: float, half_meters: float) -> Window:
    xs, ys = transform(MARS_GEOGRAPHIC, src.crs, [longitude], [latitude])
    row, col = src.index(xs[0], ys[0])
    if not (0 <= row < src.height and 0 <= col < src.width):
        raise HTTPException(status_code=422, detail="The point is outside the elevation model.")
    halb = int(half_meters / src.res[0])
    links, oben = max(0, col - halb), max(0, row - halb)
    rechts, unten = min(src.width, col + halb + 1), min(src.height, row + halb + 1)
    return Window(links, oben, rechts - links, unten - oben)


@karte.get("/terrain/patch", response_model=TerrainPatch, response_model_by_alias=True)
def terrain_patch(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=360),
    half_meters: float = Query(default=2500.0, ge=200.0, le=MAX_PATCH_HALBE_METER, alias="halfMeters"),
) -> TerrainPatch:
    with _dem() as src:
        fenster = _fenster(src, latitude, longitude, half_meters)
        faktor = max(1, math.ceil(max(fenster.width, fenster.height) / MAX_PATCH_ZELLEN_JE_SEITE))
        fenster = Window(fenster.col_off, fenster.row_off, max(faktor, fenster.width // faktor * faktor), max(faktor, fenster.height // faktor * faktor))
        form = (int(fenster.height // faktor), int(fenster.width // faktor))
        maskiert = src.read(1, window=fenster, out_shape=form, resampling=Resampling.average, masked=True)
        daten = maskiert.astype(np.float32).filled(np.nan)
        ecke = src.window_transform(fenster)
        parallele = float(src.crs.to_dict().get("lat_ts", 0.0))
        zelle = float(src.res[0]) * faktor
    luecken = (daten < -1e30) | ~np.isfinite(daten)
    if luecken.all():
        raise HTTPException(status_code=422, detail="There is no elevation data around this point.")
    tiefster = float(daten[~luecken].min())
    daten[luecken] = tiefster
    return TerrainPatch(
        rows=daten.shape[0], cols=daten.shape[1], cell_meters=zelle, west_x=ecke.c, north_y=ecke.f,
        sphere_radius_meters=3396190.0, cos_standard_parallel=math.cos(math.radians(parallele)),
        min_elevation_meters=tiefster, max_elevation_meters=float(daten.max()), gap_fraction=float(luecken.mean()),
        elevations_base64=base64.b64encode(daten.astype("<f4").tobytes()).decode("ascii"),
    )


@karte.get("/terrain/patch-image")
def terrain_patch_image(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=360),
    half_meters: float = Query(default=2500.0, ge=200.0, le=MAX_PATCH_HALBE_METER, alias="halfMeters"),
) -> Response:
    pfad = _nachbar("region_ortho_10m.tif")
    if not pfad.is_file():
        pfad = _nachbar("M20_JezeroCrater_CTXortho_mosaic_5m.tif")
    if not pfad.is_file():
        raise HTTPException(status_code=503, detail="The image mosaic is not available.")
    with _dem() as src:
        fenster = _fenster(src, latitude, longitude, half_meters)
        grenzen = rasterio.windows.bounds(fenster, src.transform)
    with rasterio.open(pfad) as bild:
        ausschnitt = rasterio.windows.from_bounds(*grenzen, transform=bild.transform)
        breite = min(1024, max(2, int(ausschnitt.width)))
        hoehe = min(1024, max(2, int(ausschnitt.height)))
        daten = bild.read(1, window=ausschnitt, out_shape=(hoehe, breite), resampling=Resampling.bilinear, boundless=True, fill_value=0)
    with MemoryFile() as speicher:
        with speicher.open(driver="PNG", width=breite, height=hoehe, count=1, dtype="uint8") as ziel:
            ziel.write(daten.astype(np.uint8), 1)
        return Response(content=speicher.read(), media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@karte.post("/routes/profile", response_model=RouteProfile, response_model_by_alias=True)
def route_profile(request: ProfileRequest) -> RouteProfile:
    punkte = request.waypoints
    if any(p.elevation_meters is None for p in punkte):
        raise HTTPException(status_code=422, detail="All waypoints need an elevation.")
    meter, sekunden, joule, steigung, leistung = [0.0], [0.0], [0.0], [0.0], [float(pandolf_watt(0.0))]
    for a, b in zip(punkte, punkte[1:]):
        flach = horizontal_meters(a, b)
        hoehe = b.elevation_meters - a.elevation_meters
        strecke = math.hypot(flach, hoehe)
        meter.append(meter[-1] + strecke)
        sekunden.append(sekunden[-1] + strecke / GEHTEMPO_METER_PRO_SEKUNDE)
        joule.append(joule[-1] + (step_energy_joule(flach, hoehe) if flach > 0 else 0.0))
        steigung.append(math.degrees(math.atan2(hoehe, flach)) if flach > 0 else 0.0)
        leistung.append(float(pandolf_watt(hoehe / flach * 100.0)) if flach > 0 else leistung[-1])
    return RouteProfile(cumulative_meters=meter, cumulative_seconds=sekunden, cumulative_joules=joule, slope_degrees=steigung, power_watts=leistung)


def _hirise_fenster(src, latitude: float, longitude: float, half_meters: float) -> Window:
    xs, ys = transform(MARS_GEOGRAPHIC, src.crs, [longitude], [latitude])
    row, col = src.index(xs[0], ys[0])
    if not (0 <= row < src.height and 0 <= col < src.width):
        raise HTTPException(status_code=404, detail="No HiRISE coverage at this point.")
    halb = int(half_meters / src.res[0])
    links, oben = max(0, col - halb), max(0, row - halb)
    rechts, unten = min(src.width, col + halb + 1), min(src.height, row + halb + 1)
    return Window(links, oben, rechts - links, unten - oben)


@karte.get("/terrain/hirise-patch", response_model=TerrainPatch, response_model_by_alias=True)
def hirise_patch(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=360),
    half_meters: float = Query(default=600.0, ge=100.0, le=MAX_HIRISE_HALB_METER, alias="halfMeters"),
) -> TerrainPatch:
    pfad = HIRISE_ORDNER / HIRISE_DTM
    if not pfad.is_file():
        raise HTTPException(status_code=404, detail="No HiRISE coverage at this point.")
    with rasterio.open(pfad) as src:
        fenster = _hirise_fenster(src, latitude, longitude, half_meters)
        faktor = max(1, math.ceil(max(fenster.width, fenster.height) / MAX_PATCH_ZELLEN_JE_SEITE))
        fenster = Window(fenster.col_off, fenster.row_off, max(faktor, fenster.width // faktor * faktor), max(faktor, fenster.height // faktor * faktor))
        form = (int(fenster.height // faktor), int(fenster.width // faktor))
        daten = src.read(1, window=fenster, out_shape=form, resampling=Resampling.average, masked=True).astype(np.float32).filled(np.nan)
        ecke = src.window_transform(fenster)
        zelle = float(src.res[0]) * faktor
    luecken = (daten < -1e30) | ~np.isfinite(daten)
    if luecken.mean() > 0.5:
        raise HTTPException(status_code=404, detail="No HiRISE coverage at this point.")
    tiefster = float(daten[~luecken].min())
    daten[luecken] = float(np.nanmedian(daten[~luecken]))
    return TerrainPatch(
        rows=daten.shape[0], cols=daten.shape[1], cell_meters=zelle, west_x=ecke.c, north_y=ecke.f,
        sphere_radius_meters=3396190.0, cos_standard_parallel=1.0,
        min_elevation_meters=tiefster, max_elevation_meters=float(daten.max()), gap_fraction=float(luecken.mean()),
        elevations_base64=base64.b64encode(daten.astype("<f4").tobytes()).decode("ascii"),
    )


@karte.get("/terrain/hirise-image")
def hirise_image(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=360),
    half_meters: float = Query(default=600.0, ge=100.0, le=MAX_HIRISE_HALB_METER, alias="halfMeters"),
) -> Response:
    pfad_dtm, pfad_bild = HIRISE_ORDNER / HIRISE_DTM, HIRISE_ORDNER / HIRISE_ORTHO
    if not (pfad_dtm.is_file() and pfad_bild.is_file()):
        raise HTTPException(status_code=404, detail="No HiRISE coverage at this point.")
    with rasterio.open(pfad_dtm) as dtm:
        fenster = _hirise_fenster(dtm, latitude, longitude, half_meters)
        faktor = max(1, math.ceil(max(fenster.width, fenster.height) / MAX_PATCH_ZELLEN_JE_SEITE))
        fenster = Window(fenster.col_off, fenster.row_off, max(faktor, fenster.width // faktor * faktor), max(faktor, fenster.height // faktor * faktor))
        grenzen = rasterio.windows.bounds(fenster, dtm.transform)
    with rasterio.open(pfad_bild) as bild:
        ausschnitt = rasterio.windows.from_bounds(*grenzen, transform=bild.transform)
        breite = min(2048, max(2, int(ausschnitt.width)))
        hoehe = min(2048, max(2, int(ausschnitt.height)))
        daten = bild.read(1, window=ausschnitt, out_shape=(hoehe, breite), resampling=Resampling.average, boundless=True, fill_value=0)
    with MemoryFile() as speicher:
        with speicher.open(driver="PNG", width=breite, height=hoehe, count=1, dtype="uint8") as ziel:
            ziel.write(daten.astype(np.uint8), 1)
        return Response(content=speicher.read(), media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
