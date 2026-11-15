import math

from app.models import MarsCoordinate, MissionAssumptions, MissionEstimate
from app.nasa_werte import (
    GELAENDEFAKTOR,
    GEHTEMPO_METER_PRO_SEKUNDE,
    JOULE_PRO_KG_SAUERSTOFF,
    KOERPERMASSE_KG,
    MAX_EVA_SEKUNDEN,
    MAX_STEIGUNG_GRAD,
    MAX_STOFFWECHSELRATE_WATT,
    MITTLERE_STOFFWECHSELRATE_WATT,
    SAUERSTOFF_DICHTE_KG_PRO_LITER,
    STRAHLUNG_MILLIGRAY_PRO_TAG,
    ZUSATZLAST_KG,
    pandolf_watt,
)
from app.routing import step_energy_joule

MARS_RADIUS_METERS = 3396190.0
VALIDITY_SCOPE = "Screening estimate with the stated assumptions, not safety-certified and not a forecast for a real EVA"


class MissingElevationError(Exception):
    pass


def horizontal_meters(a: MarsCoordinate, b: MarsCoordinate) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    d_lat = lat2 - lat1
    d_lon = math.radians(b.longitude - a.longitude)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * MARS_RADIUS_METERS * math.asin(math.sqrt(h))


def annahmen() -> MissionAssumptions:
    return MissionAssumptions(
        body_mass_kg=KOERPERMASSE_KG,
        suit_load_kg=ZUSATZLAST_KG,
        walking_speed_meters_per_second=GEHTEMPO_METER_PRO_SEKUNDE,
        terrain_factor=GELAENDEFAKTOR,
        gravity_treatment="no adjustment for Mars gravity (the Pandolf equation applies at 1 g)",
        downhill_treatment="downhill is treated as level ground",
        max_slope_degrees=MAX_STEIGUNG_GRAD,
        eva_time_limit_seconds=MAX_EVA_SEKUNDEN,
        average_metabolic_rate_limit_watts=MITTLERE_STOFFWECHSELRATE_WATT,
        peak_metabolic_rate_limit_watts=MAX_STOFFWECHSELRATE_WATT,
        oxygen_joules_per_kilogram=JOULE_PRO_KG_SAUERSTOFF,
    )


def simulate(waypoints: list[MarsCoordinate], crew_size: int, route_energy_joules: float | None = None, route_duration_seconds: float | None = None) -> MissionEstimate:
    if any(point.elevation_meters is None for point in waypoints):
        raise MissingElevationError("All waypoints need an elevation")
    distance = 0.0
    energy_per_person = 0.0
    peak_power = 0.0
    for a, b in zip(waypoints, waypoints[1:]):
        flat = horizontal_meters(a, b)
        if flat == 0.0:
            continue
        rise = b.elevation_meters - a.elevation_meters
        distance += math.hypot(flat, rise)
        energy_per_person += step_energy_joule(flat, rise)
        peak_power = max(peak_power, float(pandolf_watt(rise / flat * 100.0)))
    duration = distance / GEHTEMPO_METER_PRO_SEKUNDE
    if route_energy_joules is not None and route_duration_seconds:
        energy_per_person = route_energy_joules
        duration = route_duration_seconds
    oxygen_kg = energy_per_person / JOULE_PRO_KG_SAUERSTOFF
    average_power = energy_per_person / duration if duration > 0 else 0.0
    within_time = duration <= MAX_EVA_SEKUNDEN
    within_average = average_power <= MITTLERE_STOFFWECHSELRATE_WATT
    within_peak = peak_power <= MAX_STOFFWECHSELRATE_WATT
    warnings = []
    if not within_time:
        warnings.append("The walking time exceeds the 8 hour EVA limit.")
    if not within_average:
        warnings.append("The average power exceeds 350 W.")
    if not within_peak:
        warnings.append("Some sections exceed the 530 W peak limit.")
    return MissionEstimate(
        duration_seconds=duration,
        oxygen_liters=oxygen_kg / SAUERSTOFF_DICHTE_KG_PRO_LITER * crew_size,
        energy_watt_hours=energy_per_person / 3600.0 * crew_size,
        oxygen_kilograms=oxygen_kg * crew_size,
        average_power_watts=average_power,
        eva_time_limit_seconds=MAX_EVA_SEKUNDEN,
        within_eva_time_limit=within_time,
        within_average_metabolic_rate=within_average,
        peak_power_watts=peak_power,
        within_peak_metabolic_rate=within_peak,
        radiation_dose_milligray=STRAHLUNG_MILLIGRAY_PRO_TAG * duration / 86400.0,
        radiation_basis="Reference value MSL RAD, Gale crater, 0.21 mGy per day per person (Hassler et al. 2014), not measured in Jezero",
        validity_scope=VALIDITY_SCOPE,
        assumptions=annahmen(),
        warnings=warnings,
    )
