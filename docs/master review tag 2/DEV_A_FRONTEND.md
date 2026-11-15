# MASTER REVIEW – TAG 2 / DEV A – FRONTEND
**NASA Space Apps 2026 / MARS Pathfinder – Martian Map**  
**Auditstand:** 15.11.2026, `main` @ `92623830591765810f2290c0f6c1448d6c67bb87`  
**Vergleich:** Tag 1 @ `ffde4617b05d1664971143952fd892fe641a4fbc`, Frontend-PR #13 (gemergt).  
**Rolle:** Dev A. **Ziel:** Global-Award-taugliche, glaubwürdige Demo. Intern auf 100/100 optimieren, aber nicht als Juryergebnis ausgeben.  
**Prüfmethode:** Repository-Source, Merge/Commit-Liste, CI-Konfiguration und GitHub-Actions-Status. **Keine unabhängige Browser-Sitzung / lokale App-Ausführung** im Review; daher keine tatsächliche UX-Freigabe.

> [P0] = Release-/wissenschaftlicher Wahrheitsblocker, [P1] = hohe Qualitäts- oder Demo-Gefährdung, [P2] = Polish. Jeder Fix erfordert Commit/PR, automatischen Test und bei UI-Fixes Screenshot/Playwright-Trace.

## 1. Status der Tag-1-Aufgaben (kein blindes „A-001 bis A-013 erledigt“)

| Tag 1 | Tag 2 | Code-Evidenz |
|---|---|---|
| A-001 – Route-Ziele | **TEILWEISE / P0-BUG** | `marsApi.ts:413–495` mapped jetzt nach `objective`; **Science-Stop wird aber in einem Request für alle Profile erzwungen**, anschließend überschreibt `scienceVisited` die Science-Route mit der ersten Route. |
| A-002 – Hypsometric | **WEITGEHEND FIXED** | `TerrainPrototype.tsx:70–92` nutzt `generateHypsometricCanvas()` aus DEM-Bild. Pixel→Farbe statt horizontaler Dummy-Gradient. Gilt für grobes 8-Bit-Preview, nicht für native 20-m-Daten. |
| A-003 – Offline-Synthetic | **NICHT GEFIXT / P0** | `demSampler.ts:125–131` liefert ohne geladene PNG weiterhin synthetische Hügel; `marsApi.ts:341–392` und `505–525` erzeugen weiter Sinus-Routen und geben Wissenschafts-/Risiko-Werte aus. Labels wurden verbessert, Routing nicht. |
| A-004 – echte Layer-Overlays | **NICHT GEFIXT / P1** | `LayerManagerModal.tsx:180–248` setzt `selectedLayerId` nur lokal; `TerrainPrototype` zeigt ausschließlich Ortho/Hypsometric/Slope aus statischen lokalen Texturen. |
| A-005 – feste falsche Juryzahlen | **TEILWEISE FIXED / P0-REST** | `GuidedJuryTour.tsx` und `JURY_DEMO_SCRIPT.md` nutzen neue Backend-Benchmarkzahlen, aber Tour schaltet falsche Profile und tut so, als seien die Benchmarkresultate aktuell sichtbar. Root-README und Final-Checklist sind alt. |
| A-006 – DEM-Metadaten | **TEILWEISE** | Client-JSON und `NASA_DEM_METADATA` haben jetzt gleiche Bounds/Range. Live-Routen werden aber mit Client-Preview-Höhenprofil und Slope erneut angereichert; 256²-Kartenwerte bleiben fachlich verschieden vom Server. |
| A-007 – Science 36/36 | **FIXED IM SOURCE** | `SciencePointsLayer.tsx` entfernt `slice(0,15)`. Browser-Performance und Filter noch nicht unabhängig geprüft. |
| A-008 – Slope Threshold | **FIXED ALS UI-KLARSTELLUNG** | `LayerManagerModal.tsx:118–129` deklariert Inspector-only. |
| A-009 – Astronaut | **TEILWEISE** | Harte 15°-Bewegungssperre statt bloßer Verlangsamung implementiert; Client-Preview kann jedoch von Server-Sperrmaske abweichen, physischer Maßstab bleibt stilisiert. |
| A-010 – Spline-Cornercutting | **TEILWEISE** | `RouteMesh.tsx:31–37` verwendet LineCurves statt Catmull-Rom. Direkte Linien zwischen bis zu 200 ausgegebenen Punkten sind ohne Vollpfadvalidierung dennoch kein gesicherter begehbarer Verlauf. |
| A-011 – Profile Chart X-Achse | **FIXED IM SOURCE** | `ElevationProfileChart.tsx:46–54` rechnet `distanceKm / maxDistKm`. |
| A-012 – Kennzahl/Provenienz | **TEILWEISE** | Start-Höhe dynamisiert, mehr API-Provenienz; `A* Pandolf` / `NASA & ESA Data` und Quantisierungsunsicherheit bleiben problematisch. |
| A-013 – E2E | **NICHT GEFIXT / P0** | `frontend/scripts/test_e2e_mission.mjs` führt weiterhin nur selbst aufgebauten Node-State aus, kein Playwright/Chromium. `test:contract` fällt bei Backend-Ausfall auf eigene Mock-Schemas zurück. |

