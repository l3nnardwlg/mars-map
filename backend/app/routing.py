import heapq
import math

import numpy as np

MAX_SLOPE_DEGREES = 25.0
FLAT_SPEED_METERS_PER_SECOND = 1.0
MIN_SPEED_FACTOR = 0.25
SLOPE_COST_WEIGHT = 4.0

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


def speed_factor(slope: float) -> float:
    return max(MIN_SPEED_FACTOR, 1.0 - 0.75 * slope / MAX_SLOPE_DEGREES)


def find_path(
    elevation: np.ndarray,
    cell_meters: float,
    start: tuple[int, int],
    end: tuple[int, int],
) -> tuple[list[tuple[int, int]], np.ndarray]:
    rows, cols = elevation.shape
    slope = slope_degrees(elevation, cell_meters)
    passable = np.isfinite(slope) & (slope <= MAX_SLOPE_DEGREES)
    for row, col in (start, end):
        if not (0 <= row < rows and 0 <= col < cols) or not passable[row, col]:
            raise NoRouteError("Start oder Ziel liegt auf unpassierbarem Gelaende")

    cost_factor = 1.0 + SLOPE_COST_WEIGHT * (np.nan_to_num(slope) / MAX_SLOPE_DEGREES) ** 2
    best = np.full((rows, cols), np.inf)
    parent = np.full((rows, cols, 2), -1, dtype=np.int32)
    best[start] = 0.0
    end_row, end_col = end

    def heuristic(row: int, col: int) -> float:
        return math.hypot(row - end_row, col - end_col) * cell_meters

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
            step = length * cell_meters * 0.5 * (cost_factor[row, col] + cost_factor[n_row, n_col])
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
) -> tuple[float, float, float]:
    distance = 0.0
    duration = 0.0
    for (r1, c1), (r2, c2) in zip(path, path[1:]):
        flat = math.hypot(r2 - r1, c2 - c1) * cell_meters
        rise = float(elevation[r2, c2] - elevation[r1, c1])
        length = math.hypot(flat, rise)
        mean_slope = float(0.5 * (slope[r1, c1] + slope[r2, c2]))
        distance += length
        duration += length / (FLAT_SPEED_METERS_PER_SECOND * speed_factor(mean_slope))
    fractions = np.array([slope[r, c] for r, c in path]) / MAX_SLOPE_DEGREES
    risk = float(np.clip(0.6 * fractions.mean() + 0.4 * fractions.max(), 0.0, 1.0))
    return distance, duration, risk
