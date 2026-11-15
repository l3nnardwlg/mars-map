# MASTER REVIEW – TAG 2 / DEV B – BACKEND, WISSENSCHAFT, GEODATEN
**NASA Space Apps 2026 / MARS Pathfinder – Martian Map**  
**Auditstand:** 15.11.2026, `main` @ `92623830591765810f2290c0f6c1448d6c67bb87`  
**Vergleich:** Tag 1 @ `ffde4617b05d1664971143952fd892fe641a4fbc`; Backend-PR #12 gemergt.  
**Rolle:** Dev B. **Ziel:** reproduzierbarer, validierbarer Mars-Planungsprototyp; keine Flug-/Lebenserhaltungs-Zertifizierung. 100/100 ist interne Qualitätsambition, kein Juryversprechen.  
**Evidenz:** Sourcecode + GitHub CI + committed Benchmarkbericht; **keine unabhängige lokale Voll-DEM-Ausführung** in dieser Review-Sitzung.

## 1. Fortschrittsabgleich Tag 1

| Tag-1-ID | Tag-2-Fazit | Nachweis / Rest |
|---|---|---|
| B-001 Ziele | **KERNIMPLEMENTIERUNG FIXED** | `routing.py:14–15, 116–178`: drei echte SciPy-Dijkstra-Kostenfunktionen; `/api/routes/plan` liefert separate Routen. **Achtung:** `slope_hazard_min` minimiert Integralkosten, nicht zwingend den angezeigten `riskScore`. „2× Energiegrenze“ ist keine Optimierungsbedingung. |
| B-002 Science-Stop | **FIXED IM BACKEND** | `main.py:75–95`, `terrain.py:191–252`: IDs/Via, Teilstrecken und Routenpunkte. Frontend übergibt die Stops für alle Profile: **Integrations-P0**, A+B. |
| B-003 Diagonalen | **FIXED FÜR ZELL-ECKEN** | `routing.py:93–94` und `131–134`: orthogonale Nachbarzellen müssen passierbar sein. **Neuer Befund:** Übergangs-Steigung der KANTE ist nicht hart begrenzt. |
| B-004 Downsampling & Waypoints | **TEILWEISE** | Warnung bei grobem Grid, Erhaltung steilsten Punkts/Stops, `waypointLengthDifferencePercent`. Mittelwert-Resampling bleibt; Solver- und Mission-Geometrie nicht identisch. |
| B-005 EVA-Validität | **WEITGEHEND FIXED** | `mission.py` liefert Annahmen, Warnungen und peak-power; kein 2-way/Arbeitszeit/Reserve. Ein Gravity-Hinweis enthält eine nicht belegte Richtung der möglichen Abweichung. |
| B-006 Provenienz | **TEILWEISE** | Dataset-ID/Datum/native/effektive Auflösung/Version vorhanden; kein tatsächlicher Dataset-SHA pro Response, keine RouteInputBounds und keine Provenienz je clientseitigem Preview. |
| B-007 Risk-Index | **IM CODE VERBESSERT** | `path_statistics()` macht mittlere Hangneigung distanzgewichtet. Kein Auflösungs-/Unsicherheitskonvergenztest; Index bleibt nicht Unfallwahrscheinlichkeit. |
| B-008 HiRISE | **EHRLICHER GESCOPELT** | Offiziell Backend-CTX für Routing, HiRISE als optionale Kachel/Validierung. UI/Tour soll nur wirklich verfügbare HiRISE-Daten bewerben. |
| B-009 Layer-Metadaten | **TEILWEISE** | `status`, `coverage`, `zoom`, `codec`, `legend` ergänzt. Ein existierendes `metadata.json` zählt jedoch unmittelbar als `ready`, auch ohne prüfbare Kachel. |
| B-010 Repro-Build | **WEITGEHEND** | Docker-Actions laden CTX und routen testweise. Zusätzliche Layer bleiben bewusst optional. |
| B-011 Tests/Benchmark | **DEUTLICH VERBESSERT** | `BENCHMARK_REPORT.md`: 74 passed, 0 skipped **im Team-Datenlauf**; CI ohne DEM (laut `REVIEW_ANTWORT_DEV_B.md`) 59 passed/15 skipped. Report besitzt Datensatz-SHA-256. Nicht unabhängig nachgerechnet. |
| B-012 API/Last | **TEILWEISE** | `/ready`, Limits für Ziele/Stops/CORS ergänzt; keine Request-Budgets, strukturierte Fehlercodes, Rate Limits oder echte Lasttests. |
| B-013 OpenAPI | **TEILWEISE** | Committed OpenAPI-Diff-Test; Frontend setzt weiterhin manuelle Interfaces und weicht in der Semantik ab. |

