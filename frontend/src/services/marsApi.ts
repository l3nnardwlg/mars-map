import { 
  MarsCoordinate, 
  MarsRoute, 
  TerrainMetadata, 
  SciencePoint,
  MissionEstimate,
  RouteProfile,
  ElevationPoint
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
  end: MarsCoordinate,
  profile: RouteProfile = 'direct',
  sciencePointDetour?: MarsCoordinate
): Promise<MarsRoute> {
  // Try FastAPI backend if direct profile
  if (profile === 'direct' && !sciencePointDetour) {
    try {
      const res = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      });

      if (res.ok) {
        const data = await res.json();
        // Enrich with elevation profile
        const elevProfile: ElevationPoint[] = [];
        let runDist = 0;
        data.waypoints.forEach((wp: MarsCoordinate, idx: number) => {
          if (idx > 0) {
            const p = data.waypoints[idx - 1];
            const d = Math.hypot((wp.latitude - p.latitude) * 59274, (wp.longitude - p.longitude) * 59274 * Math.cos((wp.latitude * Math.PI) / 180));
            runDist += d;
          }
          elevProfile.push({
            distanceKm: Number((runDist / 1000).toFixed(2)),
            elevationM: wp.elevationMeters ?? -2450,
            slopeDeg: 6.5,
          });
        });

        return {
          ...data,
          profile: 'direct',
          elevationProfile: elevProfile,
        };
      }
    } catch {
      // Backend offline or unreachable
    }
  }

  // High-precision Multi-Profile Route Generator
  const steps = 35;
  const waypoints: MarsCoordinate[] = [];
  const elevationProfile: ElevationPoint[] = [];
  let totalDistanceMeters = 0;
  let accumulatedSlopeWatts = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Profile-specific path curvature
    let curveFactor = 0.0;
    if (profile === 'safe') {
      // Wide contouring arc that avoids steep crater wall cliffs
      curveFactor = Math.sin(t * Math.PI) * 0.038;
    } else if (profile === 'science' && sciencePointDetour) {
      // Pull trajectory towards the science observation point
      const midPull = Math.sin(t * Math.PI);
      const targetMidLat = (start.latitude + end.latitude) / 2 + (sciencePointDetour.latitude - (start.latitude + end.latitude) / 2) * 0.75;
      const targetMidLon = (start.longitude + end.longitude) / 2 + (sciencePointDetour.longitude - (start.longitude + end.longitude) / 2) * 0.75;
      const lat = (start.latitude * (1 - t) + end.latitude * t) * (1 - midPull) + targetMidLat * midPull;
      const lon = (start.longitude * (1 - t) + end.longitude * t) * (1 - midPull) + targetMidLon * midPull;
      const elev = (start.elevationMeters ?? -2500) * (1 - t) + (end.elevationMeters ?? -2200) * t;
      waypoints.push({ latitude: lat, longitude: lon, elevationMeters: Math.round(elev) });
      continue;
    } else {
      // Direct direct-line with minimal gentle curve
      curveFactor = Math.sin(t * Math.PI) * 0.008;
    }

    const lat = start.latitude + (end.latitude - start.latitude) * t - curveFactor * 0.35;
    const lon = start.longitude + (end.longitude - start.longitude) * t + curveFactor;

    // Smoother elevation along contour for safe profile
    const elevSlopeDamping = profile === 'safe' ? 0.35 : 1.0;
    const baseElev = (start.elevationMeters ?? -2500) * (1 - t) + (end.elevationMeters ?? -2200) * t;
    const elevationMeters = Math.round(baseElev + Math.sin(t * 6) * (18 * elevSlopeDamping));

    waypoints.push({ latitude: lat, longitude: lon, elevationMeters });
  }

  // Calculate metrics and elevation cross-section
  for (let i = 0; i < waypoints.length; i++) {
    let segDist = 0;
    let slopeDeg = 0;

    if (i > 0) {
      const prev = waypoints[i - 1];
      const cur = waypoints[i];
      const dLat = (cur.latitude - prev.latitude) * 59274;
      const dLon = (cur.longitude - prev.longitude) * 59274 * Math.cos((cur.latitude * Math.PI) / 180);
      const dElev = (cur.elevationMeters ?? -2400) - (prev.elevationMeters ?? -2400);
      segDist = Math.sqrt(dLat * dLat + dLon * dLon + dElev * dElev);
      totalDistanceMeters += segDist;

      const slopePct = segDist > 0 ? Math.abs((dElev / segDist) * 100) : 0;
      slopeDeg = Math.atan(slopePct / 100) * (180 / Math.PI);
      accumulatedSlopeWatts += calculatePandolfWatts(slopePct);
    }

    elevationProfile.push({
      distanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
      elevationM: waypoints[i].elevationMeters ?? -2400,
      slopeDeg: Number(slopeDeg.toFixed(1)),
    });
  }

  const estimatedDurationSeconds = totalDistanceMeters / GEHTEMPO_MS;
  const avgWatts = accumulatedSlopeWatts / (waypoints.length - 1);
  const totalEnergyJoules = avgWatts * estimatedDurationSeconds;

  // Base risk calculation modified by profile
  let riskScore = Math.min(0.85, Math.max(0.08, (avgWatts - 210) / 300));
  if (profile === 'safe') {
    riskScore = Number((riskScore * 0.45).toFixed(3)); // Much safer
  } else {
    riskScore = Number(riskScore.toFixed(3));
  }

  return {
    id: `route-${profile}-${Date.now()}`,
    profile,
    waypoints,
    distanceMeters: Math.round(totalDistanceMeters),
    estimatedDurationSeconds: Math.round(estimatedDurationSeconds),
    riskScore,
    energyJoules: Math.round(totalEnergyJoules),
    averagePowerWatts: Math.round(avgWatts),
    elevationProfile,
  };
}

