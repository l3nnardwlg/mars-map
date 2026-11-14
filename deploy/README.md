# Starten und Ausliefern

Voraussetzung in beiden Faellen: die Geodaten liegen unter `backend/data/` (siehe `backend/README.md`, `python scripts/fetch_data.py --layers`). Ohne Daten antworten die Routen mit 503.

## Ohne Docker (geprueft am 14.11.2026)

```bash
cd backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --port 8000
```

In einem zweiten Terminal:

```bash
cd frontend
npm install
npm run dev
```

Die Seite laeuft unter http://localhost:3000, das Frontend leitet `/api/*` an `127.0.0.1:8000` weiter (`frontend/next.config.ts`, Umgebungsvariable `BACKEND_URL` ueberschreibt das Ziel).
Beim Serverstart wird die Benchmark-Route vorgewaermt, nach etwa 15 Sekunden antwortet sie sofort.

## Mit Docker Compose (Test laeuft bei GitHub)

```bash
docker compose up --build
```

`docker-compose.yml` startet das Backend (Port 8000, Daten schreibgeschuetzt aus `backend/data`) und danach das Frontend (Port 3000, gebaut mit `next build`, Backend-Adresse als Build-Argument `BACKEND_URL`). Auf dem Entwicklungsrechner laeuft Docker nicht (keine Virtualisierung). Deshalb baut und startet der Workflow .github/workflows/docker.yml das Compose-Setup bei GitHub auf einem Linux-Rechner: Geodaten holen, docker compose up --build, dann Pruefung von Backend (Layer, Metadaten, Route) und Frontend samt Weiterleitung.

## Pruefungen vor dem Ausliefern

```bash
cd backend && pytest                       # 34 Tests
cd frontend && npm run lint && npm run test:science && npm run test:contract && npm run test:e2e && npm run build
```

`test:contract` und `test:e2e` brauchen ein laufendes Backend auf Port 8000.

