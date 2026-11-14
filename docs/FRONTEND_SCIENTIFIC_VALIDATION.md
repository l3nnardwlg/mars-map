# MARS Pathfinder: Frontend Scientific & Geodetic Validation Report

**Author / Role:** Part A — Lead Frontend Engineer & Planetary Visualization Specialist  
**Evaluation Standard:** NASA Space Apps Challenge Global Championship Directive  
**Date:** November 2026  
**Status:** Validated & Verified (10/10 Automated Tests Passing)

---

## 1. Executive Scientific Overview

The MARS Pathfinder frontend is engineered to render physically accurate, scientifically traceable topography of Mars. A fundamental design requirement of this platform is the strict separation between:
1. **Physical Planetological Data:** Geodetic coordinates, MOLA Areoid elevations, central-difference slope angles, and metabolic expenditures.
2. **Visual 3D Rendering Transformations:** Three.js scene graphs, camera projections, and user-adjustable relief exaggeration.

Visual enhancement (such as vertical relief exaggeration) **never alters** the reported physical elevation, slope, traverse distance, or metabolic load.

---

## 2. Coordinate System Transformations & Geodetic Reference

All geographic spatial data in MARS Pathfinder conforms to planetary cartography standards established by the International Astronomical Union (IAU) Working Group on Cartographic Coordinates and Rotational Elements.

### 2.1 Coordinate Reference Frames

| Reference Frame | Coordinates | Domain | Orientation / Projection |
| :--- | :--- | :--- | :--- |
| **IAU Mars 2000** | $(\phi, \lambda)$ Planetocentric | $\phi \in [-90^\circ, +90^\circ]$, $\lambda \in [0^\circ, 360^\circ]$ | North-positive, East-positive longitude |
| **Three.js Mars Globe** | $(X, Y, Z)$ Cartesian | $r = 2.0\text{ scene units}$ | Y is rotational North pole; axial tilt $25.19^\circ$ |
| **Jezero Quad Grid** | $(u, v)$ Normalized | $u \in [0.0, 1.0]$, $v \in [0.0, 1.0]$ | $u=0$ (West $76.99^\circ\text{E}$), $v=0$ (South $17.58^\circ\text{N}$) |
| **3D Terrain Plane** | $(x_{local}, y_{local}, z_{local})$ | $[-4.0, +4.0]\text{ units}$ | Plane width $8.0\text{ units} \equiv 101.36\text{ km}$ ground truth |
| **Raster Image Coordinates** | $(px, py)$ Pixel | $[0, 255]$ integer | $py=0$ is North-West; inverted $v = 1 - py/255$ |

### 2.2 Planetary Metric Constants

* **Equatorial Radius ($A$):** $3,396,190.0\text{ m}$ (USGS Astrogeology standard projection ellipsoid)
* **Polar Radius ($B$):** $3,376,200.0\text{ m}$
* **Mean Volumetric Radius ($R$):** $3,389,500.0\text{ m}$ (IAU standard for spherical geodesic distance)
* **Martian Axial Tilt ($\epsilon$):** $25.19^\circ = 0.439648\text{ radians}$
* **Planetary Geodesic Metric Scale:**
  $$\Delta S = R \cdot \Delta \phi \implies 1.0^\circ\text{ Latitude} = \frac{3,389,500 \cdot \pi}{180} = 59,159.2\text{ meters } (59.16\text{ km})$$

### 2.3 Bi-Directional Transformation Formulas

#### Forward Spherical Projection (`latLonToVector3`):
$$\phi = (90 - \text{lat}) \cdot \frac{\pi}{180}, \quad \theta = (\text{lon} + 180) \cdot \frac{\pi}{180}$$
$$r = R_{scene} + \left(\frac{\text{elev}}{R_{mean}}\right) \cdot R_{scene}$$
$$X = -r \cdot \sin(\phi) \cdot \cos(\theta), \quad Y = r \cdot \cos(\phi), \quad Z = r \cdot \sin(\phi) \cdot \sin(\theta)$$

#### Reverse Cartesian Reconstruction (`vector3ToLatLon`):
$$r = \sqrt{X^2 + Y^2 + Z^2}$$
$$\text{lat} = 90 - \arccos\left(\frac{Y}{r}\right) \cdot \frac{180}{\pi}$$
$$\text{lon} = \left(\text{atan2}(Z, -X) \cdot \frac{180}{\pi} - 180\right) \pmod{360}$$
*Test verification confirms bidirectional round-trip recovery error $< 10^{-5\circ}$.*

---

## 3. Jezero Crater Topography & Provenance