## 2. Neue und verbliebene P0-Bugs – exakt zu beheben

### A2-P0-01 – Science-Stop verfälscht die gesamte Vergleichsgruppe
**Code:** `frontend/src/store/useMissionStore.ts:305–320`, `frontend/src/services/marsApi.ts:407–495`  
**Reproduzierbare Codefolge:** `calculateRoute()` setzt `targetScience = selectedSciencePoint?.location || sciencePoints[0]?.location`; `requestRouteAlternatives` schickt `sciencePointIds` oder `via` mit **allen drei** `objectives` in genau EINEM `/api/routes/plan`-Request. Damit werden `distance_min`, `energy_min` und `slope_hazard_min` ALLE über den Science-Stop geplant. `scienceVisited = routes.find(...)` findet zuerst `energy_min` und weist diesen zusätzlich `result.science` zu. Ohne ausdrückliche Punktwahl wird sogar `sciencePoints[0]` automatisch zum Via-Stop (ohne belegte Nutzerabsicht).
**Auswirkung:** „Distance-Min“, „Energy-Min“ und „Hazard-Min“ vergleichen bei ausgewähltem Science-Point nicht die reine A→B-Mission; `science` kann dieselbe Route wie `safe` sein. Fachlich wichtigste Demo irreführend.
**Fix:** Zwei unabhängige Plan-Anfragen (gern `Promise.all`): baseline `POST /api/routes/plan` mit Start, Ziel, drei Objectives **ohne Stopps**; separater Science-Detour-Request `objectives:["energy_min"]` mit **explizit ausgewählter** `sciencePointId` oder `via`. Kein automatischer Stop aus `sciencePoints[0]`. „Science Route“ nur aktiv, wenn ein Nutzer wirklich Ziel oder Zwischenstopp ausgewählt hat; „Hazard-Min“ erhält eigenen semantischen Slot unabhängig von „Science“. Bei Science-Point als **Ziel** nicht denselben Punkt zusätzlich als Via-Ziel anfordern.
**DoD:** Mock-API-Test verifiziert genau die beiden unterschiedlichen Payloads. `direct`, `energy`, `hazard` sind baseline und `science` enthält in `visitedSciencePointIds` den gewählten Stop; keine Duplikat-/Umsortierungsroute. Browser-Test ändert Science-Point → Baseline bleibt unverändert.

### A2-P0-02 – UI-Datenmodell mit 3 Profilen für 4 fachlich verschiedene Ziele
**Code:** `frontend/src/types/mars.ts`, `marsApi.ts:397–495`, `MissionHUD.tsx:609–760`, `RouteMesh.tsx:66–79`  
**Ist:** Store/Legende sind auf `direct/safe/science` gebaut. `direct=distance_min`, `safe=energy_min`, `science=slope_hazard_min`. In der UI heißen die drei Buttons teilweise „Distance-Min / Energy-Min / Hazard-Min“, doch sobald ein Wissenschaftsziel mitgegeben wird, wird `science` zu `energy_min`-Stopproute überschrieben, während „Hazard-Min“ weiterhin draufsteht. Die „Risk“-Spalte behauptet dann etwas anderes als ihr Routingziel.
**Fix:** Entkoppelten `RouteObjective`-Typ und `selectedRouteId`/`selectedObjective` nutzen: `distance_min`, `energy_min`, `slope_hazard_min`, `science_detour`. Die Science-Route ist eine Planvariante, **keine** dritte Optimierungszielkategorie. Keine Rückwärtskompatibilität mit falscher Darstellung. Farben/Bezeichnungen/Charts konsistent umstellen.
**DoD:** Alle vier Profile können gleichzeitig existieren und sind in HUD, Diagramm, 3D-Linie und Export korrekt benannt; wenn eine Variante fehlt, wird diese deaktiviert.

