# MASTER REVIEW – TAG 1 / DEV A (Frontend & 3D)
**Projekt:** MARS Pathfinder – Interplanetary Survival Guide: Martian Map  
**Review-Baseline:** main @ ffde4617b05d1664971143952fd892fe641a4fbc, 14.11.2026  
**Owner:** Dev A / Frontend  
**Ziel:** Eine wissenschaftlich korrekte, robuste und überzeugende interaktive Jury-Demo. Ambition: höchstmögliche Bewertung nach Impact, Creativity, Validity, Relevance, Presentation. **100/100 oder Global Winner sind Ziele, keine Garantien.**
**Status:** offener Maßnahmenkatalog, nicht als erledigt markieren, bevor ein reproduzierbarer Nachweis vorliegt.

> **Stop-the-line-Prinzip:** Keine Sicherheits-, NASA- oder Optimierungsbehauptung darf über die nachweislich implementierte Funktion hinausgehen. Keinen „grünen“ Test als Beleg für eine andere Funktion zitieren.

## Vorab: Was bereits vorhanden ist

- React 19 / Next.js 16 / React Three Fiber: interaktiver Mars-Globus, lokale Jezero-Terrain-Ansicht, RouteMesh, MissionHUD, Astronaut-Modus, Messwerkzeug, Minimap, Missions-Replay und Guided Jury Tour.
- Die Integration mit FastAPI funktioniert grundsätzlich; es gibt erfolgreiche Frontend- und Docker-CI-Läufe. **Das beweist nicht jeden Browser-Workflow.**
- Ein wirklicher DEM-Backendsolver existiert, ebenso separate Frontend-Referenzberechnungen; die beiden Modi sind fachlich nicht gleichwertig.
- Backend liefert sechs benannte Datentypen und 36 Science Points, die Oberfläche zeigt aber nur eine Auswahl.

## P0 – MUSS vor jeder Global-Jury-Demo behoben werden

### A-001 | Falsche Semantik von Direct / Safe / Science
**Code:** `frontend/src/services/marsApi.ts`, `frontend/src/store/useMissionStore.ts`, `frontend/src/components/ui/MissionHUD.tsx`, `frontend/src/components/ui/ElevationProfileChart.tsx`  
**Ist:** `requestRouteAlternatives()` ordnet Backend-Routen nach Arrayposition `direct`, `safe`, `science` zu. Das Backend optimiert Energie und erzeugt alternative Korridore, jedoch keine garantierte „kürzeste“, „risikoärmste“ oder „Science-über-Probe“-Lösung. Tags wie `shortest` und `lowest_risk` sind vorhanden, werden im Frontend nicht zuverlässig als maßgebliche Auswahl verwendet. Fehlen Alternativen, können Varianten dieselbe Route referenzieren oder eine synthetische Science-Route entsteht.
**Fix:** Mit Dev B eindeutigen API-Vertrag definieren: explizites `objective`, `constraintStatus`, `visitedSciencePointIds`, `provenance` und echte Ziele. Auf tatsächlichen Backend-Tags/IDs statt Arrayposition abbilden. Bis B fertig: ehrliche UI-Bezeichnungen wie „Energy-optimal / Alternative corridor 1 / Alternative corridor 2“; keine garantierten Winkel, Umwege oder Besuche. Wenn nur eine Route existiert, weitere Profile deaktivieren statt Duplikate als echte Lösungen auszugeben.
**Definition of Done:** Für mindestens drei Start-/Ziel-Szenarien gibt die UI exakt die Backend-Objektive, Metriken und besuchten Science-Points an; bei nur einer Lösung wird genau eine Lösung dargestellt. Ein automatisierter Test verhindert positional mapping.

