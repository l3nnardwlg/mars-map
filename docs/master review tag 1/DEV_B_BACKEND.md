# MASTER REVIEW – TAG 1 / DEV B (Backend, Geodaten & Wissenschaft)
**Projekt:** MARS Pathfinder – Interplanetary Survival Guide: Martian Map  
**Review-Baseline:** main @ ffde4617b05d1664971143952fd892fe641a4fbc, 14.11.2026  
**Owner:** Dev B / Backend & Geodata  
**Ziel:** Wissenschaftlich belastbare, reproduzierbare Route- und Missionsberechnung; klarer API-Vertrag für Dev A. Zielsetzung: möglichst starke Global-Award-Einreichung und hypothetisch 100/100 in der internen Qualitätsprüfung, **keine Behauptung einer garantierten NASA-Wertung.**
**Status:** Findings aus Code-Review; nicht alle Laufzeit- und Datentests konnten unabhängig nachgerechnet werden.

> Wichtig: Die in `backend/INTEGRATION_SIGNOFF.md` genannten „53 passed“ und DEM-RMSE-Zahlen sind dokumentierte Teamresultate. Als Reviewer wurden die Implementierungen, GitHub-CI-Metadaten und Testskripte eingesehen, aber keine 5,5-GB-Datensätze unabhängig verarbeitet. Ein reproduzierbares Beweisprotokoll bleibt Pflicht.

## Bereits starke Grundlage

- FastAPI mit `/health`, `/api/layers`, `/api/terrain/metadata`, `/api/science-points`, `/api/routes/calculate`, `/api/routes/alternatives`, `/api/mission/simulate` und Tile-Serving.
- NASA/USGS-Datensätze inklusive CTX-DEM, optional HiRISE, geologischem Layer, THEMIS, CTX-Orthobild, Slope-Derivat und Perseverance-/USGS-Science-Points.
- `routing.py` verwendet SciPy-Dijkstra auf einem gewichteten 8-Nachbarn-Graphen; Energie wird aus einem Pandolf-basierten Modell abgeleitet. Eine A*-Referenzimplementierung existiert für Tests.
- `DATENQUELLEN.md` enthält Quelle, Größen und geodätische Gegenproben (u. a. 708 bzw. 320 Roverpositionen). Die Begrenzungen wie fehlende Mars-G-Anpassung und 20-m-Sampling sind bereits dokumentiert.
- 53 Tests laut Backend-Signoff, grüne aktuelle Backend-CI und erfolgreicher Docker-PR-Integrationstest.

## P0 – MUSS vor Jury-Demo geschlossen oder ehrlich begrenzt sein

### B-001 | API verspricht drei Ziele, Solver optimiert faktisch nur Energie
**Code:** `backend/app/routing.py`, `backend/app/terrain.py`, `backend/app/models.py`, `backend/app/main.py`  
**Ist:** `find_alternatives()` berechnet zuerst energieoptimale Strecke und danach räumlich abweichende Routen mit Strafkorridor. Im Response werden manche Routen als `shortest` / `lowest_risk` markiert, indem unter den zufällig vorhandenen Kandidaten das Minimum ausgewählt wird. Das ist kein globales Längen- oder Risikominimum. Auch die dritte Alternative ist nicht science-optimiert.
**Fix – bevorzugt:** Exakte Ziele mit dokumentierten Kosten- und Nebenbedingungen anbieten:
- `energy_min` – minimiert modellierte Energie;
- `distance_min` – minimiert geometrische Distanz unter derselben Gelände-Sicherheitsmaske;
- `slope_hazard_min` – minimiert einen ausdrücklich definierten Hazard-Kostenfunktional, mit sinnvollem Distanz-/Energiebudget;
- `science_via_waypoints` – erzwingt explizite wissenschaftliche Zwischenziele und berechnet A→Stop(s)→B samt Missionszeit.
Falls zeitlich nicht machbar: API nur als „energy-optimal + corridor alternatives“ deklarieren und Client-Labels korrigieren. Auf keinen Fall „globally safest“, „shortest“ oder „science optimized“ behaupten, wenn dies nicht bewiesen ist.
**DoD:** Separater Regressionstest mit synthetischem Netz, in dem Energie-, Distanz- und Risikooptimum verschieden sind. Jede Antwort enthält `objective`, `objectiveValue`, `constraints`, `sourceMode` und, für Wissenschaftsrouten, `visitedSciencePointIds`. Explizite, validierte JSON-Schemas für Dev A.

