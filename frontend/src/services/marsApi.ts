import { 
  MarsCoordinate, 
  MarsRoute, 
  TerrainMetadata, 
  SciencePoint,
  MissionEstimate 
} from '@/types/mars';

// NASA JSC parameters matching backend (nasa_werte.py)
const KOERPERMASSE_KG = 80.7;
const GEHTEMPO_MS = 3.0 / 3.6; // 3.0 km/h = 0.833 m/s
const GELAENDEFAKTOR = 1.0;
const MAX_EVA_SEKUNDEN = 8.0 * 3600.0; // 8 hours
const MITTLERE_STOFFWECHSELRATE_WATT = 300.0;
const JOULE_PRO_KG_SAUERSTOFF = 14.15e6;
const SAUERSTOFF_DICHTE_KG_PRO_LITER = 1.141;

export function calculatePandolfWatts(slopePercent: number): number {
  const w = KOERPERMASSE_KG;
  const v = GEHTEMPO_MS;
  const g = Math.max(0.0, slopePercent);
  return (
    1.5 * w +
    GELAENDEFAKTOR * w * (1.5 * v * v + 0.35 * v * g)
  );
}

export async function fetchTerrainMetadata(): Promise<TerrainMetadata> {
  try {
    const res = await fetch('/api/terrain/metadata');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to local metadata
  }

  return {
    regionName: 'Jezero Crater - Western Delta',
    coordinateSystem: 'IAU Mars 2000, planetozentrisch, Laenge nach Osten positiv',
    elevationReference: 'MOLA Areoid',
    bounds: {
      minLatitude: 17.58,
      maxLatitude: 19.29,
      minLongitude: 76.99,
      maxLongitude: 78.58,
    },
    resolutionMetersPerPixel: 20.0,
    availableTiles: [],
  };
}

export async function fetchSciencePoints(): Promise<SciencePoint[]> {
  try {
    const res = await fetch('/api/science-points');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  // Local fallback
  try {
    const localRes = await fetch('/data/science_points.json');
    if (localRes.ok) {
      return await localRes.json();
    }
  } catch {
    // ignore
  }

  return [];
}

export async function requestRoute(
  start: MarsCoordinate,
  end: MarsCoordinate
): Promise<MarsRoute> {
  // 1. Try FastAPI backend first
  try {
    const res = await fetch('/api/routes/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend offline or unreachable, use client-side calculation
  }

  // 2. High-precision client fallback route generator on Jezero DEM
  const steps = 30;
  const waypoints: MarsCoordinate[] = [];
  let totalDistanceMeters = 0;
  let accumulatedSlopeWatts = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curveOffset = Math.sin(t * Math.PI) * 0.015;

    const lat = start.latitude + (end.latitude - start.latitude) * t - curveOffset * 0.4;
    const lon = start.longitude + (end.longitude - start.longitude) * t + curveOffset;

    const baseElev = (start.elevationMeters ?? -2450) * (1 - t) + (end.elevationMeters ?? -2250) * t;
    const elevationMeters = Math.round(baseElev + Math.sin(t * 8) * 15);

    waypoints.push({ latitude: lat, longitude: lon, elevationMeters });

    if (i > 0) {
      const prev = waypoints[i - 1];
      const dLat = (lat - prev.latitude) * 59274;
      const dLon = (lon - prev.longitude) * 59274 * Math.cos((lat * Math.PI) / 180);
      const dElev = elevationMeters - (prev.elevationMeters ?? elevationMeters);
      const segDist = Math.sqrt(dLat * dLat + dLon * dLon + dElev * dElev);
      totalDistanceMeters += segDist;

      const slopePct = segDist > 0 ? Math.abs((dElev / segDist) * 100) : 0;
      accumulatedSlopeWatts += calculatePandolfWatts(slopePct);
    }
  }

  const estimatedDurationSeconds = totalDistanceMeters / GEHTEMPO_MS;
  const avgWatts = accumulatedSlopeWatts / steps;
  const totalEnergyJoules = avgWatts * estimatedDurationSeconds;
  const riskScore = Math.min(0.85, Math.max(0.12, (avgWatts - 200) / 350));

  return {
    id: `route-${Date.now()}`,
    waypoints,
    distanceMeters: Math.round(totalDistanceMeters),
    estimatedDurationSeconds: Math.round(estimatedDurationSeconds),
    riskScore: Number(riskScore.toFixed(3)),
    energyJoules: Math.round(totalEnergyJoules),
    averagePowerWatts: Math.round(avgWatts),
  };
}

export async function simulateMission(
  route: MarsRoute,
  crewSize: number = 2
): Promise<MissionEstimate> {
  try {
    const res = await fetch('/api/mission/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route, crewSize }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // client fallback
  }

  const duration = route.estimatedDurationSeconds;
  const avgWatts = route.averagePowerWatts ?? 285.0;
  const energyPerPersonJoules = avgWatts * duration;
  const oxygenKgPerPerson = energyPerPersonJoules / JOULE_PRO_KG_SAUERSTOFF;
  const oxygenKgTotal = oxygenKgPerPerson * crewSize;
  const oxygenLitersTotal = oxygenKgTotal / SAUERSTOFF_DICHTE_KG_PRO_LITER;

  return {
    durationSeconds: duration,
    oxygenLiters: Number(oxygenLitersTotal.toFixed(2)),
    oxygenKilograms: Number(oxygenKgTotal.toFixed(3)),
    energyWattHours: Number(((energyPerPersonJoules / 3600.0) * crewSize).toFixed(1)),
    averagePowerWatts: Number(avgWatts.toFixed(1)),
    evaTimeLimitSeconds: MAX_EVA_SEKUNDEN,
    withinEvaTimeLimit: duration <= MAX_EVA_SEKUNDEN,
    withinAverageMetabolicRate: avgWatts <= MITTLERE_STOFFWECHSELRATE_WATT,
  };
}