### A-002 | „Hypsometric“-Darstellung ist nur ein horizontaler Farbverlauf
**Code:** `frontend/src/components/canvas/TerrainPrototype.tsx`  
**Ist:** Die als Höhenfarbkarte angebotene `hypsometricMap` ist eine 256×1-Gradiententextur; die Farbe wird nicht auf den DEM-Höhenwert pro Terrainzelle gemappt. Die Oberfläche suggeriert eine wissenschaftliche Höhenkartierung.
**Fix:** Georeferenzierte Höhenklassifikation pro DEM-Pixel, z. B. in Shader oder per abgeleitetem Raster. Legende in realen MOLA-Areoid-Metern inklusive min/max, NoData und Einheit. Für Slope-Farben ebenso klare Schwellen und Unterschied zwischen visuellem Terrain und Routenmodell.
**Definition of Done:** Zwei räumlich getrennte Pixel mit gleicher physischer Höhe haben (bei gleichem Farbmodus) gleiche Höhenfarbe; automatischer Raster/Pixel-Test plus Screenshots belegen dies. Kein links-nach-rechts-Farbverlauf als angebliche Höhenskala.

### A-003 | Offline-Fallback erzeugt unvalidierte Routen; potenziell synthetische Messwerte
**Code:** `frontend/src/services/marsApi.ts`, `frontend/src/utils/demSampler.ts`  
**Ist:** Fallback-Routen werden über feste Sinus-Kurven und 36 Interpolationsschritte erzeugt, nicht mit Geländesuchalgorithmus. Wenn das PNG nicht geladen ist, liefert `sampleHeightAtUV()` eine mathematische Ersatztopographie. UI nennt sie teilweise „verified reference“ und erstellt Sicherheits-/Energie-Labels.
**Fix:** Zustand explizit modellieren: `backend-live`, `offline-dem-demo`, `data-unavailable`. Keine erfundenen Echtzeit-Routen oder als „NASA verified“ dargestellten Ersatzhöhen. Synthetische Demo allenfalls mit großer Kennzeichnung „ILLUSTRATIVE / NOT ROUTE-VALIDATED“, nicht zur Sicherheitsentscheidung. 422 vom Backend MUSS ein Fehler bleiben und darf nicht mit einer Ersatzroute maskiert werden. Zeitlimits auf Fetch-Anfragen hinzufügen, sofern als Feature beworben.
**Definition of Done:** Browser-Test für Backend online, Backend aus, DEM 404, Backend 422, 503 und Timeout. In keinem Fehlerfall erscheint eine ungeprüfte Route als „SAFE“, „A*“, „NASA validated“ oder „lowest-risk“.

### A-004 | Sechs Backend-Layer, aber nur drei echte visuelle Oberflächenmodi
**Code:** `frontend/src/components/ui/LayerManagerModal.tsx`, `frontend/src/components/canvas/TerrainPrototype.tsx`, `frontend/src/services/marsApi.ts`  
**Ist:** Im Katalog werden `ctx_dem`, `hirise_dem`, `slope_ctx`, `ctx_ortho`, `geology`, `thermal_inertia` gelistet. Auswahl von Katalogeinträgen schaltet diese jedoch nicht als Kartenebenen ein; die Karte verwendet lokale statische Bilder. „available“ bedeutet nicht, dass der Browser einen Layer anzeigen kann.
**Fix:** Mindestens funktionierende Overlay-Auswahl für geologische Einheiten und Wärmeträgheit, dazu CTX/HiRISE-Höhentexturen mit realer Provenienz, NoData-Maske und Einheiten, sofern verfügbare Kacheln existieren. Bei fehlenden Tiles klarer Disabled-Zustand. Exakte Tile-URL und Decoding-Vertrag mit Dev B festlegen; kein irreführendes HRSC/Ortho-Label, wenn tatsächlich CTX-Ortho gerendert wird.
**Definition of Done:** Jeder als „darstellbar“ markierte Layer verändert nachvollziehbar die Karte; Stichprobe gegen die API-Tiles und Legende; in sauberem Standard-Compose wird nicht fälschlich „6/6 verfügbar“ behauptet. Nicht verfügbare Layer werden ehrlich ausgegraut.