### B-002 | Realer Science-Detour fehlt als routenplanerisches Problem
**Code:** `backend/app/main.py`, `terrain.py`, `models.py`  
**Ist:** Backend-Request kennt `start`, `end` und `count`, aber keine ausgewählten Wissenschaftsstopps. 36 Science Points können abgerufen werden, erzeugen aber keine automatisch nachgewiesene wissenschaftliche Missionsroute. Frontend versucht einen rein grafischen Pull Richtung Zwischenpunkt.
**Fix:** `sciencePointIds` oder `via` als explizite optionale Routeingabe, Geoposition gegen zugelassenes DEM und bekannte Punkte validieren, Leg-Reihenfolge und kumulierten Sauerstoff-/Energiebedarf nachvollziehbar berechnen. Einen Stichprobenstop nicht mit „Sample collected“ verwechseln; es handelt sich um Planungsziele, keine tatsächliche Probenentnahme.
**DoD:** API-Test: Für A→SciencePoint X→B enthält der Rückweg die tatsächliche Zielkoordinate mit Meter-Toleranz; `visitedSciencePointIds` enthält X; Kosten ≥ Summe der beiden berechneten Legs bis auf numerisches Budget; nicht erreichbarer Stop = HTTP 422 mit verständlichem Grund.

### B-003 | Routingzellen vs. physische Passierbarkeit: diagonales Corner Cutting
**Code:** `backend/app/routing.py` (NEIGHBORS / `_Graph` / `find_path_astar`)  
**Ist:** Acht Nachbarn werden für jeden gültigen diagonalen Endpunkt verbunden. Wenn die beiden orthogonal angrenzenden Zellen gesperrt sind, kann eine Diagonale geometrisch durch ihre Ecke verlaufen. Die Regeln prüfen lediglich Start-/Zielzelle und lokale Steigung, nicht die gesamte Kante oder ihren Sicherheitskorridor.
**Fix:** Diagonalen optional nur erlauben, wenn beide orthogonalen Nachbarn passierbar sind; Hindernis-/NoData-Puffer entlang Segmenten; an steilen Kanten Übergangsslope oder durchgehende Zellenkonnektivität prüfen. Eine konsistente Passierbarkeitsmaske auch für alle Optimierungsziele nutzen.
**DoD:** Test mit 2×2 diagonal offen, orthogonal gesperrt ⇒ kein Pfad; Test mit enger Schlucht ⇒ kein Durchschneiden; visuelle Frontend-Polyline muss dieselbe Sperrmaske respektieren.

### B-004 | Adaptive Downsampling- und Waypoint-Verdichtung können Sicherheit verschleiern
**Code:** `backend/app/terrain.py`, Konstanten `MAX_CELLS=400_000`, `MAX_WAYPOINTS=200`, `PADDING_METERS=2000`  
**Ist:** Der lokale DEM-Suchbereich wird bei großer Rasterfläche mit `Resampling.average` reduziert, anschließend werden die aus dem ursprünglichen Pfad gewählten Punkte auf maximal 200 verdünnt. Die berichteten Metriken beziehen sich noch auf den vollständigen groben Solverpfad. Visuell gezeichnete und an `mission.simulate()` übergebene Wegpunkte sind damit nicht zwingend identisch zur berechneten Geometrie. Kleine hohe Hindernisse können beim Downsampling verschwinden.
**Fix:** Effektive Auflösung pro Anfrage als Feld anzeigen. Abrupte Richtungswechsel und kritischste Steigungspunkte beim Waypoint-Sampling erhalten, optional vollständige Route als separate Geometrie liefern. Das Downsampling mit einer feineren Kontrollprüfung und konservativen Hazard-Masken testen. Keine „20-m-Sicherheitsgarantie“, wenn bei großen Suchfenstern deutlich gröber gearbeitet wird. `route`- und `mission`-Metriken müssen identische Ursprungsdaten benutzen oder Unterschiede ausweisen.
**DoD:** Drei kurze/lange reale Jezero-Strecken mit dokumentiertem effektivem `metersPerCell`; keine vom gerenderten Pfad geschnittenen NoData-/Sperrzellen; Vollpfad vs. Response-Wegpunkte: Längen-/Energiedifferenz begrenzt und im API sichtbar.

