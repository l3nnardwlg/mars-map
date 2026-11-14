# MARS Pathfinder: NASA Space Apps Global Jury Demonstration Script

**Title:** "Why the Shortest Path is Fatal on Mars: Multi-Objective EVA Traverse Optimization"  
**Target Duration:** 2 minutes 30 seconds  
**Presenter:** Dev A / Mission Lead  
**Audience:** NASA Space Apps Global Judging Panel (Planetary Scientists, Systems Engineers, UX Evaluators)  

---

## Technical Setup Before Presentation
1. Ensure the application is loaded at `http://localhost:3000`.
2. Ensure audio is clear and browser is in full-screen mode (`F11`).
3. Press **"Global Jury Tour"** in the top navigation bar or trigger the steps manually as rehearsed below.

---

## Demonstration Script & Step-by-Step Flow

### Step 1: Global Planetary Context (0:00 – 0:25)
* **Visual:** Mars 3D Globe with 8K surface textures, true $25.19^\circ$ axial tilt, atmospheric limb glow, and landing site markers.
* **Spoken Script:**
  > "Distinguished judges: Planning a human extravehicular mission on Mars is an existential challenge. In $0.38g$ gravity with limited life support, a wrong turn or steep scarp can prove fatal.  
  > We begin here in Martian orbit. MARS Pathfinder integrates global IAU Mars 2000 planetocentric coordinates and 8K Viking topography. Notice our target: Jezero Crater, the ancient lake basin where NASA's Perseverance rover is currently caching samples for return to Earth."
* **Action:** Click **"Jezero Crater"** landmark or click **"Next"** in the tour.

---

### Step 2: Surface Descent & High-Resolution Topography (0:25 – 0:50)
* **Visual:** Smooth cinematic transition down to the Jezero 3D mesh displaced by NASA PDS CTX 20m digital elevation data.
* **Spoken Script:**
  > "Descending to the surface, we transition from orbital scale to a 384-by-384 mesh displaced by the USGS NASA PDS Context Camera elevation model.  
  > Every height on this terrain is mathematically anchored to the MOLA Areoid datum—ranging from $-2,583\text{ meters}$ on the paleolake floor up to $-1,280\text{ meters}$ along the crater rim."
* **Action:** Toggle **"Hypsometric"** or **"Slope Risk"** layer via the toolbar.

---

### Step 3: The Fatal Direct Path vs. Safe Traverse (0:50 – 1:25)
* **Visual:** Multi-route comparison overlay with SVG elevation cross-section. The Direct line climbs a steep red scarp; the Safe line contours along the delta floor.
* **Spoken Script:**
  > "Here is our core discovery: **The shortest path is not the most suitable path on Mars.**  
  > If an astronaut takes the direct Euclidean line to the delta rim, they encounter an $18.5^\circ$ scarp. In Martian regolith, that causes severe wheel slip and a $+35\%$ metabolic power spike.  
  > Watch our multi-objective routing: By selecting the **Safe** traverse, our algorithm contours along the lower alluvial terrace at under $8^\circ$ slope. It adds $550\text{ meters}$ of distance, but saves $140\text{ kilojoules}$ of metabolic energy and keeps our crew safely within nominal oxygen reserves."
* **Action:** Switch between **"Direct"** and **"Safe"** buttons. Hover over the Elevation Cross-Section to highlight the synchronized yellow cursor on the 3D route.

---

### Step 4: NASA Perseverance Sample Return Objectives (1:25 – 1:45)
* **Visual:** Orange "Science" route pulls a trajectory detour towards Perseverance sample core locations.
* **Spoken Script:**
  > "Science return is the primary purpose of exploration. We've integrated verified Perseverance sample cache locations—including the Roubion, Montdenier, and Salette cores.  
  > The **Science** profile automatically computes an intelligent detour to inspect and collect cached sample tubes, while our NASA Pandolf model validates that total EVA duration remains well under the 8-hour safety ceiling."
* **Action:** Click **"Science"** profile button.

---

### Step 5: Boots on the Ground — Astronaut Surface Mode (1:45 – 2:10)
* **Visual:** First-person helmet HUD view with digital compass heading, surface slope telemetry, and real-time Pandolf bio-energetics.
* **Spoken Script:**
  > "Now let's put boots on the ground. Entering Astronaut Mode, the crew has a tactical helmet HUD with true Martian North compass tape, local DEM surface slope sensing, and a 2D Jezero radar minimap.  
  > Notice our physics: Movement speed is slope-aware. As we approach steep inclines, walking speed decreases realistically to reflect loose regolith shear, and telemetry clearly flags bio-metrics as Pandolf simulation models rather than unverified live sensors."
* **Action:** Walk with WASD, pan mouse, point out compass heading and slope readout. Press `ESC` to return to overview.

---

### Step 6: Scientific Traceability & Provenance (2:10 – 2:30)
* **Visual:** Scientific Layer Manager and Terrain Inspector showing USGS PDS product IDs and geodetic reference frames.
* **Spoken Script:**
  > "Every calculation you see is defensible:
  > - $0.0\text{ meters}$ variation across visual 3D exaggeration.
  > - 3,155 locally tiled 1-meter HiRISE topography tiles.
  > - Verifiable USGS and NASA PDS product IDs.
  > 
  > MARS Pathfinder transforms raw planetary data into an actionable, life-saving mission planning system for humanity's next giant leap. Thank you, and we welcome your questions."

---

## Contingency & Offline Demonstration Guarantee
* If the FastAPI backend server is offline or network fails, MARS Pathfinder immediately switches to an **authenticated offline reference dataset** with transparent UI badging (`NASA PDS M20 Jezero CTX Model [Offline Reference]`).
* The system never fabricates backend responses or claims online calculation when running in offline mode.