## 2. P0 – Befunde, die die Validity-Wertung schädigen können

### B2-P0-01 – 15°-Sperre gilt nur für Zellen, NICHT für den Weg zwischen zwei Zellen
**Code:** `backend/app/routing.py:39–40, 123–145, 153–178` sowie `find_path_astar():89–103`  
**Ursache:** `passable_mask(slope)` prüft per zentralen Finite Differences die Hangneigung im Zellzentrum (≤15°). Für die Kante A→B prüft `_Graph` nur `passable[A] && passable[B]` (und diagonal angrenzende Zellen). Die direkte Steigung zwischen beiden Rasterpunkten `atan(abs(elev[B]-elev[A])/horizontalStep)` ist nicht selbst begrenzt. Ein steiler Höhensprung kann daher beide Zellzentren knapp unter 15° halten, während die Wegkante >15° ist.
**Minimaltest:** Gleichförmiges 2D-Raster mit Höhenreihe `[0,0,10,10]` m bei `cell_meters=20`. An den zwei mittleren Zellen schätzt der zentrale Gradient `10/(2×20)=0.25` → **14.04°**. Der direkte Übergang zwischen ihnen beträgt aber `atan(10/20)=26.57°`. Nach aktuellem Graph kann die Kante als zulässig gelten. Das ist ein statisch nachprüfbarer fehlender Constraint; eine vollständige Dijkstra-Reproduktion für diesen Fall ist als Test anzulegen.
**Fix:** In `_Graph.__init__` für **jede** Kandidatenkante zusätzlich `abs(rise)/flat <= tan(15°)` erzwingen; analog `find_path_astar()`. Diagonalen weiterhin auf freie orthogonale Nachbarzellen prüfen. Separat belegen, ob der 15°-Wert überhaupt als konservative, selbstdefinierte Projektannahme taugt.
**DoD:** `test_edge_grade_over_limit_is_blocked_even_if_both_cells_pass` plus diagonal/boundary/NoData. In Response: max. **edge grade** separat von max. **cell slope**; keine API-Route mit legalen Zellen, aber illegalen Kanten.

### B2-P0-02 – „Hazard-Min“ hat nur ein informatives Energiebudget, keinen Constraint
**Code:** `backend/app/terrain.py:241–251`, `routing.py:137–150`  
**Ist:** Graph minimiert `length×(0.05 +(meanSlope/15°)^2)`. Erst NACH dem Finden wird gegen `2 × Energy-Min` verglichen; `überschritten` landet nur im String und in einer Warnung, doch Route wird unter `lowest_hazard` uneingeschränkt ausgeliefert.
**Auswirkung:** Mission kann als „beste hazard-minimal Route innerhalb des Energie-Budgets“ verstanden werden, obwohl das Budget verletzt werden darf. Zudem kann die Route mit minimaler integrierter Hazard-Kostenfunktion einen **höheren** angezeigten `riskScore = 0.6×mean +0.4×peak` haben als eine andere Route. Beide Metriken sind nicht identisch.
**Fix:** Entweder das Energiebudget ausdrücklich als **informational trade-off only** umbenennen; oder tatsächlich unter Nebenbedingung optimieren (z. B. Label-setting/resource-constrained shortest path, dokumentiert mit Budget-Tests). „lowest hazard“ = niedrigster **integrated hazard exposure**, nicht garantiert niedrigster indexbasierter Risikoscore.
**DoD:** Konstruiertes Netz, bei dem niedrigster Hazard-Pfad Budget verletzt → API deklariert `constraintViolated` und deaktiviert den „within budget“-Claim **oder** findet beste zulässige Lösung. Regression, in dem Hazard-Integral und Peak-Risk-Index Rangfolgen unterschiedlich sind.

