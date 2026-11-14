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
- [x] **Dev B:** Initialize FastAPI backend
- [ ] **Agent 4:** Identify and validate NASA datasets
- [x] **Agent 5:** Design routing algorithm and risk model
- [ ] **Agent 6:** Define OpenAPI contracts and automated test setup

**Milestone:** Working 3D globe + backend skeleton + verified NASA data source.

## Phase 2 – Core Features (8–20h)

- [x] Implement high-resolution 3D Jezero terrain
- [x] Implement global-to-surface camera transition
- [x] Integrate NASA imagery and elevation layers
- [x] Implement A* route calculation
- [x] Calculate slope and terrain risk
- [x] Add interactive start/end point selection
- [x] Connect frontend with routing API

**Milestone:** User can select two points and visualize a calculated route on real Mars terrain.

## Phase 3 – Mission Planning (20–32h)

- [x] Implement NASA science points
- [x] Implement route alternatives
- [x] Add EVA duration and resource estimates
- [x] Display mission risks and terrain information
- [x] Build interactive layer controls
- [x] Finalize Mission Control dashboard
- [x] Integrate science points into 3D scene

**Milestone:** Complete interactive Marswalk planning workflow.

## Phase 4 – QA & Release (32–48h)

- [x] Validate scientific data and source attribution
- [x] Test coordinate transformations
- [x] Test routing on steep and inaccessible terrain
- [x] Verify frontend/backend integration
- [x] Optimize 3D rendering performance
- [x] Test complete mission planning workflow
- [ ] Record demonstration video
- [ ] Prepare NASA Space Apps submission
- [ ] Freeze release and deploy

**Milestone:** Stable, demonstrable project ready for submission.

## Phase 5 – Advanced 3D Exploration, Mission Visualization & UX (Dev A)

### P0 – Unbedingt umsetzen
- [x] **Astronaut Mode:** First-Person-Perspektive mit WASD-Steuerung, PointerLock-Mausblick und realistischer Geländekollision (DEM-gestützt)
- [x] **Minimap:** 2D-Radarübersicht mit Astronautenposition, Blickrichtung (FoV-Kegel), Route und Science Points
- [x] **3D Route Visualization:** Erweiterte Routendarstellung mit Richtungspfeilen, Wegpunkten und Gefahrenmarkierungen
- [x] **Terrain Inspector:** Klick-/Hover-Tool mit Anzeige von Höhe, IAU-Koordinaten und lokaler Steigung
- [x] **Layer Manager:** NASA-Layer Opacity-Slider, Legenden und konfigurierbare Gefahren-Grenzwerte
- [x] **Performance Optimization:** Frustum Culling, GPU-Memory-Management, glatte 60 FPS

### P1 – Wissenschaftliche Visualisierung
- [x] **Interaktives Höhenprofil:** Verknüpfung von Höhenprofil-Hover mit der 3D-Kartenposition
- [x] **Slope Heatmap & Risk Zones:** Einstellbare Grenzwerte für Neigungsrisiken (10°–25°)
- [x] **Route Comparison:** Direktes Gegenüberstellen von bis zu 3 Routen im Dashboard
- [x] **Distance Measurement Tool:** Laser-Messwerkzeug für Distanzen und Höhendifferenzen zwischen beliebigen Punkten
- [x] **Science Point Viewer:** Detailansicht mit NASA-Bildern, Beschreibungen und Proben-Zielen

### P2 – Immersion & Premium Features
- [x] **Cinematic Landing Experience:** Kamerafahrt vom Weltraum in den Jezero-Krater mit Skip-Button
- [x] **Mars Day/Night Simulation:** Dynamischer Sonnenlauf mit Sol-Uhrzeit und Schattenwurf
- [x] **Astronaut HUD:** Helm-Visier mit Kompassrose, künstlichem Horizont und simulierter Vitaltelemetrie
- [x] **Mission Replay:** Automatisches Abfahren der geplanten Marswalk-Route mit Timeline-Steuerung

### P3 – Extras & Accessibility
- [x] **Keyboard Shortcuts:** Schnelltasten für Ansichten (1 Orbit, 2 Terrain, 3 Astronaut, M Minimap, I Inspector, R Replay, L Layer Manager)
- [ ] **Guided Demo:** Geführte 2-Minuten-Tour für die NASA-Jury

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