### B-005 | EVA-Modell nicht als reale Astronauten-Sicherheitsprüfung verkaufen
**Code:** `backend/app/mission.py`, `backend/app/nasa_werte.py`, `backend/app/routing.py`, `backend/app/models.py`  
**Ist:** Pandolf-Gleichung mit Masse 80,7 kg, Last 0 kg, 3 km/h; negative Grade werden energetisch wie Ebene behandelt, 15°-Zellsperre ist keine zertifizierte Mars-EVA-Grenze. 8-h-Grenze, 350-W-Durchschnitt und Strahlung stammen aus Annahmen/Referenzen, keine mission-validierte Mars-Vorhersage. Maximale metabolische Leistung (`MAX_STOFFWECHSELRATE_WATT=530`) ist definiert, aber kein harter Missions-Constraint. Kein realistischer Rückweg/Reserve, keine Stop-/Arbeitszeit.
**Fix:** Modellresultat als *screening estimate* bezeichnen und explizite Annahmen im Response ausgeben (Body, suit load, gravity treatment, speed, surface factor, exposure). Optional `roundTrip`, `scienceDwellSeconds`, `reserveFraction` und Limits; bevorzugt zuerst exakte Statuskennzeichnung vor einer unbelegten „sicheren“ Hochrechnung. Konsequent prüfen, ob die Kalorien/Leistung bei Dev A aus denselben Pfadsegmenten folgen.
**DoD:** Test für flache, steigende, abfallende und unpassierbare Strecken sowie Einweg/Rückweg. Ergebnis zeigt „validity scope / assumptions / limitations“. Kein Endpunkt oder UI behauptet lebenssicherheitszertifizierte Prognosen.

### B-006 | Scheinkonsistenz durch unterschiedliche wissenschaftliche Datenbasen
**Code:** `backend/app/data.py`, `backend/app/terrain.py`, `frontend/src/utils/demSampler.ts` (Dev A Abstimmung)
**Ist:** Backendroute basiert auf Raster-DEM und ggf. Downsampling; Client-Inspector verwendet 256er-Preview. Backend gibt keine eindeutige Route-Dataset-Provenienz oder tatsächliche Solverauflösung je Route zurück. `/api/terrain/metadata` gibt an manchen Orten eine Gebietsgrenze und min. Auflösung aus Tilestufen zurück, während Routing anderes Raster verwendet.
**Fix:** Response-Felder etwa `datasetId`, `datasetVersion`, `nativeResolutionMeters`, `routingGridResolutionMeters`, `heightDatum`, `inputBounds`, `modelVersion`, `warnings`. Wissenschaftliche Checksumme/Produkt-ID und Ausgabeparameter nachvollziehbar. Langfristig Geo-Referenz/Tile-Level eindeutig normalisieren.
**DoD:** Frontend kann ohne fest einkodierte Annahmen die wirklich benutzte Datenquelle und Auflösung darstellen; Snapshot/API-Contract stimmt mit echten Dateien überein.

## P1 – Hohe fachliche Wirkung und Belastbarkeit

