import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import transform
from rasterio.windows import Window

from app.routing import find_alternatives, measure_path

MARS_GEOGRAPHIC = CRS.from_string("+proj=longlat +R=3396190 +no_defs")
DEM_STANDARD = Path(__file__).resolve().parent.parent / "data" / "raw" / "M20_JezeroCrater_CTXDEM_20m.tif"
MAX_CELLS = 400_000
MAX_WAYPOINTS = 200
PADDING_METERS = 2000.0


class OutsideTerrainError(Exception):
    pass


class DemUnavailableError(Exception):
    pass


def dem_pfad() -> Path:
    return Path(os.environ.get("MARS_DEM_PATH", DEM_STANDARD))


def pixel_of(src, latitude: float, longitude: float) -> tuple[int, int]:
    xs, ys = transform(MARS_GEOGRAPHIC, src.crs, [longitude], [latitude])
    row, col = src.index(xs[0], ys[0])
    if not (0 <= row < src.height and 0 <= col < src.width):
        raise OutsideTerrainError("Punkt liegt ausserhalb des Gelaendemodells")
    return row, col


def plan_routes(start: tuple[float, float], end: tuple[float, float], count: int) -> list[dict]:
    pfad = dem_pfad()
    if not pfad.is_file():
        raise DemUnavailableError("Gelaendemodell ist nicht vorhanden")
    return _plan_routes_cached(round(start[0], 6), round(start[1], 6), round(end[0], 6), round(end[1], 6), count, str(pfad), pfad.stat().st_mtime_ns)


@lru_cache(maxsize=64)
def _plan_routes_cached(start_lat: float, start_lon: float, end_lat: float, end_lon: float, count: int, pfad_text: str, aenderung: int) -> list[dict]:
    start, end, pfad = (start_lat, start_lon), (end_lat, end_lon), Path(pfad_text)
    with rasterio.open(pfad) as src:
        (r1, c1), (r2, c2) = pixel_of(src, *start), pixel_of(src, *end)
        pad = int(PADDING_METERS / src.res[0])
        top, bottom = max(0, min(r1, r2) - pad), min(src.height, max(r1, r2) + pad + 1)
        left, right = max(0, min(c1, c2) - pad), min(src.width, max(c1, c2) + pad + 1)
        height, width = bottom - top, right - left
        factor = max(1, math.ceil(math.sqrt(height * width / MAX_CELLS)))
        out_h, out_w = max(2, height // factor), max(2, width // factor)
        window = Window(left, top, width, height)
        data = src.read(1, window=window, out_shape=(out_h, out_w), resampling=Resampling.average, masked=True)
        elevation = data.astype(np.float64).filled(np.nan)
        win_transform = src.window_transform(window) @ rasterio.Affine.scale(width / out_w, height / out_h)
        cell_meters = float(src.res[0]) * width / out_w

        def to_cell(row: int, col: int) -> tuple[int, int]:
            return (
                min(out_h - 1, int((row - top) * out_h / height)),
                min(out_w - 1, int((col - left) * out_w / width)),
            )

        routes = []
        for path, slope in find_alternatives(elevation, cell_meters, to_cell(r1, c1), to_cell(r2, c2), count):
            distance, duration, risk, energy = measure_path(path, elevation, slope, cell_meters)
            step = max(1, math.ceil(len(path) / MAX_WAYPOINTS))
            chosen = path[::step]
            if chosen[-1] != path[-1]:
                chosen.append(path[-1])
            xs = [win_transform.a * (c + 0.5) + win_transform.b * (r + 0.5) + win_transform.c for r, c in chosen]
            ys = [win_transform.d * (c + 0.5) + win_transform.e * (r + 0.5) + win_transform.f for r, c in chosen]
            lons, lats = transform(src.crs, MARS_GEOGRAPHIC, xs, ys)
            waypoints = [
                {"latitude": lat, "longitude": lon, "elevation_meters": float(elevation[r, c])}
                for lat, lon, (r, c) in zip(lats, lons, chosen)
            ]
            routes.append(
                {
                    "waypoints": waypoints,
                    "distance_meters": distance,
                    "estimated_duration_seconds": duration,
                    "risk_score": risk,
                    "energy_joules": energy,
                    "average_power_watts": energy / duration if duration > 0 else 0.0,
                }
            )
    return routes


def plan_route(start: tuple[float, float], end: tuple[float, float]) -> dict:
    return plan_routes(start, end, 1)[0]


BENCHMARK_START = (18.38, 77.58)
BENCHMARK_END = (18.44, 77.45)


def vorwaermen() -> None:
    for anzahl in (1, 3):
        try:
            plan_routes(BENCHMARK_START, BENCHMARK_END, anzahl)
        except (DemUnavailableError, OutsideTerrainError):
            return
