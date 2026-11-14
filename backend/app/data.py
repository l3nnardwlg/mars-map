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


LAYERS = [
    Layer(
        id="mola",
        name="MOLA Hoehenmodell",
        description="Globales Hoehenmodell des Mars Orbiter Laser Altimeter",
        source_url="https://pds-geosciences.wustl.edu/missions/mgs/megdr.html",
    ),
    Layer(
        id="hirise",
        name="HiRISE",
        description="Hochaufloesende Orbitalbilder des Mars Reconnaissance Orbiter",
        source_url="https://www.uahirise.org/",
    ),
    Layer(
        id="ctx",
        name="CTX",
        description="Kontextbilder des Mars Reconnaissance Orbiter",
        source_url="https://murray-lab.caltech.edu/CTX/",
    ),
]

SCIENCE_POINTS: list[SciencePoint] = []
