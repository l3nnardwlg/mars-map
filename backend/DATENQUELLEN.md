# Datenquellen und Pruefergebnisse (Dev B)

Stand 14.11.2026. Alle Daten sind oeffentlich. Rohdaten liegen nicht im Repo, `python scripts/fetch_data.py` holt sie (siehe `README.md`).

## Verwendete Datensaetze

| Datensatz | Quelle | Groesse | Aufloesung | Abdeckung | Lizenz | Verwendung |
|---|---|---|---|---|---|---|
| CTX-DEM Jezero (`M20_JezeroCrater_CTXDEM_20m.tif`) | USGS Astrogeology, Calef 2021 ([Seite](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic)) | 90 345 300 Byte, SHA-256 `ba7f706e...1ba2` | 20 m, 4456 x 5067 | 17,58 bis 19,29 N, 76,99 bis 78,58 O | Public Domain, Autoren nennen | Routing, Kacheln `ctx_dem`, Hoehen der Science Points |
| HiRISE-DTM Jezero, MSR-Mosaike v003 (`..._mosaics.zip`) | USGS, Bland 2024 ([Seite](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic)) | 5 468 062 403 Byte, darin DTM 711 891 990 Byte | 1 m, 19144 x 26816 | 18,136 bis 18,588 N, 77,058 bis 77,381 O | Public Domain | Kacheln `hirise_dem` (bis 1,6 m) |
| CTX-Orthobild Jezero 5 m | USGS, passend zum CTX-DEM | 359 599 280 Byte, SHA-256 `cd9f4b21...d2df` | 5 m | wie CTX-DEM | Public Domain | Layer `ctx_ortho` (Kacheln bis 10 m) |
| THEMIS-Waermetraegheit Jezero (`Jezero_Thermal_Inertia_v1.tiff`) | Edwards und Buz 2021, [Zenodo 4931348](https://zenodo.org/records/4931348) | 1 721 889 Byte, SHA-256 `84401e77...829c` | THEMIS-Mosaik | Jezero-Krater | siehe Zenodo-Eintrag | Layer `thermal_inertia` (Kacheln, 87 m) |
| Rover-Wegpunkte (`M20_waypoints.json`) | NASA MMGIS Mars 2020 ([Datei](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json)) | 603 126 Byte, 708 Punkte bis Sol 2022 | - | Jezero | NASA, oeffentlich | Landeplatz und letzte Position (Science Points) |
| Probenorte (`M20_SAMPLE_v3.json`) | NASA MMGIS Mars 2020 ([Datei](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_SAMPLE_v3.json)), Tabelle: [science.nasa.gov](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples) | 11 389 Byte, SHA-256 `60d4b0a2...fcae` | - | 22 Eintraege fuer 30 Proben | NASA, oeffentlich | 22 Science Points |
| Namensverzeichnis Mars (`MARS_nomenclature_center_pts.zip`) | USGS Gazetteer of Planetary Nomenclature | 5 421 247 Byte, SHA-256 `753f2965...1910` | - | global, 12 Merkmale im Gebiet | oeffentlich | 12 Science Points |
| Geologische Karte Jezero und Nili Planum (SIM 3464, `sim3464_database.zip`) | USGS, Sun und Stack 2020 ([Seite](https://pubs.usgs.gov/publication/sim3464), [DOI](https://doi.org/10.3133/sim3464)) | 349 336 873 Byte, SHA-256 `a88bd53a...9f87` | Massstab 1:75 000, gerastert mit 20 m | 76,80 bis 77,80 O, 17,70 bis 18,70 N | Public Domain, Zitat von Sun und Stack 2020 verlangt | Layer `geology` (14 Einheiten, Legende) |
| UAHiRISE-DTMs `DTEEC_002387_1985_003798_1985_A01` und `DTEEC_022680_1985_022746_1985_A01` | University of Arizona ([Katalog](https://www.uahirise.org/hiwish/maps/dtms.jsp)) | 320 045 704 und 479 934 208 Byte | etwa 1 m | 18,39 bis 18,59 N, 77,34 bis 77,47 O und Umgebung 18,2 N 77,4 O | oeffentlich | nur Gegenprobe |

Nicht verwendet: Mars Trek (Weboberflaeche ohne stabile Download-Schnittstelle, Daten kommen von den USGS-Originalquellen), NASA Worldview (zeigt die Erde).

## Pruefergebnisse

| Pruefung | Ergebnis |
|---|---|
| Dateigroesse und SHA-256 des CTX-DEM werden von `fetch_data.py` bei jedem Download geprueft | bestanden, Neuaufbau der Kacheln in leerem Ordner ist byte-identisch |
| CTX-DEM gegen UAHiRISE-DTM 002387 (38 554 Punkte) | Mittel -4,1 m, Standardabweichung 5,3 m, RMSE 6,7 m, 95 % unter 12,6 m |
| CTX-DEM gegen UAHiRISE-DTM 022680 (53 815 Punkte) | Mittel +3,2 m, Standardabweichung 6,1 m, RMSE 6,9 m, 95 % unter 15,7 m |
| CTX-DEM gegen NASA-Probenhoehen (22 Orte) | Mittel 2,8 m, Maximum 17,2 m |
| Landeplatz: CTX-DEM gegen NASA-Wegpunkt | -2567 m gegen -2570 m, 3 m Abweichung |
| CTX-DEM gegen alle NASA-Rover-Positionen (708 Wegpunkte bis Sol 2022, `elev_geoid`) | Mittel -1,0 m, Standardabweichung 3,2 m, RMSE 3,3 m, 95 % unter 6,5 m, Maximum 13,4 m |
| HiRISE-DTM gegen die NASA-Rover-Positionen im Mosaik (320 Wegpunkte) | Mittel -0,6 m, Standardabweichung 0,95 m, RMSE 1,13 m, 95 % unter 2,6 m, Maximum 3,9 m |
| CTX-DEM gegen HiRISE-DTM an denselben 320 Positionen | Mittel -1,3 m, RMSE 4,1 m |
| Gegenprobe HiRISE-Mosaik gegen UA-DTMs | nicht moeglich, das Mosaik ueberlappt beide UA-DTMs nicht. Ersetzt durch den unabhaengigen Vergleich mit den Rover-Positionen oben |
| Pixelfreie Randwerte (Nodata) | CTX -3,4e38, HiRISE -32767, werden beim Routing als gesperrt behandelt |

Skript fuer die Gegenproben: `scripts/compare_dem.py`.

## Bekannte Grenzen

- Ein 20-m-Raster glaettet Steigungen, kleine steile Stufen sind im Routing nicht sichtbar.
- Kachelhoehen sind 16 Bit linear quantisiert: Schritt etwa 0,046 m (CTX) und 0,015 m (HiRISE).
- Probe 30 (Gallants) hat in der NASA-Datei noch keine Sol-Angabe (TBD).
- Strahlung: keine Karte gefunden, nur der Referenzwert von Curiosity (MSL RAD, Gale-Krater, 0,21 mGy pro Tag), siehe README. Wert und Quelle (Hassler et al. 2014, Science 343, 6169, DOI 10.1126/science.1244797: mittlere GCR-Dosisrate 0,210 plus minus 0,040 mGy pro Tag, im Reiseflug 0,48 mGy pro Tag) sind gegen die Veroeffentlichung abgeglichen. Eine Dosisaequivalenz in mSv ist nicht uebernommen.
- Geologie: Laut USGS liegt die Karte auf einem halbkontrollierten CTX-Mosaik und weicht um etwa 100 bis 200 m vom kontrollierten CTX-Mosaik ab, auf dem unser Hoehenmodell beruht. Die Karte deckt nur den westlichen Teil des CTX-Gebiets ab. In den Quelldaten steht die Einheit "Upper etched unit" einmal mit der Nummer der Nili-Planum-2-Einheit, und "Crater riim unit" ist ein Tippfehler, beides haben wir nach Namen zusammengefuehrt.
- Die Waermetraegheit hat in etwa einem Drittel des Gebiets keine Daten (Nodata), dort bleiben die Kacheln leer.
- Die Steigungskarte (`slope_ctx`) ist aus dem CTX-DEM berechnet und kein eigener NASA-Datensatz. Maximalwerte bis 88 Grad entstehen an Steilkanten und Randartefakten.
- Die UA-DTMs sind Stichproben, kein Nachweis fuer das ganze Gebiet.
