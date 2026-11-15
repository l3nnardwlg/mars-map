from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class MarsCoordinate(ApiModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    elevation_meters: float | None = None


class RouteLeg(ApiModel):
    to_id: str | None = None
    distance_meters: float = Field(ge=0)
    energy_joules: float = Field(ge=0)
    estimated_duration_seconds: float = Field(ge=0)


class MarsRoute(ApiModel):
    id: str
    waypoints: list[MarsCoordinate]
    distance_meters: float = Field(ge=0)
    estimated_duration_seconds: float = Field(ge=0)
    risk_score: float = Field(ge=0, le=1)
    energy_joules: float | None = Field(default=None, ge=0)
    average_power_watts: float | None = Field(default=None, ge=0)
    tags: list[str] = Field(default_factory=list)
    objective: str | None = None
    objective_value: float | None = None
    objective_unit: str | None = None
    constraints: list[str] = Field(default_factory=list)
    visited_science_point_ids: list[str] = Field(default_factory=list)
    legs: list[RouteLeg] = Field(default_factory=list)
    max_slope_deg: float | None = None
    mean_slope_deg: float | None = None
    dataset_id: str | None = None
    native_resolution_meters: float | None = None
    routing_grid_resolution_meters: float | None = None
    height_datum: str | None = None
    model_version: str | None = None
    source_mode: str | None = None
    waypoint_count: int | None = None
    waypoint_length_difference_percent: float | None = None
    warnings: list[str] = Field(default_factory=list)


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


class LegendEntry(ApiModel):
    class_id: int
    name: str
    symbol: str
    color: str


class Layer(ApiModel):
    id: str
    name: str
    description: str
    source_url: str
    kind: str | None = None
    unit: str | None = None
    tile_set: str | None = None
    available: bool = False
    status: str = "not-built"
    legend: list[LegendEntry] | None = None
    coverage: BoundingBox | None = None
    zoom_min: int | None = None
    zoom_max: int | None = None
    codec: str | None = None
    native_resolution_meters: float | None = None


class RouteRequest(ApiModel):
    start: MarsCoordinate
    end: MarsCoordinate


class AlternativesRequest(RouteRequest):
    count: int = Field(default=3, ge=1, le=5)


ObjectiveName = Literal["energy_min", "distance_min", "slope_hazard_min"]


class PlanRequest(RouteRequest):
    objectives: list[ObjectiveName] = Field(default_factory=lambda: ["energy_min", "distance_min", "slope_hazard_min"], min_length=1, max_length=3)
    science_point_ids: list[str] = Field(default_factory=list, max_length=3)
    via: list[MarsCoordinate] = Field(default_factory=list, max_length=3)


class MissionRequest(ApiModel):
    route: MarsRoute
    crew_size: int = Field(ge=1, le=6)


class MissionAssumptions(ApiModel):
    body_mass_kg: float
    suit_load_kg: float
    walking_speed_meters_per_second: float
    terrain_factor: float
    gravity_treatment: str
    downhill_treatment: str
    max_slope_degrees: float
    eva_time_limit_seconds: float
    average_metabolic_rate_limit_watts: float
    peak_metabolic_rate_limit_watts: float
    oxygen_joules_per_kilogram: float


class MissionEstimate(ApiModel):
    duration_seconds: float
    oxygen_liters: float
    energy_watt_hours: float
    oxygen_kilograms: float
    average_power_watts: float
    eva_time_limit_seconds: float
    within_eva_time_limit: bool
    within_average_metabolic_rate: bool
    peak_power_watts: float | None = None
    within_peak_metabolic_rate: bool | None = None
    radiation_dose_milligray: float | None = None
    radiation_basis: str | None = None
    validity_scope: str | None = None
    assumptions: MissionAssumptions | None = None
    warnings: list[str] = Field(default_factory=list)
