# Backend (Dev B)

FastAPI, Python 3.11 oder neuer. Starten: `uvicorn app.main:app --port 8000`, Tests: `pytest`.
Das Frontend erreicht die API ueber den Rewrite in `frontend/next.config.ts` (`/api/*` nach `127.0.0.1:8000`).

## Koordinaten

IAU Mars 2000, planetozentrisch, Laenge nach Osten positiv, Hoehe in Metern relativ zum MOLA-Areoid.
Alle Endpunkte verwenden `latitude`, `longitude` in Grad und `elevationMeters`.

## Endpunkte

| Endpunkt | Inhalt |
|---|---|
| `GET /api/terrain/metadata` | Grenzen, feinste Aufloesung, Liste der Kachelsaetze (`availableTiles`) |
| `GET /api/terrain/tiles/{name}/{z}/{x}/{y}.png` | Kacheln der Layer: `ctx_dem` (12,4 m), `hirise_dem` (1,6 m), `slope_ctx` (Steigung in Grad), `thermal_inertia` (87 m), `ctx_ortho` (Graustufenbild) |
| `GET /api/layers` | Datenlayer mit Quelle, Art (`kind`), Einheit, Kachelsatz (`tileSet`) und `available` (Kacheln vorhanden) |
| `GET /api/science-points` | 36 Punkte: 22 Probenorte der Perseverance-Mission, Landeplatz, Rover-Position, 12 USGS-Merkmale |
| `POST /api/routes/calculate` | A*-Route auf dem CTX-DEM, Energie nach Pandolf |
| `POST /api/routes/alternatives` | Beste Route plus bis zu 4 Alternativen (`count`, Standard 3), erste Route ist die energieguenstigste |
| `POST /api/mission/simulate` | Dauer, Energie, Sauerstoff, Grenzen aus den Wegpunkten einer Route |

Die Routenantwort enthaelt zusaetzlich `energyJoules` und `averagePowerWatts`. Das Frontend muss die Pandolf-Formel nicht selbst rechnen.
Fehler der Routenberechnung: 503 (Geodaten fehlen), 422 (Punkt ausserhalb oder kein passierbarer Weg). Es gibt keine Ersatzroute.

## Hoehenkacheln

- Raster in Breite und Laenge, Kachelgroesse 256 x 256, Pyramide mit Zoomstufen 0 bis `maxZoom`
- Pro Satz eine `metadata.json` im Kachelordner mit `wurzelKachel` (`west`, `north`, `groesseGrad`), `maxZoom`, `hoeheMin`, `hoeheMax`
- Wurzelkachel ist quadratisch, Stufe z teilt sie in 2^z x 2^z Kacheln, x waechst nach Osten, y waechst nach Sueden
- Kachelgroesse in Grad auf Stufe z: `groesseGrad / 2^z`
- `art` in der `metadata.json` sagt, wie die Pixel zu lesen sind:
  - `hoehe` und `wert` (Hoehe, Steigung, Waermetraegheit): 16 Bit PNG, Wert 0 bedeutet keine Daten, 1 bis 65535 laufen linear von `wertMin` bis `wertMax`: `wert = wertMin + (pixel - 1) / 65534 * (wertMax - wertMin)`. `einheit` nennt die Einheit. Bei Hoehenkacheln stehen zusaetzlich `hoeheMin` und `hoeheMax` mit denselben Werten.
  - `bild` (Orthobild): 8 Bit PNG Graustufen, 0 bedeutet keine Daten.

## Daten holen (nach git clone)

Die Geodaten liegen nicht im Repo (Rohdaten ca. 13 GB, GitHub nimmt keine Dateien ueber 100 MB). Ein Befehl holt sie von den Originalquellen, prueft Groesse und Pruefsumme und baut die Kacheln:

```bash
cd backend
pip install -e ".[dev,build]"
python scripts/fetch_data.py            # CTX-DEM (86 MB) laden, Kacheln ctx_dem bauen, ca. 2 Minuten
python scripts/fetch_data.py --layers   # zusaetzlich Steigung, Waermetraegheit (2 MB) und CTX-Orthobild (360 MB), Kacheln bauen (ca. 10 Minuten)
python scripts/fetch_data.py --science  # zusaetzlich die Quelldateien der Science Points (ca. 6 MB)
python scripts/fetch_data.py --hirise   # zusaetzlich HiRISE-Paket (5,5 GB), Kacheln hirise_dem bauen
```

Ohne das CTX-DEM antwortet `/api/routes/*` mit 503, die Science Points (`app/science_points.json`) und die Tests laufen auch ohne Daten.

## Daten neu erzeugen

Rohdaten liegen unter `backend/data/raw/` (nicht im Repo, siehe `.gitignore`).

```bash
python scripts/build_tiles.py data/raw/M20_JezeroCrater_CTXDEM_20m.tif data/tiles/ctx_dem --name ctx_dem
python scripts/build_science_points.py --gazetteer ... --waypoints ... --proben ... --dem ... --ausgabe app/science_points.json
```

## Quellen

- CTX-DEM Jezero 20 m, USGS Astrogeology (Calef, 2021), Public Domain
- HiRISE-DTM Jezero 1 m (MSR TRN Mosaike, USGS 2024)
- Probenorte und Rover-Wegpunkte: NASA MMGIS Mars 2020 (`M20_SAMPLE_v3.json`, `M20_waypoints.json`)
- Benannte Merkmale: USGS Gazetteer of Planetary Nomenclature
- Energie: Pandolf-Gleichung (NASA JSC, Kim et al. 2024), Sauerstoff aus dem Apollo PLSS Performance Report, Werte mit Quelle in `app/nasa_werte.py`
