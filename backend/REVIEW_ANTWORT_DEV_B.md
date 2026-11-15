# Antwort Dev B auf `docs/master review tag 1/DEV_B_BACKEND.md`

Stand 15.11.2026. Nachweis für jeden Punkt: Test, Datei oder `BENCHMARK_REPORT.md` (erzeugt mit `python scripts/benchmark_report.py`, enthält Commit, Datensatz-SHA-256 und Tests getrennt nach bestanden und übersprungen).

## P0

| ID | Stand | Was gemacht wurde, Nachweis | Noch offen |
|---|---|---|---|
| B-001 | erledigt | Neuer Endpunkt `POST /api/routes/plan` mit den Zielen `energy_min`, `distance_min`, `slope_hazard_min`. Jedes Ziel ist ein exaktes Optimum auf derselben Sperrmaske. Antwort mit `objective`, `objectiveValue`, `objectiveUnit`, `constraints`, `sourceMode`. Hazard-Ziel: Integral von (Steigung/15 Grad)^2 plus kleiner Distanzanteil, Energiebudget 2-fach wird als Zustand ausgegeben. Test `test_objectives_have_different_optima_and_each_wins_its_own_metric` (synthetisches Gelände mit Grat) und `test_plan_returns_each_objective_with_provenance` (echtes DEM). `alternatives` trägt jetzt `objective` (`energy_min` oder `alternative_corridor`). | `alternatives` bleibt "Energie plus Strafkorridor" und ist so benannt. Kein Feld `isValidatedRoute`, dafür `sourceMode`. |
| B-002 | erledigt | `sciencePointIds` und `via` im Request, `visitedSciencePointIds` und `legs` (Distanz, Energie, Dauer je Teilstrecke) in der Antwort. Unbekannte IDs und zu steile Stopps geben 422 mit Grund. Stopps sind Planungsziele, keine Probenentnahme. Tests `test_route_via_stop_visits_the_stop_and_sums_the_legs`, `test_plan_with_science_stop_visits_the_stop_and_sums_the_legs`. | Reihenfolge der Stopps ist die der Eingabe (erst IDs, dann Koordinaten). Keine automatische Optimierung der Reihenfolge. |
| B-003 | erledigt | Diagonalen nur, wenn beide orthogonalen Nachbarzellen frei sind, in Solver und Referenz-A*. Tests `test_diagonal_does_not_cut_a_blocked_corner` und `test_diagonal_is_allowed_when_both_neighbours_are_free_and_one_blocked_goes_around`. | Kein Sicherheitspuffer entlang der Segmente über die Nachbarzellen hinaus. |
| B-004 | teilweise | Antwort nennt `routingGridResolutionMeters`, `nativeResolutionMeters`, `waypointCount`, `waypointLengthDifferencePercent` und `warnings` (Hinweis bei gröberem Raster und bei über 2 Prozent Kürzung). Der steilste Punkt und die Stopps bleiben immer unter den Wegpunkten. Metriken kommen vom vollen Pfad. | Das Raster wird bei großen Fenstern weiter per Mittelwert verkleinert, kleine Hindernisse können fehlen (steht als Warnung). Die volle Geometrie wird nicht separat geliefert. `mission/simulate` rechnet aus den Wegpunkten. |
| B-005 | erledigt (ohne Zusatzfunktionen) | `mission/simulate` liefert `assumptions` (Masse, Last, Tempo, Geländefaktor, Behandlung von Schwerkraft und Gefälle, Grenzen), `validityScope` ("Planungsschätzung, nicht sicherheitszertifiziert"), `peakPowerWatts` mit harter Prüfung gegen 530 W und `warnings`. Test `test_mission_states_assumptions_scope_and_peak_power`. | Kein Rückweg, keine Arbeitszeit, keine Reserve (`roundTrip`, `scienceDwellSeconds`, `reserveFraction` nicht umgesetzt). |
| B-006 | teilweise | `datasetId`, `nativeResolutionMeters`, `routingGridResolutionMeters`, `heightDatum`, `modelVersion`, `sourceMode`, `warnings` je Route. | Keine `datasetVersion` und keine `inputBounds`. `/api/terrain/metadata` meldet weiter die feinste Auflösung über alle Kachelsätze, die Route nennt ihre eigene. |

## P1

