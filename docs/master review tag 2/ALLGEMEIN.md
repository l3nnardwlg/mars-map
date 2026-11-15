# MASTER REVIEW – TAG 2 / ALLGEMEIN – GLOBAL-AWARD READINESS
**Projekt:** MARS Pathfinder / NASA Space Apps Challenge 2026 / *Interplanetary Survival Guide: Martian Map*  
**Review:** 15.11.2026, `main` = `92623830591765810f2290c0f6c1448d6c67bb87`  
**Tag 1 Referenz:** `ffde4617b05d1664971143952fd892fe641a4fbc`  
**Prüfumfang:** Full repo tree (inkl. Workflows, Front-/Backend-Code, Tests, Signoffs, Docs, Git-Branches), Diff zur Tag-1-Baseline, PR-Historie und GitHub Actions; NASA Space Apps 2026 offizielle Eventseite, Bewertungsdimensionen und rechtliche Quellen-/Lizenzhinweise.  
**Grenze:** Kein lokales Ausführen des privaten Repos, keine unabhängige full-DEM-Reproduktion und kein Live-Browser-Test während dieser Review. Daher **vorläufiges Code-/Evidenzurteil**, kein fertiger operativer Audit.

## 1. Kurzurteil: nach Tag 1 großer Fortschritt, noch kein 100/100

**Provisorische interne Wertung: 72/100** (Tag-1-Schätzung: 64/100; **+8 Punkte**). Diese Punkte sind eine transparente interne Heuristik **nicht** die offizielle NASA-Jurywertung; die endgültige Qualität hängt von echter Demo, wissenschaftlichem Nachweis und eingereichter Projektseite ab.

| NASA-Kriterium | Interne Tag-2-Wertung | Begründung |
|---|---:|---|
| Impact | **15/20** | EVA-Navigation/Planung ist wichtig und verständlich, aber bisher Prototyp, kein validiertes Flight-System; Nutzeneffekt nicht empirisch getestet |
| Creativity | **17/20** | Starke Kombination aus 3D-Mars, echten Geo-Daten, Energie, Science-Stops, Hazard-Trade-offs |
| Validity | **12/20** | Echter Multi-Objective-Backend-Solver + reproduzierbarer Team-Benchmark, aber Kantensteigung/Downsampling/Mission-Kürzung, UI-Science-Verfälschung |
| Relevance | **16/20** | Offizielles Mars-Mapping-Thema klar adressiert; echte NASA/USGS-Daten, aber Layer-Auswahl ist noch keine echte Datenvisualisierung für alle Layer |
| Presentation | **12/20** | Jury-Tour besser und neue wissenschaftliche Zahlen; aber falsche Routenauswahl in Tour, kein Browser-E2E, altes README, öffentliche Abgabe nicht nachgewiesen |
| **Summe** | **72/100** | **Wettbewerbsfähig als Konzept; aktuell kein freigegebener Global-Winner-Demo-Stand** |

**Wichtig:** Ein P0-Wahrheitsfehler kann trotz rechnerisch gutem Score eine Validity-/Presentation-Kategorie dramatisch beschädigen. 72/100 ist ein fachspezifisches Entwicklungsfeedback, **keine Vorhersage der Nominierung oder Award-Chance**.

## 2. Was seit Tag 1 wirklich neu ist

Git-Diff `ffde4617 → 9262383`: **9 Commits, 39 geänderte Dateien**. Gemergt sind:
- **PR #11:** Tag-1-Review-Dokumente, `docs/master review tag 1/`.
- **PR #12:** Backend-Änderungen B-001 bis B-013, unter anderem echter Multi-Objective-Planer, Science-Stopps, OpenAPI, zusätzliche Tests und Benchmarkbericht.
- **PR #13:** Frontend-Korrekturen A-001 bis A-013, darunter objektivbasierte Routezuordnung, DEM-Farbkarte, Chart-Skalierung, Science-Punkte, Dijkstra-HUD teilweise.

