# MARS Pathfinder: AI Transparency & Engineering Disclosure

**Evaluation Standard:** NASA Space Apps Challenge Global Championship Directive  
**Date:** November 2026  
**Status:** Complete & Publicly Disclosed  

---

## 1. Commitment to Scientific & Engineering Transparency

In strict compliance with NASA Space Apps Challenge ethics and Phase 6 Engineering Directives, this document transparently details the usage, contributions, and validation mechanisms of Artificial Intelligence (AI) agents in the engineering of MARS Pathfinder.

We maintain an explicit distinction between:
1. **AI-Assisted Implementation:** Code generated or synthesized by AI models under human engineering directives.
2. **Deterministic Verification:** Automated mathematical test suites, compilers, and linters.
3. **Independent Ground-Truth Validation:** Cross-checking against published NASA PDS datasets, peer-reviewed literature, and official USGS coordinates.

---

## 2. Division of AI Contributions & Agent Roles

| Agent / Role | Focus Area | AI Tasks | Validation Method |
| :--- | :--- | :--- | :--- |
| **Agent A1 (Planetary Scientific Engineering)** | Coordinates, Topography & Physics | - IAU Mars 2000 planetocentric coordinate formulas<br>- Central finite-difference slope and aspect math<br>- Elevation exaggeration invariance proofs<br>- Pandolf/Santee metabolic model adaptation | 10/10 automated scientific unit tests in `verify_scientific_data.mjs` verifying $< 10^{-5\circ}$ round-trip error |
| **Agent A2 (3D WebGL & Exploration Engine)** | Three.js Visual Architecture | - Mars Globe 8K anisotropic texture binding<br>- Procedural atmosphere Fresnel shader<br>- First-person astronaut WASD and PointerLock controller<br>- Slope-aware walking dynamics | Visual rendering verification, 60 FPS performance profiling, zero memory-leak disposal |
| **Agent A3 (Mission UX & Scientific HUD)** | User Experience & Visualization | - Interactive SVG elevation cross-section with synchronized 3D cursor<br>- Multi-objective route comparison panel<br>- Scientific layer manager with provenance links<br>- 2.5-minute guided NASA jury tour | ESLint strict pass, TypeScript compile, responsive testing |
| **Lead Integration Agent** | Architecture & Quality Gates | - Codebase unification and conflict prevention<br>- Production Next.js Turbopack build validation<br>- CI workflow automation (`frontend.yml`)<br>- Integration contract verification with Part B (FastAPI) | `npm run lint`, `npm run test:science`, `next build`, `pytest backend/tests` (25/25 passed) |

---

## 3. Independent Validation & What Was NOT AI-Generated

The scientific foundation of this project is anchored in verified external ground truths that were **independently retrieved directly from NASA and USGS archives**:
1. **Digital Elevation Model:** Native GeoTIFF `M20_JezeroCrater_CTXDEM_20m.tif` (90 MB) downloaded directly from the USGS Astrogeology Science Investigation server.
2. **HiRISE High-Resolution DTM:** USGS release August 2024 `MSR_hirise_soc_003_DTM_MOLATopography_DeltaGeoid_1m` (5.5 GB) downloaded from the AWS PDS archive and tiled into 3,155 sub-2m raster cells.
3. **Perseverance Sample Locations:** Derived directly from the NASA Mars 2020 MMGIS sample cache JSON registry (`M20_SAMPLE_v3.json`).
4. **Metabolic Model:** The equations and constants for human load-bearing locomotion are taken from Pandolf et al. (1977) and Santee et al. (2001) as documented in NASA JSC life-support standards.

**At no point was NASA data, elevation measurements, or route statistics hallucinated or synthetically fabricated.**

---

## 4. Known Limitations, Model Boundaries & Scientific Disclosures

1. **Quantization of Client 8-Bit Heightmap:**
   * While the backend tiles are full 16-bit GeoTIFF raster data ($\pm 0.02\text{ m}$ quantization step), the lightweight client-side preview DEM is encoded as an 8-bit PNG, resulting in a maximum round-off error of $\pm 2.555\text{ m}$ ($\approx \pm 2.56\text{ m}$) and a theoretical uniform RMS error of $\pm 1.475\text{ m}$ ($\approx \pm 1.48\text{ m}$). Total composite DTM uncertainty relative to the MOLA Areoid is estimated at $\pm 6\text{ m}$ to $\pm 10\text{ m}$ RMS based on USGS literature (Fergason et al., 2020).
2. **Normalized Terrain Slope Risk Index vs. Accident Risk:**
   * The risk score is explicitly defined as a **topographic slope hazard index** ($R = \min(1.0, 0.6 \cdot \bar{\theta}/15.0^\circ + 0.4 \cdot \theta_{\max}/15.0^\circ)$) calibrated against the NASA Johnson Space Center (JSC) Rock Yard $15.0^\circ$ human EVA walkability threshold. It is not an empirical statistical probability of an accident or equipment failure.
3. **Reference Benchmark Scenario Distinction:**
   * The benchmark scenario figures originate from the standardized Western Delta Scarp test traverse ($18.38^\circ\text{ N}, 77.58^\circ\text{ E} \to 18.44^\circ\text{ N}, 77.45^\circ\text{ E}$) documented in `backend/BENCHMARK_REPORT.md` (Distance-Min: $8,776\text{ m}$, max slope $9.05^\circ$, risk $0.329$; Hazard-Min: $8,891\text{ m}$, max slope $6.83^\circ$, risk $0.238$; Energy-Min: $8,777\text{ m}$, $2.433\text{ MJ}$, risk $0.327$; Science-Detour `probe-14-15`: $14,788\text{ m}$, $4.069\text{ MJ}$). The UI explicitly distinguishes live dynamic API calculations from precomputed reference scenarios.
4. **Sub-Resolution Obstacles:**
   * The primary DEM resolution is 20 meters per pixel. Micro-topographic features such as boulders $< 20\text{ m}$ across or small fissures are below CTX resolution.
5. **Simulated Biometrics Disclaimer:**
   * Telemetry such as heart rate, suit pressure, and oxygen flow are explicitly labeled in the HUD as `SIMULATED [NASA IST-1]`. They represent predictive bio-energetic modeling, not live biomedical telemetry.
6. **Automated Quality Verification Pipelines:**
   * Every line of code committed is validated by four automated gates:
     - `npm run lint` (ESLint 9 + TypeScript strict mode)
     - `npm run test:science` (10 mathematical geodetic tests)
     - `npm run test:contract` (Pydantic / FastAPI wire schema tests)
     - `npm run test:e2e` (13-step mission acceptance test)
     - `npm run build` (Turbopack production compilation)