| ID | Stand | Nachweis | Noch offen |
|---|---|---|---|
| B-007 | erledigt | Mittlere Steigung ist jetzt streckengewichtet (`path_statistics`), Test `test_risk_uses_length_weighted_mean_slope`. Name und Grenzen stehen in `app/nasa_werte.py` (`RISIKO_INDEX`). | Stabilität bei anderer Rasterauflösung ist nicht getestet. |
| B-008 | Entscheidung | HiRISE bleibt Kachel- und Anzeigeebene. Das Routing läuft auf dem CTX-DEM (so auch im Abgabetext). Das HiRISE-DTM ist gegen 320 Rover-Positionen geprüft (RMSE 1,13 m). | Kein A/B-Routing auf HiRISE. |
| B-009 | erledigt | `GET /api/layers` liefert `status` (`ready` oder `not-built`), `coverage`, `zoomMin`, `zoomMax`, `codec`, `nativeResolutionMeters`, Legende. Test `test_every_built_tile_set_decodes_to_the_documented_encoding` dekodiert eine echte Kachel je Satz und prüft Größe, Datentyp und Klassen. | Kein `noDataFraction`. |
| B-010 | teilweise | Standardlauf von `scripts/fetch_data.py` holt nur das CTX-DEM (86 MB) und baut die Kacheln, alles Weitere über `--layers`, `--geologie`, `--science`, `--hirise`. CI und Docker laufen so von einem frischen Checkout. | Keine zweite, noch kleinere Demo-Datenvariante. |
| B-011 | teilweise | `scripts/benchmark_report.py` erzeugt `BENCHMARK_REPORT.md` und `benchmark_report.json` mit Commit, Datensatz-SHA-256, bestanden und übersprungen, drei Benchmark-Szenarien und den Fehlerfällen. Mit Daten: 74 bestanden, 0 übersprungen. Ohne Daten (wie in der CI): 59 bestanden, 15 übersprungen. | Die CI-Jobs sind nicht in Pflichtjobs getrennt. |
| B-012 | teilweise | Eingaben sind begrenzt (Koordinaten, `count` höchstens 5, höchstens 3 Ziele und 3 Stopps). CORS ist über `MARS_CORS_ORIGINS` erweiterbar. `/ready` meldet 503, wenn DEM oder Kacheln fehlen. 422 und 503 sind getrennt. | Keine Ratenbegrenzung, keine Zeitlimits, keine strukturierten Fehlercodes. |
| B-013 | teilweise | `openapi.json` wird von `test_committed_openapi_matches_app` auf Drift geprüft, dazu Vertragstests für alle Endpunkte und Pflichtfelder. | Keine generierten TypeScript-Typen. |

## Abnahmetests B-T01 bis B-T14

| Test | Abgedeckt durch |
|---|---|
| B-T01 flache Fläche | `test_flat_terrain_gives_straight_path_without_risk` |
| B-T02 Wand mit Lücke | `test_path_goes_around_steep_wall_through_gap` |
| B-T03 Diagonale | beide Diagonal-Tests |
| B-T04 Distanz gegen Energie | `test_objectives_have_different_optima_and_each_wins_its_own_metric` |
| B-T05 Science-Stopp | `test_route_via_stop_visits_the_stop_and_sums_the_legs` und der Test mit echtem DEM |
| B-T06 außerhalb, zu steil, kein Weg | `test_steep_start_gets_readable_reason`, `test_point_outside_model_gets_readable_reason`, `test_steep_via_stop_is_rejected_with_reason` |
| B-T07 fehlendes DEM | `test_plan_without_dem_returns_503`, `test_route_without_dem_returns_503` |
| B-T08 Raster und Warnung | Felder und Warnung in der Antwort, Prüfung in `test_plan_returns_each_objective_with_provenance` |
| B-T09 voller Pfad gegen Wegpunkte | `waypointLengthDifferencePercent` unter 5 Prozent, geprüft |
| B-T10 Layer | `test_every_built_tile_set_decodes_to_the_documented_encoding`, `test_layer_carries_coverage_zoom_range_and_codec` |
| B-T11 EVA-Bilanz | `test_mission.py`, aus denselben Wegpunkten und Modellparametern |
| B-T12 Benchmark-Validierung | `DATENQUELLEN.md` (Rover-Positionen) und `BENCHMARK_REPORT.md` |
| B-T13 CI mit und ohne Daten | bestanden und übersprungen getrennt im Bericht |
| B-T14 Vertrag Frontend und Backend | `test_openapi_contract.py`, `npm run test:contract` |

## Hinweis für Dev A

Neue Felder und der Endpunkt `POST /api/routes/plan` sind nur Ergänzungen, der bisherige Vertrag bleibt unverändert. Für ehrliche Labels bitte `objective` und `tags` aus der Antwort verwenden statt der Position im Array.