**Bestätigte Stärken:**
1. `POST /api/routes/plan` unterscheidet `energy_min`, `distance_min` und `slope_hazard_min` im Backend. Das ist eine **echte** graphbasierte Berechnung auf dem aktuellen Raster.
2. Echte `sciencePointIds`/`via`-Zwischenstopps, `visitedSciencePointIds`, legs; Beispiel `probe-14-15`.
3. Solver verhindert diagonales Schneiden einer Ecke, wenn die angrenzenden Zellen gesperrt sind.
4. Hypsometrische Vorschautextur wird pro Pixel aus DEM-Farbwerten abgeleitet, nicht bloß aus horizontalem Verlauf.
5. Science-Points-Limit 15 aufgehoben; 36 API-Objekte können in der Szene erscheinen (22 Samples + weitere Punkte; **nicht „36 cores“**).
6. Benchmarks enthalten Input, SHA-256 des Roh-DEM, Modellmetriken und Testzahl. Die gemeldeten **74 passed, 0 skipped** stammen von Team-Ausführung mit DEM; GitHub CI ohne Rohdaten überspringt laut Signoff **15** Tests.
7. Aktuelle GitHub Actions: `frontend` auf main SHA `9262383` erfolgreich; `backend` auf Merge-Commit `7c3867b` erfolgreich; `docker` für Entwicklercommits erfolgreich. **Keiner dieser Nachweise ist ein echter Browser-E2E auf finalem Hauptbranch.**

**CI-Referenzen:**
- Frontend main: https://github.com/l3nnardwlg/mars-map/actions/runs/43710420979
- Backend merge: https://github.com/l3nnardwlg/mars-map/actions/runs/43707346925
- Docker Dev-Frontend: https://github.com/l3nnardwlg/mars-map/actions/runs/43709705327

## 3. BRANCH-REVIEW: Wichtige ungemergte Arbeit!

Vergleich `main...dev/backend`: ahead 0 / behind 3; `dev/frontend`: ahead 0 / behind 1; `dev/route-ux`: ahead 0 / behind 18; übrige historische Branches liegen zurück.

**Eine Ausnahme: `docs/license-and-textures` ist 1 Commit VOR `main` und 0 hinterher.** Commit: `65e26841041c20a3edda61959e87510fa560930a`. Dieser Branch enthält bereits:
- neue `LICENSE` (MIT-Text, Copyright 2026 Lennard Wulf and contributors);
- neue `frontend/public/textures/README.md` (Attribution 8K-Viking- und MOLA-Dateien);
- Quellenabschnitt im Root-README;
- zusätzliche Mars-Globus-Attribution im `MissionHUD.tsx`.

**Diese Arbeit ist NICHT auf `main`.** Sie löst auch beim Merge nicht automatisch alte README-Zahlen oder die wissenschaftliche Validität der Bildlizenzannahmen. **Vor Merge:** Rechte/Copyright/Urheberschaft und Lizenz aller Drittdaten prüfen; ein MIT-Code-Lizenztext lizenziert nicht automatisch fremde Bilder/Datensätze. Danach den Branch via PR reviewen/mergen.

**Kein weiterer nicht gemergter Feature-Commit** in den geprüften Entwicklerbranches; dennoch beweisen gemergte Commits nicht, dass Front- und Backend-Funktion fachlich korrekt integriert sind.

## 4. Die acht schlimmsten offenen Release-Blocker

| Priorität | Problem | Owner | Was vor Abgabe passieren muss |
|---|---|---|---|
| **P0 / G2-01** | Frontend erzwingt Science-Stopp für alle drei Basis-Routen und überschreibt Hazard-Profil; teils ungefragter erster SciencePoint | A+B | separater Baseline-Plan ohne Stopps + eigener Science-Request, vier eindeutige Routen und Test |
| **P0 / G2-02** | Solver prüft Zell-Slope ≤15°, aber nicht Slope des **Übergangs**; eine >15°-Kante kann passierbar bleiben | B | absolute Kantengrad-Grenze mit Test `[0,0,10,10]` bei 20-m-Abtastung |
| **P0 / G2-03** | Fallback erzeugt Sinusrouten und bei fehlendem DEM synthetische Höhen; README nennt Referenz „authenticated/verified“ | A+Lead | kein beliebiger unverifizierter Route-Fallback als Safety-Modell, Datenfehler sichtbar |
| **P0 / G2-04** | Guided Jury Tour behauptet Hazard-Benchmark, wählt aber Energy-Profil; Science-Case `probe-14-15` wird nicht explizit gesetzt | A+Lead | deterministic live scenario, Bench/Response abgleichen, jede Tourstufe screenrecorden |
| **P0 / G2-05** | Full-path-Routenmetriken im Backend, aber O₂/EVA aus gekürzten 200 Waypoints neu berechnet | B→A | Missionsschätzung aus demselben Vollpfad, Peak-Steigung/Energie unverfälscht |
| **P0 / G2-06** | „Energiebudget 2×“ auf Hazard-Min wird nur als Warnung geprüft; `lowest_hazard` kann angezeigten `riskScore` nicht minimieren | B+Lead | echtes Constraint oder ehrlicher „informative trade-off“-Text |
| **P0 / G2-07** | Weder Live-Playwright-Test noch echter UI-Interaction-Nachweis; `test:e2e` läuft bei Offline-Backend mit eigenen Fixtures | A+B | Live-API + Browser CI mit Screenshots/HAR |
| **P0 / G2-08** | Aktuelles `main` ist **privat**, hat **keine LICENSE**, alte README-Werbeclaims und keinen verifizierten öffentlichen Demo-/Submissionlink | Lead | Review Lizenz-Branch, Claims bereinigen, öffentlicher Code-/Demo-Zugang, tatsächlichen SpaceApps-Projektsubmit dokumentieren |

