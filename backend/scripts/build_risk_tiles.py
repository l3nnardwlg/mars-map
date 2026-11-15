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
GRENZE_GRAD = 15.0


def farbkachel(src, west, north, grad):
    pixel_grad = grad / TILE_SIZE
    steigung = np.full((TILE_SIZE, TILE_SIZE), np.nan, dtype=np.float32)
    reproject(
        source=rasterio.band(src, 1),
        destination=steigung,
        dst_transform=Affine(pixel_grad, 0, west, 0, -pixel_grad, north),
        dst_crs=MARS_GEOGRAPHIC,
        src_nodata=-9999.0,
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    gueltig = np.isfinite(steigung)
    if not gueltig.any():
        return None
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    flach = gueltig & (steigung < 8.0)
    mittel = gueltig & (steigung >= 8.0) & (steigung < GRENZE_GRAD)
    steil = gueltig & (steigung >= GRENZE_GRAD)
    for maske, (r, g, b, a) in ((flach, (34, 197, 94, 70)), (mittel, (245, 158, 11, 130)), (steil, (239, 68, 68, 175))):
        ausgabe[0][maske], ausgabe[1][maske], ausgabe[2][maske], ausgabe[3][maske] = r, g, b, a
    return ausgabe


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("steigung", type=Path)
    parser.add_argument("ziel", type=Path)
    args = parser.parse_args()
    with rasterio.open(args.steigung) as src:
        west, south, east, north = transform_bounds(src.crs, MARS_GEOGRAPHIC, *src.bounds, densify_pts=21)
        wurzel_grad = max(east - west, north - south)
        max_zoom = math.ceil(math.log2(wurzel_grad / TILE_SIZE * METERS_PER_DEGREE / float(min(src.res))))
        anzahl = 0
        for zoom in range(max_zoom + 1):
            grad = wurzel_grad / 2**zoom
            for x in range(2**zoom):
                for y in range(2**zoom):
                    kachel_west, kachel_nord = west + x * grad, north - y * grad
                    if kachel_west > east or kachel_nord < south:
                        continue
                    daten = farbkachel(src, kachel_west, kachel_nord, grad)
                    if daten is None:
                        continue
                    pfad = args.ziel / str(zoom) / str(x) / f"{y}.png"
                    pfad.parent.mkdir(parents=True, exist_ok=True)
                    with rasterio.open(pfad, "w", driver="PNG", width=TILE_SIZE, height=TILE_SIZE, count=4, dtype="uint8") as ziel:
                        ziel.write(daten)
                    anzahl += 1
        (args.ziel / "metadata.json").write_text(
            json.dumps(
                {
                    "name": "risk_ctx",
                    "bounds": {"west": west, "south": south, "east": east, "north": north},
                    "wurzelKachel": {"west": west, "north": north, "groesseGrad": wurzel_grad},
                    "kachelGroesse": TILE_SIZE,
                    "minZoom": 0,
                    "maxZoom": max_zoom,
                    "meterProPixelFeinsteStufe": wurzel_grad / 2**max_zoom / TILE_SIZE * METERS_PER_DEGREE,
                    "art": "farbe",
                    "kodierung": "RGBA PNG, gruen unter 8 Grad, bernstein 8 bis 15 Grad, rot ab 15 Grad (gesperrt)",
                    "kacheln": anzahl,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print("Kacheln", anzahl)


if __name__ == "__main__":
    main()
