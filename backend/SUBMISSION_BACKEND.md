# Mars Pathfinder: Backend (Part B)

NASA Space Apps Challenge 2026, "Interplanetary Survival Guide: Martian Map". Text for the submission, backend part. All numbers below come from runs documented in this repository (`DATENQUELLEN.md`, `INTEGRATION_SIGNOFF.md`).

## What the backend does

The backend turns public NASA and USGS Mars data into a layered, route-ready map of Jezero Crater for a human Marswalk. It serves elevation, imagery, thermal and geologic layers as map tiles, plans walking routes that minimize the astronaut's metabolic energy, and estimates duration, oxygen use, energy and a radiation reference value for each route. A FastAPI service exposes this through a documented API (`openapi.json`).

## Data (four kinds of data, all public)

| Kind | Dataset | Resolution | Source |
|---|---|---|---|
| Topographic | CTX digital elevation model of Jezero | 20 m | USGS Astrogeology (Calef 2021) |
| Topographic | HiRISE digital terrain model, Mars Sample Return mosaics | 1 m | USGS (Bland 2024) |
| Optical | CTX orthoimage | 5 m | USGS |
| Thermal | THEMIS thermal inertia of Jezero | 100 m | Edwards and Buz 2021 (Zenodo) |
| Geologic | Geologic map of Jezero crater and Nili Planum, 14 units | 1:75,000 | USGS SIM 3464 (Sun and Stack 2020) |
| Science targets | 22 Perseverance sample sites, landing site, rover position, 12 named features | n/a | NASA Mars 2020 (MMGIS), USGS Gazetteer |

A slope layer is derived from the elevation model, so routing and map use the same terrain.

## Methods

- **Tiles.** Each layer is reprojected to latitude and longitude and cut into a 256 px tile pyramid. Measurements are stored as 16 bit PNG, imagery as 8 bit, geology as class codes with a legend.
- **Routing.** The terrain is a graph of 8 neighbours at 20 m. Cells steeper than 15 degrees are blocked, the steepest section that NASA JSC test subjects walked in the Rock Yard study. The cost of each step is the walking energy from the Pandolf equation as used in NASA's Crew State and Risk Model (Kim et al. 2024), with 80.7 kg body mass (IST-1 subjects) and 3.0 km/h. The search is an exact shortest-path computation, so it returns the same optimum as a classic A* search. Tests compare both on random terrain. Alternative routes come from penalizing a corridor around routes already found.
- **EVA estimate.** Duration and energy follow from the route. Oxygen uses 14.1 MJ per kg of oxygen, taken from the worked example in the Apollo PLSS Performance Report (Carson, NASA MSC). Limits are 8 hours and 350 W average from the xEMU specification (ICES 2026). The radiation value is a reference of 0.21 mGy per day from MSL RAD in Gale Crater (Hassler et al. 2014), multiplied by the duration.
- **Risk index.** A normalized terrain slope index from 0 to 1, built from mean and peak slope along the route. It is not an accident probability, and its 60 to 40 weighting is our own modelling choice.

## Validation

- Elevation models against NASA's own rover positions (independent data): CTX against 708 positions, RMSE 3.3 m. HiRISE against 320 positions, RMSE 1.13 m.
- CTX against two University of Arizona HiRISE terrain models: RMSE 6.7 m and 6.9 m. The landing site matches NASA's elevation within 3 m.
- 53 automated tests, an OpenAPI contract test, 10 integration scenarios against the running server, and a CI run that builds and starts the whole stack in containers.
- A route takes 0.1 to 0.7 s, three alternatives 0.5 to 1.2 s.

## Limitations

- The energy model uses no suit load and no Mars gravity adjustment, because the sources do not give a verified way to apply them. Energy is therefore likely underestimated.
- The radiation value is a reference from Gale Crater, not a measurement in Jezero, and it ignores elevation and shielding.
- The geologic map covers only the western part of the area and sits about 100 to 200 m off the controlled CTX mosaic (USGS note). About 38 percent of the thermal inertia map has no data.
- A 20 m grid smooths small steep steps. Routes are planning aids, not safety-certified.

## Reproducibility and AI use

The repository builds all data from the original sources with one command (`backend/scripts/fetch_data.py`), including checksums. The backend code, tests and documentation were developed with AI assistance (Claude Code) under the direction of the Part B developer. Results were checked with automated tests and the independent data comparisons above.

## References

- Calef, F. (2021). Mars 2020 Science Investigation CTX DEM Mosaic. USGS Astrogeology.
- Bland, M. (2024). Mars Sample Return HiRISE DTM and orthoimage mosaics. USGS Astrogeology.
- Edwards, C. S., and Buz, J. (2021). THEMIS-derived thermal inertia of Jezero Crater, Mars. Zenodo 4931348.
- Sun, V., and Stack, K. (2020). Geologic map of Jezero crater and the Nili Planum region, Mars. USGS SIM 3464.
- Kim, K. J., et al. (2024). Improving metabolic workload estimation accuracy for planning and analyzing exploration traverses. IEEE EMBC.
- Gernhardt, M., Norcross, J., and Vos, J. (2007). Integrated Suit Test 1. NASA JSC.
- Carson, M. A. Apollo Portable Life Support System Performance Report. NASA MSC.
- Mars Schematic Study for the xEMU PLSS (2026). ICES 2026, NTRS 20260002884.
- Hassler, D. M., et al. (2014). Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover. Science 343, 1244797.
- NASA Mars 2020 MMGIS layers (rover waypoints and sample sites). USGS Gazetteer of Planetary Nomenclature.
