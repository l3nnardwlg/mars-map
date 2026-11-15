import json
import os
from pathlib import Path

from app.models import BoundingBox, Layer, LegendEntry, SciencePoint, TerrainMetadata

KACHELN_STANDARD = Path(__file__).resolve().parent.parent / "data" / "tiles"


def kachelordner() -> Path:
    return Path(os.environ.get("MARS_TILES_DIR", KACHELN_STANDARD))


def lade_kachelinfos(ordner: Path) -> list[dict]:
    if not ordner.is_dir():
        return []
    infos = []
    for datei in sorted(ordner.glob("*/metadata.json")):
        try:
            info = json.loads(datei.read_text(encoding="utf-8"))
            layer_dir = datei.parent
            # B4 / B2-P0-04: Validate whether actual tiles (*.png) exist in the tile set
            has_tiles = any(layer_dir.glob("*/*/*.png")) or any(layer_dir.glob("*.png"))
            info["has_tiles"] = has_tiles
            infos.append(info)
        except Exception:
            continue
    return infos


def terrain_metadaten(ordner: Path) -> TerrainMetadata:
    infos = lade_kachelinfos(ordner)
    grenzen = BoundingBox(
        min_latitude=17.58,
        max_latitude=19.29,
        min_longitude=76.99,
        max_longitude=78.58,
    )
    aufloesung = 0.0
    if infos:
        gesamt = max(infos, key=lambda info: info["bounds"]["north"] - info["bounds"]["south"])["bounds"]
        grenzen = BoundingBox(
            min_latitude=gesamt["south"],
            max_latitude=gesamt["north"],
            min_longitude=gesamt["west"],
            max_longitude=gesamt["east"],
        )
        aufloesung = min(info["meterProPixelFeinsteStufe"] for info in infos)
    return TerrainMetadata(
        region_name="Jezero Crater",
        coordinate_system="IAU Mars 2000, planetozentrisch, Laenge nach Osten positiv",
        elevation_reference="MOLA Areoid",
        bounds=grenzen,
        resolution_meters_per_pixel=aufloesung,
        available_tiles=[info["name"] for info in infos],
    )


LAYER_KATALOG = [
    Layer(
        id="ctx_dem",
        name="CTX Hoehenmodell (20 m)",
        description="Hoehenmodell des Jezero-Kraters aus MRO-CTX-Stereobildern, an MOLA gebunden. Grundlage des Routings",
        source_url="https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic",
        kind="hoehe",
        unit="m",
        tile_set="ctx_dem",
    ),
    Layer(
        id="hirise_dem",
        name="HiRISE Hoehenmodell (1 m)",
        description="Hochaufloesendes Hoehenmodell der Landestelle und der westlichen Kraterkante aus MRO-HiRISE-Stereobildern",
        source_url="https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic",
        kind="hoehe",
        unit="m",
        tile_set="hirise_dem",
    ),
    Layer(
        id="slope_ctx",
        name="Steigung (aus CTX-DEM)",
        description="Hangneigung in Grad, aus dem CTX-DEM per Zentraldifferenz berechnet. Gleiche Grundlage wie das Routing, dort gelten ab 15 Grad Sperrzellen",
        source_url="https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic",
        kind="steigung",
        unit="Grad",
        tile_set="slope_ctx",
    ),
    Layer(
        id="ctx_ortho",
        name="CTX Orthobild (5 m)",
        description="Entzerrtes Graustufenbild des Jezero-Kraters aus MRO-CTX, passend zum CTX-Hoehenmodell",
        source_url="https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic",
        kind="bild",
        unit="Grauwert",
        tile_set="ctx_ortho",
    ),
    Layer(
        id="geology",
        name="Geologische Einheiten (SIM 3464)",
        description="Geologische Karte von Jezero-Krater und Nili Planum (Sun und Stack 2020, 1:75 000), 14 Einheiten als Klassenraster, Legende in `legend`. Deckt nur 76,80 bis 77,80 O und 17,70 bis 18,70 N ab. Die Karte liegt auf einem halbkontrollierten CTX-Mosaik und weicht laut USGS um etwa 100 bis 200 m vom kontrollierten CTX-Mosaik ab, auf dem unser Hoehenmodell beruht",
        source_url="https://pubs.usgs.gov/publication/sim3464",
        kind="geologie",
        unit="Klasse",
        tile_set="geology",
    ),
    Layer(
        id="thermal_inertia",
        name="THEMIS Waermetraegheit (100 m)",
        description="Thermische Traegheit der Oberflaeche aus Nachtaufnahmen von Mars Odyssey THEMIS. Hohe Werte stehen fuer Fels, niedrige fuer Staub und Sand. Rund ein Drittel des Kraters ist ohne Daten",
        source_url="https://zenodo.org/records/4931348",
        kind="thermik",
        unit="J m-2 K-1 s-1/2",
        tile_set="thermal_inertia",
    ),
]


def layer_liste(ordner: Path) -> list[Layer]:
    infos = {info["name"]: info for info in lade_kachelinfos(ordner)}
    ergebnis = []
    for layer in LAYER_KATALOG:
        info = infos.get(layer.tile_set)
        legende = None
        if info and info.get("legende"):
            legende = [
                LegendEntry(class_id=e["klasse"], name=e["name"], symbol=e["symbol"], color=e["farbe"])
                for e in info["legende"]
            ]
        has_tiles = bool(info and info.get("has_tiles"))
        if info is not None and has_tiles:
            status = "ready"
            available = True
        elif info is not None and not has_tiles:
            status = "partial"
            available = False
        else:
            status = "not-built"
            available = False

        zusatz: dict = {"available": available, "legend": legende, "status": status}
        if info is not None:
            grenzen = info["bounds"]
            zusatz.update(
                coverage=BoundingBox(
                    min_latitude=grenzen["south"],
                    max_latitude=grenzen["north"],
                    min_longitude=grenzen["west"],
                    max_longitude=grenzen["east"],
                ),
                zoom_min=info.get("minZoom"),
                zoom_max=info.get("maxZoom"),
                codec=info.get("kodierung"),
                native_resolution_meters=info.get("meterProPixelFeinsteStufe"),
            )
        ergebnis.append(layer.model_copy(update=zusatz))
    return ergebnis


SCIENCE_POINTS: list[SciencePoint] = [
    SciencePoint.model_validate(eintrag)
    for eintrag in json.loads((Path(__file__).parent / "science_points.json").read_text(encoding="utf-8"))
]