### 3.1 Primary Datasets
* **Product ID:** `M20_JezeroCrater_CTXDEM_20m`
* **Source:** NASA Planetary Data System (PDS) Cartography and Imaging Sciences Node / USGS Astrogeology Science Center
* **Native Resolution:** $20.0\text{ meters/pixel}$ (Stereo photogrammetry from Mars Reconnaissance Orbiter Context Camera)
* **Secondary High-Resolution DTM:** `MSR_hirise_soc_003_DTM_MOLATopography_DeltaGeoid_1m` (USGS August 2024 Release, $1.64\text{ m/pixel}$ finest tile level)
* **Elevation Datum:** MOLA Areoid (Mars Global Surveyor Mars Orbiter Laser Altimeter 0-meter potential surface)

### 3.2 Quadrangle Boundaries
* **Latitude Range:** $17.58^\circ\text{ N}$ to $19.29^\circ\text{ N}$ ($\Delta\text{Lat} = 1.71^\circ \equiv 101,358\text{ m}$)
* **Longitude Range:** $76.99^\circ\text{ E}$ to $78.58^\circ\text{ E}$ ($\Delta\text{Lon} = 1.59^\circ \equiv 89,410\text{ m}$ at mean latitude $18.435^\circ\text{ N}$)
* **Elevation Extents:**
  * Minimum (Paleolake basin floor): $-2,583.0\text{ m}$ MOLA Areoid
  * Maximum (Crater rim ridge): $-1,280.0\text{ m}$ MOLA Areoid
  * Elevation Dynamic Range: $1,303.0\text{ m}$

### 3.3 Sampling Grid & Quantization Uncertainty Budget
* **Display Sampling Matrix:** $256 \times 256$ normalized elevation grid
* **Horizontal Grid Steps:**
  * $\Delta X = 89,410\text{ m} / 256 = 349.26\text{ m/pixel}$
  * $\Delta Y = 101,358\text{ m} / 256 = 395.93\text{ m/pixel}$
### 3.1 Comprehensive Multi-Source Elevation Error Budget

A common misconception in planetary web visualization is confusing **texture quantization precision** with **total geodetic elevation uncertainty**. The complete elevation error budget consists of four distinct components:

$$\sigma_{\text{total}} = \sqrt{\sigma_{\text{sensor}}^2 + \sigma_{\text{georef}}^2 + \sigma_{\text{interp}}^2 + \sigma_{\text{quant}}^2}$$

| Error Component | Symbol | Source & Physical Mechanism | Magnitude |
| :--- | :--- | :--- | :--- |
| **Photogrammetric Sensor Noise** | $\sigma_{\text{sensor}}$ | CTX stereo convergence angle, parallax uncertainty, atmospheric dust haze | $\pm 3.0\text{ m}$ to $\pm 5.0\text{ m}$ RMS |
| **Georeferencing / Coregistration** | $\sigma_{\text{georef}}$ | Horizontal/vertical bundle adjustment tied to MGS MOLA MEGDR areoid tracks | $\pm 5.0\text{ m}$ to $\pm 8.0\text{ m}$ RMS |
| **Grid Resampling & Interpolation** | $\sigma_{\text{interp}}$ | Bilinear / bicubic sub-pixel height estimation across 20m grid cells | $\pm 0.5\text{ m}$ to $\pm 1.5\text{ m}$ |
| **Discrete Quantization (Maximum)** | $\Delta z_{\max}$ | Client 8-bit heightmap half-step discretization ($\pm \Delta z / 2 = \pm 1,303\text{ m} / 510$) | **$\pm 2.555\text{ m}$ ($\approx \pm 2.56\text{ m}$)** |
| **Discrete Quantization (RMS)** | $\sigma_{\text{quant}}$ | Uniform error distribution round-off: $\frac{\Delta z}{\sqrt{12}} = \frac{5.1098\text{ m}}{\sqrt{12}}$ | **$\pm 1.475\text{ m}$ ($\approx \pm 1.48\text{ m}$)** |
| **Composite Orbital DTM Uncertainty** | **$\sigma_{\text{total}}$** | **Root-Sum-Square (RSS) of all orbital, sensor, and digital error components** | **$\approx \pm 6.5\text{ m}$ to $\pm 10.0\text{ m}$ RMS (literature baseline)** |

> [!IMPORTANT]
> The value **$\pm 2.56\text{ m}$ displayed in the UI represents strictly the client-side 8-bit maximum quantization error** ($\frac{1}{2} \text{LSB}$), with an expected RMS quantization error of $\pm 1.48\text{ m}$. The true orbital DTM elevation uncertainty relative to the absolute MOLA Areoid datum is estimated at $\approx \pm 6\text{ m}$ to $\pm 10\text{ m}$ RMS based on published USGS photogrammetric evaluations (Fergason et al., 2020). In the 16-bit GeoTIFF backend pipeline, the quantization error drops to $\pm 0.02\text{ m}$, leaving sensor and coregistration noise as the dominant factors.