### A2-P0-03 – Offline-Pfad ist weiterhin generiert, nicht sicherheitsgeprüft
**Code:** `frontend/src/services/marsApi.ts:295–392, 505–525`, `frontend/src/utils/demSampler.ts:91–140`  
**Ist:** Backend-Fehler außer 422 führen zu Sinuskurven-Simulation mit numerischen Risiko-/O₂-Schätzwerten. Die README-/Demo-Texte sprechen weiterhin von „authenticated reference dataset“ oder „verified“; sogar `safe.tags = ['energy_optimal','lowest_risk']` wird einer Kurve ohne Optimierer zugewiesen. Wenn DEM-Bild fehlt, liefert der Sampler mathematische Hügel und `initDemSampler()` resolved trotzdem.
**Fix:** Offline-Modus `illustrative_only`: entweder Routenzeichnen ausschalten und klaren „backend unavailable“ zeigen, oder fest abgelegte/geprüfte Referenzgeometrie mit SHA, Koordinaten und Dataset-Version **ohne** beliebige Neuberechnung verwenden. Niemals `energy_optimal`, `lowest_risk`, `shortest` für synthetische Kurven. `initDemSampler` muss zwischen loaded/error unterscheiden; bei error keine physikalischen Höhendaten. Separate 422/503/Timeout/Routing-Busy-UI.
**DoD:** HTTP 422,503,500, Netzwerk-Abbruch, 1–15s Timeout und PNG 404 ergeben keine „verified safe route“; automatisierte Tests plus Video. Schalter „Demo only“ ändert Tooltip/Legend/Export.

### A2-P0-04 – Tour erzählt Benchmark und navigiert dazu auf inkonsistente Live-Routen
**Code:** `frontend/src/components/ui/GuidedJuryTour.tsx:44–84`, `MissionHUD.tsx:609–725`  
**Ist:** Step 3 spricht von Hazard-Min (0.238) aber ruft `selectRouteProfile('safe')` auf, das aktuell `energy_min` ist (im Benchmark 0.327). Step 4 spricht explizit von `probe-14-15`, 14,788 m, 4.069 MJ, ruft aber nur `selectRouteProfile('science')` auf; keine Auswahl von `probe-14-15`. Die Tour startet außerdem nicht garantiert die Benchmarkkoordinaten. Step 6 nennt „36 Cores“, obwohl im Backend **22 Samples + 14 andere Science Points** hinterlegt sind, und behauptet 3,155 lokale HiRISE-Tiles ohne Runtime-Nachweis.
**Fix:** Tourzustand mit deterministischem Referenzszenario und `await` für `calculateRoute`/Science-Request; danach tatsächliche Response prüfen. Step 3 `slope_hazard_min` aktivieren, Step 4 exaktes Sample `probe-14-15` wählen und live route planen. Jede Zahl nur zeigen, wenn Inputs+Dataset+Modellversion zum Bericht passen. Andere Szenarios: „benchmark reference, not current route“.
**DoD:** Vollständig durchgespielte Tour im Browser; Screenshot jeder Stufe + HAR/JSON zu gezeigtem Zahlenmaterial. Benchmarkwerte 8,776/8,891m, 0.329/0.238 stammen aus exakt gleicher Referenzstrecke – sonst kein fester Text.

### A2-P0-05 – „13-Step E2E“ ist weiterhin kein E2E
**Code:** `frontend/scripts/test_e2e_mission.mjs`, `frontend/scripts/verify_api_contracts.mjs`, `.github/workflows/frontend.yml`  
**Ist:** Test baut `missionState` als JS-Dummy, ruft (falls Backend live) HTTP-API auf, interagiert aber nicht mit echter UI, Pointer-Events, WebGL oder Next-Seite. Wenn Backend offline, ist Referenzfixture erlaubt. Workflow startet Backend nicht; `npm run test:contract` kann so 4 statische Checks erfolgreich abhaken. Grüne CI belegt kein echtes Science-Detour-/Layer-/Tour-Erlebnis.
**Fix:** Echten Playwright-Testjob mit Docker-Compose und DEM/Fixtures klar getrennt: Page öffnen, Orbit→Terrain, Doppelklick A+B, Route bei echter API, Umschalten aller vier Varianten, Science Point, Tour, Layer, Missionsbudget, Fehlerfälle. Fixtures-Tests als `test:mock` bezeichnen; Live-E2E muss bei Offline-API **fail**. Testresultate und Screenshots als GitHub-Actions-Artefakte.
**DoD:** Nachweisbare Browser-Trace mindestens Chrome Desktop 1366×768 und 1920×1080; realer HTTP-/UI-Test auf dem finalen gemeinsamen SHA.

