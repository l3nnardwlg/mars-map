# maps-neubau

Neubau der Oberflaeche und erweiterte Backend-Teile, entstanden als eigene Arbeitskopie von Dev B.
Dieser Ordner ersetzt nichts. Die bestehenden Ordner `frontend/` und `backend/` im Repo sind unveraendert.

## Was drin ist
- `frontend/src/components/karte/`: neue Oberflaeche. `Karte.tsx` (Leisten, Routen, EVA, Briefing, Radar, Lineal, Demo), `Gelaende3D.tsx` (3D-Gelaende mit Orbit, Ortsnamen, Start/Ziel per Doppelklick), `Egoansicht.tsx` (Bodenansicht in echtem Massstab mit HiRISE), `Globus.tsx` (3D-Planet).
- `frontend/src/app/page.tsx` zeigt die neue Oberflaeche, die alte liegt unter `/alt`.
- `backend/app/karte.py`: neue Endpunkte `/api/places`, `/api/terrain/sample`, `/api/terrain/patch`, `/api/terrain/patch-image`, `/api/terrain/hirise-patch`, `/api/terrain/hirise-image`, `/api/routes/profile`.
- `backend/scripts/`: `build_region_dem.py`, `build_region_ortho.py`, `build_color_tiles.py`, `build_risk_tiles.py`, `fetch_global_window.py`.
- Geaendert gegenueber dem Stand auf `main`: `backend/app/terrain.py`, `mission.py`, `main.py`, `data.py` (englische Texte, Herkunftshinweise, EVA nutzt die Summen der vollen Route).

## Demo
`/?demo=1` startet die 30-Sekunden-Demo, der Knopf oben rechts auch.

## Daten (nicht im Repo, zu gross)
- NE-Syrtis-DEM und Orthobild: Caltech, https://data.caltech.edu/records/hhzzq-yw058 (CC0). Gegenueber dem Jezero-Modell um etwa 480 m nach Norden und 20 m nach Osten verschoben und um 10,1 m abgesenkt (Werte in `build_region_dem.py`). Nicht gegen Rover-Positionen geprueft, Abweichung zum Jezero-Modell etwa 24 m (RMSE).
- Viking-Farbmosaik und MOLA/HRSC-Modell: USGS, per `fetch_global_window.py` als Ausschnitt.
- HiRISE-Mosaike: wie bisher aus dem USGS-Archiv (`backend/data/raw/hirise`).
- Reihenfolge: `build_region_dem.py`, `build_slope.py`, `build_tiles.py` (hoehe), `build_region_ortho.py`, `build_color_tiles.py` (relief, scharf, wert, klasse), `build_risk_tiles.py`.

## Starten
Backend mit `MARS_DEM_PATH` auf das Regionsmodell und `MARS_TILES_DIR` auf den Kachelordner, `MARS_CORS_ORIGINS` fuer den Frontend-Port. Frontend mit `BACKEND_URL` auf das Backend und `NEXT_PUBLIC_TILE_BASE` auf die Kachel-Adresse.

## Offene Punkte
- Astronaut Mode, Cinematic Landing und Jury-Tour aus der bestehenden Oberflaeche sind hier nicht neu gebaut.
- Hangneigung und Geologie liegen nicht als Ueberlagerung im 3D-Gelaende.
- Nicht auf Firefox, Safari und kleinen Fenstern geprueft. Die FPS im 3D-Gelaende wurden nur im eingebetteten Testbrowser gemessen und waren dort niedrig.
- Die Tests in `backend/tests/` laufen mit den lokalen Daten (82 gruen).
