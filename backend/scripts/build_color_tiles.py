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
RAND = 1
METERS_PER_DEGREE = MARS_RADIUS_METERS * math.pi / 180.0
HOEHEN_RAMPE = [
    (0.0, (30, 27, 75)), (0.2, (2, 132, 199)), (0.4, (16, 185, 129)),
    (0.65, (245, 158, 11)), (0.85, (239, 68, 68)), (1.0, (255, 255, 255)),
]
WAERME_RAMPE = [
    (0.0, (13, 8, 135)), (0.25, (126, 3, 168)), (0.5, (204, 71, 120)),
    (0.75, (248, 149, 64)), (1.0, (240, 249, 33)),
]


def rampe(anteil, stufen):
    anteil = np.clip(anteil, 0.0, 1.0)
    stellen = [s[0] for s in stufen]
    return [np.interp(anteil, stellen, [s[1][kanal] for s in stufen]) for kanal in range(3)]


def lesen(src, west, north, grad, nearest, nodata):
    pixel_grad = grad / TILE_SIZE
    groesse = TILE_SIZE + 2 * RAND
    ziel = np.full((groesse, groesse), np.nan, dtype=np.float32)
    reproject(
        source=rasterio.band(src, 1),
        destination=ziel,
        dst_transform=Affine(pixel_grad, 0, west - RAND * pixel_grad, 0, -pixel_grad, north + RAND * pixel_grad),
        dst_crs=MARS_GEOGRAPHIC,
        src_nodata=nodata,
        dst_nodata=np.nan,
        resampling=Resampling.nearest if nearest else Resampling.bilinear,
    )
    return ziel


def kachel_relief(src, west, north, grad, bereich):
    daten = lesen(src, west, north, grad, False, src.nodata)
    kern = daten[RAND:-RAND, RAND:-RAND]
    gueltig = np.isfinite(kern)
    if not gueltig.any():
        return None
    breite = north - grad / 2
    dy = grad / TILE_SIZE * METERS_PER_DEGREE
    dx = dy * math.cos(math.radians(breite))
    gefuellt = np.where(np.isfinite(daten), daten, np.nanmean(daten))
    nach_sued, nach_ost = np.gradient(gefuellt, dy, dx)
    licht = (-nach_ost * -0.6 + nach_sued * -0.6 + 0.55) / np.sqrt(nach_ost**2 + nach_sued**2 + 1.0) / math.sqrt(0.6**2 + 0.6**2 + 0.55**2)
    licht = np.clip(0.35 + 0.95 * licht[RAND:-RAND, RAND:-RAND], 0.15, 1.25)
    farben = rampe((kern - bereich[0]) / (bereich[1] - bereich[0]), HOEHEN_RAMPE)
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    for kanal in range(3):
        ausgabe[kanal][gueltig] = np.clip(farben[kanal] * licht, 0, 255)[gueltig]
    ausgabe[3][gueltig] = 255
    return ausgabe


def kachel_wert(src, west, north, grad, bereich):
    kern = lesen(src, west, north, grad, False, src.nodata)[RAND:-RAND, RAND:-RAND]
    gueltig = np.isfinite(kern) & (kern > 0)
    if not gueltig.any():
        return None
    farben = rampe((kern - bereich[0]) / (bereich[1] - bereich[0]), WAERME_RAMPE)
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    for kanal in range(3):
        ausgabe[kanal][gueltig] = farben[kanal][gueltig]
    ausgabe[3][gueltig] = 215
    return ausgabe


def lesen_band(src, band, west, north, grad, rand):
    pixel_grad = grad / TILE_SIZE
    groesse = TILE_SIZE + 2 * rand
    ziel = np.zeros((groesse, groesse), dtype=np.float32)
    reproject(
        source=rasterio.band(src, band),
        destination=ziel,
        dst_transform=Affine(pixel_grad, 0, west - rand * pixel_grad, 0, -pixel_grad, north + rand * pixel_grad),
        dst_crs=MARS_GEOGRAPHIC,
        src_nodata=0,
        dst_nodata=0,
        resampling=Resampling.bilinear,
    )
    return ziel


