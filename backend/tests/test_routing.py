from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, pandolf_watt
from app.routing import MAX_SLOPE_DEGREES, NoRouteError, find_path, measure_path, slope_degrees
from app.terrain import DEM_STANDARD

client = TestClient(app)


def test_flat_terrain_gives_straight_path_without_risk():
    elevation = np.zeros((30, 30))
    path, slope = find_path(elevation, 10.0, (15, 2), (15, 27))
    distance, duration, risk, energy = measure_path(path, elevation, slope, 10.0)
    assert distance == pytest.approx(250.0)
    assert duration == pytest.approx(250.0 / GEHTEMPO_METER_PRO_SEKUNDE)
    assert energy == pytest.approx(pandolf_watt(0.0) * duration)
    assert risk == 0.0


def test_path_goes_around_steep_wall_through_gap():
    elevation = np.zeros((40, 40))
    elevation[:, 20] = 500.0
    elevation[30:33, 20] = 0.0
    path, slope = find_path(elevation, 10.0, (5, 5), (5, 35))
    assert any(col == 20 and 28 <= row <= 34 for row, col in path)
    assert all(slope[row, col] <= MAX_SLOPE_DEGREES for row, col in path)


def test_closed_wall_has_no_route():
    elevation = np.zeros((20, 20))
    elevation[:, 10] = 500.0
    with pytest.raises(NoRouteError):
        find_path(elevation, 10.0, (10, 2), (10, 17))


def test_slope_of_known_ramp():
    ramp = np.tile(np.arange(10) * 10.0, (10, 1))
    assert slope_degrees(ramp, 10.0)[5, 5] == pytest.approx(45.0)


def test_climb_is_slower_and_riskier_than_flat():
    flat = np.zeros((20, 20))
    hill = np.tile(np.arange(20) * 2.0, (20, 1))
    results = []
    for elevation in (flat, hill):
        path, slope = find_path(elevation, 10.0, (10, 1), (10, 18))
        results.append(measure_path(path, elevation, slope, 10.0))
    assert results[1][1] > results[0][1]
    assert results[1][2] > results[0][2]
    assert results[1][3] > results[0][3]


def test_pandolf_formula_matches_nasa_equation():
    assert pandolf_watt(0.0) == pytest.approx(1.5 * 80.7 + 80.7 * 1.5 * GEHTEMPO_METER_PRO_SEKUNDE**2)
    assert pandolf_watt(20.0) > pandolf_watt(10.0) > pandolf_watt(0.0)
    assert pandolf_watt(-10.0) == pandolf_watt(0.0)


def test_route_without_dem_returns_503(monkeypatch, tmp_path):
    monkeypatch.setenv("MARS_DEM_PATH", str(tmp_path / "fehlt.tif"))
    payload = {"start": {"latitude": 18.4, "longitude": 77.5}, "end": {"latitude": 18.5, "longitude": 77.6}}
    assert client.post("/api/routes/calculate", json=payload).status_code == 503


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_route_on_real_jezero_dem():
    payload = {"start": {"latitude": 18.44, "longitude": 77.45}, "end": {"latitude": 18.40, "longitude": 77.55}}
    body = client.post("/api/routes/calculate", json=payload).json()
    assert len(body["waypoints"]) >= 2
    assert 6000 < body["distanceMeters"] < 12000
    assert 0 <= body["riskScore"] <= 1
    assert body["estimatedDurationSeconds"] >= body["distanceMeters"]
    assert "elevationMeters" in body["waypoints"][0]


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_route_outside_dem_returns_422():
    payload = {"start": {"latitude": 0.0, "longitude": 10.0}, "end": {"latitude": 18.4, "longitude": 77.5}}
    assert client.post("/api/routes/calculate", json=payload).status_code == 422
