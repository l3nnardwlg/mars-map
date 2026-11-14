# MASTER REVIEW – TAG 1 / ALLGEMEIN: GLOBAL-AWARD READINESS
**Projekt:** MARS Pathfinder / Mars Map  
**NASA Space Apps Challenge 2026:** *Interplanetary Survival Guide: Martian Map*  
**Review-Stand:** 14.11.2026 – main @ ffde4617b05d1664971143952fd892fe641a4fbc  
**Owner:** Projektlead / Integration / Submission  
**Zielbild:** globale Wettbewerbsfähigkeit nach Impact, Creativity, Validity, Relevance und Presentation – intern an der Maximalwertung 100/100 ausrichten. **Eine Jurywertung von 100/100 oder ein Global Award ist nicht garantiert und kann nicht durch „grüne“ Tests zugesichert werden.**

## 0. Verwendung dieses Review-Pakets

Im gleichen Ordner liegen:
- `DEV_A_FRONTEND.md` – interaktive 3D-App, wissenschaftliche Darstellung, reale Browser-Integration, Demo.
- `DEV_B_BACKEND.md` – Geodaten, Routensolver, bioenergetische Modelle, API-Contract und Wissenschaftsvalidierung.
- `ALLGEMEIN.md` (diese Datei) – offizielle Einreichung, Release-Gates, Prioritäten, Synchronisation, Jurystory und Abnahmekriterien.

**Reviewbasis:** Hauptbranch wurde gegen alle fünf Nebenbranches verglichen. Zum Zeitpunkt der Prüfung war kein Nebenbranch gegenüber main voraus; alle bisher gemergten Arbeiten sind commit-seitig in main enthalten. Das schließt funktionslose Integrationspunkte ausdrücklich nicht aus. Der Hauptbranch war privat, kein öffentlicher Deployment-/Demo-Link ist im Repo-Nachweis verifiziert.

**Evidenz-Level unterscheiden:**
1. `Code-confirmed` = Sourcecode zeigt sicher den Befund.
2. `CI-confirmed` = konkreter GitHub-Actions-Lauf war erfolgreich; keine automatische Vollabnahme.
3. `Team-reported` = Bericht/README behauptet Messung; noch nicht unabhängig reproduziert.
4. `Browser-confirmed` = tatsächlich reproduzierte Userinteraktion mit Screenshot, Trace, Logs.
5. `Scientific-reproduced` = Datensatz, Commit, Parameter, Rohwerte, unabhängiger Benchmark/Abgleich.

Nur die letzten beiden Levels reichen für besonders starke wissenschaftliche und Demo-Claims.

## 1. Bewertungslogik der Jury

Die veröffentlichten NASA-Space-Apps-2026-Eventseiten führen fünf Kriterien: **Impact, Creativity, Validity, Relevance, Presentation**. Diese fünf Kategorien als Entwicklungsfilter verwenden.

**Interne, NICHT offizielle 100-Punkte-Scorecard (5×20 Punkte):**

| Kriterium | Für 20/20 intern erforderlich |
|---|---|
| Impact | Konkretes Problem menschlicher Mars-EVA erläutern, Nutzen und Zielgruppe belegen, Einschränkung als Planungsprototyp |
| Creativity | Eigenständige Verknüpfung von orbitalen Kartendaten, 3D-Terrain, Routenszenarien, nachvollziehbarer Energie-/Gefahrenanalyse |
| Validity | Geodaten mit Herkunft, physikalische Modelle korrekt begrenzt, keine überzogenen Safety-Claims, reproduzierbare Benchmarks |
| Relevance | Mehrschichtige Marskarte plus NASA-Datennutzung, wirklich interaktive Routen- und wissenschaftliche Szenarien gemäß Challenge |
| Presentation | Klare Problem-Lösung-Beweis-Story, öffentlich erreichbares Ergebnis, kurzes Regel-konformes Video/Folien, lesbare Oberfläche |

**Hard Gate:** Eine ansehnliche Präsentation ohne korrekte, nutzbare wissenschaftliche Karten-/Routenfunktion ist kein „100/100“. Umgekehrt ist ein starkes Backend ohne in der Demo sichtbaren Nutzen ebenfalls nicht ausreichend.

Referenzen:
- Challenge: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- NASA Space Apps: https://www.spaceappschallenge.org/
- 2026 Eventbeispiele mit Kriterien und Regeln: https://www.spaceappschallenge.org/2026/local-events/ajmer/ und https://www.spaceappschallenge.org/2026/local-events/islamabad/
- Veröffentlichtes 2026-Formatbeispiel (30-Sek.-Demo oder 7 Folien): https://www.spaceappschallenge.org/2026/local-events/poznan/