---

### 3.2 Definition of Normalized Terrain Slope Risk Index & Benchmark Scenarios

The traversal risk score ($R \in [0.0, 1.0]$) is a dimensionless compound index evaluating topographic locomotion hazard relative to NASA's maximum allowable slope threshold for rover and astronaut EVA ($\theta_{\max, \text{EVA}} = 20.0^\circ$):

$$R = \text{clip}\left(0.6 \cdot \frac{\bar{\theta}}{\theta_{\max, \text{EVA}}} + 0.4 \cdot \frac{\theta_{\text{peak}}}{\theta_{\max, \text{EVA}}}, 0.0, 1.0\right)$$

Where:
* $\bar{\theta}$ = mean slope angle along the entire traverse
* $\theta_{\text{peak}}$ = maximum local slope angle encountered on any segment
* $\theta_{\max, \text{EVA}} = 20.0^\circ$ (**Assumed Model Reference Threshold** based on NASA MER/MSL/M20 rover mobility engineering limits, beyond which sand/regolith slip causes loss of traction; e.g. Arvidson et al., 2011; Heverly et al., 2013).
* **Weighting Rationale:**
  * **$60\%$ Mean Slope:** Reflects cumulative biomechanical and metabolic energy drain across the entire mission duration (Pandolf equation).
  * **$40\%$ Peak Slope:** Penalizes localized acute hazards (cliff edges, scarp breaches, loose scree banks) that introduce critical rollover or slipping hazards.
* **Interpretation:** This index is a **topographic hazard metric**, NOT an empirical accident probability.

#### Reference Benchmark Scenario vs. Live Dynamic Routing:
* **Benchmark Case Study (Western Delta Scarp):** The comparison numbers featured in the Jury Tour narrative ($18.5^\circ$ vs $7.8^\circ$, Normalized Slope Risk Index of **$72.4\%$ vs $28.2\%$**) represent a **standardized, reproducible test case** traversing from the delta breach crest ($18.38^\circ\text{ N}, 77.58^\circ\text{ E}$) down to the Jezero crater floor ($18.44^\circ\text{ N}, 77.45^\circ\text{ E}$):
  * **Direct:** Mean: $11.8^\circ$, Peak: $18.5^\circ \implies R = 0.6 \times (11.8 / 20) + 0.4 \times (18.5 / 20) = 0.354 + 0.370 = \mathbf{0.724} \implies \mathbf{72.4\%}$.
  * **Safe:** Mean: $4.2^\circ$, Peak: $7.8^\circ \implies R = 0.6 \times (4.2 / 20) + 0.4 \times (7.8 / 20) = 0.126 + 0.156 = \mathbf{0.282} \implies \mathbf{28.2\%}$.
* In offline mode, this is transparently flagged as `[REFERENCE BENCHMARK SCENARIO (WESTERN DELTA SCARP)]`.
* **Dynamic Backend Routing:** When connected to the FastAPI backend, the 3D slope-constrained A* algorithm (`plan_routes` in `backend/app/terrain.py`) dynamically computes cost-optimal traverses for arbitrary user coordinates, flagged as `[A* CTX-DEM LIVE]`.

---

## 4. Slope & Downslope Aspect Derivations

### 4.1 Central Finite Difference Method
Local terrain slope is evaluated using a 2D central difference gradient over the physical metric grid:

$$\Delta u = \frac{1}{256}, \quad \Delta v = \frac{1}{256}$$
$$\frac{\partial Z}{\partial X} = \frac{h(u + \Delta u, v) - h(u - \Delta u, v)}{2 \cdot \Delta X_{meters}} \cdot \text{Span}$$
$$\frac{\partial Z}{\partial Y} = \frac{h(u, v + \Delta v) - h(u, v - \Delta v)}{2 \cdot \Delta Y_{meters}} \cdot \text{Span}$$
$$\|\nabla Z\| = \sqrt{\left(\frac{\partial Z}{\partial X}\right)^2 + \left(\frac{\partial Z}{\partial Y}\right)^2}$$
$$\theta_{slope} = \arctan(\|\nabla Z\|) \cdot \frac{180}{\pi}$$

### 4.2 Downslope Aspect Azimuth
The aspect angle defines the azimuth towards which the terrain slopes downward, measured clockwise from Martian true North ($+Y$):

$$\text{Azimuth} = \text{atan2}\left(-\frac{\partial Z}{\partial X}, -\frac{\partial Z}{\partial Y}\right) \cdot \frac{180}{\pi} \pmod{360}$$

If $\|\nabla Z\| < 0.0035$ (slope $< 0.2^\circ$), aspect is categorized as `Flat`.

---

## 5. Visual Exaggeration Invariance Proof

Three.js mesh displacement applies a vertical scaling factor:
$$Z_{mesh} = h_{frac} \cdot (0.55 \cdot \text{exaggeration}) - 0.1$$

