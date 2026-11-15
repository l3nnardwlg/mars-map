from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.data import KACHELN_STANDARD
from app.main import app
from app.terrain import DEM_STANDARD

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
    assert {layer["id"] for layer in layers} == {"ctx_dem", "hirise_dem", "slope_ctx", "ctx_ortho", "geology", "thermal_inertia"}
    assert {layer["kind"] for layer in layers} == {"hoehe", "steigung", "bild", "geologie", "thermik"}
    assert all(layer["sourceUrl"].startswith("https://") for layer in layers)


def test_layers_report_availability_from_tile_sets(monkeypatch, tmp_path):
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    assert not any(layer["available"] for layer in client.get("/api/layers").json())
    ordner = tmp_path / "thermal_inertia"
    ordner.mkdir()
    (ordner / "metadata.json").write_text(
        '{"name": "thermal_inertia", "bounds": {"west": 77.0, "south": 17.6, "east": 78.6, "north": 19.3},'
        ' "meterProPixelFeinsteStufe": 87.0}',
        encoding="utf-8",
    )
    verfuegbar = {layer["id"] for layer in client.get("/api/layers").json() if layer["available"]}
    assert verfuegbar == {"thermal_inertia"}


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


def test_all_nasa_sample_sites_are_science_points():
    punkte = client.get("/api/science-points").json()
    proben = [p for p in punkte if p["id"].startswith("probe-")]
    assert len(proben) == 22
    canyon = next(p for p in proben if "Sapphire Canyon" in p["name"])
    assert "Neretva Vallis" in canyon["description"]
    assert canyon["location"]["latitude"] == pytest.approx(18.4975, abs=1e-3)
    assert all("Sample" in p["description"] and "rock:" in p["description"] for p in proben)


def test_cors_allows_local_frontend():
    antwort = client.options(
        "/api/layers",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert antwort.status_code == 200
    assert antwort.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_foreign_origin():
    antwort = client.options(
        "/api/layers",
        headers={"Origin": "http://boese.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in antwort.headers


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_routes_alternatives_endpoint():
    payload = {"start": {"latitude": 18.44, "longitude": 77.45}, "end": {"latitude": 18.40, "longitude": 77.55}, "count": 2}
    antwort = client.post("/api/routes/alternatives", json=payload)
    assert antwort.status_code == 200
    routen = antwort.json()
    assert 1 <= len(routen) <= 2
    assert len({route["id"] for route in routen}) == len(routen)
    for route in routen:
        assert {"id", "waypoints", "distanceMeters", "estimatedDurationSeconds", "riskScore", "energyJoules"} <= set(route)
        assert 0 <= route["riskScore"] <= 1


@pytest.mark.skipif(not (KACHELN_STANDARD / "ctx_dem" / "0" / "0" / "0.png").is_file(), reason="Kacheln nicht lokal vorhanden")
def test_tiles_are_served_as_png():
    antwort = client.get("/api/terrain/tiles/ctx_dem/0/0/0.png")
    assert antwort.status_code == 200
    assert antwort.headers["content-type"] == "image/png"
    assert antwort.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_geology_layer_carries_legend_from_tile_metadata(monkeypatch, tmp_path):
    ordner = tmp_path / "geology"
    ordner.mkdir()
    (ordner / "metadata.json").write_text(
        '{"name": "geology", "bounds": {"west": 76.8, "south": 17.7, "east": 77.8, "north": 18.7},'
        ' "meterProPixelFeinsteStufe": 62.0,'
        ' "legende": [{"klasse": 1, "name": "Eolian bedform unit", "symbol": "Aeb", "farbe": "#e6194b"}]}',
        encoding="utf-8",
    )
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    geologie = next(layer for layer in client.get("/api/layers").json() if layer["id"] == "geology")
    assert geologie["available"] is True
    assert geologie["legend"] == [{"classId": 1, "name": "Eolian bedform unit", "symbol": "Aeb", "color": "#e6194b"}]
    assert "100 bis 200 m" in geologie["description"]


@pytest.mark.skipif(not Path(DEM_STANDARD).is_file(), reason="Jezero-DEM nicht lokal vorhanden")
def test_alternatives_carry_tags():
    payload = {"start": {"latitude": 18.44, "longitude": 77.45}, "end": {"latitude": 18.40, "longitude": 77.55}, "count": 3}
    routen = client.post("/api/routes/alternatives", json=payload).json()
    assert "energy_optimal" in routen[0]["tags"]
    alle = [tag for route in routen for tag in route["tags"]]
    assert "lowest_risk" in alle and "shortest" in alle


def test_layer_carries_coverage_zoom_range_and_codec(monkeypatch, tmp_path):
    ordner = tmp_path / "ctx_dem"
    ordner.mkdir()
    (ordner / "metadata.json").write_text(
        '{"name": "ctx_dem", "bounds": {"west": 77.0, "south": 17.6, "east": 78.6, "north": 19.3},'
        ' "minZoom": 0, "maxZoom": 5, "kodierung": "uint16 PNG", "meterProPixelFeinsteStufe": 12.4}',
        encoding="utf-8",
    )
    monkeypatch.setenv("MARS_TILES_DIR", str(tmp_path))
    layer = next(l for l in client.get("/api/layers").json() if l["id"] == "ctx_dem")
    assert layer["status"] == "ready" and layer["available"] is True
    assert layer["coverage"]["minLatitude"] == 17.6 and layer["coverage"]["maxLongitude"] == 78.6
    assert (layer["zoomMin"], layer["zoomMax"]) == (0, 5)
    assert layer["codec"] == "uint16 PNG" and layer["nativeResolutionMeters"] == 12.4
    fehlend = next(l for l in client.get("/api/layers").json() if l["id"] == "geology")
    assert fehlend["status"] == "not-built" and fehlend["coverage"] is None


@pytest.mark.skipif(not (KACHELN_STANDARD / "ctx_dem" / "metadata.json").is_file(), reason="Kacheln nicht lokal vorhanden")
def test_every_built_tile_set_decodes_to_the_documented_encoding():
    import json

    import rasterio

    for ordner in sorted(KACHELN_STANDARD.iterdir()):
        meta_pfad = ordner / "metadata.json"
        if not meta_pfad.is_file():
            continue
        meta = json.loads(meta_pfad.read_text(encoding="utf-8"))
        stufe = ordner / str(meta["maxZoom"])
        kachel = next(stufe.glob("*/*.png"))
        with rasterio.open(kachel) as bild:
            daten = bild.read(1)
        assert daten.shape == (256, 256), ordner.name
        art = meta.get("art", "hoehe")
        erwartet = "uint8" if art in ("bild", "klasse") else "uint16"
        assert str(daten.dtype) == erwartet, ordner.name
        if art == "klasse":
            klassen = {e["klasse"] for e in meta["legende"]} | {0}
            assert set(map(int, set(daten.ravel().tolist()))) <= klassen, ordner.name
        bounds = meta["bounds"]
        assert 17.0 < bounds["south"] < bounds["north"] < 20.0, ordner.name
