import heapq
import math

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

from app.nasa_werte import GEHTEMPO_METER_PRO_SEKUNDE, MAX_STEIGUNG_GRAD, pandolf_watt, pandolf_watt_array

MAX_SLOPE_DEGREES = MAX_STEIGUNG_GRAD
RISK_WEIGHT_MEAN = 0.6
RISK_WEIGHT_PEAK = 0.4

OBJECTIVES = ("energy_min", "distance_min", "slope_hazard_min")
HAZARD_BASE_WEIGHT = 0.05

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


def passable_mask(slope: np.ndarray) -> np.ndarray:
    return np.isfinite(slope) & (slope <= MAX_SLOPE_DEGREES)


def step_energy_joule(flat_meters: float, rise_meters: float) -> float:
    length = math.hypot(flat_meters, rise_meters)
    grade_percent = rise_meters / flat_meters * 100.0
    return pandolf_watt(grade_percent) * length / GEHTEMPO_METER_PRO_SEKUNDE


def _blocked_message() -> str:
    return f"Start oder Ziel liegt auf zu steilem Gelände (über {MAX_SLOPE_DEGREES:.0f} Grad). Bitte einen flacheren Punkt wählen."


def _no_way_message() -> str:
    return f"Kein passierbarer Weg zwischen Start und Ziel gefunden. Hänge über {MAX_SLOPE_DEGREES:.0f} Grad sind gesperrt."


def find_path_astar(
    elevation: np.ndarray,
    cell_meters: float,
    start: tuple[int, int],
    end: tuple[int, int],
    penalty: np.ndarray | None = None,
    passable: np.ndarray | None = None,
) -> tuple[list[tuple[int, int]], np.ndarray]:
    rows, cols = elevation.shape
    slope = slope_degrees(elevation, cell_meters)
    if passable is None:
        passable = passable_mask(slope)
    for row, col in (start, end):
        if not (0 <= row < rows and 0 <= col < cols) or not passable[row, col]:
            raise NoRouteError(_blocked_message())

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
            if d_row and d_col and not (passable[n_row, col] and passable[row, n_col]):
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
        raise NoRouteError(_no_way_message())

    path = [end]
    while path[-1] != start:
        row, col = parent[path[-1]]
        path.append((int(row), int(col)))
    path.reverse()
    return path, slope


