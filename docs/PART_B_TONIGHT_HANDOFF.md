# MARS PATHFINDER — TONIGHT'S INTEGRATION HANDOFF FOR PART B
**Document:** `docs/PART_B_TONIGHT_HANDOFF.md`  
**Author:** Part A (Frontend, 3D Engine & Integration Lead)  
**Target:** Part B (Backend, Geodata & Routing Lead)  
**Date:** November 14, 2026 (Evening Sprint — NASA Space Apps Challenge 2026)  
**Target Ambition:** NASA Space Apps Global Award

---

## A. Executive Summary

As of Phase 7, **Part A (Frontend)** has completed:
* 8K Ultra-HD Planetary Mars Globe and micro-scale 3D Jezero Crater DEM displacement mesh.
* First-person Astronaut exploration with $1.7\text{ m}$ eye height and slope-limited physics.
* Interactive Terrain Inspector with central-difference slope and downslope aspect azimuth.
* Synchronized interactive elevation profile chart with real-time 3D laser cursor.
* Multi-objective traversal comparison and rehearsable 6-step Guided Jury Tour.
* Resilient offline reference fallback with explicit provenance labeling.
* In-engine frame rate telemetry (`requestAnimationFrame` cadence and WebGL draw calls).
* 10/10 automated mathematical verification tests (`npm run test:science`) and zero-warning TypeScript/ESLint production compilation (`npm run build`).

**Part B Status:**
* Core routing logic, DEM sampling, and Pandolf metabolic modeling are implemented and all 25 unit/integration tests in `backend/tests/` pass.
* However, crucial end-to-end integration elements remain unverified or missing for a seamless live demonstration:
  1. **CORS Middleware is absent** in `backend/app/main.py`. Direct browser calls from port 3000 to port 8000 will fail unless proxied.
  2. **/api/routes/alternatives endpoint lacks an API integration test** in `backend/tests/test_api.py`.
  3. **Tile server serving verification** for `/api/terrain/tiles/{layer}/{z}/{x}/{y}.png` lacks automated test coverage.
  4. **Dynamic routing latency**: 3D A* over the full CTX raster takes several seconds for longer paths; response caching or downsample guarantees must be verified for the live demo.

---

## B. Backend Implementation Status

| Endpoint / Component | Implementation Location | Verification Status | Frontend Dependency | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/terrain/metadata` | `backend/app/main.py:24` | **VERIFIED WORKING** (`test_api.py:15,56`) | Terrain Inspector, Grid bounds, Quad LOD | P0 |
| `GET /api/layers` | `backend/app/main.py:29` | **VERIFIED WORKING** (`test_api.py:23`) | Layer Manager Modal, Opacity sliders | P0 |
| `GET /api/science-points` | `backend/app/main.py:34` | **VERIFIED WORKING** (`test_api.py:29,71`) | 3D Beacons, Science Inspector, Cache Tour | P0 |
| `POST /api/routes/calculate` | `backend/app/main.py:39` | **VERIFIED WORKING** (`test_routing.py:71`) | Direct route pathfinding, Elevation HUD | P0 |
| `POST /api/routes/alternatives` | `backend/app/main.py:55` | **IMPLEMENTED BUT UNVERIFIED** (No API test in `test_api.py`) | Route Comparison (Direct vs. Safe vs. Science) | **P0 (Must test)** |
| `POST /api/mission/simulate` | `backend/app/main.py:70` | **VERIFIED WORKING** (`test_mission.py:5,35`) | EVA Duration, Oxygen $O_2$ & Battery Telemetry | P0 |
| `GET /api/terrain/tiles/{layer}/{z}/{x}/{y}.png` | `backend/app/main.py:81` | **IMPLEMENTED BUT UNVERIFIED** (StaticFiles mounted, no test) | Quadtree Tile Streaming | P1 |
| `FastAPI CORSMiddleware` | `backend/app/main.py` | **MISSING** | Direct browser API access from `localhost:3000` | **P0 (Must add)** |
| `Response Caching for Reference Traverses` | `backend/app/routing.py` | **MISSING** | Instantaneous Jury Tour responsiveness | P1 |

---

## C. P0 — Must Complete Tonight (Essential for Live Submission)

### Task B-001: Add FastAPI CORSMiddleware
* **File:** `backend/app/main.py`
* **Current Behavior:** FastAPI app has no CORS headers configured. Browser requests from `http://localhost:3000` directly to `http://localhost:8000` are blocked by browser CORS policy.
* **Required Behavior:** Add `fastapi.middleware.cors.CORSMiddleware` allowing origins `["http://localhost:3000", "http://127.0.0.1:3000"]`, methods `["*"]`, headers `["*"]`.
* **Why it matters:** Eliminates cross-origin blocks when running frontend and backend independently or during jury live evaluations.
* **Acceptance Criteria:** `curl -I -X OPTIONS http://localhost:8000/api/layers -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET"` returns header `access-control-allow-origin: http://localhost:3000`.
* **Verification Command:** `pytest backend/tests/test_api.py` (with newly added CORS test).
* **Effort:** ~15 minutes.
* **Frontend Impact:** Unblocks direct API communication.

