import math

from app.models import MarsCoordinate, MissionEstimate
from app.nasa_werte import (
    GEHTEMPO_METER_PRO_SEKUNDE,
    JOULE_PRO_KG_SAUERSTOFF,
    MAX_EVA_SEKUNDEN,
    MITTLERE_STOFFWECHSELRATE_WATT,
    SAUERSTOFF_DICHTE_KG_PRO_LITER,
)
from app.routing import step_energy_joule

MARS_RADIUS_METERS = 3396190.0


class MissingElevationError(Exception):
    pass


def horizontal_meters(a: MarsCoordinate, b: MarsCoordinate) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    d_lat = lat2 - lat1
    d_lon = math.radians(b.longitude - a.longitude)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * MARS_RADIUS_METERS * math.asin(math.sqrt(h))


def simulate(waypoints: list[MarsCoordinate], crew_size: int) -> MissionEstimate:
    if any(point.elevation_meters is None for point in waypoints):
        raise MissingElevationError("Alle Wegpunkte brauchen eine Hoehe")
    distance = 0.0
    energy_per_person = 0.0
    for a, b in zip(waypoints, waypoints[1:]):
        flat = horizontal_meters(a, b)
        if flat == 0.0:
            continue
        rise = b.elevation_meters - a.elevation_meters
        distance += math.hypot(flat, rise)
        energy_per_person += step_energy_joule(flat, rise)
    duration = distance / GEHTEMPO_METER_PRO_SEKUNDE
    oxygen_kg = energy_per_person / JOULE_PRO_KG_SAUERSTOFF
    average_power = energy_per_person / duration if duration > 0 else 0.0
    return MissionEstimate(
        duration_seconds=duration,
        oxygen_liters=oxygen_kg / SAUERSTOFF_DICHTE_KG_PRO_LITER * crew_size,
        energy_watt_hours=energy_per_person / 3600.0 * crew_size,
        oxygen_kilograms=oxygen_kg * crew_size,
        average_power_watts=average_power,
        eva_time_limit_seconds=MAX_EVA_SEKUNDEN,
        within_eva_time_limit=duration <= MAX_EVA_SEKUNDEN,
        within_average_metabolic_rate=average_power <= MITTLERE_STOFFWECHSELRATE_WATT,
    )
