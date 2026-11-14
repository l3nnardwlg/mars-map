import json
import os
from pathlib import Path

from app.models import BoundingBox, Layer, SciencePoint, TerrainMetadata

KACHELN_STANDARD = Path(__file__).resolve().parent.parent / "data" / "tiles"


def kachelordner() -> Path:
    return Path(os.environ.get("MARS_TILES_DIR", KACHELN_STANDARD))


def lade_kachelinfos(ordner: Path) -> list[dict]:
    if not ordner.is_dir():
        return []
    infos = []
    for datei in sorted(ordner.glob("*/metadata.json")):
        infos.append(json.loads(datei.read_text(encoding="utf-8")))
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
    vorhanden = {info["name"] for info in lade_kachelinfos(ordner)}
    return [layer.model_copy(update={"available": layer.tile_set in vorhanden}) for layer in LAYER_KATALOG]


SCIENCE_POINTS: list[SciencePoint] = [
    SciencePoint.model_validate(eintrag)
    for eintrag in json.loads((Path(__file__).parent / "science_points.json").read_text(encoding="utf-8"))
]
