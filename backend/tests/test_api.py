import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_terrain_metadata_uses_camel_case(monkeypatch, tmp_path):
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    body = client.get("/api/terrain/metadata").json()
    assert body["regionName"] == "Jezero Crater"
    assert body["bounds"]["minLatitude"] < body["bounds"]["maxLatitude"]
    assert body["availableTiles"] == []


def test_layers_have_source_urls():
    layers = client.get("/api/layers").json()
    assert {layer["id"] for layer in layers} == {"mola", "hirise", "ctx"}
    assert all(layer["sourceUrl"].startswith("https://") for layer in layers)


def test_science_points_are_inside_jezero_with_nasa_sources():
    punkte = client.get("/api/science-points").json()
    ids = {punkt["id"] for punkt in punkte}
    assert {"perseverance-landung", "gazetteer-jezero", "gazetteer-neretva-vallis"} <= ids
    assert len(ids) == len(punkte)
    for punkt in punkte:
        assert 17.58 <= punkt["location"]["latitude"] <= 19.29
        assert 76.99 <= punkt["location"]["longitude"] <= 78.58
        assert punkt["nasaSourceUrl"].startswith("https://")
        assert punkt["description"]


def test_landing_site_matches_nasa_waypoint():
    landung = next(p for p in client.get("/api/science-points").json() if p["id"] == "perseverance-landung")
    assert landung["location"]["latitude"] == pytest.approx(18.4446, abs=1e-3)
    assert landung["location"]["longitude"] == pytest.approx(77.4509, abs=1e-3)
    assert landung["location"]["elevationMeters"] == pytest.approx(-2570, abs=10)


def test_route_rejects_invalid_latitude():
    payload = {
        "start": {"latitude": 95, "longitude": 77.5},
        "end": {"latitude": 18.4, "longitude": 77.6},
    }
    assert client.post("/api/routes/calculate", json=payload).status_code == 422


def test_terrain_metadata_reads_tile_info(monkeypatch, tmp_path):
    ordner = tmp_path / "ctx_dem"
    ordner.mkdir()
    (ordner / "metadata.json").write_text(
        '{"name": "ctx_dem", "bounds": {"west": 77.0, "south": 17.6, "east": 78.6, "north": 19.3},'
        ' "meterProPixelFeinsteStufe": 12.4}',
        encoding="utf-8",
    )
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    body = client.get("/api/terrain/metadata").json()
    assert body["availableTiles"] == ["ctx_dem"]
    assert body["bounds"]["minLatitude"] == 17.6
    assert body["resolutionMetersPerPixel"] == 12.4