### B-007 | Risikokennzahl auditieren; keine Unfallwahrscheinlichkeit
**Code:** `backend/app/nasa_werte.py`, `backend/app/routing.py:measure_path`  
**Ist:** 0.6 × mittlere Steigung/15° + 0.4 × maximale Steigung/15°, gecappt auf [0,1]. Die Gewichtung ist hausgemacht, der Mittelwert wird über besuchte Zellen statt zwingend streckengewichtet berechnet. Kein Fels-, Regolith-, Thermik- oder Expositionsrisiko.
**Fix:** „Normalized Terrain Slope Hazard Index“ als Modell und nicht als empirische Wahrscheinlichkeit definieren. Alternative streckengewichtete mittlere Steigung wissenschaftlich sauber begründen. Bei fehlenden Layern Warnungen statt Scheinsicherheit. Numerische Beispiele nur aus dem aktuellen Modell, keine veraltete 20°-Rechnung.
**DoD:** Prüffälle mit identischer physischer Route, aber unterschiedlicher Pixelauflösung; Risk-Index-Stabilität und Grenzfälle dokumentiert. Kein „72.4% chance of accident“.

### B-008 | Einsatz und Grenzen von HiRISE demonstrieren
**Code:** `backend/scripts/fetch_data.py`, `backend/app/terrain.py`  
**Ist:** HiRISE-Kachelaufbau existiert, produktives Routing verwendet aber standardmäßig den CTX-Pfad. Claim „1-m micro-scale routing“ wäre so nicht gedeckt.
**Fix:** High-Res-ROI als explizite Datenoption mit Coverage-Check / Patch-Strategie, oder ehrlich als *visualization-only* kennzeichnen. Kein stiller Wechsel auf andere Höhenreferenz; Tile-Coverage und reelle Georeferenzwerte prüfen.
**DoD:** Entweder ein Echt-HiRISE-A/B-Vergleich (identische Route mit zwei Rastern, dokumentiert) oder eindeutiger Ausschluss aus Routing-Claims.

### B-009 | Kartenlayer und Qualitätsflaggen testbar machen
**Code:** `backend/app/data.py`, `scripts/build_tiles.py`, `scripts/build_geology.py`, `scripts/build_slope.py`  
**Ist:** Sechs Layer im Katalog, einige nur bei Zusatzflags vorhanden. „available“ kann anhand einer Metadata-Datei true werden; für tatsächliche Anzeige müssen Tilestufen, Kodierung, NoData und projektspezifische Legenden stimmen.
**Fix:** `availability` (not-built/partial/ready), `coverage`, `noDataFraction`, `zoomRange`, `codec`, `unit`, `legend`, `sourceUrl` validieren. Geologie hat laut Quellenbericht 100–200 m Georeferenzabweichung, THEMIS teils große Lücken.
**DoD:** Für jeden Layer ein Test: existierende PNG-Kachel dekodieren, Lage/Einheit/NoData prüfen; Teilabdeckung korrekt als Teilabdeckung dokumentiert; Frontend sieht den Zustand.

### B-010 | Reproduzierbarkeit des Datenaufbaus / Flags / Pipeline
**Code:** `backend/scripts/fetch_data.py`, `.github/workflows/docker.yml`, `backend/DATENQUELLEN.md`, `backend/README.md`  
**Ist:** Default lädt nur CTX-DEM; `--hirise`, `--layers`, `--geologie` und `--science` müssen bewusst angegeben werden. Das optionale HiRISE-Paket ist mehrere GB groß. Ein voller Datenaufbau kann Zeit- und Downloadbudget der Jury sprengen.
**Fix:** Reproduzierbare kleine Demo-Datenvariante mit exakt dokumentiertem Lizenz-/Provenienzpfad, vollständigen Checksums und Cache-Strategie. CI für Minimalstandard, separate nächtliche Vollprüfung, exakte Infrastruktur- und Ressourcenangaben. Optionale Daten NICHT implizit als Standard-Deploy claimen.
**DoD:** Frischer Clone → ein dokumentierter Build → funktionsfähiges Routing und echte UI-Weiterleitung. Falls zusätzliche Layer nicht im Minimalsetup: klarer CLI-Befehl und UI-Verfügbarkeitsmarkierung.

