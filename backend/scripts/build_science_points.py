import argparse
import json
import math
from datetime import datetime
from pathlib import Path

import rasterio
import shapefile
from rasterio.crs import CRS
from rasterio.warp import transform

MARS_GEOGRAPHIC = CRS.from_string("+proj=longlat +R=3396190 +no_defs")
BOUNDS = (76.99, 17.58, 78.58, 19.29)
WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json"
JEZERO_PAPER = "https://doi.org/10.1126/science.abl4051"

TYP_NAMEN = {
    "Crater, craters": "Krater",
    "Vallis, valles": "Tal",
    "Planum, plana": "Hochebene",
    "Mons, montes": "Berg",
}


def hoehe_am_punkt(dem, lat, lon):
    xs, ys = transform(MARS_GEOGRAPHIC, dem.crs, [lon], [lat])
    zeile, spalte = dem.index(xs[0], ys[0])
    if not (0 <= zeile < dem.height and 0 <= spalte < dem.width):
        return None
    wert = float(dem.read(1, window=((zeile, zeile + 1), (spalte, spalte + 1)))[0, 0])
    return None if wert < -1e30 or math.isnan(wert) else round(wert, 1)


def slug(text):
    return text.lower().replace(" ", "-")


def gazetteer_punkte(shp_pfad):
    punkte = []
    for eintrag in shapefile.Reader(str(shp_pfad)).records():
        d = eintrag.as_dict()
        if not (BOUNDS[0] <= d["center_lon"] <= BOUNDS[2] and BOUNDS[1] <= d["center_lat"] <= BOUNDS[3]):
            continue
        datum = d["approvaldt"].strftime("%Y-%m-%d") if isinstance(d["approvaldt"], datetime) else str(d["approvaldt"])[:10]
        typ = TYP_NAMEN.get(d["type"], d["type"])
        beschreibung = (
            f"{typ}, Durchmesser {d['diameter']:.1f} km. {d['approval']} am {datum}. "
            f"Namensherkunft laut USGS-Namensverzeichnis: {d['origin']}"
        )
        if d["clean_name"] == "Jezero":
            beschreibung += f" Ehemaliges Seebecken mit Flussdelta, Zielgebiet der Perseverance-Mission (Mangold et al. 2021, {JEZERO_PAPER})."
        punkte.append(
            {
                "id": f"gazetteer-{slug(d['clean_name'])}",
                "name": d["clean_name"],
                "lat": round(float(d["center_lat"]), 6),
                "lon": round(float(d["center_lon"]), 6),
                "description": beschreibung,
                "url": d["link"].replace("http://", "https://"),
            }
        )
    return punkte


def rover_punkte(waypoints_pfad):
    features = json.loads(Path(waypoints_pfad).read_text(encoding="utf-8"))["features"]
    erste, letzte = features[0]["properties"], features[-1]["properties"]
    return [
        {
            "id": "perseverance-landung",
            "name": "Octavia E. Butler Landing",
            "lat": erste["lat"],
            "lon": erste["lon"],
            "description": (
                "Landeplatz von Perseverance im Jezero-Krater, Landung am 18. Februar 2021. "
                f"Koordinaten aus der ersten lokalisierten Rover-Position (Sol {erste['sol']}) der NASA-Wegpunktdatei."
            ),
            "url": WAYPOINTS_URL,
        },
        {
            "id": "perseverance-letzte-position",
            "name": f"Perseverance, Position Sol {letzte['sol']}",
            "lat": letzte["lat"],
            "lon": letzte["lon"],
            "description": (
                f"Letzte Position in der NASA-Wegpunktdatei (Sol {letzte['sol']}), "
                f"{letzte['dist_total_m'] / 1000:.1f} km Fahrstrecke seit der Landung."
            ),
            "url": WAYPOINTS_URL,
        },
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gazetteer", type=Path, required=True)
    parser.add_argument("--waypoints", type=Path, required=True)
    parser.add_argument("--dem", type=Path, required=True)
    parser.add_argument("--ausgabe", type=Path, required=True)
    args = parser.parse_args()

    ergebnis = []
    with rasterio.open(args.dem) as dem:
        for punkt in rover_punkte(args.waypoints) + gazetteer_punkte(args.gazetteer):
            hoehe = hoehe_am_punkt(dem, punkt["lat"], punkt["lon"])
            ort = {"latitude": punkt["lat"], "longitude": punkt["lon"]}
            if hoehe is not None:
                ort["elevationMeters"] = hoehe
            ergebnis.append(
                {
                    "id": punkt["id"],
                    "name": punkt["name"],
                    "location": ort,
                    "description": punkt["description"],
                    "nasaSourceUrl": punkt["url"],
                }
            )
    args.ausgabe.write_text(json.dumps(ergebnis, indent=2, ensure_ascii=False), encoding="utf-8")
    print(len(ergebnis), "Science Points geschrieben")


if __name__ == "__main__":
    main()
