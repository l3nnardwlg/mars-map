from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_terrain_metadata_uses_camel_case():
    body = client.get("/api/terrain/metadata").json()
    assert body["regionName"] == "Jezero Crater"
    assert body["bounds"]["minLatitude"] < body["bounds"]["maxLatitude"]
    assert body["availableTiles"] == []


def test_layers_have_source_urls():
    layers = client.get("/api/layers").json()
    assert {layer["id"] for layer in layers} == {"mola", "hirise", "ctx"}
    assert all(layer["sourceUrl"].startswith("https://") for layer in layers)


def test_science_points_is_list():
    assert client.get("/api/science-points").json() == []


def test_route_rejects_invalid_latitude():
    payload = {
        "start": {"latitude": 95, "longitude": 77.5},
        "end": {"latitude": 18.4, "longitude": 77.6},
    }
    assert client.post("/api/routes/calculate", json=payload).status_code == 422


def test_route_not_implemented_yet():
    payload = {
        "start": {"latitude": 18.4, "longitude": 77.5},
        "end": {"latitude": 18.5, "longitude": 77.6},
    }
    assert client.post("/api/routes/calculate", json=payload).status_code == 501
