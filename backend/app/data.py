from app.models import BoundingBox, Layer, SciencePoint, TerrainMetadata

TERRAIN = TerrainMetadata(
    region_name="Jezero Crater",
    coordinate_system="IAU Mars 2000, planetozentrisch, Laenge nach Osten positiv",
    elevation_reference="MOLA Areoid",
    bounds=BoundingBox(
        min_latitude=17.9,
        max_latitude=18.9,
        min_longitude=77.0,
        max_longitude=78.2,
    ),
    resolution_meters_per_pixel=0.0,
    available_tiles=[],
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