class _Graph:
    def __init__(self, elevation: np.ndarray, cell_meters: float, passable: np.ndarray | None = None) -> None:
        self.elevation = elevation
        self.cell_meters = cell_meters
        self.rows, self.cols = elevation.shape
        self.slope = slope_degrees(elevation, cell_meters)
        self.passable = passable_mask(self.slope) if passable is None else passable
        index = np.arange(self.rows * self.cols).reshape(self.rows, self.cols)
        quellen, ziele, energie_liste, laenge_liste, hazard_liste = [], [], [], [], []
        with np.errstate(invalid="ignore"):
            for d_row, d_col, length in NEIGHBORS:
                row_q = slice(max(0, -d_row), self.rows - max(0, d_row))
                row_z = slice(max(0, d_row), self.rows - max(0, -d_row))
                col_q = slice(max(0, -d_col), self.cols - max(0, d_col))
                col_z = slice(max(0, d_col), self.cols - max(0, -d_col))
                frei = self.passable[row_q, col_q] & self.passable[row_z, col_z]
                if d_row and d_col:
                    frei &= self.passable[row_z, col_q] & self.passable[row_q, col_z]
                flat = length * cell_meters
                rise = elevation[row_z, col_z] - elevation[row_q, col_q]
                laenge = np.hypot(flat, rise)
                energie = pandolf_watt_array(rise / flat * 100.0) * laenge / GEHTEMPO_METER_PRO_SEKUNDE
                mittlere_steigung = 0.5 * (self.slope[row_q, col_q] + self.slope[row_z, col_z])
                hazard = laenge * (HAZARD_BASE_WEIGHT + (mittlere_steigung / MAX_SLOPE_DEGREES) ** 2)
                quellen.append(index[row_q, col_q][frei])
                ziele.append(index[row_z, col_z][frei])
                energie_liste.append(energie[frei])
                laenge_liste.append(laenge[frei])
                hazard_liste.append(hazard[frei])
        self.quellen = np.concatenate(quellen)
        self.ziele = np.concatenate(ziele)
        self.kosten_je_ziel = {
            "energy_min": np.concatenate(energie_liste),
            "distance_min": np.concatenate(laenge_liste),
            "slope_hazard_min": np.concatenate(hazard_liste),
        }

    def kuerzester_weg(
        self,
        start: tuple[int, int],
        end: tuple[int, int],
        penalty: np.ndarray | None = None,
        objective: str = "energy_min",
    ) -> tuple[list[tuple[int, int]], np.ndarray]:
        for row, col in (start, end):
            if not (0 <= row < self.rows and 0 <= col < self.cols) or not self.passable[row, col]:
                raise NoRouteError(_blocked_message())
        kosten = self.kosten_je_ziel[objective]
        if penalty is not None:
            flach = penalty.ravel()
            kosten = kosten * (1.0 + 0.5 * (flach[self.quellen] + flach[self.ziele]))
        knoten = self.rows * self.cols
        matrix = csr_matrix((kosten, (self.quellen, self.ziele)), shape=(knoten, knoten))
        start_index = start[0] * self.cols + start[1]
        end_index = end[0] * self.cols + end[1]
        distanz, vorgaenger = dijkstra(matrix, directed=True, indices=start_index, return_predecessors=True)
        if not np.isfinite(distanz[end_index]):
            raise NoRouteError(_no_way_message())
        weg = [end_index]
        while weg[-1] != start_index:
            weg.append(int(vorgaenger[weg[-1]]))
        weg.reverse()
        return [(n // self.cols, n % self.cols) for n in weg], self.slope

    def weg_ueber_punkte(
        self,
        punkte: list[tuple[int, int]],
        objective: str,
    ) -> tuple[list[tuple[int, int]], list[list[tuple[int, int]]]]:
        teilwege = [self.kuerzester_weg(a, b, objective=objective)[0] for a, b in zip(punkte, punkte[1:])]
        gesamt = list(teilwege[0])
        for teil in teilwege[1:]:
            gesamt.extend(teil[1:])
        return gesamt, teilwege


def find_path(
    elevation: np.ndarray,
    cell_meters: float,
    start: tuple[int, int],
    end: tuple[int, int],
    penalty: np.ndarray | None = None,
    passable: np.ndarray | None = None,
    objective: str = "energy_min",
) -> tuple[list[tuple[int, int]], np.ndarray]:
    return _Graph(elevation, cell_meters, passable).kuerzester_weg(start, end, penalty, objective)


def path_statistics(
    path: list[tuple[int, int]],
    slope: np.ndarray,
) -> tuple[float, float]:
    zellen = np.array([slope[r, c] for r, c in path], dtype=float)
    laengen = []
    mittel = []
    for (r1, c1), (r2, c2) in zip(path, path[1:]):
        laengen.append(math.hypot(r2 - r1, c2 - c1))
        mittel.append(0.5 * (slope[r1, c1] + slope[r2, c2]))
    gesamt = sum(laengen)
    mittlere_steigung = float(np.dot(laengen, mittel) / gesamt) if gesamt > 0 else float(zellen[0])
    return mittlere_steigung, float(zellen.max())


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
    mean_slope, max_slope = path_statistics(path, slope)
    fraction_mean = mean_slope / MAX_SLOPE_DEGREES
    fraction_peak = max_slope / MAX_SLOPE_DEGREES
    risk = float(np.clip(RISK_WEIGHT_MEAN * fraction_mean + RISK_WEIGHT_PEAK * fraction_peak, 0.0, 1.0))
    return distance, duration, risk, energy


def hazard_exposure(
    path: list[tuple[int, int]],
    elevation: np.ndarray,
    slope: np.ndarray,
    cell_meters: float,
) -> float:
    gesamt = 0.0
    for (r1, c1), (r2, c2) in zip(path, path[1:]):
        flat = math.hypot(r2 - r1, c2 - c1) * cell_meters
        laenge = math.hypot(flat, float(elevation[r2, c2] - elevation[r1, c1]))
        steigung = 0.5 * (slope[r1, c1] + slope[r2, c2])
        gesamt += laenge * (HAZARD_BASE_WEIGHT + (steigung / MAX_SLOPE_DEGREES) ** 2)
    return gesamt


def objective_value(
    objective: str,
    path: list[tuple[int, int]],
    elevation: np.ndarray,
    slope: np.ndarray,
    cell_meters: float,
) -> tuple[float, str]:
    distance, _, _, energy = measure_path(path, elevation, slope, cell_meters)
    if objective == "energy_min":
        return energy, "J"
    if objective == "distance_min":
        return distance, "m"
    return hazard_exposure(path, elevation, slope, cell_meters), "m"


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
    graph = _Graph(elevation, cell_meters)
    best_path, slope = graph.kuerzester_weg(start, end)
    results = [(best_path, slope)]
    best_energy = measure_path(best_path, elevation, slope, cell_meters)[3]
    radius = max(1, int(ALTERNATIVE_CORRIDOR_METERS / cell_meters))
    penalty = np.zeros(elevation.shape)
    penalty[corridor(elevation.shape, best_path, radius)] = ALTERNATIVE_PENALTY
    for _ in range(count + 2):
        if len(results) >= count:
            break
        try:
            path, path_slope = graph.kuerzester_weg(start, end, penalty)
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