def kachel_rgb(src, west, north, grad):
    baender = [lesen_band(src, b, west, north, grad, 0) for b in (1, 2, 3)]
    gueltig = (baender[0] + baender[1] + baender[2]) > 0
    if not gueltig.any():
        return None
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    for kanal in range(3):
        ausgabe[kanal] = np.clip(baender[kanal], 0, 255)
    ausgabe[3][gueltig] = 255
    return ausgabe


def kachel_scharf(src, farbe, west, north, grad):
    from scipy.ndimage import uniform_filter

    rand = 96
    grau = lesen_band(src, 1, west, north, grad, rand)
    gueltig = grau > 0
    if not gueltig[rand:-rand, rand:-rand].any():
        return None
    meter_pro_pixel = grad / TILE_SIZE * METERS_PER_DEGREE
    sigma = min(rand / 2.5, 260.0 / meter_pro_pixel)
    if sigma >= 0.6:
        breite = max(3, int(sigma * 1.7) | 1)
        glatt = lambda feld: uniform_filter(uniform_filter(feld, breite, mode="nearest"), breite, mode="nearest")
        gewicht = glatt(gueltig.astype(np.float32))
        mittel = glatt(np.where(gueltig, grau, 0.0).astype(np.float32)) / np.maximum(gewicht, 1e-3)
        detail = np.clip(grau / np.maximum(mittel, 1.0), 0.45, 1.9)
    else:
        detail = np.ones_like(grau)
    kern = slice(rand, -rand)
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    for kanal in range(3):
        ton = lesen_band(farbe, kanal + 1, west, north, grad, 0)
        ausgabe[kanal] = np.clip(ton * detail[kern, kern], 0, 255)
    ausgabe[3][gueltig[kern, kern]] = 255
    return ausgabe


