import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject, transform_bounds

MARS_RADIUS_METERS = 3396190.0
MARS_GEOGRAPHIC = CRS.from_string(f"+proj=longlat +R={MARS_RADIUS_METERS} +no_defs")
TILE_SIZE = 256
METERS_PER_DEGREE = MARS_RADIUS_METERS * math.pi / 180.0


def hoehenbereich(src):
    faktor = max(1, max(src.width, src.height) // 2000)
    daten = src.read(1, out_shape=(src.height // faktor, src.width // faktor), masked=True)
    return float(daten.min()), float(daten.max())


def bild_kachel_bauen(src, west, north, grad):
    pixel_grad = grad / TILE_SIZE
    ziel = np.zeros((TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    reproject(
        source=rasterio.band(src, 1),
        destination=ziel,
        dst_transform=Affine(pixel_grad, 0, west, 0, -pixel_grad, north),
        dst_crs=MARS_GEOGRAPHIC,
        dst_nodata=0,
        resampling=Resampling.bilinear,
    )
    return ziel if ziel.any() else None


def kachel_bauen(src, west, north, grad, hoehe_min, hoehe_max):
    pixel_grad = grad / TILE_SIZE
    ziel = np.full((TILE_SIZE, TILE_SIZE), np.nan, dtype=np.float32)
    reproject(
        source=rasterio.band(src, 1),
        destination=ziel,
        dst_transform=Affine(pixel_grad, 0, west, 0, -pixel_grad, north),
        dst_crs=MARS_GEOGRAPHIC,
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    gueltig = np.isfinite(ziel)
    if not gueltig.any():
        return None
    skaliert = (ziel - hoehe_min) / (hoehe_max - hoehe_min) * 65534.0 + 1.0
    ausgabe = np.zeros_like(ziel, dtype=np.uint16)
    ausgabe[gueltig] = np.clip(np.rint(skaliert[gueltig]), 1, 65535).astype(np.uint16)
    return ausgabe


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("quelle", type=Path)
    parser.add_argument("ziel", type=Path)
    parser.add_argument("--name", required=True)
    parser.add_argument("--max-zoom", type=int, default=None)
    parser.add_argument("--art", choices=["hoehe", "wert", "bild"], default="hoehe")
    parser.add_argument("--einheit", default="m")
    args = parser.parse_args()

    with rasterio.open(args.quelle) as src:
        west, south, east, north = transform_bounds(src.crs, MARS_GEOGRAPHIC, *src.bounds, densify_pts=21)
        pixel_meter = float(min(src.res))
        bild = args.art == "bild"
        hoehe_min, hoehe_max = (0.0, 255.0) if bild else hoehenbereich(src)

        wurzel_grad = max(east - west, north - south)
        natuerlich = math.ceil(math.log2(wurzel_grad / TILE_SIZE * METERS_PER_DEGREE / pixel_meter))
        max_zoom = natuerlich if args.max_zoom is None else min(args.max_zoom, natuerlich)
        max_zoom = max(max_zoom, 0)

        anzahl = 0
        for zoom in range(max_zoom + 1):
            grad = wurzel_grad / 2**zoom
            for x in range(2**zoom):
                for y in range(2**zoom):
                    kachel_west = west + x * grad
                    kachel_nord = north - y * grad
                    if kachel_west > east or kachel_nord - grad > north or kachel_nord < south:
                        continue
                    if bild:
                        daten = bild_kachel_bauen(src, kachel_west, kachel_nord, grad)
                    else:
                        daten = kachel_bauen(src, kachel_west, kachel_nord, grad, hoehe_min, hoehe_max)
                    if daten is None:
                        continue
                    pfad = args.ziel / str(zoom) / str(x) / f"{y}.png"
                    pfad.parent.mkdir(parents=True, exist_ok=True)
                    with rasterio.open(
                        pfad, "w", driver="PNG", width=TILE_SIZE, height=TILE_SIZE, count=1, dtype="uint8" if bild else "uint16"
                    ) as ziel:
                        ziel.write(daten, 1)
                    anzahl += 1

        metadaten = {
            "name": args.name,
            "quelle": args.quelle.name,
            "koordinatensystem": "Mars sphaerisch, Radius 3396190 m, Laenge nach Osten positiv",
            "bounds": {"west": west, "south": south, "east": east, "north": north},
            "wurzelKachel": {"west": west, "north": north, "groesseGrad": wurzel_grad},
            "kachelGroesse": TILE_SIZE,
            "minZoom": 0,
            "maxZoom": max_zoom,
            "meterProPixelFeinsteStufe": wurzel_grad / 2**max_zoom / TILE_SIZE * METERS_PER_DEGREE,
            "art": args.art,
            "einheit": args.einheit,
            "wertMin": hoehe_min,
            "wertMax": hoehe_max,
            "kacheln": anzahl,
        }
        if bild:
            metadaten["kodierung"] = "uint8 PNG Graustufen, 0 = keine Daten"
        else:
            metadaten["hoeheMin"] = hoehe_min
            metadaten["hoeheMax"] = hoehe_max
            metadaten["kodierung"] = "uint16 PNG, 0 = keine Daten, 1..65535 = wertMin..wertMax linear"
        (args.ziel / "metadata.json").write_text(json.dumps(metadaten, indent=2), encoding="utf-8")
        print(json.dumps(metadaten, indent=2))


if __name__ == "__main__":
    main()