## 3. P1 – wichtige Genauigkeits- und UX-Themen

### A2-P1-01 – Frontend-Preview mischt weiterhin Referenzhöhen mit Live-Metriken
`marsApi.ts:449–469` berechnet `elevationProfile`/`elevationGainMeters` aus Client-Preview, übernimmt zugleich Backend-Distanz/Energie/Risiko; `demSampler.ts` arbeitet mit 256×256 und festen Bounds/Höhen; das sind nicht die nativen 20 m. `segmentSlopeDeg` verwendet im Nenner die **3D-Segmentlänge** statt die horizontale Länge und unterschätzt den Winkel. Die Pandolf-Clientformel setzt `abs(dElevM)` ein und behandelt Gefälle damit als Steigung, obwohl Backend Gefälle wie Ebene behandelt; falls Client-Fallback aktiv, entstehen andere Energiemodelle. Im HUD kann also ein Profil mit einer Energie aus einem anderen Geometriemodell stehen.
**Fix:** Server-segmentweises `distance/elevation/slope`-Profil oder Kennzeichnung `client_coarse_preview`, einheitlicher Physikmodus, vollständige Provenienz im Chart. `rise / horizontalRun` für Angle. **DoD:** drei Benchmark-Routen zeigen einheitliche Datenquelle und reproduzierbaren Vergleich mit tolerierten Fehlern.

### A2-P1-02 – Science-Layer-Auswahl bleibt reine Katalogauswahl
`LayerManagerModal.tsx` setzt lokale `selectedLayerId`; sie wird nicht an das Terrain oder Tile-API gekoppelt. Keine echte Darstellung von `geology`, `thermal_inertia` oder `hirise_dem`. Fallback `fetchLayers()` meldet auch ohne Backend `ctx_dem/hirise_dem/slope_ctx` als verfügbar (`marsApi.ts:206–267`).
**Fix:** Mindestens ein echter Geologie-/THEMIS-Overlay mit georeferenzierten Tiles; anderenfalls Details als „dataset catalog (not visualized)“ kennzeichnen. Fallback-Verfügbarkeit = `false/unknown`.
**DoD:** Umschalten verändert tatsächliche Pixel; abgefangene Kachel-URL, Legende, NoData-Test und Screenshot.

### A2-P1-03 – Linie auf 3D-Modell ist nicht gegen Terrain validiert
`RouteMesh.tsx:31–37` ersetzt Catmull-Rom durch LineCurve. Gerade Segmente zwischen gekürzten Waypoints bleiben aber nicht zwingend im begehbaren Rasterkorridor; `TubeGeometry` ist 3D-linear zwischen Z-Endpunkten, passt sich dem Zwischenrelief nicht an. `depthTest=false` zeichnet durch den Boden.
**Fix:** Serverpfad-Tile-/Vollauflösung und Zwischenpunkte visualisieren oder jede Linie entlang der Route resamplen und sicherheitsprüfen. `depthTest` nur für Marker-Akzente aushebeln; Routenlinie auf Oberfläche.
**DoD:** In einer Steilwand-Testmap kein gerades Durchschneiden/„Schweben“ möglich.

### A2-P1-04 – Missionssimulation und Profilumschalten können asynchron veralten
`useMissionStore.ts:347–359` setzt Profil sofort, berechnet später `simulateMission`, ohne Anfrage-ID/Gültigkeitsprüfung. Schnelles A→B→A kann eine Simulation zum falschen sichtbaren Profil anzeigen.
**Fix:** `requestId`/`AbortController` oder compare-Route-ID vor `set({missionEstimate})`; loading state pro route, kein voriger O₂-Wert für neue Route. **DoD:** künstliche 1500ms vs. 50ms Antworten in umgekehrter Reihenfolge, final UI bleibt konsistent.

### A2-P1-05 – Irreführende Quellen-/Sicherheitslabels und Tour-Timing
`MissionHUD.tsx:584` und `LayerManagerModal.tsx:127` sagen „A*“, Backend berechnet SciPy-Dijkstra. Die Inspector-Vorschau gibt quantisierungsbedingte ±2.56 m als `elevationUncertaintyMeters` aus, obwohl deutlich gröbere räumliche Abtastung und Quelldatenfehler bestehen. „NASA safety passability gate“ ist eine Projektannahme aus Test-/Literaturmaterial, keine NASA-Zertifizierung. `NASA & ESA Data` wirkt unbelegt für aktive Layer.
**Fix:** Labels „Dijkstra / raster graph, Pandolf estimate“, „15° prototype constraint“, „8-bit preview ±2.56 m quantization only; not geospatial accuracy“. Proof für Agency-Claims. **DoD:** Central Claims Checklist ohne werbende Überbehauptungen.