### B2-P0-03 – Mission/EVA nicht konsistent zum Solver-Vollpfad
**Code:** `backend/app/terrain.py:76–134`, `backend/app/mission.py:52–95`, `backend/app/main.py:98–103`  
**Ist:** `MarsRoute.distanceMeters/energyJoules` werden über **alle Raster-Zellschritte** berechnet, JSON enthält nur ca. 200 Waypoints. `POST /api/mission/simulate` nimmt diese **gekürzten** Waypoints und berechnet Distanz, Pandolf-Watt, O₂, Dauer erneut. Dadurch können Mission-Ergebnisse von derselben Routenkarte abweichen; Route-Polyline kann Zwischenanstiege verdecken. Warnschwelle für Längendifferenz ist 2%, aber `energy_joules`- und `peakPower`-Abweichung werden nicht getestet.
**Fix:** MissionEstimates serverseitig im Routing aus **Vollpfadsegmenten** erzeugen; alternativ signed routeId + konsistente serverseitige RouteCache-Referenz. Wenn Mission vom Nutzer frei eingegebene Wegpunkte simuliert, als separaten Modus deklarieren. Für Clientanzeige komprimierte Geometrie nur als vereinfachtes Rendering behandeln und Informationen über alle kritischen Segmente behalten.
**DoD:** Die `missionEstimate.durationSeconds`, `energyWh`, `oxygen` aus dem gleichen Vollpfad stimmen mit `route` unter numerischem Budget überein; Test mit sägezahnartigen Höhen und nur 10 JSON-Wegpunkten belegt, dass Gipfel-/Energieinformationen nicht verschwinden.

### B2-P0-04 – API-Layer „ready“ wird anhand der Metadata-Datei gesetzt
**Code:** `backend/app/data.py:14–20,109–136`, `backend/tests/test_api.py:34–45`  
**Ist:** Bereits eine Datei `thermal_inertia/metadata.json` reicht für `available=true`/`status=ready`. Der Test erzeugt genau so ein Verzeichnis **ohne eine PNG-Kachel** und erwartet `available=true`. `/ready` selbst prüft ebenfalls nur Existenz von DEM und `ctx_dem/metadata.json`. Das ist eine bestätigte Abweichung zwischen „katalogisiert“ und „darstellbar“.
**Fix:** Für `ready` tatsächlich vorhandene/prüfbare `z/x/y.png` und Coverage/Codec validieren; ideal `ready/partial/missing` differenzieren. NoData-Anteil aus Tile-Metadata, invalides JSON sauber handhaben und 503/availability bei beschädigter Startkarte.
**DoD:** Ein Layer mit reiner metadata.json ist `not-built/partial`, niemals `ready`; zerschnittene/defekte Datei, falsches Tileformat, fehlende Zoomlevel als Test.

