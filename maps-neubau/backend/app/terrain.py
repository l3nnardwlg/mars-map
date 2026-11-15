import math
import os
import threading
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import transform
from rasterio.windows import Window

from app.routing import NoRouteError, _Graph, find_alternatives, measure_path, objective_value, path_statistics

MARS_GEOGRAPHIC = CRS.from_string("+proj=longlat +R=3396190 +no_defs")
DEM_STANDARD = Path(__file__).resolve().parent.parent / "data" / "raw" / "M20_JezeroCrater_CTXDEM_20m.tif"
MAX_CELLS = 400_000
MAX_WAYPOINTS = 200
PADDING_METERS = 2000.0
DATASET_ID = "M20_JezeroCrater_CTXDEM_20m"
DATASET_ID_REGION = "REGION_JezeroCTX20m_NESyrtisCTX"
HEIGHT_DATUM = "MOLA Areoid (CTX-DEM, an MOLA gebunden)"
MODEL_VERSION = "2026-11-15"
HAZARD_ENERGY_BUDGET_FACTOR = 2.0
TAGS_JE_ZIEL = {"energy_min": "energy_optimal", "distance_min": "shortest", "slope_hazard_min": "lowest_hazard"}


class OutsideTerrainError(Exception):
    pass


class DemUnavailableError(Exception):
    pass


class UnknownScienceStopError(Exception):
    pass


def dem_pfad() -> Path:
    return Path(os.environ.get("MARS_DEM_PATH", DEM_STANDARD))


def pixel_of(src, latitude: float, longitude: float, label: str = "The point") -> tuple[int, int]:
    xs, ys = transform(MARS_GEOGRAPHIC, src.crs, [longitude], [latitude])
    row, col = src.index(xs[0], ys[0])
    if not (0 <= row < src.height and 0 <= col < src.width):
        raise OutsideTerrainError(f"{label} is outside the elevation model.")
    return row, col


