import threading
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.data import SCIENCE_POINTS, kachelordner, layer_liste, terrain_metadaten
from app.mission import MissingElevationError, simulate
from app.routing import NoRouteError
from app.terrain import DemUnavailableError, OutsideTerrainError, plan_route, plan_routes, vorwaermen
from app.models import (
    AlternativesRequest,
    Layer,
    MarsRoute,
    MissionEstimate,
    MissionRequest,
    RouteRequest,
    SciencePoint,
    TerrainMetadata,
)

api = APIRouter(prefix="/api")


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
    except DemUnavailableError as fehler:
        raise HTTPException(status_code=503, detail=str(fehler)) from fehler
    except OutsideTerrainError as fehler:
        raise HTTPException(status_code=422, detail=str(fehler)) from fehler
    except NoRouteError as fehler:
        raise HTTPException(status_code=422, detail=str(fehler)) from fehler
    return MarsRoute(id=str(uuid4()), **ergebnis)


@api.post("/routes/alternatives", response_model=list[MarsRoute], response_model_by_alias=True)
def calculate_alternatives(request: AlternativesRequest) -> list[MarsRoute]:
    try:
        ergebnisse = plan_routes(
            (request.start.latitude, request.start.longitude),
            (request.end.latitude, request.end.longitude),
            request.count,
        )
    except DemUnavailableError as fehler:
        raise HTTPException(status_code=503, detail=str(fehler)) from fehler
    except (OutsideTerrainError, NoRouteError) as fehler:
        raise HTTPException(status_code=422, detail=str(fehler)) from fehler
    return [MarsRoute(id=str(uuid4()), **ergebnis) for ergebnis in ergebnisse]


@api.post("/mission/simulate", response_model=MissionEstimate, response_model_by_alias=True)
def simulate_mission(request: MissionRequest) -> MissionEstimate:
    try:
        return simulate(request.route.waypoints, request.crew_size)
    except MissingElevationError as fehler:
        raise HTTPException(status_code=422, detail=str(fehler)) from fehler


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=vorwaermen, daemon=True).start()
    yield


app = FastAPI(title="Mars Map API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)

if kachelordner().is_dir():
    app.mount("/api/terrain/tiles", StaticFiles(directory=kachelordner()), name="tiles")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
