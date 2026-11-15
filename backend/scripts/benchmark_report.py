import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app import terrain  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
START = {"latitude": 18.38, "longitude": 77.58}
ZIEL = {"latitude": 18.44, "longitude": 77.45}


def sha256_von(pfad: Path) -> str:
    h = hashlib.sha256()
    with pfad.open("rb") as datei:
        for block in iter(lambda: datei.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def git(*argumente: str) -> str:
    return subprocess.run(["git", *argumente], cwd=BACKEND, capture_output=True, text=True).stdout.strip()


def pytest_ergebnis() -> dict:
    lauf = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], cwd=BACKEND, capture_output=True, text=True)
    letzte = [zeile for zeile in lauf.stdout.splitlines() if " passed" in zeile or " failed" in zeile][-1]
    zahlen = {name: int(anzahl) for anzahl, name in re.findall(r"(\d+) (passed|failed|skipped)", letzte)}
    return {"zusammenfassung": letzte.strip(), **zahlen}


def zeitmessung(aufruf):
    terrain._plan_routes_cached.cache_clear()
    terrain._plan_objectives_cached.cache_clear()
    start = time.perf_counter()
    antwort = aufruf()
    return antwort, time.perf_counter() - start


def main() -> None:
    dem = terrain.dem_pfad()
    bericht: dict = {
        "zeitpunkt_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "commit": git("rev-parse", "--short", "HEAD"),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        "dem": {"datei": dem.name, "bytes": dem.stat().st_size, "sha256": sha256_von(dem)},
        "pytest": pytest_ergebnis(),
        "szenarien": [],
    }

    antwort, dauer = zeitmessung(lambda: client.post("/api/routes/plan", json={"start": START, "end": ZIEL}))
    bericht["szenarien"].append(
        {
            "name": "Benchmark-Strecke, drei Ziele",
            "eingabe": {"start": START, "end": ZIEL},
            "status": antwort.status_code,
            "sekunden": round(dauer, 2),
            "routen": [
                {
                    "ziel": r["objective"],
                    "distanz_m": round(r["distanceMeters"]),
                    "energie_MJ": round(r["energyJoules"] / 1e6, 3),
                    "risiko": round(r["riskScore"], 3),
                    "max_steigung_grad": r["maxSlopeDeg"],
                    "mittlere_steigung_grad": r["meanSlopeDeg"],
                    "zielwert": round(r["objectiveValue"], 2),
                    "einheit": r["objectiveUnit"],
                    "raster_m": r["routingGridResolutionMeters"],
                    "wegpunkte": r["waypointCount"],
                    "wegpunkte_laenge_abweichung_prozent": r["waypointLengthDifferencePercent"],
                }
                for r in antwort.json()
            ],
        }
    )

    kurz_start = {"latitude": 18.440, "longitude": 77.450}
    kurz_ziel = {"latitude": 18.445, "longitude": 77.455}
    antwort, dauer = zeitmessung(lambda: client.post("/api/routes/plan", json={"start": kurz_start, "end": kurz_ziel, "objectives": ["energy_min"]}))
    r = antwort.json()[0]
    bericht["szenarien"].append(
        {"name": "Kurze Strecke (etwa 400 m)", "status": antwort.status_code, "sekunden": round(dauer, 2),
         "routen": [{"ziel": r["objective"], "distanz_m": round(r["distanceMeters"]), "energie_MJ": round(r["energyJoules"] / 1e6, 3), "risiko": round(r["riskScore"], 3)}]}
    )

    antwort, dauer = zeitmessung(
        lambda: client.post("/api/routes/plan", json={"start": START, "end": ZIEL, "objectives": ["energy_min"], "sciencePointIds": ["probe-14-15"]})
    )
    r = antwort.json()[0]
    bericht["szenarien"].append(
        {"name": "Science-Stopp Probe 14 und 15", "status": antwort.status_code, "sekunden": round(dauer, 2),
         "besucht": r["visitedSciencePointIds"],
         "teilstrecken": [{"bis": leg["toId"] or "Ziel", "distanz_m": round(leg["distanceMeters"]), "energie_MJ": round(leg["energyJoules"] / 1e6, 3)} for leg in r["legs"]],
         "gesamt_energie_MJ": round(r["energyJoules"] / 1e6, 3)}
    )

    fehler = []
    antwort = client.post("/api/routes/plan", json={"start": {"latitude": 18.064, "longitude": 77.517}, "end": {"latitude": 18.026, "longitude": 77.478}})
    fehler.append({"fall": "Start auf zu steilem Gelände", "status": antwort.status_code, "text": antwort.json().get("detail")})
    antwort = client.post("/api/routes/plan", json={"start": {"latitude": 0.0, "longitude": 10.0}, "end": ZIEL})
    fehler.append({"fall": "Punkt außerhalb des Modells", "status": antwort.status_code, "text": antwort.json().get("detail")})
    alt = os.environ.get("MARS_DEM_PATH")
    os.environ["MARS_DEM_PATH"] = str(BACKEND / "data" / "fehlt.tif")
    antwort = client.post("/api/routes/plan", json={"start": START, "end": ZIEL})
    fehler.append({"fall": "Geländemodell fehlt", "status": antwort.status_code, "text": antwort.json().get("detail")})
    if alt is None:
        del os.environ["MARS_DEM_PATH"]
    else:
        os.environ["MARS_DEM_PATH"] = alt
    bericht["fehlerfaelle"] = fehler

    (BACKEND / "benchmark_report.json").write_text(json.dumps(bericht, indent=2, ensure_ascii=False), encoding="utf-8")

    zeilen = [
        "# Benchmark-Bericht Backend",
        "",
        f"Erzeugt mit `python scripts/benchmark_report.py` am {bericht['zeitpunkt_utc']} UTC, Branch `{bericht['branch']}`, Commit `{bericht['commit']}`.",
        "",
        f"- Geländemodell: `{bericht['dem']['datei']}`, {bericht['dem']['bytes']} Byte, SHA-256 `{bericht['dem']['sha256']}`",
        f"- Tests: {bericht['pytest']['zusammenfassung']} (bestanden {bericht['pytest'].get('passed', 0)}, uebersprungen {bericht['pytest'].get('skipped', 0)}, fehlgeschlagen {bericht['pytest'].get('failed', 0)})",
        "",
    ]
    for szenario in bericht["szenarien"]:
        zeilen.append(f"## {szenario['name']}")
        zeilen.append("")
        zeilen.append(f"HTTP {szenario['status']}, kalt gerechnet in {szenario['sekunden']} s.")
        zeilen.append("")
        if "routen" in szenario and szenario["routen"] and "raster_m" in szenario["routen"][0]:
            zeilen.append("| Ziel | Distanz (m) | Energie (MJ) | Risiko | max. Steigung | mittl. Steigung | Zielwert | Raster (m) | Wegpunkte | Abweichung Wegpunkte |")
            zeilen.append("|---|---|---|---|---|---|---|---|---|---|")
            for r in szenario["routen"]:
                zeilen.append(
                    f"| {r['ziel']} | {r['distanz_m']} | {r['energie_MJ']} | {r['risiko']} | {r['max_steigung_grad']} | {r['mittlere_steigung_grad']} | {r['zielwert']} {r['einheit']} | {r['raster_m']} | {r['wegpunkte']} | {r['wegpunkte_laenge_abweichung_prozent']} % |"
                )
        elif "teilstrecken" in szenario:
            zeilen.append(f"Besucht: {', '.join(szenario['besucht'])}")
            zeilen.append("")
            zeilen.append("| Teilstrecke bis | Distanz (m) | Energie (MJ) |")
            zeilen.append("|---|---|---|")
            for leg in szenario["teilstrecken"]:
                zeilen.append(f"| {leg['bis']} | {leg['distanz_m']} | {leg['energie_MJ']} |")
            zeilen.append("")
            zeilen.append(f"Summe: {szenario['gesamt_energie_MJ']} MJ")
        else:
            for r in szenario["routen"]:
                zeilen.append(f"- {r['ziel']}: {r['distanz_m']} m, {r['energie_MJ']} MJ, Risiko {r['risiko']}")
        zeilen.append("")
    zeilen.append("## Fehlerfälle")
    zeilen.append("")
    zeilen.append("| Fall | HTTP | Text |")
    zeilen.append("|---|---|---|")
    for f in bericht["fehlerfaelle"]:
        zeilen.append(f"| {f['fall']} | {f['status']} | {f['text']} |")
    (BACKEND / "BENCHMARK_REPORT.md").write_text("\n".join(zeilen) + "\n", encoding="utf-8")
    print("geschrieben: BENCHMARK_REPORT.md und benchmark_report.json")


if __name__ == "__main__":
    main()