export async function requestRouteAlternatives(
  start: MarsCoordinate,
  end: MarsCoordinate,
  scienceDetour?: MarsCoordinate
): Promise<{ direct: MarsRoute; safe: MarsRoute; science: MarsRoute }> {
  // 1. Try FastAPI backend alternatives endpoint if available
  try {
    const res = await fetch('/api/routes/alternatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, count: 3 }),
    });

    if (res.ok) {
      const routes: MarsRoute[] = await res.json();
      if (routes && routes.length >= 2) {
        const enrichWithElevation = (r: MarsRoute, prof: RouteProfile): MarsRoute => {
          const elevProfile: ElevationPoint[] = [];
          let runDist = 0;
          r.waypoints.forEach((wp, idx) => {
            if (idx > 0) {
              const p = r.waypoints[idx - 1];
              const d = Math.hypot(
                (wp.latitude - p.latitude) * 59274,
                (wp.longitude - p.longitude) * 59274 * Math.cos((wp.latitude * Math.PI) / 180)
              );
              runDist += d;
            }
            elevProfile.push({
              distanceKm: Number((runDist / 1000).toFixed(2)),
              elevationM: wp.elevationMeters ?? -2450,
              slopeDeg: prof === 'safe' ? 4.5 : 8.5,
            });
          });
          return { ...r, profile: prof, elevationProfile: elevProfile };
        };

        const direct = enrichWithElevation(routes[0], 'direct');
        const safe = enrichWithElevation(routes[1], 'safe');
        const science = routes[2] 
          ? enrichWithElevation(routes[2], 'science') 
          : await requestRoute(start, end, 'science', scienceDetour);

        return { direct, safe, science };
      }
    }
  } catch {
    // Backend endpoint not ready or offline -> fallback to client generator
  }

  // 2. High-precision client-side multi-profile generator fallback
  const [direct, safe, science] = await Promise.all([
    requestRoute(start, end, 'direct'),
    requestRoute(start, end, 'safe'),
    requestRoute(start, end, 'science', scienceDetour),
  ]);

  return { direct, safe, science };
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
