import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.data import KACHELN_STANDARD
from app.main import _erlaubte_herkuenfte, app
from app.terrain import DEM_STANDARD

client = TestClient(app)
START = {"latitude": 18.38, "longitude": 77.58}
ZIEL = {"latitude": 18.44, "longitude": 77.45}
MIT_DEM = pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
MIT_KACHELN = pytest.mark.skipif(not (KACHELN_STANDARD / "ctx_dem" / "metadata.json").is_file(), reason="Kacheln nicht lokal vorhanden")


def test_duplicate_objectives_are_rejected():
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL, "objectives": ["energy_min", "energy_min"]})
    assert antwort.status_code == 422


def test_unknown_objective_is_rejected():
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL, "objectives": ["schoen"]})
    assert antwort.status_code == 422


def test_unknown_science_point_is_rejected():
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL, "sciencePointIds": ["gibt-es-nicht"]})
    assert antwort.status_code == 422
    assert "Unbekannter Science Point" in antwort.json()["detail"]


def test_too_many_stops_are_rejected():
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL, "via": [START] * 4})
    assert antwort.status_code == 422


def test_plan_without_dem_returns_503(monkeypatch, tmp_path):
    monkeypatch.setenv("MARS_DEM_PATH", str(tmp_path / "fehlt.tif"))
    assert client.post("/api/routes/plan", json={"start": START, "end": ZIEL}).status_code == 503


@MIT_DEM
def test_plan_returns_each_objective_with_provenance():
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL})
    assert antwort.status_code == 200
    routen = {route["objective"]: route for route in antwort.json()}
    assert set(routen) == {"energy_min", "distance_min", "slope_hazard_min"}
    assert routen["energy_min"]["tags"] == ["energy_optimal"]
    assert routen["distance_min"]["tags"] == ["shortest"]
    assert routen["slope_hazard_min"]["tags"] == ["lowest_hazard"]
    assert routen["distance_min"]["distanceMeters"] <= min(r["distanceMeters"] for r in routen.values()) + 1e-6
    assert routen["energy_min"]["energyJoules"] <= min(r["energyJoules"] for r in routen.values()) + 1e-6
    for route in routen.values():
        assert route["datasetId"] == "M20_JezeroCrater_CTXDEM_20m"
        assert route["sourceMode"] == "live-dem"
        assert route["routingGridResolutionMeters"] >= route["nativeResolutionMeters"] - 1e-6
        assert route["maxSlopeDeg"] <= 15.0 + 1e-6
        assert route["modelVersion"]
        assert route["waypointCount"] == len(route["waypoints"])
        assert abs(route["waypointLengthDifferencePercent"]) < 5
    budget = [c for c in routen["slope_hazard_min"]["constraints"] if "Energiebudget" in c]
    assert budget


@MIT_DEM
def test_plan_with_science_stop_visits_the_stop_and_sums_the_legs():
    punkte = {p["id"]: p for p in client.get("/api/science-points").json()}
    ziel = punkte["probe-14-15"]["location"]
    antwort = client.post(
        "/api/routes/plan",
        json={"start": START, "end": ZIEL, "objectives": ["energy_min"], "sciencePointIds": ["probe-14-15"]},
    )
    assert antwort.status_code == 200
    route = antwort.json()[0]
    assert route["visitedSciencePointIds"] == ["probe-14-15"]
    assert len(route["legs"]) == 2
    assert route["legs"][0]["toId"] == "probe-14-15"
    assert sum(leg["energyJoules"] for leg in route["legs"]) == pytest.approx(route["energyJoules"], rel=1e-6)
    naechster = min(
        math.hypot(
            (w["latitude"] - ziel["latitude"]) * 59275.0,
            (w["longitude"] - ziel["longitude"]) * 59275.0 * math.cos(math.radians(ziel["latitude"])),
        )
        for w in route["waypoints"]
    )
    assert naechster <= route["routingGridResolutionMeters"] * 1.5
    direkt = client.post("/api/routes/calculate", json={"start": START, "end": ZIEL}).json()
    assert route["energyJoules"] > direkt["energyJoules"]


@MIT_DEM
def test_steep_via_stop_is_rejected_with_reason():
    antwort = client.post(
        "/api/routes/plan",
        json={"start": START, "end": ZIEL, "via": [{"latitude": 18.064, "longitude": 77.517}]},
    )
    assert antwort.status_code == 422
    assert "Zwischenstopp" in antwort.json()["detail"]


@MIT_DEM
def test_alternatives_carry_provenance_and_objective():
    routen = client.post("/api/routes/alternatives", json={"start": START, "end": ZIEL, "count": 2}).json()
    assert routen[0]["objective"] == "energy_min"
    assert all(r["sourceMode"] == "live-dem" for r in routen)
    assert all(r["objective"] in ("energy_min", "alternative_corridor") for r in routen)


def test_ready_reports_missing_data(monkeypatch, tmp_path):
    monkeypatch.setenv("MARS_DEM_PATH", str(tmp_path / "fehlt.tif"))
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    antwort = client.get("/ready")
    assert antwort.status_code == 503
    assert "Geländemodell fehlt" in antwort.json()["detail"]


@MIT_DEM
@MIT_KACHELN
def test_ready_with_data():
    assert client.get("/ready").status_code == 200


def test_cors_origins_can_be_extended(monkeypatch):
    monkeypatch.setenv("MARS_CORS_ORIGINS", "https://demo.example, https://zweite.example")
    herkunft = _erlaubte_herkuenfte()
    assert "http://localhost:3000" in herkunft
    assert "https://demo.example" in herkunft and "https://zweite.example" in herkunft