### B2-P0-05 – Backendscience-Via funktioniert, aber Vertrag unterstützt gefährliche Frontend-Verwendung
**Code:** `backend/app/main.py:75–95`, `backend/app/models.py:110–116`, `frontend/src/services/marsApi.ts:407–495`  
**Ist:** `/routes/plan` kombiniert alle Objectives und alle Via-Stopps für jede Route. Der Backendvertrag ist damit fachlich konsistent für „Optimize A→X→B across objectives“, aber Frontend verwendet diesen Request als **Baseline A→B** plus **Science-Detour**. Dadurch entstehen falsche Jury-Vergleiche.
**Fix:** Dev B unterstützt Dev A mit expliziten Response-Beispielen und OpenAPI-Schemas: `baselinePlanRequest` ohne Stops und `scienceMissionRequest` mit `sciencePointIds`. Optional `routeSetType` / `viaStopsApplied` im Response. Keine stillen API-Änderungen; zwei getrennte, dokumentierte Requests sind ausreichend.
**DoD:** Integrationstest startet beide Services, prüft Baseline ohne X, Science-Route mit X und dass die Baselinewerte beim Hinzufügen von X gleich bleiben.

## 3. P1 – weiterhin relevante wissenschaftliche/operative Grenzen

### B2-P1-01 – Resampling.average kann Hindernisse „wegbügeln“
**Code:** `backend/app/terrain.py:52–73` – `MAX_CELLS=400_000` und `Resampling.average`  
Ein hoher Einzel-Pixelwall kann im gröberen Raster geglättet werden, bevor die `>15°`-Sperrmaske entsteht. Der Warntext nennt das, verhindert den falschen scheinbar passierbaren Pfad aber nicht.
**Fix:** Für Hazard-Masken konservatives Block-Pooling (bei irgendeiner nativ blockierten Zelle in passierter Grobzelle sperren), oder finaler Full-Resolution-Korridor-Check und Neuplanung/422. Mindestens kurz/weit Strecke und systematische Resolution-Tests. Das Label „solver resolution“ allein ist keine Sicherheit.
**DoD:** 20-m-Schranke bleibt auch bei 40/80-m-Suche gesperrt.

### B2-P1-02 – Legacy-Alternatives-Tags sind noch keine globalen Optimierungen
**Code:** `backend/app/terrain.py:163–184`  
`/api/routes/alternatives` markiert innerhalb der von Strafkorridoren erzeugten Energiealternativen den kleinsten Risiko- und Distanzwert als `lowest_risk` bzw. `shortest`. Das ist **nur bestes Exemplar der vorhandenen Kandidaten**, nicht globaler Wert – und manche Test-/Frontend-Altpfade können diese Tags weiter nutzen.  
**Fix:** Tags `shortest_among_candidates`, `lowest_risk_among_candidates` oder Legacy-Endpoint deprecaten; globale Ziele nur über `/api/routes/plan`. **DoD:** kein API-Konsument kann einen solchen Tag mit globalem Solveroptimum verwechseln.

### B2-P1-03 – Metabolic Gravity-Hinweis enthält unbelegte Richtung
**Code:** `backend/app/mission.py:42`  
`gravity_treatment` sagt: Pandolf für 1g, „Energie daher eher zu niedrig“. Ohne modellvalidierte 0.38g-Anpassung ist die **Richtung der Verzerrung nicht gesichert**. Körpergewicht, Anzug/Last, Geschwindigkeit, Gangmechanik wirken gegenläufig; keine scheinbar gerichtete Unsicherheitsbehauptung.
**Fix:** „1g empirical model; Mars-specific bias unknown; not calibrated for suit/0.38g“; separates NASA-Quellenzitat für jede Annahme. **DoD:** Scope-/Physikreview ohne ungestützte Über-/Unterschätzungsrichtung.

### B2-P1-04 – Schwerkraft-/O₂-Modell nicht „NASA EVA safety certified“
`mission.py` kennt nominale Grenzen 8h, 350W, 530W, aber weder Ruhezeit noch Pause/Arbeit, reale O₂-Reserven, Anzugmasse noch Rückweg. Kritischer 15°-Schwellenwert basiert auf gewählten experimentellen/konservativen Annahmen. `withinEvaTimeLimit` = im Modell unter 8h, **nicht** garantiert sichere EVA.  
**Fix:** klare Beschriftung „screening estimate“, optional separate Dauer+Science-Dwell+Return-to-Base Rechnung. Stopps nicht als durchgeführte Sample Collection ausgeben.