**Achtung:** Dies sind Orientierung und öffentliche Eventseiten. Prüft die verbindliche persönliche Team-/Location-Seite und die aktuelle offizielle Submission-Maske. Regeln/Deadlines können lokal abweichen. Eine ältere Eventseite oder ein Beispiel ersetzt keine verbindliche 2026-Regel.

## 2. Offizielle Abgabe und formale Disqualifikationsrisiken (P0)

### G-001 | Öffentlich erreichbare Projekt- und Demoartefakte
- [ ] Öffentlicher **Live-App-Link** ohne Anmeldung (oder alternative öffentlich zugängliche, reproduzierbare Demo), HTTPS, stabile Domain.
- [ ] Reviewer kann Code/Methodik ohne Freigabeprozess lesen: Repo öffentlich oder klare öffentlich lesbare Snapshot-/Quellcode-Alternative im Rahmen der Submissionbedingungen. Prüfen, ob eure Local-/Global-Judging-Regeln ein Public-Repo verlangen.
- [ ] Alle eingebetteten Links zur Abgabe in privatem Browserfenster testen (ohne GitHub/SpaceApps Login).
- [ ] Keine geheimen Schlüssel im Repo; vor Freigabe git history/Secrets, Lizenz/Third-Party-Assets, private Inhalte und NASA-Attribution prüfen.
**Kritisch:** Zum Reviewzeitpunkt ist `l3nnardwlg/mars-map` privat.

### G-002 | Regelkonforme Projekt-Demo
- [ ] Ein **30-Sekunden-Demovideo ODER maximal sieben Folien**, soweit für eure 2026-Teilnahme die veröffentlichten Submissionvorgaben gelten; das genaue Feld auf der Projektseite überprüfen.
- [ ] Die bestehende 2,5-Minuten-Jury-Tour bleibt als Live-Demo optional, ist aber **kein Ersatz** für das kurze Abgabeformat.
- [ ] Inhalt in Englisch verständlich, Untertitel/Labels ausreichend groß; echte Screen-Capture statt nur visuellem Teaser.
- [ ] Video-/Foliendatei und Hosting-Link unter Testbedingungen ohne Anmeldung öffnen.

### G-003 | NASA-Datennutzung, Quellen und KI-Transparenz
- [ ] Mindestens eine **konkret in den Ressourcen der gewählten 2026-Challenge gelistete NASA-Quelle** als tatsächlich verwendete Datenquelle nachweisen; den Resources-Tab der offiziellen Challenge gegenprüfen. Es reicht nicht, irgendeine NASA-Seite zu erwähnen.
- [ ] Pro Datensatz: Produkt-ID, Version, Quelle, Zweck, Auflösung, Coverage, Lizenz und Unsicherheits-/NoData-Grenzen.
- [ ] Alle Drittbibliotheken, 8K-Texturen, Rohdaten, verwendeten Bilder, generierten Assets und Lizenzen/Urheber in der Abgabe aufführen.
- [ ] KI-Verwendung offen und präzise auf der Submission-Seite und in `docs/AI_USAGE.md` erklären (welcher Agent half bei Code, Daten, Design, Validierung? Was wurde tatsächlich von Menschen überprüft?).
- [ ] Keine „NASA approved“, „NASA global award candidate“ als amtliche Auszeichnung oder „certified life-saving tool“ ohne Beleg.

### G-004 | Team, Termin, Einreichung
- [ ] Team-/Teilnahmeberechtigung, Namen, ggf. Alters-/Local-Event-Regeln und alle erforderlichen Zustimmungen gegen offizielle Seite prüfen.
- [ ] Abgabefrist nach **eigener Location-Zeitzone** und ggf. gesondertem lokalen Pitchfenster bestätigen (Event 14.–15.11.2026).
- [ ] Alle Pflichtfelder, Links und Judging-Opt-in vollständig ausfüllen; Submission vor Deadline tatsächlich absenden.
- [ ] Abgabe danach in Inkognito + von einem anderen Netzwerk öffnen und Screenshot/Bestätigung sichern.

## 3. Die sieben fachlichen Release-Blocker