Weitere P1: Katalog-Layer-Klick ist keine Texturänderung; der Backendserver markiert `metadata.json` ohne Tiles als `ready`; DEM-Downsampling kann Hindernisse verdecken; RouteMesh mit LineCurves kann beim Wegpunkt-Simplifying durch Gelände gehen; Response und Frontend-Preview verwenden unterschiedliche Höhendaten; Label „A*“ trotz SciPy-Dijkstra; Race Condition bei Missionsauswahl.

## 5. Root-README / Dokumentation – für Jury sofort bereinigen

**Noch in `main/README.md`:**
- „Global Award Candidate“ wirkt wie offizieller NASA-Auszeichnungsstatus; keine Beleglage.
- „shortest path ... often hazardous or fatal“ als harte Sicherheitsthese ohne Missionsvalidierung.
- `18.5°`, `72.4%→28.2%`, `405kJ`, `<8°` als angeblich aktueller Referenzfall. Der **aktuelle** Benchmark hat `9.05°` vs. `6.83°`, `0.329` vs. `0.238`.
- UI-Routen als Direct/Euclidean, Safe und Science dargestellt; der aktuelle Backend-Solver bietet echte Distanz-, Energie-, Hazard-Minimierung und separate Science-Stopps.
- `pip install -r requirements.txt`, obwohl Backend `pyproject.toml` und **keine `requirements.txt`** im aktuellen Tree hat.
- „25 passed“, obwohl aktueller Bericht 74 passed mit Voll-DEM nennt.
- MIT-Badge verweist auf `LICENSE`, die **nur im nicht gemergten Branch** existiert.
- `docs/FINAL_INTEGRATION_CHECKLIST.md` ist vom 14.11. und hat alte/teilweise widersprüchliche Sign-off-Felder.
- `docs/AI_USAGE.md` behauptet „At no point ... route statistics synthetically fabricated“, während Frontend weiterhin offline eigene sinusförmige Routen und bei DEM-Fehler mathematische Hügel erzeugt. Ebenfalls `test:e2e` als reeller 13-Step-Nachweis und alte Testergebnisse. Unbedingt an tatsächliches Verhalten anpassen.
- `docs/JURY_DEMO_SCRIPT.md` nennt die Probe als „collected“ und das Tool „life-saving“, obwohl nur ein nicht zertifizierter Planungsprototyp existiert.

**Lead-Auftrag:** `docs/SCIENTIFIC_CLAIMS_AUDIT.md` zum echten, aktuellen Beweisregister machen. Pro Zahlenclaim: Input, Source-SHA, Route-ID, JSON-Evidence, Frontend-Komponente und Ausnahmeklausel. **Kein Text darf einen Daten-/Sicherheitssachverhalt stärker behaupten als die Implementierung beweist.**

## 6. Aktuelle, ehrlich präsentierbare Demo-Zahlen

**Team-gemeldeter Backend-Benchmark:** `start=(18.38,77.58)`; `end=(18.44,77.45)`; `M20_JezeroCrater_CTXDEM_20m`; SHA-256 `ba7f706ea1b5d63a562f28a7dcf7a7f3c79bce7f048e6974b57e8a33c30d1ba2`.

| Route-Ziel | Distanz | Energie | Slope-Hazard-Index | Max. Zell-Slope |
|---|---:|---:|---:|---:|
| distance_min | 8,776 m | 2.437 MJ | 0.329 | 9.05° |
| energy_min | 8,777 m | 2.433 MJ | 0.327 | 9.05° |
| slope_hazard_min | 8,891 m | 2.521 MJ | 0.238 | 6.83° |
| science via probe-14-15 | 14,788 m | 4.069 MJ | gesonderter Plan | nicht aus Report hervorgehend |