### B2-P1-05 – Rasterauflösung nur als horizontale Kennzahl
**Code:** `terrain.py:64–65` verwendet `src.res[0]` und Breiten-Faktor. Bei ungleichen X-/Y-Pixelmaßen oder nicht quadratischer Output-Auflösung verwendet der Solver einen Skalierungswert für beide Achsen; dies ist nur für quadratisch normierte Projektionen korrekt. **DoD:** Test mit anisotropen/verschiedenen Projektionen oder klare Input-Assertion `abs(resX-resY)<tol`.

### B2-P1-06 – Provenienz/Benchmark-Lauf ist gut, aber noch nicht unveränderlich genug
`backend/BENCHMARK_REPORT.md`: 74 passed, 0 skipped, 2 warnings, DEM SHA-256 `ba7f706ea1b5d63a562f28a7dcf7a7f3c79bce7f048e6974b57e8a33c30d1ba2`, Commit `3d9dde6`, Branch `feature/nasa-data`, Report-Datum `15.11 10:21 UTC`. Das ist **ein Teambericht auf Vor-Merge-Commit**, keine unabhängige Wiederholung auf finalem `9262383`. CI im GitHub-Runner enthält nicht alle Rohdaten und überspringt DEM-Tests.  
**Fix:** Auf dem finalen SHA gleiche Datei + Python-Version/OS/SciPy/Rasterio und reproduzierte Inputs/Responses dokumentieren; JSON-Ausgabe als unveränderliches CI-Artefakt. **DoD:** Re-run mit identischen Daten und tolerierten Routenwerten.

### B2-P1-07 – Testdeckung: Pflichtjobs mit Full-DEM fehlen
**Code:** `.github/workflows/backend.yml`: `pytest`; `docker.yml`: HTTP-Smoke, kein voller `/api/routes/plan`-Benchmark in GitHub Actions. Der Projektbericht weist selbst 59/15 skipped ohne DEM aus.
**Fix:** Unit-fast als Pflicht, DEM-integration mit Datencache oder klarer manueller signed-off Beweismappe; Live-FE/BE Contract und Browser-E2E als eigenes Pflichtgate. **DoD:** Statusbericht zeigt ausdrücklich passed/skipped/fail und Datensatz-SHA.

### B2-P1-08 – Request-Planer in öffentlicher Demo ohne Zeitbudget/Rate Limit
`/api/routes/plan` kann für 3 objectives×7 Wegpunktsegmente je Dijkstra-Berechnung Graphen bis 400k Zellen mehrfach rechnen; `_SPERREN` vermeidet gleiche gleichzeitige Berechnung, schützt aber nicht vor vielen unterschiedlichen Inputs. Keine eigene Route-Timeout-/Concurrency-Grenze.  
**Fix:** max. Routenfenster / Zeitbudget, Request-RateLimit, structured error codes, Abbruchstatus 429/503 und cache warm-up. **DoD:** paralleler Last-/Abbruchtest, keine unbegrenzte CPU-/Memory-Blockade während Jury-Demo.

### B2-P1-09 – Science Point ID ≠ durchgeführte Probenentnahme
`visited_science_point_ids` spiegelt die angeforderten Stopps und den durchgehenden Planpfad wider, nicht den tatsächlichen Missionsablauf. Keine automatische wissenschaftliche Gewichtung der Probe; `sciencePointIds` vor `via` sortiert, nicht die Eingangsmischreihenfolge.  
**Fix:** Namen wie `plannedScienceStops` und `reachedByRouteGeometry` dokumentieren; „sample collected“ im Pitch entfernen, Stop-Order explizit. Probenbuchung als simulierte Aktion nur bei entsprechendem UI-Beleg.

## 4. Fachliche Gegenprüfung mit benchmark / Datenquellen

**Dokumentierter Referenzfall (Team-Bericht, nicht unabhängig nachgerechnet):**  
A = 18.38°N / 77.58°E, B = 18.44°N / 77.45°E; CTX 20m; `modelVersion=2026-11-15`.