def _fenster(src, pixel_punkte: list[tuple[int, int]]):
    zeilen = [p[0] for p in pixel_punkte]
    spalten = [p[1] for p in pixel_punkte]
    pad = int(PADDING_METERS / src.res[0])
    top, bottom = max(0, min(zeilen) - pad), min(src.height, max(zeilen) + pad + 1)
    left, right = max(0, min(spalten) - pad), min(src.width, max(spalten) + pad + 1)
    height, width = bottom - top, right - left
    factor = max(1, math.ceil(math.sqrt(height * width / MAX_CELLS)))
    out_h, out_w = max(2, height // factor), max(2, width // factor)
    window = Window(left, top, width, height)
    data = src.read(1, window=window, out_shape=(out_h, out_w), resampling=Resampling.average, masked=True)
    elevation = data.astype(np.float64).filled(np.nan)
    win_transform = src.window_transform(window) @ rasterio.Affine.scale(width / out_w, height / out_h)
    cell_meters = float(src.res[0]) * width / out_w

    def to_cell(row: int, col: int) -> tuple[int, int]:
        return (
            min(out_h - 1, int((row - top) * out_h / height)),
            min(out_w - 1, int((col - left) * out_w / width)),
        )

    return elevation, win_transform, cell_meters, float(src.res[0]), to_cell


def _anteil_syrtis(xs: list[float], ys: list[float]) -> float:
    pfad = dem_pfad().with_name("region_quelle_20m.tif")
    if not pfad.is_file() or not xs:
        return 0.0
    with rasterio.open(pfad) as quelle:
        codes = [int(wert[0]) for wert in quelle.sample(list(zip(xs, ys)))]
    return sum(1 for code in codes if code == 2) / len(codes)


def _gewaehlte_indizes(path, slope, erzwungen: set[int]) -> list[int]:
    schritt = max(1, math.ceil(len(path) / MAX_WAYPOINTS))
    indizes = set(range(0, len(path), schritt))
    indizes.add(len(path) - 1)
    indizes |= erzwungen
    steilster = max(range(len(path)), key=lambda i: slope[path[i][0], path[i][1]])
    indizes.add(steilster)
    return sorted(indizes)


def _linienlaenge(zellen, elevation, cell_meters) -> float:
    gesamt = 0.0
    for (r1, c1), (r2, c2) in zip(zellen, zellen[1:]):
        flach = math.hypot(r2 - r1, c2 - c1) * cell_meters
        gesamt += math.hypot(flach, float(elevation[r2, c2] - elevation[r1, c1]))
    return gesamt


def _route_dict(path, slope, elevation, cell_meters, native_meters, win_transform, crs, erzwungen_indizes: set[int] | None = None) -> dict:
    distance, duration, risk, energy = measure_path(path, elevation, slope, cell_meters)
    mean_slope, max_slope = path_statistics(path, slope)
    indizes = _gewaehlte_indizes(path, slope, erzwungen_indizes or set())
    gewaehlt = [path[i] for i in indizes]
    xs = [win_transform.a * (c + 0.5) + win_transform.b * (r + 0.5) + win_transform.c for r, c in gewaehlt]
    ys = [win_transform.d * (c + 0.5) + win_transform.e * (r + 0.5) + win_transform.f for r, c in gewaehlt]
    lons, lats = transform(crs, MARS_GEOGRAPHIC, xs, ys)
    waypoints = [
        {"latitude": lat, "longitude": lon, "elevation_meters": float(elevation[r, c])}
        for lat, lon, (r, c) in zip(lats, lons, gewaehlt)
    ]
    voll = _linienlaenge(path, elevation, cell_meters)
    gekuerzt = _linienlaenge(gewaehlt, elevation, cell_meters)
    unterschied = (gekuerzt - voll) / voll * 100.0 if voll > 0 else 0.0
    warnungen = []
    dataset_id = DATASET_ID
    anteil_syrtis = _anteil_syrtis(xs, ys)
    if anteil_syrtis > 0:
        dataset_id = DATASET_ID_REGION
        warnungen.append(
            f"{anteil_syrtis * 100:.0f} % of the route is in the NE Syrtis model (Caltech CTX multistrip). "
            "It is not checked against rover positions, was shifted by about 480 m to match the Jezero model and differs from it by about 24 m (RMSE) where both overlap."
        )
    if cell_meters > native_meters * 1.05:
        warnungen.append(
            f"Searched on a {cell_meters:.0f} m grid (native {native_meters:.0f} m). Small obstacles and steep edges can be missed."
        )
    if abs(unterschied) > 2.0:
        warnungen.append(f"The {len(waypoints)} waypoints are {abs(unterschied):.1f} % shorter than the calculated path.")
    return {
        "waypoints": waypoints,
        "distance_meters": distance,
        "estimated_duration_seconds": duration,
        "risk_score": risk,
        "energy_joules": energy,
        "average_power_watts": energy / duration if duration > 0 else 0.0,
        "max_slope_deg": round(max_slope, 2),
        "mean_slope_deg": round(mean_slope, 2),
        "dataset_id": dataset_id,
        "native_resolution_meters": native_meters,
        "routing_grid_resolution_meters": round(cell_meters, 2),
        "height_datum": HEIGHT_DATUM,
        "model_version": MODEL_VERSION,
        "source_mode": "live-dem",
        "waypoint_count": len(waypoints),
        "waypoint_length_difference_percent": round(unterschied, 3),
        "warnings": warnungen,
    }


_SPERREN: dict = {}
_SPERREN_LOCK = threading.Lock()


def _mit_sperre(schluessel, funktion):
    with _SPERREN_LOCK:
        if len(_SPERREN) > 256:
            _SPERREN.clear()
        sperre = _SPERREN.setdefault(schluessel, threading.Lock())
    with sperre:
        return funktion(*schluessel)


def _dateistand() -> tuple[Path, int]:
    pfad = dem_pfad()
    if not pfad.is_file():
        raise DemUnavailableError("The elevation model is not available.")
    return pfad, pfad.stat().st_mtime_ns


def plan_routes(start: tuple[float, float], end: tuple[float, float], count: int) -> list[dict]:
    pfad, aenderung = _dateistand()
    schluessel = ("alt", round(start[0], 6), round(start[1], 6), round(end[0], 6), round(end[1], 6), count, str(pfad), aenderung)
    return _mit_sperre(schluessel, _plan_routes_cached)


@lru_cache(maxsize=64)
def _plan_routes_cached(art: str, start_lat: float, start_lon: float, end_lat: float, end_lon: float, count: int, pfad_text: str, aenderung: int) -> list[dict]:
    start, end, pfad = (start_lat, start_lon), (end_lat, end_lon), Path(pfad_text)
    with rasterio.open(pfad) as src:
        (r1, c1), (r2, c2) = pixel_of(src, *start, "The start"), pixel_of(src, *end, "The destination")
        elevation, win_transform, cell_meters, native_meters, to_cell = _fenster(src, [(r1, c1), (r2, c2)])
        routes = []
        for path, slope in find_alternatives(elevation, cell_meters, to_cell(r1, c1), to_cell(r2, c2), count):
            routes.append(_route_dict(path, slope, elevation, cell_meters, native_meters, win_transform, src.crs))
    for route in routes:
        route["tags"] = []
    routes[0]["tags"].append("energy_optimal")
    routes[0]["objective"] = "energy_min"
    routes[0]["objective_value"] = routes[0]["energy_joules"]
    routes[0]["objective_unit"] = "J"
    routes[min(range(len(routes)), key=lambda i: routes[i]["risk_score"])]["tags"].append("lowest_risk")
    routes[min(range(len(routes)), key=lambda i: routes[i]["distance_meters"])]["tags"].append("shortest")
    for route in routes[1:]:
        route["objective"] = "alternative_corridor"
    for route in routes:
        route["constraints"] = ["Cells over 15 degrees blocked, alternatives in a penalty corridor, at most 1.6 times the energy of the best route"]
    return routes


def plan_route(start: tuple[float, float], end: tuple[float, float]) -> dict:
    return plan_routes(start, end, 1)[0]


def plan_objectives(
    start: tuple[float, float],
    end: tuple[float, float],
    stops: list[tuple[float, float, str | None]],
    objectives: list[str],
) -> list[dict]:
    pfad, aenderung = _dateistand()
    schluessel = (
        "ziel",
        round(start[0], 6), round(start[1], 6), round(end[0], 6), round(end[1], 6),
        tuple((round(s[0], 6), round(s[1], 6), s[2]) for s in stops),
        tuple(objectives), str(pfad), aenderung,
    )
    return _mit_sperre(schluessel, _plan_objectives_cached)


@lru_cache(maxsize=32)
def _plan_objectives_cached(art, start_lat, start_lon, end_lat, end_lon, stops, objectives, pfad_text, aenderung) -> list[dict]:
    punkte = [(start_lat, start_lon, "The start", None)]
    punkte += [(lat, lon, f"The stop {stop_id}" if stop_id else f"The stop {i + 1}", stop_id) for i, (lat, lon, stop_id) in enumerate(stops)]
    punkte.append((end_lat, end_lon, "The destination", None))
    with rasterio.open(Path(pfad_text)) as src:
        pixel = [pixel_of(src, lat, lon, label) for lat, lon, label, _ in punkte]
        elevation, win_transform, cell_meters, native_meters, to_cell = _fenster(src, pixel)
        zellen = [to_cell(r, c) for r, c in pixel]
        graph = _Graph(elevation, cell_meters)
        for (lat, lon, label, _), zelle in zip(punkte, zellen):
            if not graph.passable[zelle]:
                raise NoRouteError(f"{label} is on ground that is too steep (over 15 degrees). Please pick a flatter point.")
        ergebnisse = []
        for ziel in objectives:
            gesamt, teilwege = graph.weg_ueber_punkte(zellen, ziel)
            erzwungen = set()
            position = 0
            for teil in teilwege[:-1]:
                position += len(teil) - 1
                erzwungen.add(position)
            route = _route_dict(gesamt, graph.slope, elevation, cell_meters, native_meters, win_transform, src.crs, erzwungen)
            wert, einheit = objective_value(ziel, gesamt, elevation, graph.slope, cell_meters)
            route["objective"] = ziel
            route["objective_value"] = wert
            route["objective_unit"] = einheit
            route["tags"] = [TAGS_JE_ZIEL[ziel]]
            route["visited_science_point_ids"] = [stop[2] for stop in stops if stop[2]]
            legs = []
            for index, teil in enumerate(teilwege):
                weg_distanz, weg_dauer, _, weg_energie = measure_path(teil, elevation, graph.slope, cell_meters)
                legs.append({"to_id": punkte[index + 1][3], "distance_meters": weg_distanz, "energy_joules": weg_energie, "estimated_duration_seconds": weg_dauer})
            route["legs"] = legs
            route["constraints"] = ["Cells over 15 degrees blocked, diagonals only with free neighbour cells"]
            ergebnisse.append(route)
        energie_min = next((r for r in ergebnisse if r["objective"] == "energy_min"), None)
        if energie_min is None:
            energie_min = {"energy_joules": measure_path(graph.weg_ueber_punkte(zellen, "energy_min")[0], elevation, graph.slope, cell_meters)[3]}
        for route in ergebnisse:
            if route["objective"] == "slope_hazard_min":
                faktor = route["energy_joules"] / energie_min["energy_joules"] if energie_min["energy_joules"] > 0 else 1.0
                zustand = "met" if faktor <= HAZARD_ENERGY_BUDGET_FACTOR else "exceeded"
                route["constraints"].append(f"Energy budget {HAZARD_ENERGY_BUDGET_FACTOR:.1f} times the energy optimum: {faktor:.2f} times, {zustand}")
                if zustand == "exceeded":
                    route["warnings"].append("The lowest-hazard route needs more than twice the energy of the lowest-energy route.")
    return ergebnisse


BENCHMARK_START = (18.38, 77.58)
BENCHMARK_END = (18.44, 77.45)


def vorwaermen() -> None:
    for anzahl in (1, 3):
        try:
            plan_routes(BENCHMARK_START, BENCHMARK_END, anzahl)
        except (DemUnavailableError, OutsideTerrainError):
            return
