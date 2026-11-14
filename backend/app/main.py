from fastapi import APIRouter, FastAPI, HTTPException

from app.data import LAYERS, SCIENCE_POINTS, TERRAIN
from app.models import (
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
    return TERRAIN


@api.get("/layers", response_model=list[Layer], response_model_by_alias=True)
def layers() -> list[Layer]:
    return LAYERS


@api.get("/science-points", response_model=list[SciencePoint], response_model_by_alias=True)
def science_points() -> list[SciencePoint]:
    return SCIENCE_POINTS


@api.post("/routes/calculate", response_model=MarsRoute, response_model_by_alias=True)
def calculate_route(request: RouteRequest) -> MarsRoute:
    raise HTTPException(status_code=501, detail="Routenberechnung ist noch nicht umgesetzt")


@api.post("/mission/simulate", response_model=MissionEstimate, response_model_by_alias=True)
def simulate_mission(request: MissionRequest) -> MissionEstimate:
    raise HTTPException(status_code=501, detail="Missionssimulation ist noch nicht umgesetzt")


app = FastAPI(title="Mars Map API", version="0.1.0")
app.include_router(api)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