### B-011 | Testdeckung nachweisen statt nur Zählwerte übernehmen
**Code:** `backend/tests/*.py`, `frontend/scripts/verify_api_contracts.mjs`, `.github/workflows/*.yml`  
**Ist:** CI funktioniert, aber DEM-abhängige Tests können ohne lokale Rohdaten übersprungen werden. Der Frontend-Contract-Test kann sich bei Backend-Ausfall selbst mit Fixtures validieren. Ein grüner Check allein belegt keine wissenschaftliche Live-Integration.
**Fix:** In CI getrennte Pflichtjobs für (1) unit synthetic terrain (2) live-Datensatz-Smoke (3) Full-stack-HTTP (4) echter Browserflow Dev A. Testreport mit Anzahl `passed`/`skipped`, Dataset-SHA, Commit-SHA und CSV/JSON von festen Benchmarkstrecken. Beispiel-Assertions gegen echte Rechnergebnisse, nicht nur gegen JSON-Schemas.
**DoD:** Ein öffentlich für Reviewer lesbarer Artefaktbericht mit Benchmarkinputs, Outputs, Skips und Versionsstempel; alle P0-Szenarien nachweislich ausgeführt.

### B-012 | API-Fehlerpfad und Skalierbarkeit absichern
**Code:** `backend/app/main.py`, `backend/app/terrain.py`, `backend/app/routing.py`  
**Ist:** Realer Request kann bei fehlenden Tiles 503, bei außerhalb/zu steil/keinem Weg 422 liefern; Cache/Lock und Warmup sind gut. Ein Graph mit vielen Zellen und wiederholten Dijkstra-Läufen braucht begrenzte CPU/RAM/Bearbeitungszeit. Nicht alle Eingaben sind auf Missbrauch / extrem lange Anfragen begrenzt.
**Fix:** Grenzen für Request-Länge, Koordinaten, science-stop-count und Solver-Budget; Timeouts, Ratenbegrenzung oder Queue-Schutz falls öffentlich; Fehlercodes strukturiert statt allein Texte. CORS für tatsächliche Deploy-Origins, nicht nur localhost; Health + Readiness getrennt.
**DoD:** Last-/Timeout-Test, wiederholter identischer Request, parallele verschiedene Requests; keine unkontrollierte Speicherexplosion oder fiktiver Erfolg; FE interpretiert 422/503 korrekt.

### B-013 | OpenAPI als Vertrag und TypeScript-Generierung
**Code:** `backend/openapi.json`, `backend/app/models.py`, `frontend/src/types/mars.ts`  
**Fix:** OpenAPI im CI neu exportieren und Diff als verpflichtenden Check ausführen; TS-Typen generieren oder automatischer Contract-Abgleich aus dem laufenden API-Schema; enums/Tags/Null-Werte präzisieren; Versionswechsel dokumentieren.
**DoD:** Änderung eines API-Feldes schlägt fehl, bis Frontend-Typen/Fixtures/Testdaten angepasst sind.

## P2 – Sinnvolle Erweiterungen, falls P0/P1 abgearbeitet

- Explicit return-to-base path / EVA consumable reserve + science-dwell time in a single mission plan.
- Sensitivitätsvergleich für Energie bei 2.0/3.0 km/h, Last und Reibungsannahmen (klar nicht NASA-validiert).
- Multi-Objective Pareto-Darstellung mit Distanz, Energie, Hazard und Science-Value; echte Pareto-Front nur bei entsprechendem Algorithmus.
- Einheitliche geospatial feature IDs / Datensatzversionen und Maschinenlesbarkeit der Provenienzkette.
- Gezielt hilfreiche Plots: Energie/Dauer gegen Geländeprofil, deutlich gekennzeichnete Unsicherheitsbänder statt unbegründeter Dezimalpräzision.

