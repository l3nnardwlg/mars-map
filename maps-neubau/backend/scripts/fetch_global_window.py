import argparse
import json
from pathlib import Path

import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

MARS_GEOGRAPHIC = CRS.from_string("+proj=longlat +R=3396190 +no_defs")
QUELLEN = {
    "viking": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif",
    "mola_hrsc": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("quelle", choices=sorted(QUELLEN))
    parser.add_argument("wurzel", type=Path)
    parser.add_argument("ausgabe", type=Path)
    parser.add_argument("--rand-grad", type=float, default=0.2)
    args = parser.parse_args()
    wurzel = json.loads(args.wurzel.read_text(encoding="utf-8"))["wurzelKachel"]
    west = wurzel["west"] - args.rand_grad
    nord = wurzel["north"] + args.rand_grad
    ost = wurzel["west"] + wurzel["groesseGrad"] / 0.9492 + args.rand_grad
    sued = wurzel["north"] - wurzel["groesseGrad"] - args.rand_grad
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        with rasterio.open("/vsicurl/" + QUELLEN[args.quelle]) as src:
            print("Quelle", src.width, src.height, src.count, src.dtypes[0], src.res, src.crs.to_string()[:120])
            grenzen = transform_bounds(MARS_GEOGRAPHIC, src.crs, west, sued, ost, nord, densify_pts=21)
            fenster = from_bounds(*grenzen, transform=src.transform).round_offsets().round_lengths()
            daten = src.read(window=fenster)
            profil = src.profile.copy()
            profil.update(driver="GTiff", width=int(fenster.width), height=int(fenster.height), transform=src.window_transform(fenster), compress="deflate", tiled=True, blockxsize=256, blockysize=256)
            profil.pop("photometric", None)
    args.ausgabe.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.ausgabe, "w", **profil) as ziel:
        ziel.write(daten)
    print("geschrieben", args.ausgabe, daten.shape, "min", daten.min(), "max", daten.max())


if __name__ == "__main__":
    main()