### A-005 | Wissenschaftlich unzulässige feste Benchmarkzahlen in Live-UI & Jury Tour
**Code:** `frontend/src/components/ui/MissionHUD.tsx` (ca. Z. 615–658), `frontend/src/components/ui/GuidedJuryTour.tsx` (Step 3), `docs/JURY_DEMO_SCRIPT.md`, `docs/AI_USAGE.md`  
**Ist:** Live-Karten-Erzählung behauptet 18,5° „direct“, unter 8° „safe“, 72,4% → 28,2%, +550 m, +650 m. Aktuelles Backend verwendet 15°-Sperre und dokumentiert für alte Referenzfälle andere Werte (96,5% → 37,6%). Die Zahlen belegen nicht automatisch die gerade gerechnete Route.
**Fix:** Alle Live-Erklärungen aus aktuellen API-Ergebnissen generieren. Vorab berechnete Beispiele nur mit klaren, reproduzierten Koordinaten, Datenbasis, Solver-Version, Datum, Begrenzungen und dem Etikett „reference scenario“, niemals als aktuelles Nutzerergebnis. Wo keine Messung vorhanden ist, Text entfernen. Abstimmung mit Dev B über Referenzszenario.
**Definition of Done:** Jede gerenderte Prozent-, Winkel-, Distanz-, Energie- und Probenbesuch-Aussage lässt sich in einer JSON-Antwort oder eindeutig dokumentierter statischer Referenz nachweisen; Demo-Script, UI und Docs stimmen überein.

### A-006 | Verschiedene Geländeauflösungen und Metadaten werden vermischt
**Code:** `frontend/src/utils/demSampler.ts`, `frontend/src/utils/coordinates.ts`, `frontend/public/terrain/metadata.json`, `frontend/src/services/marsApi.ts`  
**Ist:** Das 256×256-Client-PNG wird über ca. 349 × 396 Meter pro Pixel gesampelt, der Backend-CTX-Datensatz hat nativ ca. 20 m; Backend kann zusätzlich downsamplen. `metadata.json` enthält andere Grenzen und Höhenextrema als die Clientkonstanten. Bei Backend-Routen wird das Höhenprofil aus einem groben Client-Bild neu erstellt, der Risikowert aber vom Backend übernommen.
**Fix:** Eine gemeinsame, versionierte Terrain-Provenienz / georeferenzierte Metadatenstruktur, dynamisch geladen; UI zeigt native und tatsächlich genutzte Samplingauflösung getrennt. Für Live-Routen Höhenprofil/Metriken aus exakt derselben Routen-Geometrie und denselben serverseitigen Höhen ableiten; Client-Preview ausdrücklich nur Preview nennen. Unbekannte Höhen = unbekannt, niemals automatisch „präzise“.
**Definition of Done:** Für drei Testpunkte stimmen UI-Elevations mit serverseitigem Ursprung innerhalb definierten Daten-/Quantisierungsbudgets überein; DEM-Ausfall wird sichtbar; keine widersprüchlichen BBOX-/Auflösungsangaben.

## P1 – Stark empfehlenswert für Global-Award-Qualität

### A-007 | 36 Science Points im Backend, nur 15 im 3D-Layer
**Code:** `frontend/src/components/canvas/SciencePointsLayer.tsx:92`  
**Fix:** `slice(0, 15)` entfernen; 36 echte Punkte anzeigen, mit Filtern (Samples / Landing / Rover / Named Features), Clustering/LOD und klickbarer Suche. Der ausgewählte Science-Point soll dem Routing als echtes Ziel übergeben werden und in der Route nachweisbar auftauchen.
**Done:** 36/36 aus API via Filter/Ansicht erreichbar, keine Duplikate; alle Nutzerinteraktionen per Playwright dokumentiert.

### A-008 | User-Config des Hanggrenzwinkels wirkt nicht auf den Backend-Solver
**Code:** `LayerManagerModal.tsx`, `useMissionStore.ts`, `backend/app/routing.py`  
**Fix:** Entweder Slider als **Inspector-only visualization threshold** beschriften oder Dev B implementiert ein modelliertes Feld mit validiertem Range und exakter Server-Routenberechnung. Nicht suggerieren, ein 8°-Wert ändere den 15°-Sicherheitsfilter im Backend.
**Done:** UI-Wortlaut korrekt; API-/UI-Verhalten per Test.

