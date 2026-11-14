import heapq
import math

import numpy as np

from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, MAX_STEIGUNG_GRAD, pandolf_watt

MAX_SLOPE_DEGREES = MAX_STEIGUNG_GRAD

NEIGHBORS = [
    (-1, 0, 1.0),
    (1, 0, 1.0),
    (0, -1, 1.0),
    (0, 1, 1.0),
    (-1, -1, math.sqrt(2)),
    (-1, 1, math.sqrt(2)),
    (1, -1, math.sqrt(2)),
    (1, 1, math.sqrt(2)),
]


class NoRouteError(Exception):
    pass


def slope_degrees(elevation: np.ndarray, cell_meters: float) -> np.ndarray:
    filled = np.where(np.isfinite(elevation), elevation, np.nan)
    d_row, d_col = np.gradient(filled, cell_meters)
    return np.degrees(np.arctan(np.hypot(d_row, d_col)))


def step_energy_joule(flat_meters: float, rise_meters: float) -> float:
    length = math.hypot(flat_meters, rise_meters)
    grade_percent = rise_meters / flat_meters * 100.0
    return pandolf_watt(grade_percent) * length / GEHTEMPO_METER_PRO_SEKUNDE


def find_path(
    elevation: np.ndarray,
    cell_meters: float,
    start: tuple[int, int],
    end: tuple[int, int],
    penalty: np.ndarray | None = None,
) -> tuple[list[tuple[int, int]], np.ndarray]:
    rows, cols = elevation.shape
    slope = slope_degrees(elevation, cell_meters)
    passable = np.isfinite(slope) & (slope <= MAX_SLOPE_DEGREES)
    for row, col in (start, end):
        if not (0 <= row < rows and 0 <= col < cols) or not passable[row, col]:
            raise NoRouteError("Start oder Ziel liegt auf unpassierbarem Gelaende")

    best = np.full((rows, cols), np.inf)
    parent = np.full((rows, cols, 2), -1, dtype=np.int32)
    best[start] = 0.0
    end_row, end_col = end
    flat_joule_per_meter = pandolf_watt(0.0) / GEHTEMPO_METER_PRO_SEKUNDE

    def heuristic(row: int, col: int) -> float:
        return math.hypot(row - end_row, col - end_col) * cell_meters * flat_joule_per_meter

    queue = [(heuristic(*start), 0.0, start)]
    while queue:
        _, cost, (row, col) = heapq.heappop(queue)
        if (row, col) == end:
            break
        if cost > best[row, col]:
            continue
        for d_row, d_col, length in NEIGHBORS:
            n_row, n_col = row + d_row, col + d_col
            if not (0 <= n_row < rows and 0 <= n_col < cols) or not passable[n_row, n_col]:
                continue
            rise = float(elevation[n_row, n_col] - elevation[row, col])
            step = step_energy_joule(length * cell_meters, rise)
            if penalty is not None:
                step *= 1.0 + 0.5 * (penalty[row, col] + penalty[n_row, n_col])
            new_cost = cost + step
            if new_cost < best[n_row, n_col]:
                best[n_row, n_col] = new_cost
                parent[n_row, n_col] = (row, col)
                heapq.heappush(queue, (new_cost + heuristic(n_row, n_col), new_cost, (n_row, n_col)))

    if not np.isfinite(best[end]):
        raise NoRouteError("Kein passierbarer Weg zwischen Start und Ziel gefunden")

    path = [end]
    while path[-1] != start:
        row, col = parent[path[-1]]
        path.append((int(row), int(col)))
    path.reverse()
    return path, slope


def measure_path(
    path: list[tuple[int, int]],
    elevation: np.ndarray,
    slope: np.ndarray,
    cell_meters: float,
) -> tuple[float, float, float, float]:
    distance = 0.0
    energy = 0.0
    for (r1, c1), (r2, c2) in zip(path, path[1:]):
        flat = math.hypot(r2 - r1, c2 - c1) * cell_meters
        rise = float(elevation[r2, c2] - elevation[r1, c1])
        distance += math.hypot(flat, rise)
        energy += step_energy_joule(flat, rise)
    duration = distance / GEHTEMPO_METER_PRO_SEKUNDE
    fractions = np.array([slope[r, c] for r, c in path]) / MAX_SLOPE_DEGREES
    risk = float(np.clip(0.6 * fractions.mean() + 0.4 * fractions.max(), 0.0, 1.0))
    return distance, duration, risk, energy


ALTERNATIVE_PENALTY = 3.0
ALTERNATIVE_CORRIDOR_METERS = 200.0
MAX_ALTERNATIVE_OVERLAP = 0.7
MAX_ALTERNATIVE_ENERGY_FACTOR = 1.6


def corridor(shape: tuple[int, int], path: list[tuple[int, int]], radius: int) -> np.ndarray:
    mask = np.zeros(shape, dtype=bool)
    for row, col in path:
        mask[max(0, row - radius): row + radius + 1, max(0, col - radius): col + radius + 1] = True
    return mask


def find_alternatives(
    elevation: np.ndarray,
    cell_meters: float,
    start: tuple[int, int],
    end: tuple[int, int],
    count: int,
) -> list[tuple[list[tuple[int, int]], np.ndarray]]:
    best_path, slope = find_path(elevation, cell_meters, start, end)
    results = [(best_path, slope)]
    best_energy = measure_path(best_path, elevation, slope, cell_meters)[3]
    radius = max(1, int(ALTERNATIVE_CORRIDOR_METERS / cell_meters))
    penalty = np.zeros(elevation.shape)
    penalty[corridor(elevation.shape, best_path, radius)] = ALTERNATIVE_PENALTY
    for _ in range(count * 3):
        if len(results) >= count:
            break
        try:
            path, path_slope = find_path(elevation, cell_meters, start, end, penalty)
        except NoRouteError:
            break
        penalty[corridor(elevation.shape, path, radius)] = ALTERNATIVE_PENALTY
        energy = measure_path(path, elevation, path_slope, cell_meters)[3]
        if energy > best_energy * MAX_ALTERNATIVE_ENERGY_FACTOR:
            continue
        masks = [corridor(elevation.shape, other, radius) for other, _ in results]
        overlap = max(float(np.mean([mask[r, c] for r, c in path])) for mask in masks)
        if overlap > MAX_ALTERNATIVE_OVERLAP:
            continue
        results.append((path, path_slope))
    return results
