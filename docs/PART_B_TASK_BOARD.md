# MARS PATHFINDER — PART B OPERATIONAL TASK BOARD
**Sprint:** Hackathon Final Integration Night (NASA Space Apps Challenge 2026)  
**Owner:** Part B (Backend & Geodata Lead)  
**Status Reference:** Synced with `dev/frontend` and `origin/dev/backend`

---

## 🎯 Active Task Matrix

| ID | Priority | Task Description | Status | Dependencies | Acceptance Test | Blocks Frontend Feature |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B-001** | **P0** | Add `CORSMiddleware` to FastAPI in `backend/app/main.py` | 🟡 Ready for Dev | None | OPTIONS preflight returns `Access-Control-Allow-Origin: *` | Direct browser API calls from port 3000 |
| **B-002** | **P0** | Add API test for `POST /api/routes/alternatives` in `test_api.py` | 🟡 Ready for Dev | B-001 | `pytest -k test_routes_alternatives` exits 0 with 2 routes | Live Multi-Route Comparison in MissionHUD |
| **B-003** | **P0** | Document 20° slope threshold & risk formula in `nasa_werte.py` | 🟡 Ready for Dev | None | Code docstrings quote MER/MSL $20^\circ$ rover mobility limits | Scientific defensibility in Jury Evaluation |
| **B-004** | **P0** | Add test asserting tile serving at `/api/terrain/tiles/...` | 🟡 Ready for Dev | B-001 | `pytest -k test_tiles` passes with `image/png` | Future Quadtree Tile Streaming |
| **B-005** | **P1** | Add route response caching for benchmark coordinates | ⚪ Optional | B-002 | Cache hit returns `< 50ms` on second request | Instantaneous Jury Tour responsiveness |
| **B-006** | **P1** | Verify HiRISE DEM bbox routing downsampling | ⚪ Optional | B-002 | Routing inside HiRISE bbox completes `< 2.5s` | Micro-scale science waypoint detours |
| **B-007** | **P2** | Port A* pathfinder inner loops to Cython / C++ | 🔴 Defer Post-Comp | None | Benchmark $< 100\text{ms}$ on raw raster | Post-hackathon scaling only |

---

## 📊 Status Definitions

- 🟢 **VERIFIED WORKING**: Automated test exists, passes in CI, and verified end-to-end.
- 🟡 **READY FOR DEV**: Specification is fully drafted in `docs/PART_B_TONIGHT_HANDOFF.md`, immediately actionable.
- ⚪ **OPTIONAL / P1**: Non-blocking polish task to be tackled if time remains.
- 🔴 **DEFERRED / P2**: Explicitly excluded from tonight's hackathon scope to protect core delivery.

---

## 🚀 Part B Quickstart Command

```bash
cd backend
# Activate environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
# Run all tests
pytest tests
# Start API server for live integration
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
