import os
import threading
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.data import SCIENCE_POINTS, kachelordner, layer_liste, terrain_metadaten
from app.karte import karte
from app.mission import MissingElevationError, simulate
from app.models import (
    AlternativesRequest,
    Layer,
    MarsRoute,
    MissionEstimate,
    MissionRequest,
    PlanRequest,
    RouteRequest,
    SciencePoint,
    TerrainMetadata,
)
from app.routing import NoRouteError
from app.terrain import DemUnavailableError, OutsideTerrainError, dem_pfad, plan_objectives, plan_route, plan_routes, vorwaermen

api = APIRouter(prefix="/api")


def _routenfehler(fehler: Exception) -> HTTPException:
    if isinstance(fehler, DemUnavailableError):
        return HTTPException(status_code=503, detail=str(fehler))
    return HTTPException(status_code=422, detail=str(fehler))


@api.get("/terrain/metadata", response_model=TerrainMetadata, response_model_by_alias=True)
def terrain_metadata() -> TerrainMetadata:
    return terrain_metadaten(kachelordner())


@api.get("/layers", response_model=list[Layer], response_model_by_alias=True)
def layers() -> list[Layer]:
    return layer_liste(kachelordner())


@api.get("/science-points", response_model=list[SciencePoint], response_model_by_alias=True)
def science_points() -> list[SciencePoint]:
    return SCIENCE_POINTS


@api.post("/routes/calculate", response_model=MarsRoute, response_model_by_alias=True)
def calculate_route(request: RouteRequest) -> MarsRoute:
    try:
        ergebnis = plan_route(
            (request.start.latitude, request.start.longitude),
            (request.end.latitude, request.end.longitude),
        )
    except (DemUnavailableError, OutsideTerrainError, NoRouteError) as fehler:
        raise _routenfehler(fehler) from fehler
    return MarsRoute(id=str(uuid4()), **ergebnis)


@api.post("/routes/alternatives", response_model=list[MarsRoute], response_model_by_alias=True)
def calculate_alternatives(request: AlternativesRequest) -> list[MarsRoute]:
    try:
        ergebnisse = plan_routes(
            (request.start.latitude, request.start.longitude),
            (request.end.latitude, request.end.longitude),
            request.count,
        )
    except (DemUnavailableError, OutsideTerrainError, NoRouteError) as fehler:
        raise _routenfehler(fehler) from fehler
    return [MarsRoute(id=str(uuid4()), **ergebnis) for ergebnis in ergebnisse]


@api.post("/routes/plan", response_model=list[MarsRoute], response_model_by_alias=True)
def plan_objective_routes(request: PlanRequest) -> list[MarsRoute]:
    if len(set(request.objectives)) != len(request.objectives):
        raise HTTPException(status_code=422, detail="Jedes Ziel darf nur einmal vorkommen.")
    stopps: list[tuple[float, float, str | None]] = []
    for stopp_id in request.science_point_ids:
        punkt = next((p for p in SCIENCE_POINTS if p.id == stopp_id), None)
        if punkt is None:
            raise HTTPException(status_code=422, detail=f"Unbekannter Science Point: {stopp_id}")
        stopps.append((punkt.location.latitude, punkt.location.longitude, stopp_id))
    stopps += [(v.latitude, v.longitude, None) for v in request.via]
    try:
        ergebnisse = plan_objectives(
            (request.start.latitude, request.start.longitude),
            (request.end.latitude, request.end.longitude),
            stopps,
            list(request.objectives),
        )
    except (DemUnavailableError, OutsideTerrainError, NoRouteError) as fehler:
        raise _routenfehler(fehler) from fehler
    return [MarsRoute(id=str(uuid4()), **ergebnis) for ergebnis in ergebnisse]


@api.post("/mission/simulate", response_model=MissionEstimate, response_model_by_alias=True)
def simulate_mission(request: MissionRequest) -> MissionEstimate:
    try:
        return simulate(request.route, request.crew_size)
    except MissingElevationError as fehler:
        raise HTTPException(status_code=422, detail=str(fehler)) from fehler


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=vorwaermen, daemon=True).start()
    yield


def _erlaubte_herkuenfte() -> list[str]:
    standard = ["http://localhost:3000", "http://127.0.0.1:3000"]
    zusaetzlich = [e.strip() for e in os.environ.get("MARS_CORS_ORIGINS", "").split(",") if e.strip()]
    return standard + zusaetzlich


app = FastAPI(title="Mars Map API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_erlaubte_herkuenfte(),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)
app.include_router(karte)

if kachelordner().is_dir():
    app.mount("/api/terrain/tiles", StaticFiles(directory=kachelordner()), name="tiles")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    probleme = []
    if not dem_pfad().is_file():
        probleme.append("Geländemodell fehlt")
    ctx_meta = kachelordner() / "ctx_dem" / "metadata.json"
    if not ctx_meta.is_file():
        probleme.append("Kacheln ctx_dem fehlen")
    elif not (any((kachelordner() / "ctx_dem").glob("*/*/*.png")) or any((kachelordner() / "ctx_dem").glob("*.png"))):
        probleme.append("Kacheln ctx_dem (PNG) fehlen")
    if probleme:
        raise HTTPException(status_code=503, detail=probleme)
    return {"status": "ready"}