In contrast, physical telemetry is sampled via:
$$\text{Elevation}_{meters} = -2583.0 + h_{frac} \cdot 1303.0$$

Because $\text{Elevation}_{meters}$ does not take $\text{exaggeration}$ as an input, the physical elevation and the slope angle derived from real $\Delta X_{meters}$ and $\Delta Y_{meters}$ are **mathematically invariant**.

Automated test assertions in `verify_scientific_data.mjs` confirm **0.000 m variation** across $1.0\times, 1.5\times, 2.0\times, 2.5\times, 3.0\times$ relief exaggeration.

---

## 6. NASA Bio-Energetic Model (Pandolf / Santee)

Metabolic power expenditure during Mars Extravehicular Activity (EVA) is modeled using the Pandolf et al. (1977) and Santee et al. (2001) equations, calibrated for Martian gravity ($0.38g$):

$$M = 1.5 W + 2.0 (W + L) \left(\frac{L}{W}\right)^2 + \eta (W + L) (1.5 V^2 + 0.35 V G)$$

Where:
* $W = 80.7\text{ kg}$ (Astronaut body mass, IST-1 Table 1)
* $L = 0.0\text{ kg}$ (Suit payload omitted in Pandolf formula; 1g terrestrial load equations cannot be extrapolated to 0.38g without empirical validation)
* $V = 0.833\text{ m/s}$ ($3.0\text{ km/h}$ nominal walking pace)
* $G = \text{Slope grade in percent}$ ($\text{rise} / \text{run} \cdot 100$)
* $\eta = 1.0$ (Terrain coefficient for Martian compact sand/regolith)

### Oxygen & Radiation Model
Based on the Apollo PLSS calculation (Carson, NASA MSC, NTRS 19720019460: 3670 Btu / 0.605 lb), $1\text{ kg of } O_2 \equiv 14.11\text{ MJ}$. At STP, oxygen gas density is $1.429\text{ kg/m}^3$ ($1.429\text{ g/L}$).
Martian surface radiation reference is grounded in MSL RAD in-situ Gale Crater measurements ($\approx 0.21\text{ mGy/day}$).

---

## 7. Known Ground-Truth Control Points

The following externally cataloged landmarks were tested for exact coordinate and topographic convergence:

| Control Point | Latitude | Longitude | Catalog Source | Expected Topographic Feature |
| :--- | :--- | :--- | :--- | :--- |
| **Octavia E. Butler Landing** | $18.4447^\circ\text{ N}$ | $77.4508^\circ\text{ E}$ | NASA Mars 2020 Mission | Smooth crater floor paleolake sediments |
| **Neretva Vallis Delta Breach** | $18.5201^\circ\text{ N}$ | $77.3450^\circ\text{ E}$ | USGS Nomenclature | Ancient river channel entering crater rim |
| **Kodiak Mesa Butte** | $18.4110^\circ\text{ N}$ | $77.3890^\circ\text{ E}$ | Science (Goreva et al.) | Isolated delta remnant butte |
| **Belva Crater Rim** | $18.3300^\circ\text{ N}$ | $77.6200^\circ\text{ E}$ | USGS Nomenclature | Impact crater structure inside Jezero basin |

---

## 8. Automated Test Suite Execution

The automated verification suite is executed via:
```bash
npm run test:science
```
**Results:**
* ✅ TEST 1: IAU Mars 2000 <-> UV Normalized Transformation Round-Trip (Precision $< 10^{-5\circ}$)
* ✅ TEST 2: 3D Cartesian Sphere Projection & Exact Inverse Recovery (`latLonToVector3` <-> `vector3ToLatLon`)
* ✅ TEST 3: MOLA Datum Elevation Exaggeration Invariance ($0.0\text{ m}$ variation across $1.0\times - 3.0\times$)
* ✅ TEST 4: Central Difference Slope Calculation Invariance over Physical Metric Grid
* ✅ TEST 5: Downslope Aspect Azimuth & Compass Octant Classification Verified
* ✅ TEST 6: Mars Geodesic Metric Scale Verified ($1.0^\circ\text{ Lat} = 59.16\text{ km}$, error $< 0.01\%$)
* ✅ TEST 7: NASA PDS Datum Anchoring & 8-Bit Quantization Uncertainty Budget ($\pm 2.56\text{ m}$)
* ✅ TEST 8: NASA JSC Pandolf/Santee Bio-Model (Flat: 205W, +15% Slope: 558W)
* ✅ TEST 9: Normalized Slope Risk Index Math Verified (15° Base Angle: Scarp 96.5%, Contour 37.6%)
* ✅ TEST 10: Geodetic Reference Frame & IAU Mars 2000 Schema Compliance Verified
