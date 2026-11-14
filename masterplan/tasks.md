# MARS Pathfinder – TASKS.md

## Project Overview

**Challenge:** NASA Space Apps – Interplanetary Survival Guide: Martian Map  
**Team:** 2 Fullstack Developers + 6 AI Agents  
**Goal:** Build an interactive 3D Mars exploration and mission planning platform using real NASA data.

## Team Responsibilities

| Owner | Responsibility | Branch |
|---|---|---|
| Dev A | 3D Engine, Frontend, UI Integration | `dev/frontend` |
| Agent 1 | Planet Engine | `feature/planet-engine` |
| Agent 2 | Terrain Engine | `feature/terrain-engine` |
| Agent 3 | Mission Control UI | `feature/mission-ui` |
| Dev B | Backend, NASA Data, Integration | `dev/backend` |
| Agent 4 | NASA Data Processing | `feature/nasa-data` |
| Agent 5 | Routing & Safety Engine | `feature/routing` |
| Agent 6 | Backend API & QA | `feature/backend-qa` |

## Phase 1 – Foundation (0–8h)

- [x] **Dev A:** Initialize Next.js frontend and Three.js
- [x] **Agent 1:** Implement interactive 3D Mars globe
- [x] **Agent 2:** Research and prototype NASA DEM terrain rendering
- [x] **Agent 3:** Create Mission Control UI skeleton
- [ ] **Dev B:** Initialize FastAPI backend
- [ ] **Agent 4:** Identify and validate NASA datasets
- [ ] **Agent 5:** Design routing algorithm and risk model
- [ ] **Agent 6:** Define OpenAPI contracts and automated test setup

**Milestone:** Working 3D globe + backend skeleton + verified NASA data source.

## Phase 2 – Core Features (8–20h)

- [ ] Implement high-resolution 3D Jezero terrain
- [ ] Implement global-to-surface camera transition
- [ ] Integrate NASA imagery and elevation layers
- [ ] Implement A* route calculation
- [ ] Calculate slope and terrain risk
- [ ] Add interactive start/end point selection
- [ ] Connect frontend with routing API

**Milestone:** User can select two points and visualize a calculated route on real Mars terrain.

## Phase 3 – Mission Planning (20–32h)

- [ ] Implement NASA science points
- [ ] Implement route alternatives
- [ ] Add EVA duration and resource estimates
- [ ] Display mission risks and terrain information
- [ ] Build interactive layer controls
- [ ] Finalize Mission Control dashboard
- [ ] Integrate science points into 3D scene

**Milestone:** Complete interactive Marswalk planning workflow.

## Phase 4 – QA & Release (32–48h)

- [ ] Validate scientific data and source attribution
- [ ] Test coordinate transformations
- [ ] Test routing on steep and inaccessible terrain
- [ ] Verify frontend/backend integration
- [ ] Optimize 3D rendering performance
- [ ] Test complete mission planning workflow
- [ ] Record demonstration video
- [ ] Prepare NASA Space Apps submission
- [ ] Freeze release and deploy

**Milestone:** Stable, demonstrable project ready for submission.

## Integration Rules

1. All agents must read `AGENTS.md`, `ARCHITECTURE.md`, `API_CONTRACT.md` and `COORDINATE_SYSTEM.md` before implementation.
2. Every agent works on its assigned feature branch.
3. API contracts and coordinate conventions must not change without approval from both developers.
4. All pull requests require review by the responsible developer.
5. Integrate working features at least every 4 hours.
6. Never merge broken builds into `main`.
7. Use real NASA data wherever scientific claims are made.
8. Label simulated values and assumptions clearly.

## Definition of Done

A feature is complete only when:

- [ ] Implementation works
- [ ] Relevant tests pass
- [ ] No critical errors remain
- [ ] API contracts are respected
- [ ] Scientific data sources are documented
- [ ] Responsible developer approves the PR

## Final Success Criteria

A user must be able to:

1. Explore a fully interactive 3D Mars globe.
2. Zoom into a detailed NASA-derived terrain region.
3. Select a Marswalk starting point and destination.
4. Generate a terrain-aware route.
5. Inspect mission risks, scientific targets and estimated resources.
6. View the complete mission in an interactive Mission Control dashboard.

**Project Priority:** Scientific accuracy → Working functionality → Performance → Visual polish.