import math

from app.models import MarsCoordinate, MarsRoute, MissionAssumptions, MissionEstimate
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
VALIDITY_SCOPE = "Planungsschätzung (screening estimate) mit den genannten Annahmen, nicht sicherheitszertifiziert und keine Vorhersage für einen realen Einsatz"


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
        gravity_treatment="1-g-Modell nach Pandolf et al. ohne Mars-Schwerkraft-Kalibrierung (0,38 g); Richtung einer Verzerrung durch Anzugmasse und reduzierte Schwerkraft unbestimmt",
        downhill_treatment="Gefälle wird wie ebener Boden gerechnet",
        max_slope_degrees=MAX_STEIGUNG_GRAD,
        eva_time_limit_seconds=MAX_EVA_SEKUNDEN,
        average_metabolic_rate_limit_watts=MITTLERE_STOFFWECHSELRATE_WATT,
        peak_metabolic_rate_limit_watts=MAX_STOFFWECHSELRATE_WATT,
        oxygen_joules_per_kilogram=JOULE_PRO_KG_SAUERSTOFF,
    )


def simulate(route_or_waypoints: MarsRoute | list[MarsCoordinate], crew_size: int) -> MissionEstimate:
    if isinstance(route_or_waypoints, MarsRoute):
        route = route_or_waypoints
        if any(point.elevation_meters is None for point in route.waypoints):
            raise MissingElevationError("Alle Wegpunkte brauchen eine Hoehe")
        if route.energy_joules is not None and route.energy_joules > 0:
            distance = route.distance_meters
            duration = route.estimated_duration_seconds
            energy_per_person = route.energy_joules
            peak_power = route.peak_power_watts if route.peak_power_watts is not None else (
                route.average_power_watts or 0.0
            )
        else:
            waypoints = route.waypoints
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
    else:
        waypoints = route_or_waypoints
        if any(point.elevation_meters is None for point in waypoints):
            raise MissingElevationError("Alle Wegpunkte brauchen eine Hoehe")
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
    oxygen_kg = energy_per_person / JOULE_PRO_KG_SAUERSTOFF
    average_power = energy_per_person / duration if duration > 0 else 0.0
    within_time = duration <= MAX_EVA_SEKUNDEN
    within_average = average_power <= MITTLERE_STOFFWECHSELRATE_WATT
    within_peak = peak_power <= MAX_STOFFWECHSELRATE_WATT
    warnings = []
    if not within_time:
        warnings.append("Die Gehzeit überschreitet die EVA-Grenze von 8 Stunden.")
    if not within_average:
        warnings.append("Die mittlere Leistung überschreitet 350 W.")
    if not within_peak:
        warnings.append("Einzelne Abschnitte überschreiten die Spitzenleistung von 530 W.")
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
        radiation_basis="Referenzwert MSL RAD, Gale-Krater, 0,21 mGy pro Tag je Person (Hassler et al. 2014), nicht in Jezero gemessen",
        validity_scope=VALIDITY_SCOPE,
        assumptions=annahmen(),
        warnings=warnings,
    )