## Cross-Team API-Contract für Dev A – Priorität P0

| Feld/Vertrag | Verantwortung |
|---|---|
| Eindeutiges `objective` je Route / richtige Benennung | B definiert, A rendert |
| `energyJoules`, `distanceMeters`, `estimatedDurationSeconds`, `riskScore` | B berechnet, A unverändert darstellt |
| `maxSlopeDeg`, `meanSlopeDeg`, ggf. segmentweise Topographie | B berechnet, A präsentiert |
| `datasetId` / `routingGridResolutionMeters` / `modelVersion` | B liefert, A zeigt |
| `sourceMode` / `isValidatedRoute` / `warnings` | B definiert, A zeigt |
| `visitedSciencePointIds` und ggf. Zwischenstopps | B berechnet, A verlinkt |
| `sciencePointIds` / `via` als Request | A sendet, B validiert |
| 422 / 503 / Timeout als getrennte Zustände | B liefert, A unterscheidet |
| Layer-Metadaten, Legenden und Tileformate | B definiert, A dekodiert |

## Backend-Abnahmetests

| ID | Test | Bestehensbedingung |
|---|---|---|
| B-T01 | Flache synthetische Fläche | Energie/Distanz/Zero-Risk entsprechen Handrechnung |
| B-T02 | Steile Wand mit Lücke | Nur legale Lücke wird benutzt |
| B-T03 | Diagonales Corner Cutting | Keine Überquerung einer gesperrten Ecke |
| B-T04 | Distanz- vs. Energieoptimum | Nachweislich unterschiedliche und korrekt markierte Routen |
| B-T05 | Science Stop A→X→B | X auf Route, Zeit/Energie aller Legs enthalten |
| B-T06 | Start/Ziel außerhalb / Nodata / zu steil | 422 mit strukturiertem Grund, keine Fallback-Lüge |
| B-T07 | Fehlendes DEM | 503, keine angeblich geprüfte Marsroute |
| B-T08 | Große Route mit Resampling | effektive Zellgröße und Validität transparent |
| B-T09 | Full path vs. 200 waypoints | Länge/Risiko/Energie und Passierbarkeit konsistent |
| B-T10 | 6 Layer / Coverage / Legend | reale PNG-Bytes und Angaben stimmen |
| B-T11 | EVA-Missionsbilanz | Energie, O₂ und Time Limits aus denselben Waypoints / Modellparametern |
| B-T12 | Benchmark-Validierung | fester Dataset-SHA, Vergleich CTX/HiRISE/Rover reproduziert |
| B-T13 | CI live und ohne Daten | Pflichtprüfungen eindeutig als live/skipped unterschieden |
| B-T14 | FE/BE-Contract | echte Requests gegen laufende Services und Browser-Test |

## Dev-B-Abgabe an Integration

1. PR inkl. wissenschaftlich begründeter Algorithmen und Tests; keine numerischen Kennzahlen ohne reproduzierbare Herkunft.
2. API-Beispielantworten für `energy_min`, `distance_min`, `slope_hazard_min`, `science_via_waypoints` oder explizite De-Scope-Entscheidung.
3. Bericht `DATA_PROVENANCE.md` bzw. Erweiterung von `DATENQUELLEN.md` mit DOI/Produkt-URL, Tile-Datum, Gültigkeitsregion, Checksums, Unsicherheit und Lizenz/Attribution.
4. Nachweis von mindestens einer reproduzierten Live-Jezero-Benchmarkroute und fehlerhaftem Testfall.
5. Eingrenzung „planning prototype / non-operational / not safety-certified“ in API und Docs.
6. Kommunikation an Dev A vor jeder Änderung von Feldnamen, Risikoformel oder Grenzwerten.

**Kein fachlicher Sign-off**, solange B-001 bis B-006 ungeklärt sind oder UI/Abgabe stärkere wissenschaftliche Behauptungen machen als der Backend-Solver beweisen kann.