### A-009 | Kein echter 1,7-m-Astronaut, keine echte „unpassierbare“ Klippe
**Code:** `frontend/src/components/canvas/AstronautController.tsx`  
**Ist:** `eyeHeight = 0.045` wird als „~1.7m“ beschrieben, obwohl 8 Scene Units eine regionale Geländebreite von vielen Kilometern darstellen. Bei >25° wird Bewegung nur auf 22% reduziert, nicht gesperrt. Andere Schwellen als im Backend; Einheiten von Szene-Geschwindigkeit und km/h sind nur visuell vergleichbar.
**Fix:** Einheitenumrechnung definieren oder astronomische Realmaßstäbe als stilisierte Perspektive kennzeichnen. Kollisions-/Passierbarkeitsprüfung vor Bewegung; Wände und Randfälle testen; physische Bewegung nur dann behaupten, wenn Kalibrierung vorhanden ist.
**Done:** Kein Traversieren einer als „impassable“ definierten Testkante; Szenenmaßstab und Geschwindigkeit dokumentiert; HUD keine falschen Meterangaben.

### A-010 | Glättung kann route geometrisch vom Solver-Pfad wegziehen
**Code:** `frontend/src/components/canvas/RouteMesh.tsx`  
**Ist:** `THREE.CatmullRomCurve3` kann Kurven zwischen Wegpunkten bilden, die vom sicherheitsgeprüften Rasterpfad abweichen; Backend sendet bis zu 200 Wegpunkte.
**Fix:** Original-Polyline für fachliche Darstellung, optional visuelle Glättung nur mit Kollisions-/Steigungsnachweis. Keine vorgetäuschte passierbare Kurve bei fehlenden Zwischenpunkten.
**Done:** Routenmesh bleibt innerhalb dokumentierter Toleranz des Serverpfads; visueller Screenshot und geometrischer Test.

### A-011 | Höhenprofil X-Achse nicht proportional zur echten Entfernung
**Code:** `frontend/src/components/ui/ElevationProfileChart.tsx`  
**Ist:** `getSvgCoords()` verwendet Arrayindex statt `distanceKm`. Bei ungleichmäßiger Punktdichte sind räumliche Proportionen verfälscht.
**Fix:** X = kumulative Distanz / Gesamtdistanz; Hover an tatsächlicher Segmentposition interpolieren; mehrere Vergleichsrouten nur mit gemeinsamer Distanz-Skalierung anzeigen.
**Done:** Test mit ungleichmäßig beabstandeten Punkten: korrekte X-Koordinaten und Tooltip.

### A-012 | Vermeintlich „live“ / „exact“ sind teilweise feste oder modellierte Werte
**Code:** `MissionHUD.tsx:244`, `AstronautHUD.tsx`, `TerrainInspector.tsx`  
**Ist:** Topbar zeigt feste -2400 M, NASA-Telemetrie ist teils simuliert, Inspector zeigt geringe 8-Bit-Quantisierungsunsicherheit, obwohl räumliche Resamplingunsicherheit hinzukommt.
**Fix:** Feste Werte durch ausgewählte echte Karte/Position ersetzen oder als Referenz bezeichnen. METRICS nach `measured`, `derived`, `assumed`, `illustrative` differenzieren. Keine implizite NASA-Sicherheitszertifizierung.
**Done:** Jede prominente Kennzahl besitzt Datenquelle, Einheit, Zustand, Unsicherheitsgrenze.

### A-013 | Fehlender echter Browser-E2E-Test
**Code:** `frontend/scripts/test_e2e_mission.mjs`, `frontend/scripts/verify_api_contracts.mjs`, `.github/workflows/frontend.yml`  
**Ist:** Das „13-step E2E“-Script simuliert einen eigenen JS-State, kann mit Fixtures bestehen und bedient nicht die reale Web-App. Der Frontend-CI-Workflow startet kein Backend. CI grün ≠ geprüfter Mission-Workflow im Browser.
**Fix:** Playwright oder gleichwertiger Browser-Runtime-Test gegen reale Compose-Instanzen: Rendern → Terrain → 2 Doppelklicks → echte Route → Profilwechsel → Science Point → Missionsmetrik → Layer → Inspector → Fehlerfall. Fixtures als Unit-/Contract-Test separat kennzeichnen.
**Done:** CI-Job mit Screenshots/Traces, produktionsgleichem Start und klar markierten Daten-Modes; mindestens ein echter Server-E2E-Pfad.

