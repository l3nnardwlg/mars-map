from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class MarsCoordinate(ApiModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    elevation_meters: float | None = None


class MarsRoute(ApiModel):
    id: str
    waypoints: list[MarsCoordinate]
    distance_meters: float = Field(ge=0)
    estimated_duration_seconds: float = Field(ge=0)
    risk_score: float = Field(ge=0, le=1)
    energy_joules: float | None = Field(default=None, ge=0)
    average_power_watts: float | None = Field(default=None, ge=0)


class SciencePoint(ApiModel):
    id: str
    name: str
    location: MarsCoordinate
    description: str
    nasa_source_url: str


class BoundingBox(ApiModel):
    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float


class TerrainMetadata(ApiModel):
    region_name: str
    coordinate_system: str
    elevation_reference: str
    bounds: BoundingBox
    resolution_meters_per_pixel: float
    available_tiles: list[str]


class Layer(ApiModel):
    id: str
    name: str
    description: str
    source_url: str
    kind: str | None = None
    unit: str | None = None
    tile_set: str | None = None
    available: bool = False


class RouteRequest(ApiModel):
    start: MarsCoordinate
    end: MarsCoordinate


class AlternativesRequest(RouteRequest):
    count: int = Field(default=3, ge=1, le=5)


class MissionRequest(ApiModel):
    route: MarsRoute
    crew_size: int = Field(ge=1, le=6)


class MissionEstimate(ApiModel):
    duration_seconds: float
    oxygen_liters: float
    energy_watt_hours: float
    oxygen_kilograms: float
    average_power_watts: float
    eva_time_limit_seconds: float
    within_eva_time_limit: bool
    within_average_metabolic_rate: bool
