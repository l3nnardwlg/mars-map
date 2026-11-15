import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
import rasterio
import shapely
from pyogrio import read_info
from pyogrio.raw import read
from rasterio.features import rasterize
from rasterio.transform import from_origin

SCHREIBWEISE = {"Crater riim unit": "Crater rim unit"}
FARBEN = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0",
    "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Rastert die Geologieeinheiten (SIM 3464) in ein Klassenraster.")
    parser.add_argument("geodatabase", type=Path)
    parser.add_argument("raster", type=Path)
    parser.add_argument("legende", type=Path)
    parser.add_argument("--zelle", type=float, default=20.0)
    args = parser.parse_args()

    info = read_info(str(args.geodatabase), layer="GeoUnits_v1")
    crs = info["crs"]
    meta, _, geometrien, felder = read(str(args.geodatabase), layer="GeoUnits_v1")
    spalte = {name: i for i, name in enumerate(meta["fields"])}
    namen = [SCHREIBWEISE.get(n, n) for n in felder[spalte["name"]]]
    symbole = felder[spalte["symbol"]]

    haeufigkeit = Counter(namen)
    reihenfolge = sorted(haeufigkeit, key=lambda n: -haeufigkeit[n])
    klasse = {name: i + 1 for i, name in enumerate(reihenfolge)}
    legende = []
    for name in reihenfolge:
        symbol = Counter(s for n, s in zip(namen, symbole) if n == name).most_common(1)[0][0]
        legende.append({"klasse": klasse[name], "name": name, "symbol": symbol, "farbe": FARBEN[(klasse[name] - 1) % len(FARBEN)], "polygone": haeufigkeit[name]})

    formen = shapely.from_wkb(geometrien)
    flaechen = shapely.area(formen)
    west, sued, ost, nord = info["total_bounds"]
    breite = int(np.ceil((ost - west) / args.zelle))
    hoehe = int(np.ceil((nord - sued) / args.zelle))
    transform = from_origin(west, nord, args.zelle, args.zelle)
    reihe = np.argsort(-flaechen)
    paare = [(shapely.geometry.mapping(formen[i]), klasse[namen[i]]) for i in reihe]
    raster = rasterize(paare, out_shape=(hoehe, breite), transform=transform, fill=0, dtype="uint8")

    args.raster.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.raster, "w", driver="GTiff", height=hoehe, width=breite, count=1, dtype="uint8", crs=crs, transform=transform, nodata=0, compress="deflate") as ziel:
        ziel.write(raster, 1)
    args.legende.write_text(json.dumps(legende, indent=2, ensure_ascii=False), encoding="utf-8")
    belegt = float((raster > 0).mean())
    print(f"Geologieraster {breite} x {hoehe}, {args.zelle:.0f} m, {belegt:.0%} belegt, {len(legende)} Einheiten")


if __name__ == "__main__":
    main()