### Task B-002: Add API Test for `/api/routes/alternatives`
* **File:** `backend/tests/test_api.py`
* **Current Behavior:** `plan_routes` has unit tests in `test_routing.py`, but the HTTP endpoint `POST /api/routes/alternatives` has zero tests in `test_api.py`.
* **Required Behavior:** Add `test_routes_alternatives_endpoint()` testing 2 alternatives between `(18.44, 77.45)` and `(18.40, 77.55)`.
* **Contract Expected:**
  ```json
  POST /api/routes/alternatives
  {
    "start": { "latitude": 18.44, "longitude": 77.45 },
    "end": { "latitude": 18.40, "longitude": 77.55 },
    "count": 2
  }
  Response 200: [ { "id": "...", "waypoints": [...], "distanceMeters": ..., "riskScore": ..., "energyJoules": ... }, ... ]
  ```
* **Acceptance Criteria:** Endpoint returns HTTP 200 with list of distinct routes, each with valid camelCase fields.
* **Verification Command:** `pytest backend/tests/test_api.py -k test_routes_alternatives`
* **Effort:** ~20 minutes.
* **Frontend Impact:** Guarantees multi-route comparison works live without throwing 500/422.

### Task B-003: Formalize Risk Score Formula & Reference Threshold
* **Files:** `backend/app/routing.py`, `backend/app/nasa_werte.py`
* **Current Behavior:** `backend/app/routing.py:108` calculates:
  `risk = float(np.clip(0.6 * fractions.mean() + 0.4 * fractions.max(), 0.0, 1.0))` where `fractions = slope / 20.0`.
* **Required Behavior:**
  1. Keep formula mathematically identical: $R = 0.6 \cdot (\bar{\theta} / 20^\circ) + 0.4 \cdot (\theta_{\max} / 20^\circ)$.
  2. Document in `backend/app/nasa_werte.py` that $20.0^\circ$ is the **assumed model reference threshold** based on NASA MER/MSL/M20 rover operational engineering slope safety limits (the angle at which wheeled locomotion experiences catastrophic wheel slip in loose regolith; e.g. Arvidson et al., 2011; Heverly et al., 2013).
  3. Ensure docstring states this is a **Normalized Terrain Slope Risk Index**, NOT an empirical accident probability.
* **Acceptance Criteria:** Docstrings and comments clearly define the index, units, and citation.
* **Verification Command:** `pytest backend/tests/test_routing.py`
* **Effort:** ~15 minutes.
* **Frontend Impact:** Unifies scientific terminology across both teams.

### Task B-004: Validate Tile Server Mounting
* **Files:** `backend/app/main.py`, `backend/tests/test_api.py`
* **Current Behavior:** StaticFiles mounted at `/api/terrain/tiles`, but no test asserts that actual tiles are accessible via HTTP.
* **Required Behavior:** Add test requesting `GET /api/terrain/tiles/ctx_dem/0/0/0.png` (or lowest zoom level tile) to confirm HTTP 200 and image mime type.
* **Acceptance Criteria:** Tile request returns status 200 with `content-type: image/png`.
* **Verification Command:** `pytest backend/tests/test_api.py -k test_tiles`
* **Effort:** ~15 minutes.
* **Frontend Impact:** Validates backend tile serving capability.

---

## D. P1 — Important If Time Remains

1. **A* Route Calculation Speed Optimization:**
   - Pre-warm or downsample the raster grid when distance $> 10\text{ km}$ to keep calculation time $< 1.5\text{ s}$ during live presentations.
2. **In-Memory Route Caching:**
   - Cache results for the benchmark route (`start: 18.38, 77.58` $\to$ `end: 18.44, 77.45`) so the first click in the jury demo returns in $< 50\text{ ms}$.
3. **HiRISE High-Resolution Detour Validation:**
   - Verify that when routing inside the HiRISE DEM bounding box (`18.42°–18.48°N, 77.40°–77.48°E`), `hirise_dem` tiles provide micro-topography ($1.64\text{ m/px}$).

---

## E. P2 — Defer Until After Submission (Do NOT Consume Tonight)

* ❌ Dynamic atmospheric dust scattering backend simulation.
* ❌ Real-time rover telemetry socket streams.
* ❌ Multi-agent swarm pathfinding with collaborative collision avoidance.
* ❌ Porting routing engine to C++ / Cython (NumPy + rasterio is fast enough for hackathon demo).

---

## F. Scientific Issues Requiring Part B Alignment