### A-014 | Responsiveness, Ladefehler, Performance und Zugänglichkeit
**Code:** `MissionHUD.tsx` (~961 Zeilen), `MarsScene.tsx`, `MarsGlobe.tsx`, `OnboardingModal.tsx`  
**Fix:** Mindestens 1366×768, 1920×1080 und kleines mobiles Viewport prüfen; HUD-Panels dürfen Routenpunkte nicht verdecken. WebGL-unsupported, Textur-404, langsame GPU, Keyboard-/Screenreader-Bedienung; keine 60-FPS-Garantie nur wegen rAF-Tracker. GLTF/8K Texturen nicht unreflektiert auf Mobilgeräte übertragen.
**Done:** Screenshots, Console ohne Runtime-Exceptions, visuelle Regression und Lade-/Offline-Fallback.

## P2 – Nach nachgewiesenem P0/P1-Fix

- Stabiles Auto-Camera-Framing der Vergleichsrouten und Science-Stops; sichtbarer Start, Ziel, Umweg und Legende.
- Einsatz eines festen Demo-Benchmarks mit echter Live-Solver-Antwort und nachvollziehbarem „why route A vs route B“.
- Visualisierung von Datengüte (CTX/HiRISE Coverage, NoData, 20-m-Grenze, DEM-Abweichungen) statt allein dekorativer Badges.
- Export eines nachvollziehbaren Mission-Briefings mit Modellannahmen, Version, Standorten, Routen-Zielen und Quellen.

## Verbindliche Akzeptanzmatrix / Tests (Dev A)

| Test-ID | Szenario | Erwartung |
|---|---|---|
| A-T01 | FastAPI online, bekannte Jezero-Punkte | UI zeigt echte Serverroute, gleiche Tags/Metriken, eindeutige Provenienz |
| A-T02 | Backend 422 (zu steil / außerhalb) | klare 422-Meldung, keine erfundene sichere Route |
| A-T03 | Backend 503 oder down | Offline-Demo klar markiert, niemals als Echtberechnung |
| A-T04 | DEM-PNG 404 / decode fail | „data unavailable“ statt synthetischer wissenschaftlicher Messwert |
| A-T05 | Layer geology / thermal | sichtbare korrekte Überlagerung oder nicht verfügbar |
| A-T06 | Science points 36/36 | jeder Punkt auffindbar; Auswahl steuert Route korrekt |
| A-T07 | Hypsometric Farbkarte | Farbe entspricht tatsächlichem Höhenwert |
| A-T08 | Terrain exaggeration ×1/×2.5 | alle physikalischen Messwerte bleiben identisch |
| A-T09 | Profil A/B/C und nur eine Route | keine falschen Labels oder Duplikate |
| A-T10 | Steilwand & Astronaut | passierbar/unpassierbar eindeutig, Bewegung konsistent |
| A-T11 | Browser Full Flow | Screenshot + Trace + API-Responses |
| A-T12 | Jury-Tour & Demo-Text | 0 widersprüchliche Winkel, Prozente oder Sicherheitsversprechen |

## Dev-A-Abgabe an Integration

1. PR mit P0-Fixes, konkreten Bildbeweisen und Erklärung jeder gekürzten/entfernten Claim.
2. Contract-Vorschlag an Dev B für `RouteObjective` / `provenance` / `ScienceWaypoint`; keine stillen API-Annahmen.
3. Nachweis, ob Browser-E2E LIVE oder FIXTURE durchlief; genauer Commit-SHA und Befehle.
4. Vorher/Nachher-Tabelle aller Anzeige- und Datengenauigkeitsfehler.
5. Keine Änderung an Demo-Benchmarkwerten ohne Dokumentation der zugrunde liegenden Live-Resultate.

**Keine Freigabe**, solange A-001 bis A-006 nicht nachvollziehbar erledigt oder ausdrücklich in der Jury-Demo als nicht implementiert ausgeklammert wurden.