### A2-P1-06 – DEM-Decoder liefert Erfolg sogar bei Fehler
`initDemSampler():94–119` resolved immer, kein Fehlerstatus oder Retry; `RouteMesh.tsx:51–53` setzt `demLoaded=true` nach jedem Resolve. Bei Bild-404 werden synthetische Höhen gerendert, während die statischen TextureLoader ggf. den View crashen. **DoD:** error/ready/state, sichtbarer Datenfehler, keine routenbasierte „Live“-Simulation im Fallback.

### A2-P1-07 – Benutzerführung / Responsiveness verifizieren
`MissionHUD.tsx` ~1000 Zeilen, `LayerManagerModal` ~322. Kein echter Responsive-Browser-Snapshot im CI, GPU-/WebGL-Unsupported nicht geprüft. Wissenschaftsvergleich benötigt direkt ablesbare Objective-, Distanz- und Hazard-Differenzen.
**DoD:** QA-Matrix 1366×768, 1920×1080, 390×844; vollständige Tastaturbedienung des Modals, Tooltip mit Quelle, keine unsichtbaren CTAs.

## 4. Konkreter Auftrag – priorisierte Umsetzung

1. **Sofort P0:** `requestRouteAlternatives` in Baseline- und Science-Request aufteilen; vier unabhängige Profile; alle Demo-Labels semantisch korrekt.
2. **Dann P0:** Offline-Synthetic deaktivieren oder streng als illustrative Demo kapseln; `demSampler` keine synthetischen wissenschaftlichen Höhen.
3. **Dann P0:** Tour auf echte Benchmarks ausrichten; alten Root-README-Claim mit Lead bereinigen.
4. **Dann P0:** Browser-E2E auf laufender API; klare Differenz zwischen mock/unit und E2E.
5. **P1 vor Polishing:** Layer-Overlay oder klare De-Scope; Profil/Serverhöhen konsistent; Async-Missionsrennen fixen; Routenlinie validiert zeichnen.
6. **Erst dann:** Animationen, Dramaturgie und Kamera-Polish.

## 5. Abnahmetests Dev A Tag 2

| ID | Muss nachgewiesen sein |
|---|---|
| A2-T01 | Baseline-Routenrequest enthält KEINEN Science-Stop; separater Science-Request enthält genau gewählten Stop |
| A2-T02 | Ohne Science-Auswahl existiert kein vorgetäuschter Science-Detour, auch nicht durch `sciencePoints[0]` |
| A2-T03 | `energy_min`, `distance_min`, `slope_hazard_min`, `science_detour` haben eigene Route-IDs und korrekte Profile |
| A2-T04 | Tour Step 3 zeigt tatsächlich den `slope_hazard_min`-Routewert 0.238 nur beim fixierten Benchmark |
| A2-T05 | Tour Step 4 navigiert zu `probe-14-15` per echter API und zeigt nur ihre echten 14,788 m / 4.069 MJ |
| A2-T06 | 422 / 503 / 500 / Timeout / DEM 404 führen zu verständlichen, wissenschaftlich ehrlichen Zuständen |
| A2-T07 | Backend down ⇒ CI-live-E2E schlägt fehl statt als 13/13 grün durchzulaufen |
| A2-T08 | 2 echte Kartenlayer mit korrekten NoData-Legenden **oder** keine angebliche Layer-Steuerung im Pitch |
| A2-T09 | Backendroute Chart und O₂-Bilanz dürfen keine nicht deklarierten 256er-Preview-Mischwerte verwenden |
| A2-T10 | Schnelle mehrfach profilierte Routeauswahl zeigt nie O₂-Zahlen der alten Auswahl |
| A2-T11 | Im 3D-Mesh kein unvalidiertes Shortcut durch gesperrte Zellen |
| A2-T12 | Root-README, Jury-Text, HUD, Tour geben dieselben evidenzbasierten Claims aus |

**Abgabe Dev A:** PR-Link + commit SHA, Vorher/Nachher-Aufnahme, Playwright-Traces, echte Requests/Responses, überprüfte Modellgrenzen. Kein „A-001 bis A-013 100% erledigt“ allein wegen eines Commit-Titels.