| Gate | Warum kritisch | Eigentümer | Abschlussnachweis |
|---|---|---|---|
| R-01 | Direct/Safe/Science suggerieren Ziele, die der Solver nicht garantiert | A+B | dynamischer API-Objective-Contract + Live-UI-Test oder ehrliches Umbenennen |
| R-02 | Hypsometric Mode entspricht keiner echten Höhenfarbenkarte | A | Raster-/Shader-Test mit Höhe→Farbe |
| R-03 | Offline-Routing berechnet sinusförmige Demo-Kurven und kann synthetische Höhen liefern | A | klare Illustrationslabels, keine unvalidierten Safe-Routen |
| R-04 | Backend hat sechs Layer; sichtbare Datenkarte hat nicht alle Overlays | A+B | echte Layeranzeige oder transparente Scope-Reduktion |
| R-05 | Live-Story enthält alte 72,4/28,2%-Werte und abweichende Winkel | A+B+Lead | Claim-Audit mit Quellenbelegen auf demselben Commit |
| R-06 | Science-Detour fährt nicht nachgewiesen ausgewählte Science-Points an | B→A | Test A→Sample→B mit API und Browser |
| R-07 | Browser-E2E und reale Nutzertests sind nicht durch den simulierten 13-Step-Test belegt | A+B | Playwright-Trace mit laufendem realem Backend |

**Kein Feature darf durch schönere Textlabels, zusätzliche Deko, einen Kommentar im Code oder einen aktualisierten README-Haken als „fix“ gelten.**

## 4. Sofortige Synchronisation zwischen Dev A und Dev B

### Vertrag / gemeinsames Schema
1. B schreibt oder aktualisiert `backend/openapi.json` mit eindeutigen Objective-Definitionen, Ziel-IDs, vollständiger Routenprovenienz, tatsächlicher Gridauflösung und Fehlerzuständen.
2. A bindet ausschließlich diese Felder und entfernt positional assumptions (`routes[0]=direct`, `routes[1]=safe`, `routes[2]=science`).
3. API-Contract-Tests und Browser-Test verwenden dieselben Start-/Ziel-Koordinaten und je drei nachvollziehbare Szenarien:
   - flache, einfache Route
   - Weg um wirklich gesperrte Steigung
   - Route über explizit ausgewählten Science Point
4. Für unimplementierte Ziele **Feature deaktivieren oder korrekt als Illustrationsmodus bezeichnen**. Keine inkonsistenten Fake-Routen.
5. Alle Zahlendarstellungen (Meter, Grad, Watt, kJ, kcal, O₂-Liter, mGy) stammen aus derselben Routen-/Modellversion.

### Single Source of Truth / Claim Register
Eine kleine maschinenlesbare Datei oder aktualisierte `docs/SCIENTIFIC_CLAIMS_AUDIT.md` sollte pro Claim enthalten:
- genau formulierter Claim (und was **nicht** behauptet wird);
- Code-Quellpfad, Dataset-Produkt-ID und Versions-SHA;
- Formel, Einheiten, feste und geschätzte Parameter;
- Referenzszenario mit Koordinaten und Roh-API-Ergebnis;
- `measured / derived / assumed / illustrative`;
- visueller Ort im Frontend + automatische Prüfung;
- DRI/Owner, Status, letzter Testlauf.

**Beispiel Hauptkonflikt:** 15°-Backend-Grenze versus alte 20°-Textformel in mehreren Docs; `96.5%→37.6%` im einen Text versus `72.4%→28.2%` in anderen. **Keine** dieser Zahlen pauschal übernehmen, ohne die entsprechenden Benchmark-Routen neu aus einem fixierten Datensatz nachzurechnen.

## 5. Wissenschaftliche Grundhaltung (Validity)

### Was ihr seriös behaupten könnt
- Experimenteller Mars-Traverse-Planungsprototyp auf realen NASA/USGS/Perseverance-Daten.
- Höhen- und Geologiedaten mit dokumentierten Quellen und teilweiser unabhängiger Gegenprobe.
- Reproduzierbarer Energieschätzer unter expliziten Körpermasse-/Geschwindigkeits-/Terrainannahmen.
- Alternative Korridore mittels geländebasiertem Graphalgorithmus.
- Interaktive 3D-Präsentation und quantitative Analyse von Geometrie, Energie und einem **modellierten Hangneigungs-Gefahrenindex**.

### Was ihr derzeit NICHT behaupten dürft
- „Diese Route ist sicher für eine reale NASA EVA“ oder „lebensrettend“ als bestätigte Eigenschaft.
- „Risk 28%“ als Unfallwahrscheinlichkeit.
- „Echte drei global optimale Ziele“ ohne drei tatsächlich optimierende Solververfahren.
- „Science route visits samples“ ohne erzwingbare Stopps.
- „Alle wissenschaftlichen Layer aktiv in der 3D-Karte“ ohne tatsächlich gerenderte Kacheln.
- „1-m HiRISE wird für Routing verwendet“ solange nur CTX zur Routenberechnung dient.
- „Exakt 1,7 m Augenhöhe“ ohne korrekte physische Szenenumrechnung.
- „E2E geprüft“ durch ein Node-Script, das keinen Browser bedient.
- „Native 20-m Genauigkeit im Client-Inspector“, wenn dieser ein ~350–400-m-Pixel-Preview verwendet.

