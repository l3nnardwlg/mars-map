import json
from pathlib import Path

from app.main import app

SPEC_PFAD = Path(__file__).resolve().parent.parent / "openapi.json"

PFADE = {
    "/health": {"get"},
    "/api/terrain/metadata": {"get"},
    "/api/layers": {"get"},
    "/api/science-points": {"get"},
    "/api/routes/calculate": {"post"},
    "/api/routes/alternatives": {"post"},
    "/api/mission/simulate": {"post"},
}

PFLICHTFELDER = {
    "MarsCoordinate": {"latitude", "longitude"},
    "MarsRoute": {"id", "waypoints", "distanceMeters", "estimatedDurationSeconds", "riskScore"},
    "SciencePoint": {"id", "name", "location", "description", "nasaSourceUrl"},
    "RouteRequest": {"start", "end"},
}


def test_committed_openapi_matches_app():
    festgehalten = json.loads(SPEC_PFAD.read_text(encoding="utf-8"))
    assert festgehalten == json.loads(json.dumps(app.openapi())), "openapi.json ist veraltet: python scripts/export_openapi.py"


def test_all_endpoints_are_in_the_contract():
    pfade = app.openapi()["paths"]
    for pfad, methoden in PFADE.items():
        assert pfad in pfade
        assert methoden <= set(pfade[pfad])


def test_contract_models_have_required_camel_case_fields():
    schemas = app.openapi()["components"]["schemas"]
    for name, felder in PFLICHTFELDER.items():
        assert felder <= set(schemas[name]["properties"]), name
        assert felder <= set(schemas[name].get("required", [])), name


def test_optional_fields_are_not_required():
    schemas = app.openapi()["components"]["schemas"]
    assert "elevationMeters" in schemas["MarsCoordinate"]["properties"]
    assert "elevationMeters" not in schemas["MarsCoordinate"]["required"]
    for feld in ("energyJoules", "averagePowerWatts"):
        assert feld in schemas["MarsRoute"]["properties"]
        assert feld not in schemas["MarsRoute"]["required"]
