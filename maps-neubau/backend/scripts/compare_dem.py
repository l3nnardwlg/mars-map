import argparse

import numpy as np
import rasterio
from rasterio.warp import transform


def raster_grad(src, xs, ys):
    gx, gy = transform(src.crs, src.crs.geodetic_crs, xs, ys)
    return np.array(gx), np.array(gy)


def werte(src, lons, lats):
    xs, ys = transform(src.crs.geodetic_crs, src.crs, list(lons), list(lats))
    punkte = list(zip(xs, ys))
    ergebnis = np.array([v[0] for v in src.sample(punkte)], dtype=np.float64)
    innen = (np.array(xs) >= src.bounds.left) & (np.array(xs) <= src.bounds.right) & (np.array(ys) >= src.bounds.bottom) & (np.array(ys) <= src.bounds.top)
    ungueltig = ~innen | ~np.isfinite(ergebnis) | (ergebnis < -1e30) | (ergebnis == src.nodata)
    ergebnis[ungueltig] = np.nan
    return ergebnis


def vergleich(name, referenz, pruefling):
    gueltig = np.isfinite(referenz) & np.isfinite(pruefling)
    if gueltig.sum() == 0:
        print(name, "keine Ueberlappung")
        return
    d = pruefling[gueltig] - referenz[gueltig]
    print(f"{name}: {gueltig.sum()} Punkte, Mittel {d.mean():+.2f} m, Std {d.std():.2f} m, RMSE {np.sqrt((d**2).mean()):.2f} m, "
          f"Median {np.median(d):+.2f} m, 95%-Betrag {np.percentile(np.abs(d), 95):.2f} m")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("referenz")
    parser.add_argument("--vergleich", nargs="+", required=True)
    parser.add_argument("--abstand", type=float, default=40.0)
    args = parser.parse_args()
    with rasterio.open(args.referenz) as ref:
        schritt = max(1, int(round(args.abstand / ref.res[0])))
        spalten = np.arange(0, ref.width, schritt)
        zeilen = np.arange(0, ref.height, schritt)
        gitter_s, gitter_z = np.meshgrid(spalten, zeilen)
        xs, ys = rasterio.transform.xy(ref.transform, gitter_z.ravel(), gitter_s.ravel())
        referenz = np.array([v[0] for v in ref.sample(list(zip(xs, ys)))], dtype=np.float64)
        referenz[(referenz < -1e30) | ~np.isfinite(referenz)] = np.nan
        lons, lats = raster_grad(ref, xs, ys)
        print(f"Referenz {args.referenz.split('/')[-1]}: {np.isfinite(referenz).sum()} gueltige Punkte, Hoehe {np.nanmin(referenz):.0f} bis {np.nanmax(referenz):.0f} m")
        for pfad in args.vergleich:
            with rasterio.open(pfad) as src:
                vergleich(pfad.split("/")[-1], referenz, werte(src, lons, lats))


if __name__ == "__main__":
    main()
