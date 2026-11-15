from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.terrain import DEM_STANDARD

client = TestClient(app)
MIT_DEM = pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")


@MIT_DEM
def test_places_contain_official_names_inside_the_model():
    orte = client.get("/api/places").json()
    namen = {o["name"] for o in orte}
    assert "Jezero" in namen and "Neretva Vallis" in namen
    assert all(o["sourceUrl"] for o in orte)


@MIT_DEM
def test_sample_returns_elevation_inside_and_no_data_outside():
    innen = client.get("/api/terrain/sample", params={"latitude": 18.44, "longitude": 77.45}).json()
    assert innen["hasData"] is True
    assert -2700 < innen["elevationMeters"] < -2400
    aussen = client.get("/api/terrain/sample", params={"latitude": 0.0, "longitude": 10.0}).json()
    assert aussen["hasData"] is False and aussen["elevationMeters"] is None


@MIT_DEM
def test_patch_has_consistent_size_and_limits():
    antwort = client.get("/api/terrain/patch", params={"latitude": 18.44, "longitude": 77.45, "halfMeters": 1000})
    assert antwort.status_code == 200
    patch = antwort.json()
    import base64
    assert len(base64.b64decode(patch["elevationsBase64"])) == patch["rows"] * patch["cols"] * 4
    assert patch["cellMeters"] == 20.0
    assert client.get("/api/terrain/patch", params={"latitude": 18.44, "longitude": 77.45, "halfMeters": 99999}).status_code == 422
    assert client.get("/api/terrain/patch", params={"latitude": 0.0, "longitude": 10.0}).status_code == 422


def test_profile_matches_mission_energy():
    punkte = [
        {"latitude": 18.4, "longitude": 77.5, "elevationMeters": -2500},
        {"latitude": 18.401, "longitude": 77.5, "elevationMeters": -2495},
        {"latitude": 18.402, "longitude": 77.5, "elevationMeters": -2499},
    ]
    profil = client.post("/api/routes/profile", json={"waypoints": punkte}).json()
    route = {"id": "t", "waypoints": punkte, "distanceMeters": 1, "estimatedDurationSeconds": 1, "riskScore": 0}
    mission = client.post("/api/mission/simulate", json={"route": route, "crewSize": 1}).json()
    assert profil["cumulativeJoules"][-1] / 3600.0 == pytest.approx(mission["energyWattHours"], rel=1e-9)
    assert profil["cumulativeSeconds"][-1] == pytest.approx(mission["durationSeconds"], rel=1e-9)
    assert profil["slopeDegrees"][1] > 0 > profil["slopeDegrees"][2]


def test_profile_needs_elevations():
    punkte = [{"latitude": 18.4, "longitude": 77.5}, {"latitude": 18.401, "longitude": 77.5}]
    assert client.post("/api/routes/profile", json={"waypoints": punkte}).status_code == 422


MIT_HIRISE = pytest.mark.skipif(
    not (Path(DEM_STANDARD).parent / "hirise").is_dir(), reason="HiRISE nicht lokal vorhanden"
)


@MIT_HIRISE
def test_hirise_patch_inside_and_outside_coverage():
    innen = client.get("/api/terrain/hirise-patch", params={"latitude": 18.44, "longitude": 77.45 - 0.01, "halfMeters": 500})
    assert innen.status_code in (200, 404)
    aussen = client.get("/api/terrain/hirise-patch", params={"latitude": 19.5, "longitude": 77.45})
    assert aussen.status_code == 404
    assert client.get("/api/terrain/hirise-patch", params={"latitude": 18.3, "longitude": 77.2, "halfMeters": 99999}).status_code == 422


@MIT_DEM
def test_sample_has_aspect_distance_and_optional_context():
    probe = client.get("/api/terrain/sample", params={"latitude": 18.40, "longitude": 77.45}).json()
    assert probe["hasData"] is True
    assert 0 < probe["distanceToLandingMeters"] < 10000
    if probe["aspectDegrees"] is not None:
        assert 0 <= probe["aspectDegrees"] < 360 and probe["aspectCompass"] in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
