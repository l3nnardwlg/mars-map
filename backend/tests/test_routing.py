from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, pandolf_watt
from app.routing import MAX_SLOPE_DEGREES, NoRouteError, find_alternatives, find_path, measure_path, slope_degrees
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
    assert body["energyJoules"] > 0
    assert body["averagePowerWatts"] == pytest.approx(body["energyJoules"] / body["estimatedDurationSeconds"])
    assert body["averagePowerWatts"] >= pandolf_watt(0.0) - 1e-6


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_route_outside_dem_returns_422():
    payload = {"start": {"latitude": 0.0, "longitude": 10.0}, "end": {"latitude": 18.4, "longitude": 77.5}}
    assert client.post("/api/routes/calculate", json=payload).status_code == 422


def test_alternative_goes_through_other_gap():
    elevation = np.zeros((60, 60))
    elevation[:, 30] = 500.0
    elevation[10:13, 30] = 0.0
    elevation[45:48, 30] = 0.0
    ergebnisse = find_alternatives(elevation, 10.0, (30, 5), (30, 55), 2)
    assert len(ergebnisse) == 2
    luecken = [next(row for row, col in path if col == 30) for path, _ in ergebnisse]
    assert min(luecken) < 20 < 40 < max(luecken)


def test_no_alternative_when_only_one_way():
    elevation = np.zeros((40, 40))
    elevation[:, 20] = 500.0
    elevation[18:21, 20] = 0.0
    assert len(find_alternatives(elevation, 10.0, (20, 5), (20, 35), 3)) == 1


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_alternatives_endpoint_on_real_dem():
    payload = {"start": {"latitude": 18.44, "longitude": 77.45}, "end": {"latitude": 18.40, "longitude": 77.55}, "count": 3}
    antwort = client.post("/api/routes/alternatives", json=payload)
    routen = antwort.json()
    assert antwort.status_code == 200
    assert 1 <= len(routen) <= 3
    einzel = client.post("/api/routes/calculate", json={k: payload[k] for k in ("start", "end")}).json()
    assert routen[0]["energyJoules"] == pytest.approx(einzel["energyJoules"])
    assert all(r["energyJoules"] <= routen[0]["energyJoules"] * 1.6 + 1 for r in routen)


def test_identical_concurrent_requests_are_computed_one_at_a_time(monkeypatch, tmp_path):
    import threading
    import time

    from app import terrain

    dem = tmp_path / "dem.tif"
    dem.write_bytes(b"")
    monkeypatch.setenv("MARS_DEM_PATH", str(dem))
    gleichzeitig = {"jetzt": 0, "max": 0, "aufrufe": 0}
    zaehler = threading.Lock()

    def langsam(*args):
        with zaehler:
            gleichzeitig["jetzt"] += 1
            gleichzeitig["max"] = max(gleichzeitig["max"], gleichzeitig["jetzt"])
            gleichzeitig["aufrufe"] += 1
        time.sleep(0.2)
        with zaehler:
            gleichzeitig["jetzt"] -= 1
        return [{"id": "x"}]

    monkeypatch.setattr(terrain, "_plan_routes_cached", langsam)
    terrain._SPERREN.clear()
    threads = [threading.Thread(target=terrain.plan_routes, args=((18.4, 77.5), (18.5, 77.6), 3)) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert gleichzeitig["max"] == 1
    assert gleichzeitig["aufrufe"] == 4


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_parallel_identical_alternatives_requests_search_only_once(monkeypatch):
    import threading

    from app import terrain

    terrain._plan_routes_cached.cache_clear()
    suchen = []
    original = terrain.find_alternatives

    def zaehlend(*args, **kwargs):
        suchen.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(terrain, "find_alternatives", zaehlend)
    ergebnisse = []
    start, ende = (18.43, 77.46), (18.41, 77.50)
    threads = [threading.Thread(target=lambda: ergebnisse.append(terrain.plan_routes(start, ende, 2))) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(suchen) == 1
    assert len(ergebnisse) == 3