def kachel_klasse(src, west, north, grad, legende):
    kern = lesen(src, west, north, grad, True, 0)[RAND:-RAND, RAND:-RAND]
    gueltig = np.isfinite(kern) & (kern > 0)
    if not gueltig.any():
        return None
    ausgabe = np.zeros((4, TILE_SIZE, TILE_SIZE), dtype=np.uint8)
    for eintrag in legende:
        maske = gueltig & (kern == eintrag["klasse"])
        if not maske.any():
            continue
        farbe = eintrag["farbe"].lstrip("#")
        for kanal in range(3):
            ausgabe[kanal][maske] = int(farbe[kanal * 2 : kanal * 2 + 2], 16)
        ausgabe[3][maske] = 185
    return ausgabe if ausgabe[3].any() else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("quelle", type=Path)
    parser.add_argument("ziel", type=Path)
    parser.add_argument("--art", choices=["relief", "wert", "klasse", "rgb", "scharf"], required=True)
    parser.add_argument("--wurzel", type=Path, required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--einheit", default="")
    parser.add_argument("--legende", type=Path, default=None)
    parser.add_argument("--max-zoom", type=int, default=None)
    parser.add_argument("--min-zoom", type=int, default=0)
    parser.add_argument("--bereich", type=float, nargs=2, default=None)
    parser.add_argument("--farbe", type=Path, default=None)
    parser.add_argument("--teil", type=int, nargs=2, default=None)
    parser.add_argument("--uebersicht", type=int, default=None)
    args = parser.parse_args()

    wurzel = json.loads(args.wurzel.read_text(encoding="utf-8"))["wurzelKachel"]
    legende = json.loads(args.legende.read_text(encoding="utf-8")) if args.legende else None
    oeffnen = {} if args.uebersicht is None else {"overview_level": args.uebersicht}
    with rasterio.open(args.quelle, **oeffnen) as src:
        west, south, east, north = transform_bounds(src.crs, MARS_GEOGRAPHIC, *src.bounds, densify_pts=21)
        natuerlich = math.ceil(math.log2(wurzel["groesseGrad"] / TILE_SIZE * METERS_PER_DEGREE / float(min(src.res))))
        if args.uebersicht is not None and args.max_zoom is not None:
            natuerlich = max(natuerlich, args.max_zoom)
        max_zoom = natuerlich if args.max_zoom is None else min(args.max_zoom, natuerlich)
        bereich = None
        farbe = rasterio.open(args.farbe) if args.farbe else None
        if args.bereich:
            bereich = tuple(args.bereich)
        elif args.art in ("relief", "wert"):
            faktor = max(1, max(src.width, src.height) // 2000)
            probe = src.read(1, out_shape=(src.height // faktor, src.width // faktor), masked=True).compressed()
            probe = probe[np.isfinite(probe) & (probe > -1e30)]
            if args.art == "wert":
                probe = probe[probe > 0]
            bereich = (float(np.percentile(probe, 1)), float(np.percentile(probe, 99)))
        anzahl = 0
        for zoom in range(args.min_zoom, max_zoom + 1):
            grad = wurzel["groesseGrad"] / 2**zoom
            x0 = max(0, int((west - wurzel["west"]) / grad))
            x1 = min(2**zoom - 1, int((east - wurzel["west"]) / grad))
            y0 = max(0, int((wurzel["north"] - north) / grad))
            y1 = min(2**zoom - 1, int((wurzel["north"] - south) / grad))
            for x in range(x0, x1 + 1):
                if args.teil and x % args.teil[1] != args.teil[0]:
                    continue
                for y in range(y0, y1 + 1):
                    kachel_west, kachel_nord = wurzel["west"] + x * grad, wurzel["north"] - y * grad
                    if args.art == "relief":
                        daten = kachel_relief(src, kachel_west, kachel_nord, grad, bereich)
                    elif args.art == "wert":
                        daten = kachel_wert(src, kachel_west, kachel_nord, grad, bereich)
                    elif args.art == "rgb":
                        daten = kachel_rgb(src, kachel_west, kachel_nord, grad)
                    elif args.art == "scharf":
                        daten = kachel_scharf(src, farbe, kachel_west, kachel_nord, grad)
                    else:
                        daten = kachel_klasse(src, kachel_west, kachel_nord, grad, legende)
                    if daten is None:
                        continue
                    pfad = args.ziel / str(zoom) / str(x) / f"{y}.png"
                    pfad.parent.mkdir(parents=True, exist_ok=True)
                    with rasterio.open(pfad, "w", driver="PNG", width=TILE_SIZE, height=TILE_SIZE, count=4, dtype="uint8") as ziel:
                        ziel.write(daten)
                    anzahl += 1
        if args.teil and args.teil[0] != 0:
            print(args.name, "Teil", args.teil, "Kacheln", anzahl)
            return
        metadaten = {
            "name": args.name,
            "quelle": args.quelle.name,
            "bounds": {"west": west, "south": south, "east": east, "north": north},
            "wurzelKachel": wurzel,
            "kachelGroesse": TILE_SIZE,
            "minZoom": 0,
            "maxZoom": max_zoom,
            "meterProPixelFeinsteStufe": wurzel["groesseGrad"] / 2**max_zoom / TILE_SIZE * METERS_PER_DEGREE,
            "art": "farbe",
            "einheit": args.einheit,
            "kodierung": "RGBA PNG, fertig eingefaerbt",
            "kacheln": anzahl,
        }
        if bereich:
            metadaten["wertMin"], metadaten["wertMax"] = bereich
        if legende:
            metadaten["legende"] = legende
        (args.ziel / "metadata.json").write_text(json.dumps(metadaten, indent=2), encoding="utf-8")
        print(args.name, "Kacheln", anzahl, "Bereich", bereich)


if __name__ == "__main__":
    main()