## 6. Empfohlene Jury-Story: nicht übertreiben, sondern beweisen

**Arbeitstitel:** *MARS Pathfinder – Science-aware traverse planning across real Martian terrain.*

**Ein-Satz-Pitch (englisch):** “We turn NASA and USGS terrain and science data from Jezero Crater into an interactive Mars traverse planning prototype that makes energy trade-offs, terrain constraints, and scientific targets transparent.”

Die **empfohlene Demo-Reihenfolge**:
1. Problem zeigen: kürzeste geometrische Verbindung kann eine ungeeignete Geländepassage enthalten.
2. NASA-Datenquelle, CTX-Höhenmodell, Gebiet und Auflösung am echten Modell zeigen.
3. Einen konkreten Start-/Ziel-Pfad live berechnen (mit objektivem Label, nicht statischer Benchmarkzahl).
4. Zweiten **tatsächlich** verfügbaren Vergleichspfad + Metriken und deren Herkunft vergleichen.
5. Wissenschaftlichen Punkt gezielt auswählen und Route dorthin samt Dauer/Energie zeigen (nur nach B-Fix).
6. Den Constraint und Unsicherheiten offen benennen: 20-m-Daten, Marsgravitation nicht validiert, Strahlung aus Gale-Referenz.
7. Kurz den Nutzen und die nächsten Forschungs-/Validierungsschritte nennen.

**30-Sekunden-Demovideo-Storyboard (optional, vor Ort geltende Regeln verifizieren):**
- 00–05 s: „How do you plan a Marswalk when terrain and life support matter?“
- 05–11 s: NASA/USGS Jezero-Datenkarte mit Quelle, über die Oberfläche navigieren.
- 11–20 s: echte Route rechnen und Vergleichsdaten sichtbar machen.
- 20–26 s: echter Science-Stop / Provenienz / Risikobeschränkung.
- 26–30 s: „An open, reproducible planning prototype—not a flight-certified navigation system.“

**Keine fiktive Ausgangs-/Zielroute, kein ungekennzeichneter Mock-Solver, keine Erfolgskennzahl aus einer anderen Route!**

## 7. Integration- und Release-Gates (Go / No-Go)

### Gate 1: Source & Tests
- [ ] Branches sind abgeglichen, alle P0-Änderungen auf main, keine offenen relevanten PR-Konflikte.
- [ ] Frontend ESLint, TypeScript Build und Unit/Science-Tests grün.
- [ ] Backend-Pytest grün; **passed/skipped** separat dokumentiert.
- [ ] API-Contract gegen lebenden Backendserver grün, kein Offline-Mock als Live-Nachweis.
- [ ] Docker-Compose läuft von frischem Checkout mit dokumentierten Geodaten/Flags.

### Gate 2: Interaktion
- [ ] Frischer Browser: 3D-Orbit → Jezero Terrain → zweimal Doppelklick → Live Route → Route-Vergleich → Science Target → echtes Mission-Resultat.
- [ ] Mindestens ein realer visueller Wechsel auf geologische/thermische Ebene **oder** bewusst und korrekt gekennzeichneter Nichtverfügbarkeitszustand.
- [ ] Backend-Fehler 422/503/Timeout und DEM-404 ergeben keine falsche Erfolgsmeldung.
- [ ] 1366×768 und 1920×1080, mindestens ein mobiles Viewport: lesbare Oberfläche und keine WebGL-Runtime-Fehler.
- [ ] Browser-Netzwerkmitschnitt belegt Herkunft aller wichtigen Zahlen; Screen-Capture abgelegt.

### Gate 3: Wissenschaftliche Validität
- [ ] Mindestens eine unabhängige Rover-/HiRISE-Höhen-Gegenprobe reproduziert, Dataset-Hashes und Skript dokumentiert.
- [ ] Dynamischer Risikowert vs. wissenschaftlicher Index vs. Safety-Claim sauber unterschieden.
- [ ] Einheitliche 15°-Regel **oder** sauber dokumentiertes anderes Modell, kein unbegründeter Wechsel.
- [ ] Kartenfarbskala und tatsächliche Datenebene nachweisbar korrekt.
- [ ] Keine Probenvisite ohne geodätisch geprüftes Zwischenziel.