Daraus: **minus 0.091 Indexpunkte** oder rund **27.7% relative Verringerung des modellierten Index**, +115 m gegenüber `distance_min`. **Das ist KEINE gemessene Verringerung von Astronauten-Unfallwahrscheinlichkeit.** Die ungeprüfte 15°-Kantensperre und Downsamplinggrenze müssen transparent bleiben.

## 7. NASA: Regeln und Risiken am tatsächlichen letzten Hackathon-Tag

**Offizielle 2026-Hackathonseite:** https://www.spaceappschallenge.org/2026/  
Dort für Projektabgabe ausdrücklich: **Sonntag, 15.11.2026, 23:59 Uhr Ortszeit der registrierten Location**. Submission erfolgt über den **Project Tab der Team-Seite**. Event 14.–15.11.2026.  
Die Local-Event-Seiten nennen fünf Kriterien: **Impact, Creativity, Validity, Relevance, Presentation**. Beispiele: https://www.spaceappschallenge.org/2026/local-events/ajmer/

**NASA Terms/Legal:** https://www.spaceappschallenge.org/legal/ – Quellen, Lizenzdokumentation und Rechte für verwendete Materialien sind relevant; nicht belegte Bild-/Drittlizenzen können problematisch werden.

**Unbedingt jetzt explizit prüfen (nicht durch GitHub-Commit beweisbar):**
- [ ] Registrierung der tatsächlich zulässigen Mitglieder, Teamgröße, Teilnahme-/Global-Judging-Opt-in.
- [ ] Offizielle Challenge und mindestens ein tatsächlicher NASA-Data-Resource-Nachweis im Submission-Text.
- [ ] Öffentliche funktionierende Demo- und Quellcode-URL, nicht nur privates GitHub. Keine Tokens oder Assets unbesehen öffentlich schalten.
- [ ] **Exaktes aktuelles Demoformat** der eigenen 2026-Projektmaske prüfen. Frühere Regeln nannten 30s-Video oder 7 Folien; alte Dokumente sind kein alleiniger Nachweis für 2026.
- [ ] Projektseite, AI-Usage, Lizenz-/Third-party-Material, NASA-Attribution und Links in Englisch, Video bei Bedarf mit englischen Untertiteln.
- [ ] Vor `23:59` tatsächlich speichern und final submitten; Bestätigung/URL sichern. Ein lokaler Commit allein ist **keine NASA-Abgabe**.

**Keine Aussage möglich**, ob die Teamseite bereits korrekt eingereicht wurde – dieser Status steht nicht im Repository.

## 8. Maximale Wirkung in verbleibender Zeit: harte Priorität

### Release-Plan, nach Nutzen und Risiko
**T0 – Submission absichern:** Team-Page, Demo, Lizenz-Branch prüfen/mergen, Readme-Claims korrigieren, alle Ressourcen öffentlich erreichbar.  
**T1 – Wahrheit der Kern-Demo:** Dev A getrennte Science/Baseline, vier korrekte Labels; Dev B Edge-Slope und Klarstellung Hazard-Energie; Tour-Live-Benchmark synchronisieren.  
**T2 – Zahlen valide:** Vollpfad-Mission, keine als sicher ausgegebene Sinus-Fallbackroute, Preview/Server-Metriken trennen.  
**T3 – Tatsächlich testen:** ein 4–6-minütiger interner Live-Durchlauf mit aufgezeichneten API-Requests + Screenshots, auf mindestens zwei Browsergrößen; 422, 503, 404.  
**T4 – Polish:** erst wenn T0–T3 wahr und sichtbar sind: Shader, Animation, zusätzliche Layer, UI-Microinteractions. Ein ungetestetes neues Feature darf die letzte funktionierende Demo nicht gefährden.

### Entscheidungslogik Go/No-Go
- **GO zur Einreichung als ehrlicher Prototyp:** öffentlich zugänglicher demonstrierbarer Stand, eindeutiger wissenschaftlicher Scope, NASA-/Datenquellen, korrekt beschriftete Basisroute, kein erfundener Safety-Claim; auch unvollständige Features können transparent ausgeschlossen werden.
- **NO-GO für Behauptung „global-winner-ready/100% validated“:** Science-Comparison noch verfälscht, Route 15° nur Zell- aber nicht Kantenbegrenzt, synthetischer Offlinepfad als validiert, ungetestete Jury-Tour, fehlende öffentlich zugängliche Abgabe.