| Route | Strecke | Energie | Index | max. Zell-Slope | Hinweis |
|---|---:|---:|---:|---:|---|
| energy_min | 8,777 m | 2.433 MJ | 0.327 | 9.05° | geringste Energie |
| distance_min | 8,776 m | 2.437 MJ | 0.329 | 9.05° | kürzeste Graph-Geometrie |
| slope_hazard_min | 8,891 m | 2.521 MJ | 0.238 | 6.83° | minimaler **integrierter** Hazard-Objective |
| via `probe-14-15` | 14,788 m | 4.069 MJ | nicht als gleichwertiger Baselinewert gegeben | – | expliziter Stopp, nicht 36 „cores“ |

Das sind gute Demo-Zahlen, **falls** die UI tatsächlich dieselben Ziele und dasselbe Input-Szenario zeigt. Kein Wert ist eine empirische Unfallwahrscheinlichkeit.

## 5. Dev-B-Tests Tag 2 (Pflicht)

| ID | Test / Expected |
|---|---|
| B2-T01 | Zell-Slope 14.0°, Kanten-Slope 26.6° ⇒ Übergang gesperrt |
| B2-T02 | Diagonale passabel nur bei freien Orthogonalzellen UND Steigungs-/NoData-validierter Kante |
| B2-T03 | Hazard-Objective verletzt 2× Energie: bewusst rejected/constraint flag; keine stille „safe“ Markierung |
| B2-T04 | Hazard-Integral und angezeigter Risk-Index widersprechen im Gegenbeispiel ⇒ Labels fachlich korrekt |
| B2-T05 | Full Solver Path vs. JSON-Waypoints: Distanz/Energie/Peak/O₂ auf gleichartiger Referenz |
| B2-T06 | Downsample 20→80m mit Einzel-Klippe: keine falsche passable Querung |
| B2-T07 | `metadata.json` allein ⇒ Layer **nicht** als ready bezeichnet |
| B2-T08 | fehlende/wrong-codec Tiles ⇒ 503/partial und klare UI-Verfügbarkeit |
| B2-T09 | `/routes/plan` ohne Stopps vs. mit `probe-14-15` ⇒ Baseline bleibt unverändert |
| B2-T10 | Legacy `/routes/alternatives` kann globale Shortest/Risk-Optima nicht behaupten |
| B2-T11 | 3 Ziele × 6 Stopps / parallele Requests ⇒ begrenzte Laufzeit und Memory-Budget |
| B2-T12 | Final-Merge-SHA + DEM-SHA erzeugen gleichen Benchmark mit dokumentiertem Runtime-Setup |
| B2-T13 | 422/503/429 und alle Pydantic-Schemafehler im Live-Frontend verstanden |
| B2-T14 | Exakte Missionsannahmen (0.38g), no-return/no-work und Quelle klar kommuniziert |

## 6. Aufgabenteilung bis Release

- **Dev B sofort:** B2-P0-01 Kantensteigung als echte Sperrbedingung, B2-P0-02 Energiebudget semantisch korrekt, B2-P0-03 Mission-Vollpfad, B2-P0-04 Layer-ready. API-Semantik direkt an Dev A geben.
- **Dev B+Dev A:** B2-P0-05 zwei getrennte Baseline-/Science-Requests; gemeinsamer echter Live-Test; keine falschen `objective`-Karten mehr.
- **Danach:** Downsampling-Validierung, alte Endpoint-Tags, endgültiges OpenAPI/SHA-Freeze, Lastschutz.
- **Wissenschaftlicher Scope:** Für NASA-Jury als reproduzierbarer *research/planning prototype*, niemals reale EVA-Risiko-/Sicherheitsgarantie.

**Sign-off nur für:** P0-Testartefakte + finaler Commit + Datenhash + vollständig gleiche Zahlen im Frontend und Abgabe. **„74 passed“ allein erfüllt dies nicht.**