### Gate 4: Presentation & Submission
- [ ] Alle Angaben, QR-Codes, Demo-URLs und Video-/Slides-Links in Inkognito testbar.
- [ ] Knapper englischer Pitch plus Dokumentation, klarer Hinweis auf Grenzen.
- [ ] AI-Usage, Drittmaterial und Datenquellen vollständig und konsistent.
- [ ] Offizielle 2026-Teamseite tatsächlich abgegeben, Datum/Uhrzeit/Bestätigung dokumentiert.

**Go:** Alle P0 behoben oder ehrlich aus dem im Jury-Video beworbenen Scope gestrichen; die verbliebene Demo läuft und ist nachweisbar korrekt.  
**No-Go:** Falsche Sicherheitsbehauptung, synthetische Route als Live-Validierung, private unzugängliche einzige Demoquelle, nicht reproduzierbare Kernwerte oder ungeprüfte Abgabe.

## 8. Verantwortung und Reportingformat

| Owner | Primärverantwortung | Muss an andere liefern |
|---|---|---|
| Dev A | Frontend, 3D, Labeling, realer Browserflow, Demo | Screenshots, Trace, UI→API-Mapping, exakte Versionsstände |
| Dev B | Geodaten, RouteObjectives, echte Science-Stops, EVA-Schätzmodell, API | OpenAPI, reproduzierbare Resultate, Datenprovenienz, NoData-/Risiko-Limits |
| Lead | Integrationsentscheidung, Claim Register, Submission, Pitch | Go/No-Go, Quellen- und Lizenzprüfung, öffentlicher Live-/Demo-Link |

**Jede erledigte Aufgabe** muss enthalten: Aufgaben-ID, Commit/PR, was geändert wurde, exakte Start-/Ziel-Inputs, Testbefehl, Testausgabe, Screenshot/Trace (bei UI), Einschränkungen und Reviewer-Name. Keine weiteren „SIGNED OFF“-Haken ohne Artefakt.

## 9. Realistische Priorisierung für den verbleibenden Hackathon

1. **Sofort:** Zugang und Abgabeformat sichern; keine gesamte Einreichung durch einen privaten Link verlieren.
2. **Danach:** Irreführende Routen-/Risikobezeichnungen entschärfen und auf echte Solverantworten ausrichten. Wenn B echte Optimierungen nicht rechtzeitig liefert: ehrliches De-Scope.
3. **Danach:** Höhenfarben und Datenverfügbarkeit reparieren, mindestens einen wirklich sinnvollen wissenschaftlichen Overlay-/Science-Use-Case vorführen.
4. **Danach:** Ein vollständiger Live-End-to-End-Lauf, nachvollziehbare Benchmarkzahlen, Konsistenz der Texte.
5. **Erst zuletzt:** Shader-Polish, Animationen, Effekte, Micro-UX, zusätzliche Features. Keine neuen P2-Funktionen riskieren die letzte stabile Demo.

## 10. Nachweise / Referenzen im Repository

- `README.md` – aktuelles Projekt-Narrativ, aber teilweise nicht mehr synchron (Requirements-/Lizenzpfad, Benchmarkzahlen).
- `backend/DATENQUELLEN.md` – Datenquellen, Größen, DEM-/Rover-Gegenproben (Team-belegte Resultate).
- `backend/INTEGRATION_SIGNOFF.md` – Backend-53-Test-Signoff (Team-belegt).
- `backend/SUBMISSION_BACKEND.md` – gute fachliche Grundlage für englischen Backend-Abgabetext.
- `docs/SCIENTIFIC_CLAIMS_AUDIT.md` – Ausgangspunkt für einen zentralen Claim-/Formel-Abgleich.
- `docs/AI_USAGE.md` – zu aktualisieren: u. a. 20° versus 15°, ältere Daten und Claims.
- `docs/FINAL_INTEGRATION_CHECKLIST.md` – veraltete Freigabestatus; beim Merge aktualisieren.
- `docs/JURY_DEMO_SCRIPT.md` und `frontend/src/components/ui/GuidedJuryTour.tsx` – feste und teils widersprüchliche Benchmarkzahlen.
- `frontend/scripts/test_e2e_mission.mjs` – keine echte Browserautomation, daher gesondert kennzeichnen.
- `.github/workflows/frontend.yml` und `.github/workflows/docker.yml` – hilfreiche CI-Checks, ersetzen aber nicht vollständige Browser-/Wissenschaftsprüfung.

**Schlussurteil Tag 1:** Technischer Kern stark, aber noch nicht „Global Winner ready“. Für eine realistische Spitzenplatzierung müssen vor allem **wissenschaftliche Ehrlichkeit, echte sichtbare Integration, reproduzierbare Live-Beweise und eine regelkonforme öffentliche Einreichung** stimmen.