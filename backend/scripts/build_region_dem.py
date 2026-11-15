import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import Affine, from_origin
from rasterio.warp import Resampling, reproject, transform_bounds

QUELL_VERSCHIEBUNG_OST_M = 20.0
QUELL_VERSCHIEBUNG_NORD_M = -480.0
HOEHENABGLEICH_M = -10.1
NODATA = -3.4028234663852886e+38


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("jezero")
    parser.add_argument("syrtis")
    parser.add_argument("ausgabe_ordner")
    args = parser.parse_args()
    ausgabe = Path(args.ausgabe_ordner)
    ausgabe.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.jezero) as jez, rasterio.open(args.syrtis) as syr:
        crs = jez.crs
        res = jez.res[0]
        links, unten, rechts, oben = transform_bounds(syr.crs, crs, *syr.bounds, densify_pts=21)
        links = min(links, jez.bounds.left)
        unten = min(unten, jez.bounds.bottom)
        rechts = max(rechts, jez.bounds.right)
        oben = max(oben, jez.bounds.top)
        links = np.floor((links - jez.bounds.left) / res) * res + jez.bounds.left
        oben = jez.bounds.top - np.floor((jez.bounds.top - oben) / res) * res
        breite = int(np.ceil((rechts - links) / res))
        hoehe = int(np.ceil((oben - unten) / res))
        ziel = from_origin(links, oben, res, res)
        print(f"Zielraster {breite} x {hoehe}, {breite * hoehe * 4 / 1e6:.0f} MB")

        syr_transform = syr.transform * Affine.translation(0, 0)
        syr_verschoben = Affine(
            syr_transform.a, syr_transform.b, syr_transform.c + QUELL_VERSCHIEBUNG_OST_M,
            syr_transform.d, syr_transform.e, syr_transform.f + QUELL_VERSCHIEBUNG_NORD_M,
        )
        hoehen = np.full((hoehe, breite), NODATA, dtype=np.float32)
        quelle = np.zeros((hoehe, breite), dtype=np.uint8)

        aus_syrtis = np.full((hoehe, breite), NODATA, dtype=np.float32)
        reproject(
            source=rasterio.band(syr, 1),
            destination=aus_syrtis,
            src_transform=syr_verschoben,
            src_crs=syr.crs,
            src_nodata=syr.nodata,
            dst_transform=ziel,
            dst_crs=crs,
            dst_nodata=NODATA,
            resampling=Resampling.average,
            init_dest_nodata=True,
        )
        gueltig_syrtis = aus_syrtis > -1e30
        hoehen[gueltig_syrtis] = aus_syrtis[gueltig_syrtis] + np.float32(HOEHENABGLEICH_M)
        quelle[gueltig_syrtis] = 2
        del aus_syrtis

        aus_jezero = np.full((hoehe, breite), NODATA, dtype=np.float32)
        reproject(
            source=rasterio.band(jez, 1),
            destination=aus_jezero,
            src_transform=jez.transform,
            src_crs=jez.crs,
            src_nodata=jez.nodata,
            dst_transform=ziel,
            dst_crs=crs,
            dst_nodata=NODATA,
            resampling=Resampling.nearest,
            init_dest_nodata=True,
        )
        gueltig_jezero = aus_jezero > -1e30
        hoehen[gueltig_jezero] = aus_jezero[gueltig_jezero]
        quelle[gueltig_jezero] = 1
        print(f"Jezero-Zellen {int(gueltig_jezero.sum())}, nur Syrtis {int((quelle == 2).sum())}, ohne Wert {int((quelle == 0).sum())}")

        profil = dict(
            driver="GTiff", height=hoehe, width=breite, count=1, crs=crs, transform=ziel,
            tiled=True, blockxsize=256, blockysize=256, compress="deflate", predictor=3,
        )
        with rasterio.open(ausgabe / "region_dem_20m.tif", "w", dtype="float32", nodata=NODATA, **profil) as ziel_datei:
            ziel_datei.write(hoehen, 1)
        profil["predictor"] = 1
        with rasterio.open(ausgabe / "region_quelle_20m.tif", "w", dtype="uint8", nodata=0, **profil) as ziel_datei:
            ziel_datei.write(quelle, 1)

    (ausgabe / "region_herkunft.json").write_text(
        json.dumps(
            {
                "1": "USGS CTX DEM Jezero 20 m (Calef et al. 2021), an HiRISE gebunden, gegen NASA-Rover-Positionen geprueft (RMSE 3,3 m)",
                "2": "Caltech CTX multistrip NE Syrtis (Quinn, CC0), von 9,9 m auf 20 m gemittelt, empirisch um 480 m Nord und 20 m Ost verschoben und um 10,1 m abgesenkt, nicht gegen Rover geprueft",
                "verschiebung": {"ost_m": QUELL_VERSCHIEBUNG_OST_M, "nord_m": QUELL_VERSCHIEBUNG_NORD_M, "hoehe_m": HOEHENABGLEICH_M},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