**Wichtig:** Nicht wegen offener Extras die tatsächliche fristgerechte Submission verpassen. Für Wettbewerbsfähigkeit sind klare Grenzen besser als ein unfertiges Feature-Bündel.

## 9. Reproduzierbare Checkliste / Eigentümer

| ID | Owner | Deliverable zum Freigabezeitpunkt |
|---|---|---|
| G2-T01 | Lead | Nachweis gemergter Lizenz, geprüfter Drittmaterialrechte und öffentlicher Repo-/Demo-Link |
| G2-T02 | A | HTTP Baseline 3 Objectives ohne Stop + eigener echter Science-Stop-Call, getrennte 4 Labels |
| G2-T03 | B | Gradient-/Edge-Test (14.04° Zellgradient vs. 26.57° Kantenanstieg) grün |
| G2-T04 | B | Hazard-Budget wirklich Constraint oder ausdrücklich informative Warnung |
| G2-T05 | B | Route/mission Energie, Distanz und O₂ aus einem konsistenten Vollpfad |
| G2-T06 | A | Keine synthetische Route/Höhe als Live-NASA-/Safety-Ergebnis |
| G2-T07 | A+Lead | Tour Step 3 zeigt hazard_min statt energy_min; Step 4 via probe-14-15 |
| G2-T08 | A+B | Live-Browser-E2E auf frischem Docker-Deployment mit Trace |
| G2-T09 | Lead | README, AI_USAGE, JURY_DEMO_SCRIPT, Signoff, NASA-Zitate aktualisiert |
| G2-T10 | B | Layer-„ready“ nur bei nachweisbaren Tiles, nicht nur metadata.json |
| G2-T11 | Lead | Öffentliche Team-Projektseite eingereicht, Zeit/Bestätigung dokumentiert |
| G2-T12 | Lead | Finaler Release-SHA, DEM-Datensatzhash, Tests, Reviewer/Signoffs in ein Übergabeprotokoll |

## 10. Was als nächstes im Repository passieren sollte

### Dev A
Siehe `DEV_A_FRONTEND.md`: 5 präzise P0-Cluster, 7 P1-Themen und 12 Testcases. **Stoppt die Verwechslung der Routeziele mit Science-Missionen.**

### Dev B
Siehe `DEV_B_BACKEND.md`: 5 P0-Cluster, 9 P1-Themen und 14 Testcases. **Begrenzt auch die Routekanten, nicht nur Zellgradienten; macht Energiebudget und Missionsmodell konsistent.**

### Integration / Lead
PR-Reihenfolge: 1) `docs/license-and-textures` (prüfen, Git-/Rechte-Risiken), 2) Dev-B-Kanten/Solver, 3) Dev-A-Four-Profile mit separatem Science-Call, 4) Claims/Demo/Tests. Danach **unveränderlichen Tag/Commit als Submission-Stand festhalten**.

## 11. Evidenzindex
- Branch & Commits: https://github.com/l3nnardwlg/mars-map/commits/main
- PR #11: https://github.com/l3nnardwlg/mars-map/pull/11
- PR #12: https://github.com/l3nnardwlg/mars-map/pull/12
- PR #13: https://github.com/l3nnardwlg/mars-map/pull/13
- Unmerged Branch mit Lizenz: https://github.com/l3nnardwlg/mars-map/tree/docs/license-and-textures
- Backend Benchmark: `backend/BENCHMARK_REPORT.md` / `backend/benchmark_report.json`
- Wissenschaft: `backend/app/routing.py` / `backend/app/terrain.py` / `backend/app/mission.py`
- UI-Integration: `frontend/src/services/marsApi.ts` / `frontend/src/store/useMissionStore.ts` / `frontend/src/components/ui/GuidedJuryTour.tsx`
- CI: `.github/workflows/frontend.yml` / `backend.yml` / `docker.yml`

**Schlussurteil Tag 2:** Der echte Backend-Kern hat sich stark verbessert. Das größte aktuelle Risiko ist nicht ein Mangel an Features, sondern **Inkonsistenz zwischen Solver, UI, Demo-Story und Veröffentlichungsstand**. Für eine Global-Award-fähige Einreichung müssen genau diese Grenzen sauber geschlossen oder transparent kommuniziert werden – bevor weitere Features entstehen.