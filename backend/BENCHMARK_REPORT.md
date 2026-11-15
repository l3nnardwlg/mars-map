# Benchmark-Bericht Backend

Erzeugt mit `python scripts/benchmark_report.py` am 2026-11-15 16:03 UTC, Branch `main`, Commit `1ad7d3b`.

- Geländemodell: `M20_JezeroCrater_CTXDEM_20m.tif`, 90345300 Byte, SHA-256 `ba7f706ea1b5d63a562f28a7dcf7a7f3c79bce7f048e6974b57e8a33c30d1ba2`
- Tests: 77 passed, 2 warnings in 6.08s (bestanden 77, uebersprungen 0, fehlgeschlagen 0)

## Benchmark-Strecke, drei Ziele

HTTP 200, kalt gerechnet in 0.56 s.

| Ziel | Distanz (m) | Energie (MJ) | Risiko | max. Steigung | mittl. Steigung | Zielwert | Raster (m) | Wegpunkte | Abweichung Wegpunkte |
|---|---|---|---|---|---|---|---|---|---|
| energy_min | 8777 | 2.433 | 0.327 | 9.05 | 2.14 | 2432895.14 J | 20.0 | 185 | -0.773 % |
| distance_min | 8776 | 2.437 | 0.329 | 9.05 | 2.2 | 8776.47 m | 20.0 | 185 | -0.61 % |
| slope_hazard_min | 8891 | 2.521 | 0.238 | 6.83 | 1.41 | 555.74 m | 20.0 | 187 | -1.244 % |

## Kurze Strecke (etwa 400 m)

HTTP 200, kalt gerechnet in 0.1 s.

- energy_min: 416 m, 0.105 MJ, Risiko 0.132

## Science-Stopp Probe 14 und 15

HTTP 200, kalt gerechnet in 0.53 s.

Besucht: probe-14-15

| Teilstrecke bis | Distanz (m) | Energie (MJ) |
|---|---|---|
| probe-14-15 | 11782 | 3.303 |
| Ziel | 3006 | 0.766 |

Summe: 4.069 MJ

## Fehlerfälle

| Fall | HTTP | Text |
|---|---|---|
| Start auf zu steilem Gelände | 422 | Der Startpunkt liegt auf zu steilem Gelände (über 15 Grad). Bitte einen flacheren Punkt wählen. |
| Punkt außerhalb des Modells | 422 | Der Startpunkt liegt außerhalb des Geländemodells von Jezero. |
| Geländemodell fehlt | 503 | Das Geländemodell ist nicht vorhanden. |
