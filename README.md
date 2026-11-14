# MARS PATHFINDER — Advanced 3D Mars Mission & Traverse Optimization Engine

[![Frontend CI](https://github.com/l3nnardwlg/mars-map/actions/workflows/frontend.yml/badge.svg)](https://github.com/l3nnardwlg/mars-map/actions/workflows/frontend.yml)
[![Backend CI](https://github.com/l3nnardwlg/mars-map/actions/workflows/backend.yml/badge.svg)](https://github.com/l3nnardwlg/mars-map/actions/workflows/backend.yml)
[![NASA Space Apps Challenge](https://img.shields.io/badge/NASA%20Space%20Apps-Global%20Award%20Candidate-orange.svg)](https://www.spaceappschallenge.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MARS Pathfinder** is a high-fidelity, scientifically defensible planetary exploration and traverse optimization platform designed for NASA astronaut extravehicular activity (EVA) planning in Jezero Crater, Mars.

Developed for the **NASA Space Apps Challenge**, MARS Pathfinder pairs genuine NASA orbital elevation models (MOLA, HRSC, CTX, HiRISE) with real-time bio-energetic metabolic simulations and multi-objective pathfinding to prove a critical planetary truth: **the shortest Euclidean path on Mars is often hazardous or fatal.**

---

## 🌟 Key Capabilities

### 1. Planetary & High-Resolution Terrain Engine
- **8K Ultra-HD Planetary Mars:** 8192×4096 albedo and 8K topographic bump displacement rendered with 16× anisotropic texture filtering and 128-subdivision geometry.
- **Micro-Scale Jezero Crater:** Seamless cinematic transition from space orbit to real 3D terrain displacement sampled directly from the NASA Jezero elevation model.
- **Relief Exaggeration Invariance:** Mathematical separation of visual rendering exaggeration from physical elevation sampling ensures MOLA datum accuracy is never distorted by rendering parameters.
- **Scientific Quantization Transparency:** Discloses elevation uncertainty ($\pm 2.56\text{ m}$ discrete heightmap half-step, $\pm 0.02\text{ m}$ backend tile resolution) across all UI telemetry.

### 2. Multi-Objective Traverse Comparison
- **Direct Path (Euclidean):** Demonstrates naive shortest paths encountering dangerous $18.5^\circ$ scarp grades and steep metabolic costs ($405\text{ kJ}$).
- **Safe Path (Ridge Traversal):** Traverses stable delta alluvial contours ($<8^\circ$ slopes), avoiding hazardous escarpments and saving $140\text{ kJ}$ ($265\text{ kJ}$ total).
- **Science Path (Outcrop Sampling):** Strategic waypoint routing targeting Jezero Western Fan outcrop mudstones and delta deposits while staying well within human EVA physiological limits.

### 3. Synchronized Topographic & EVA Telemetry
- **Interactive Elevation Cross-Section:** Live bidirectional hover linking elevation chart profile to a 3D laser cursor on the Martian terrain.
- **Topographic Inspector:** Live click inspector calculating IAU-2000 planetographic coordinates, MOLA datum elevation, local slope grade, central-difference aspect azimuth, and USGS/PDS provenance metadata.
- **Astronaut First-Person Exploration (HUD):** Realistic $1.7\text{ m}$ eye-height camera, WASD + mouse look, slope-dependent locomotion ($<10^\circ$ nominal, $10^\circ-20^\circ$ slowed, $>25^\circ$ impassable cliff barrier), compass tape, and Pandolf/Santee metabolic modeling.

### 4. NASA Space Apps Global Jury Mode
- **15-Second Visitor Onboarding:** Immediate mission primer explaining the challenge, NASA datasets, and guidance.
- **Guided 2.5-Minute Interactive Jury Tour:** 6-step rehearsable narrative demonstrating orbit-to-surface transition, route trade-offs, interactive inspector, astronaut locomotion, and verified data provenance.

---

## 📚 Technical & Scientific Documentation

| Document | Description |
| :--- | :--- |
| **[FRONTEND_SCIENTIFIC_VALIDATION.md](docs/FRONTEND_SCIENTIFIC_VALIDATION.md)** | Geodetic coordinate transforms, MOLA datum proofs, central-difference slope math, and error budgets. |
| **[FRONTEND_PERFORMANCE_REPORT.md](docs/FRONTEND_PERFORMANCE_REPORT.md)** | VRAM profiling, 60 FPS benchmarks, 8K texture anisotropy, and WebGL resource lifecycle management. |
| **[JURY_DEMO_SCRIPT.md](docs/JURY_DEMO_SCRIPT.md)** | Rehearsable step-by-step 2.5-minute presentation script for NASA Space Apps evaluation. |
| **[FRONTEND_BACKEND_INTEGRATION.md](docs/FRONTEND_BACKEND_INTEGRATION.md)** | Complete API contract, tile serving protocols, error resilience (503/422/timeout), and fallback modes. |
| **[AI_USAGE.md](docs/AI_USAGE.md)** | Transparent disclosure of AI assistance, automated verification pipelines, and technical limitations. |

---

## 🏗 Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph Frontend ["Part A: Frontend & 3D Visualization (Next.js / Three.js)"]
        UI["Mission Control HUD / UI (React 19 / Tailwind)"]
        Canvas["React Three Fiber Canvas"]
        Globe["8K Planetary Mars Sphere"]
        Terrain["Jezero 3D Displaced Mesh"]
        Inspector["Terrain Inspector & Sampler"]
        Astronaut["First-Person Controller (1.7m)"]
        Chart["Elevation Profile Chart"]
    end

    subgraph Backend ["Part B: Routing & Geodata Engine (FastAPI / GDAL)"]
        API["FastAPI REST Endpoints"]
        AStar["3D Slope-Constrained A* Pathfinder"]
        BioModel["Pandolf / Santee Metabolic Engine"]
        TileServer["DEM & Imagery Tile Server"]
    end

    subgraph Data ["NASA Planetary Data System (PDS)"]
        MOLA["MGS MOLA MEGDR Topography"]
        CTX["MRO CTX Jezero DEM (12.37 m/px)"]
        HiRISE["MRO HiRISE Micro-DEM (1.64 m/px)"]
        Perseverance["NASA PDS Perseverance Rover Waypoints"]
    end

    Data --> Backend
    Backend -->|REST / GeoJSON / TMS Tiles| Frontend
    Inspector <-->|Central-Difference Sampling| Terrain
    Chart <-->|Synchronized Cursor Link| Canvas
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js**: v20 or higher
- **Python**: v3.12 or higher (optional, for backend server)
- **Git**

### Frontend Setup

```bash
cd frontend
npm install
npm run lint          # 0 errors, 0 warnings
npm run test:science  # 10/10 automated mathematical verification tests
npm run dev           # Start Next.js development server on http://localhost:3000
```

### Production Build

```bash
cd frontend
npm run build         # Next.js Turbopack production compilation
npm run start         # Launch production server
```

### Backend Setup (Optional)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pytest tests     # 25 passed
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔬 Scientific Data Attribution

1. **MGS MOLA (Mars Global Surveyor / Mars Orbiter Laser Altimeter):**
   - Reference: Smith, D. E., et al. (2001). Mars Orbiter Laser Altimeter: Experiment summary and data status. *J. Geophys. Res.*, 106(E10), 23689–23722.
   - Datum: IAU 2000 areoid (0 m potential surface).
2. **MRO CTX (Mars Reconnaissance Orbiter / Context Camera):**
   - Reference: Malin, M. C., et al. (2007). Context Camera Investigation on board the Mars Reconnaissance Orbiter. *J. Geophys. Res.*, 112, E05S04.
   - Processing: USGS Astrogeology Science Center controlled DEM mosaic of Jezero Crater.
3. **MRO HiRISE (High Resolution Imaging Science Experiment):**
   - Reference: McEwen, A. S., et al. (2007). Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE). *J. Geophys. Res.*, 112, E05S02.
4. **Bio-energetic Metabolic Modeling:**
   - Pandolf, K. B., Givoni, B., & Goldman, R. F. (1977). *Predicting energy expenditure with loads while walking on level and inclined ground.* Journal of Applied Physiology, 43(4), 577-581.
   - Santee, W. R., et al. (2001). *Metabolic rate prediction for human locomotion over variable terrain.*

---

## ⚖️ NASA Space Apps Challenge Disclaimer

*This application is an independent submission developed for the NASA Space Apps Challenge. All topographic and albedo datasets originate from public NASA and USGS planetary archives. The project does not imply formal endorsement by or official operational affiliation with NASA, JPL, or the Mars 2020 Perseverance mission.*
