import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, JOULE_PRO_KG_SAUERSTOFF, pandolf_watt

client = TestClient(app)


def route(points):
    return {
        "id": "test",
        "waypoints": [{"latitude": lat, "longitude": lon, "elevationMeters": h} for lat, lon, h in points],
        "distanceMeters": 0,
        "estimatedDurationSeconds": 0,
        "riskScore": 0,
    }


def test_joule_per_kg_oxygen_matches_apollo_example():
    assert JOULE_PRO_KG_SAUERSTOFF == pytest.approx(14.11e6, rel=0.01)


def test_flat_walk_of_one_kilometer():
    meter_in_grad = 1000.0 / (3396190.0 * 3.141592653589793 / 180.0)
    payload = {"route": route([(18.4, 77.5, -2500), (18.4 + meter_in_grad, 77.5, -2500)]), "crewSize": 1}
    body = client.post("/api/mission/simulate", json=payload).json()
    zeit = 1000.0 / GEHTEMPO_METER_PRO_SEKUNDE
    assert body["durationSeconds"] == pytest.approx(zeit, rel=1e-3)
    assert body["averagePowerWatts"] == pytest.approx(pandolf_watt(0.0), rel=1e-3)
    assert body["energyWattHours"] == pytest.approx(pandolf_watt(0.0) * zeit / 3600.0, rel=1e-3)
    assert body["oxygenKilograms"] == pytest.approx(pandolf_watt(0.0) * zeit / JOULE_PRO_KG_SAUERSTOFF, rel=1e-3)
    assert body["withinEvaTimeLimit"] is True
    assert body["withinAverageMetabolicRate"] is True


def test_crew_size_scales_totals():
    punkte = [(18.4, 77.5, -2500), (18.41, 77.5, -2480)]
    eins = client.post("/api/mission/simulate", json={"route": route(punkte), "crewSize": 1}).json()
    zwei = client.post("/api/mission/simulate", json={"route": route(punkte), "crewSize": 2}).json()
    assert zwei["oxygenKilograms"] == pytest.approx(2 * eins["oxygenKilograms"])
    assert zwei["durationSeconds"] == pytest.approx(eins["durationSeconds"])


def test_long_route_exceeds_eva_limit():
    payload = {"route": route([(18.0, 77.5, -2500), (19.0, 77.5, -2500)]), "crewSize": 1}
    body = client.post("/api/mission/simulate", json=payload).json()
    assert body["withinEvaTimeLimit"] is False


def test_missing_elevation_is_rejected():
    punkte = {"id": "x", "waypoints": [{"latitude": 18.4, "longitude": 77.5}, {"latitude": 18.5, "longitude": 77.5}],
              "distanceMeters": 0, "estimatedDurationSeconds": 0, "riskScore": 0}
    assert client.post("/api/mission/simulate", json={"route": punkte, "crewSize": 1}).status_code == 422


def test_radiation_reference_scales_with_duration():
    punkte = [(18.4, 77.5, -2500), (18.41, 77.5, -2480)]
    antwort = client.post("/api/mission/simulate", json={"route": route(punkte), "crewSize": 2}).json()
    erwartet = 0.210 * antwort["durationSeconds"] / 86400.0
    assert antwort["radiationDoseMilligray"] == pytest.approx(erwartet)
    assert "Gale" in antwort["radiationBasis"]


def test_mission_states_assumptions_scope_and_peak_power():
    flach = [(18.4, 77.5, -2500), (18.4 + 0.0001, 77.5, -2500)]
    steil = [(18.4, 77.5, -2500), (18.4 + 0.0001, 77.5, -2480)]
    antwort_flach = client.post("/api/mission/simulate", json={"route": route(flach), "crewSize": 1}).json()
    antwort_steil = client.post("/api/mission/simulate", json={"route": route(steil), "crewSize": 1}).json()
    assert "nicht sicherheitszertifiziert" in antwort_flach["validityScope"]
    annahmen = antwort_flach["assumptions"]
    assert annahmen["bodyMassKg"] == 80.7 and annahmen["suitLoadKg"] == 0.0
    assert "Mars-Schwerkraft" in annahmen["gravityTreatment"]
    assert antwort_steil["peakPowerWatts"] > antwort_flach["peakPowerWatts"]
    assert antwort_flach["withinPeakMetabolicRate"] is True
    assert antwort_steil["withinPeakMetabolicRate"] is False
    assert any("530 W" in w for w in antwort_steil["warnings"])
