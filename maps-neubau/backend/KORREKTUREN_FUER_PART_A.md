# Korrekturen fuer Part A (Dev B an Dev A)

Bezug: `docs/PART_B_TONIGHT_HANDOFF.md` und `docs/PART_B_TASK_BOARD.md` auf `dev/frontend`.
Die Aufgaben B-001 bis B-005 sind umgesetzt (PR #6). Bei der Umsetzung sind fuenf Stellen in den Dokumenten aufgefallen, die nicht zum Code passen. Bitte in den Dokumenten und in der README anpassen, bevor sie jemand vorliegt.

## 1. Steigungsgrenze 15 Grad, nicht 20 Grad

Im Code gilt `MAX_STEIGUNG_GRAD = 15.0` (`backend/app/nasa_werte.py`). Quelle: steilster Abschnitt im Rock Yard des NASA JSC, den Probanden bei der Pandolf-Studie liefen (Kim et al., APACHE-Studie, ICES 2022, NTRS 20220003008).
Die 20 Grad aus dem Handoff sind ein Rover-Wert (MER, MSL). Der gilt fuer Raeder und nicht fuer Astronauten zu Fuss. Die Zitate Arvidson et al. 2011 und Heverly et al. 2013 haben wir nicht geprueft und deshalb nicht uebernommen.

## 2. Keine Anzuglast, keine Mars-Schwerkraft in der Energie

Im Code gilt `ZUSATZLAST_KG = 0.0`. Das Handoff nennt 35 kg Anzugnutzlast und eine Kalibrierung auf 3,721 m/s2.
Die Pandolf-Gleichung gilt fuer Lasten bei 1 g. Wie die NASA die Anzuglast bei Mars-Schwerkraft einrechnet, steht in den gelesenen Quellen nicht. Deshalb rechnen wir ohne Last, die Energie ist damit eher zu niedrig. Koerpermasse 80,7 kg und Tempo 3,0 km/h stimmen.

## 3. Gewichtung 60 zu 40 ist eine eigene Festlegung

Der Risikoindex ist `R = 0,6 * (mittlere Steigung / 15 Grad) + 0,4 * (steilste Steigung / 15 Grad)`, begrenzt auf 0 bis 1.
Die Gewichtung kommt nicht aus einer NASA-Quelle. Sie darf als Modellannahme genannt werden, nicht als belegter Wert. Der Name "Normalized Terrain Slope Risk Index" und der Hinweis, dass es kein Unfallrisiko ist, stehen in `nasa_werte.py` (`RISIKO_INDEX`).

## 4. HiRISE-Kasten liegt ausserhalb des Mosaiks

Das Handoff nennt fuer HiRISE 18,42 bis 18,48 N und 77,40 bis 77,48 O. Das USGS-HiRISE-Mosaik reicht von 18,136 bis 18,588 N und 77,058 bis 77,381 O. Der Kasten liegt damit ausserhalb.
Das Routing rechnet immer auf dem CTX-DEM (20 m). Die HiRISE-Kacheln (`hirise_dem`, 1,6 m) sind nur fuer die Anzeige gedacht.

## 5. Beschriftung der Alternativrouten

`requestRouteAlternatives` nennt Route 1 "direct", Route 2 "safe" und Route 3 "science". Die API sortiert nach Energie. Route 2 ist nicht automatisch sicherer, Route 3 hat keinen Bezug zu den Science Points.
Beispiel Jezero: Risk 0,23 / 0,22 / 0,28. Die dritte Route ist die mit dem hoechsten Risiko.
Vorschlag: neutral beschriften ("Route 1 (energiearmste)", "Alternative 2", "Alternative 3") oder ein Namensfeld in der API ergaenzen, dann bitte Bescheid sagen.

## 6. Leistungs- und Sauerstoffwerte weichen ab

- Das Frontend (HUD) zeigt etwa 285 W Leistung, weil es mit 35 kg Anzuglast rechnet. Die API liefert fuer dieselbe Route etwa 217 W (Last 0, siehe Punkt 2). Beide Zahlen stehen sonst nebeneinander.
- `SCIENTIFIC_CLAIMS_AUDIT.md` nennt 14,15 MJ je kg Sauerstoff. Im Code gilt 14,11 MJ (aus dem Apollo-Rechenbeispiel, 3670 Btu durch 0,605 lb).
- Das Audit nennt 791 W bei 15 % Steigung. Unser Pandolf-Wert bei 15 % ist 558 W (Last 0).

## Weitere Hinweise

- Die API liefert jetzt Namen fuer Alternativrouten im Feld `tags` (`energy_optimal`, `lowest_risk`, `shortest`). Damit laesst sich die Beschriftung aus Punkt 5 wahrheitsgemaess machen.
- Neuer Layer `geology` in `GET /api/layers` mit Legende, neue Kachelsaetze `slope_ctx`, `thermal_inertia`, `ctx_ortho`.
- Strahlung: `radiationDoseMilligray` in der Missionssimulation ist ein Referenzwert aus dem Gale-Krater, nicht aus Jezero.

- Zahlen in der README (z. B. 405 kJ gegen 265 kJ, +-0,02 m Kachelaufloesung) sind von uns nicht geprueft. Die Kachelaufloesung betraegt je nach Satz etwa 0,015 m (HiRISE) bis 0,046 m (CTX) Hoehenschritt.
- Laufzeit `/api/routes/alternatives` mit 3 Routen: kalt etwa 10 s, die Benchmark-Route (18,38 N 77,58 O nach 18,44 N 77,45 O) wird beim Serverstart vorgewaermt und kommt dann unter 10 ms. Eine Ladeanzeige im Frontend ist sinnvoll.
