Gemeinsame Schnittstellen
Diese API-Verträge müssen vor dem parallelen Entwicklungsstart feststehen:
Endpoint	Funktion
GET /api/terrain/metadata	Terrain-Koordinaten, Auflösung und verfügbare Kacheln
GET /api/layers	Verfügbare NASA-Datenlayer
GET /api/science-points	Wissenschaftliche Ziele
POST /api/routes/calculate	Route und Risikoanalyse berechnen
POST /api/mission/simulate	EVA-Ressourcen und Missionsdauer schätzen

Wichtig: Beide Entwickler müssen dasselbe Mars-Koordinatensystem, Höhenreferenzsystem und dieselben Datentypen verwenden.

OPENAPI