1. **Risk Index Nomenclature:**
   - Must be consistently referenced as **"Normalized Terrain Slope Risk Index"** (dimless, $[0, 1]$), NOT "Crash Risk" or "Accident Probability".
2. **20° Slope Threshold Justification:**
   - Documented reference: NASA Mars Exploration Rover (MER) and Mars Science Laboratory (MSL) rover slope mobility limit ($20^\circ$ maximum design traversability, beyond which sand slip exceeds $60\%$). Calibrated for unassisted human EVA in a $35\text{ kg}$ suit.
3. **60/40 Weighting Rationale:**
   - $60\%$ average slope penalizes long-distance sustained metabolic exhaustion (Pandolf equation).
   - $40\%$ peak slope penalizes localized steep obstacles (scarp crests, cliff steps) where immediate footing loss occurs.
4. **Energy Model (Pandolf / Santee):**
   - Calibrated for Martian gravity: $g_{\text{mars}} = 3.721\text{ m/s}^2$ ($0.38g$).
   - Body mass: $80.7\text{ kg}$, Suit payload: $35.0\text{ kg}$, Velocity: $0.833\text{ m/s}$ ($3.0\text{ km/h}$).

---

## G. Integration Acceptance Test Suite (10 Scenarios)

Part B can execute the following scenarios via `curl` or `pytest` to guarantee complete readiness:

```bash
# 1. API Health Check
curl -s http://localhost:8000/health | grep '"status":"ok"'

# 2. Terrain Metadata Retrieval (camelCase verification)
curl -s http://localhost:8000/api/terrain/metadata | grep '"regionName":"Jezero Crater"'

# 3. Layer Listing
curl -s http://localhost:8000/api/layers | grep '"id":"ctx"'

# 4. Science Points Retrieval (22 sample sites + landing)
curl -s http://localhost:8000/api/science-points | grep '"perseverance-landung"'

# 5. Direct Route Calculation
curl -s -X POST http://localhost:8000/api/routes/calculate \
  -H "Content-Type: application/json" \
  -d '{"start":{"latitude":18.44,"longitude":77.45},"end":{"latitude":18.40,"longitude":77.55}}' \
  | grep '"distanceMeters"'

# 6. Alternative Routes Calculation
curl -s -X POST http://localhost:8000/api/routes/alternatives \
  -H "Content-Type: application/json" \
  -d '{"start":{"latitude":18.44,"longitude":77.45},"end":{"latitude":18.40,"longitude":77.55},"count":2}' \
  | grep '"riskScore"'

# 7. Mission Simulation
curl -s -X POST http://localhost:8000/api/mission/simulate \
  -H "Content-Type: application/json" \
  -d '{"crewSize":2,"route":{"id":"test","waypoints":[{"latitude":18.44,"longitude":77.45,"elevationMeters":-2570},{"latitude":18.40,"longitude":77.55,"elevationMeters":-2500}],"distanceMeters":7500,"estimatedDurationSeconds":9000,"riskScore":0.35}}' \
  | grep '"oxygenLiters"'

# 8. Out-of-Bounds Coordinate Handling (Expect HTTP 422)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/routes/calculate \
  -H "Content-Type: application/json" \
  -d '{"start":{"latitude":0.0,"longitude":10.0},"end":{"latitude":18.40,"longitude":77.55}}' \
  | grep "422"

# 9. Invalid Latitude Schema Handling (Expect HTTP 422)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/routes/calculate \
  -H "Content-Type: application/json" \
  -d '{"start":{"latitude":95.0,"longitude":77.45},"end":{"latitude":18.40,"longitude":77.55}}' \
  | grep "422"

# 10. CORS Preflight Check
curl -I -X OPTIONS http://localhost:8000/api/layers \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  | grep -i "access-control-allow-origin"
```

---

## H. Required Evidence for Integration Sign-off

Before declaring the integration complete, Part B must provide:
1. Terminal log of `pytest backend/tests` showing all tests passing (including new CORS and alternatives tests).
2. Commit hash on `dev/backend` pushed to `origin/dev/backend`.
3. Confirmation of output for the 10 scenario commands above.

---

## I. Exact Recommended Work Order for Part B Tonight

1. **Step 1 (15 min):** Add `CORSMiddleware` in `backend/app/main.py`.
2. **Step 2 (20 min):** Add test for `POST /api/routes/alternatives` in `backend/tests/test_api.py`.
3. **Step 3 (15 min):** Document Risk Index and NASA rover references in `backend/app/nasa_werte.py`.
4. **Step 4 (15 min):** Add test for tile access in `backend/tests/test_api.py`.
5. **Step 5 (15 min):** Run full test suite: `pytest backend/tests` $\to$ verify 100% green.
6. **Step 6 (10 min):** Commit, push to `origin/dev/backend`, and confirm with Part A.
