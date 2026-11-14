# MARS Pathfinder: Frontend / Backend Integration & API Contract Specification

**Role:** Part A (Frontend Lead) in coordination with Part B (Backend Lead)  
**Evaluation Standard:** NASA Space Apps Challenge Global Championship Directive  
**Date:** November 2026  
**Status:** Integrated & Verified (Contract Compatible)  

---

## 1. Integration Architecture

The MARS Pathfinder architecture cleanly delineates responsibilities between Part A (Frontend) and Part B (Backend):
* **Part B (Backend):** Python 3.12, FastAPI, Rasterio, NumPy, A* Pathfinding over georeferenced raster tiles, and Pandolf metabolic simulation.
* **Part A (Frontend):** Next.js 16, Three.js WebGL engine, React Three Fiber, client-side DEM sampling, interactive HUD, and mission analysis UI.

Communication takes place over standard REST JSON endpoints and a static PNG tile server.

```
┌─────────────────────────────────────────────────────────────┐
│                       Part A: Frontend                      │
│     (Next.js 16 • Three.js WebGL • Zustand • React 19)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON & PNG Tiles
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Part B: Backend                       │
│    (FastAPI • Uvicorn • Rasterio • NumPy • A* Pathfinding)  │
├─────────────────────────────────────────────────────────────┤
│  Data Layer:                                                │
│  - backend/data/tiles/ctx_dem/     (1,285 tiles, 12.37m/px) │
│  - backend/data/tiles/hirise_dem/  (3,155 tiles,  1.64m/px) │
│  - backend/app/science_points.json (Perseverance Samples)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. API Contract Specification & Endpoint Signatures

### 2.1 Terrain Metadata (`GET /api/terrain/metadata`)
* **Response Model:** `TerrainMetadata`
```json
{
  "regionName": "Jezero Crater",
  "coordinateSystem": "Mars sphaerisch, Radius 3396190 m, Laenge nach Osten positiv",
  "elevationReference": "MOLA Areoid",
  "bounds": {
    "minLatitude": 17.5805,
    "maxLatitude": 19.2902,
    "minLongitude": 76.9974,
    "maxLongitude": 78.5826
  },
  "resolutionMetersPerPixel": 12.37,
  "availableTiles": ["0/0/0.png"]
}
```

### 2.2 Science Sample Points (`GET /api/science-points`)
* **Response Model:** `list[SciencePoint]`
```json
[
  {
    "id": "sample-roubion",
    "name": "Roubion Sample Core",
    "location": {
      "latitude": 18.4447,
      "longitude": 77.4508,
      "elevationMeters": -2583.0
    },
    "description": "Perseverance drill sample attempt on paleolake basin sediments",
    "nasaSourceUrl": "https://mars.nasa.gov/mars2020/multimedia/raw-images/"
  }
]
```

### 2.3 Route Calculation (`POST /api/routes/calculate`)
* **Request Model:** `RouteRequest` (`start`, `end`)
* **Response Model:** `MarsRoute`
* **HTTP Errors:**
  * `503 Service Unavailable`: DEM raster tiles missing on disk.
  * `422 Unprocessable Entity`: Coordinates outside Jezero bounds or destination unreachable.

### 2.4 Multi-Objective Alternatives (`POST /api/routes/alternatives`)
* **Request Model:** `AlternativesRequest` (`start`, `end`, `count: 3`)
* **Response Model:** `list[MarsRoute]` (Order: Direct, Safe, Science)
```json
[
  {
    "id": "e6a2b3c4-...",
    "waypoints": [
      { "latitude": 18.4276, "longitude": 77.4516, "elevationMeters": -2583.0 },
      { "latitude": 18.4438, "longitude": 77.4542, "elevationMeters": -2560.0 }
    ],
    "distanceMeters": 2150.0,
    "estimatedDurationSeconds": 2580.0,
    "riskScore": 0.45,
    "energyJoules": 860000.0,
    "averagePowerWatts": 333.3
  }
]
```

### 2.5 Mission Life-Support Simulation (`POST /api/mission/simulate`)
* **Request Model:** `MissionRequest` (`route`, `crewSize`)
* **Response Model:** `MissionEstimate`
```json
{
  "durationSeconds": 2580.0,
  "oxygenLiters": 34.2,
  "oxygenKilograms": 0.039,
  "energyWattHours": 477.8,
  "averagePowerWatts": 333.3,
  "evaTimeLimitSeconds": 28800.0,
  "withinEvaTimeLimit": true,
  "withinAverageMetabolicRate": false
}
```

---

## 3. Resilience, Offline Fallback & Scientific Honesty

In accordance with Phase 6 Engineering Rule 11 ("No placeholder features disguised as finished functionality") and Rule 15 ("Keep scientific data, simulated values, and purely cinematic effects clearly distinguishable"):
1. **Never Fabricate Live Calculation:**
   If the FastAPI backend is unreachable (e.g. server down, network failure, or offline demo mode), `marsApi.ts` does not silently pretend the calculation was performed on the server.
2. **Transparent Data Source Tagging:**
   * When connected to backend: `dataSource: "NASA FastAPI Backend [Local Tiles / A* CTX-DEM]"`
   * When running offline: `dataSource: "NASA PDS M20 Jezero CTX Model [Offline Reference]"`
3. **Consistent Physical Units:**
   All routes, elevations, and metabolic expenditures use identical units ($m$, $km$, $W$, $kJ$, $L$) across both online and offline paths.

---

## 4. Contract Verification & Automated Testing

To ensure zero breaking changes between Part A and Part B, two dedicated automated test suites have been deployed:

1. **API Contract Verification Suite (`npm run test:contract`):**
   * Executes `frontend/scripts/verify_api_contracts.mjs`.
   * When FastAPI is online on port 8000, validates all 6 HTTP wire contracts directly.
   * When offline, executes strict TypeScript $\leftrightarrow$ Pydantic schema validation.
2. **E2E Mission Acceptance Test (`npm run test:e2e`):**
   * Executes `frontend/scripts/test_e2e_mission.mjs`.
   * Simulates the complete 13-step jury workflow from region selection to astronaut exploration and reset.

For tonight's priority tasks, operational sprint board, and handoff protocols, refer to:
* **[PART_B_TONIGHT_HANDOFF.md](PART_B_TONIGHT_HANDOFF.md)**
* **[PART_B_TASK_BOARD.md](PART_B_TASK_BOARD.md)**
* **[FINAL_INTEGRATION_CHECKLIST.md](FINAL_INTEGRATION_CHECKLIST.md)**
* **[SCIENTIFIC_CLAIMS_AUDIT.md](SCIENTIFIC_CLAIMS_AUDIT.md)**
