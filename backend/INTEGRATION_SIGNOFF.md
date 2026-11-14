# Integration Sign-off Part B (Backend)

Antwort auf `docs/PART_B_TONIGHT_HANDOFF.md`, Abschnitt H "Required Evidence for Integration Sign-off".
Stand 14.11.2026, Code-Stand `dev/backend` Commit `f3b8af8` (gepusht nach `origin/dev/backend`).

## 1. Aufgaben B-001 bis B-005

| ID | Aufgabe | Stand | Nachweis |
|---|---|---|---|
| B-001 | CORS fuer `localhost:3000` | erledigt | `tests/test_api.py::test_cors_allows_local_frontend`, `test_cors_rejects_foreign_origin`, Preflight liefert `access-control-allow-origin: http://localhost:3000` |
| B-002 | API-Test `/api/routes/alternatives` | erledigt | `tests/test_api.py::test_routes_alternatives_endpoint`, dazu `test_routing.py::test_alternatives_endpoint_on_real_dem` und `test_alternatives_carry_tags` |
| B-003 | Risiko-Index dokumentieren | erledigt mit Abweichung | `app/nasa_werte.py` (`RISIKO_INDEX`). Bezugswinkel **15 Grad**, nicht 20 Grad, siehe `KORREKTUREN_FUER_PART_A.md` |
| B-004 | Kachel-Test | erledigt | `tests/test_api.py::test_tiles_are_served_as_png` (200, `image/png`, PNG-Signatur) |
| B-005 | Cache und Vorwaermen | erledigt | Routen-Cache, Vorwaermen der Benchmark-Route beim Start, gleiche Anfragen werden nur einmal gerechnet, Tests dazu |

## 2. Testprotokoll (`pytest backend/tests`)

```
53 passed, 1 warning in 4.72s
```

Mit lokalen Geodaten laufen alle 53 Tests, keine uebersprungen. In der CI (GitHub) gibt es keine Geodaten, dort werden die Tests, die das DEM oder Kacheln brauchen, uebersprungen. Der Docker-Lauf in der CI holt die Daten und prueft Backend und Frontend zusammen.

## 3. Die zehn Szenarien aus Abschnitt G (gegen den laufenden Server)

| # | Szenario | Ergebnis |
|---|---|---|
| 1 | Health | OK, 200 |
| 2 | Terrain-Metadaten (`regionName` Jezero Crater) | OK, 200 |
| 3 | Layer | OK, 200 (siehe Abweichung A) |
| 4 | Science Points (`perseverance-landung`) | OK, 200 (siehe Abweichung B) |
| 5 | Route berechnen | OK, 200, 0,02 bis 0,17 s |
| 6 | Alternativen (`count` 2) | OK, 200, 0,01 bis 0,26 s |
| 7 | Missionssimulation (`oxygenLiters`) | OK, 200 |
| 8 | Punkt ausserhalb des Modells | OK, 422 |
| 9 | Breite 95 Grad | OK, 422 |
| 10 | CORS-Preflight | OK, `access-control-allow-origin: http://localhost:3000` |

Abweichung A: Das Handoff prueft `"id":"ctx"`. Die Layer-IDs haben sich geaendert: `ctx_dem`, `hirise_dem`, `slope_ctx`, `ctx_ortho`, `geology`, `thermal_inertia`. Geprueft wurde mit `"id":"ctx_dem"`.
Abweichung B: Das Handoff nennt "22 sample sites + landing". Es sind jetzt 36 Science Points (22 Probenorte, Landeplatz, letzte Rover-Position, 12 benannte Merkmale).

## 4. Frontend-Tests gegen dieses Backend

| Test | Ergebnis |
|---|---|
| `npm run test:science` | 10 von 10 |
| `npm run test:contract` | 6 von 6 (6 Layer, 36 Science Points) |
| `npm run test:e2e` | 13 von 13, mit und ohne Backend (nach Anpassung in PR #9) |

## 5. CI

PR #8: Tests, Docker Compose und GitGuardian gruen. PR #9 (nur Frontend): Tests und GitGuardian gruen.

## 6. Fuer die Checkliste `docs/FINAL_INTEGRATION_CHECKLIST.md`

- Punkt 3 (CORS): erledigt
- Punkt 4 (Alternatives-Test): erledigt
- Punkt 2: statt "25/25" jetzt 53 Tests
- "Awaiting tonight's tasks (B-001 through B-004)": B-001 bis B-005 sind erledigt
