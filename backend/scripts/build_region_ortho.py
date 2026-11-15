import argparse
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import Affine, from_origin
from rasterio.warp import Resampling, reproject

QUELL_VERSCHIEBUNG_OST_M = 20.0
QUELL_VERSCHIEBUNG_NORD_M = -480.0
ZIEL_METER = 10.0


def einlesen(quelle, ziel_array, transform, crs):
    reproject(
        source=rasterio.band(quelle, 1),
        destination=ziel_array,
        src_transform=quelle.transform if transform is None else transform,
        src_crs=quelle.crs,
        src_nodata=0,
        dst_transform=crs[0],
        dst_crs=crs[1],
        dst_nodata=0,
        resampling=Resampling.average,
        init_dest_nodata=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("referenz_dem")
    parser.add_argument("jezero_ortho")
    parser.add_argument("syrtis_ortho")
    parser.add_argument("ausgabe")
    args = parser.parse_args()

    with rasterio.open(args.referenz_dem) as ref:
        crs = ref.crs
        faktor = ZIEL_METER / ref.res[0]
        breite, hoehe = int(ref.width / faktor), int(ref.height / faktor)
        ziel = from_origin(ref.bounds.left, ref.bounds.top, ZIEL_METER, ZIEL_METER)
    print(f"Zielraster {breite} x {hoehe}, {breite * hoehe / 1e6:.0f} MB")

    bild = np.zeros((hoehe, breite), dtype=np.uint8)
    with rasterio.open(args.syrtis_ortho) as syr:
        t = syr.transform
        verschoben = Affine(t.a, t.b, t.c + QUELL_VERSCHIEBUNG_OST_M, t.d, t.e, t.f + QUELL_VERSCHIEBUNG_NORD_M)
        einlesen(syr, bild, verschoben, (ziel, crs))
    aus_syrtis = int((bild > 0).sum())
    jez = np.zeros_like(bild)
    with rasterio.open(args.jezero_ortho) as quelle:
        einlesen(quelle, jez, None, (ziel, crs))
    nutze_jezero = jez > 0
    bild[nutze_jezero] = jez[nutze_jezero]
    print(f"Syrtis-Pixel {aus_syrtis}, Jezero-Pixel {int(nutze_jezero.sum())}, gesamt gueltig {int((bild > 0).sum())}")

    Path(args.ausgabe).parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        args.ausgabe, "w", driver="GTiff", height=hoehe, width=breite, count=1, dtype="uint8",
        crs=crs, transform=ziel, nodata=0, tiled=True, blockxsize=256, blockysize=256, compress="deflate",
    ) as datei:
        datei.write(bild, 1)


if __name__ == "__main__":
    main()
