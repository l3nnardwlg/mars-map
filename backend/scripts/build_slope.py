import argparse
from pathlib import Path

import numpy as np
import rasterio


def main() -> None:
    parser = argparse.ArgumentParser(description="Berechnet aus einem DEM eine Steigungskarte in Grad.")
    parser.add_argument("dem", type=Path)
    parser.add_argument("ausgabe", type=Path)
    args = parser.parse_args()

    with rasterio.open(args.dem) as src:
        hoehe = src.read(1, masked=True).astype(np.float64).filled(np.nan)
        zelle = float(src.res[0])
        d_zeile, d_spalte = np.gradient(hoehe, zelle)
        steigung = np.degrees(np.arctan(np.hypot(d_zeile, d_spalte)))
        steigung = np.where(np.isfinite(steigung), steigung, -9999.0).astype(np.float32)
        profil = src.profile.copy()
        profil.update(dtype="float32", nodata=-9999.0, count=1, compress="deflate")
        args.ausgabe.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(args.ausgabe, "w", **profil) as ziel:
            ziel.write(steigung, 1)
    gueltig = steigung[steigung > -9000]
    print(f"Steigung geschrieben: {args.ausgabe}, Mittel {gueltig.mean():.1f} Grad, Maximum {gueltig.max():.1f} Grad")


if __name__ == "__main__":
    main()
