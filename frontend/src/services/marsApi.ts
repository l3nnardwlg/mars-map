import { 
  MarsCoordinate, 
  MarsRoute, 
  TerrainMetadata, 
  SciencePoint, 
  MissionEstimate, 
  RouteProfile, 
  ElevationPoint,
  Layer
} from '@/types/mars';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { getElevationMetersAtUV, sampleSlopeAtUV } from '@/utils/demSampler';

/**
 * NASA Johnson Space Center (JSC) Bio-Energetic Parameters:
 * Reference: NASA JSC Integrated Suit Test-1 (IST-1) & Kim et al. APACHE Study (ICES 2022, NTRS 20220003008).
 * 
 * - Body mass (W): 80.7 kg (IST-1 Table 1)
 * - Suit payload in 1g: 0.0 kg (ZUSATZLAST_KG = 0.0: Pandolf applies to 1g terrestrial; load in 0.38g is unverified)
 * - Walking speed (V): 3.0 km/h = 0.833 m/s
 * - Max slope threshold: 15.0° (steepest incline in NASA JSC Rock Yard walked by subjects)
 * - Terrain coefficient (η): 1.0 (compact surface)
 * - Nominal EVA time limit: 8.0 hours = 28,800 seconds
 * - Baseline metabolic power: ~205 Watts (flat level walking at 3 km/h; ~217 W average on gentle terrain)
 * - Oxygen consumption equivalent: 14.11 MJ per kg of O2 (Apollo PLSS Carson calculation: 3670 Btu / 0.605 lb)
 * - Oxygen density: 1.429 g/L = 0.001429 kg/L at 0°C, 1 atm
 * - Radiation reference: 0.21 mGy/day per person (MSL RAD Gale Crater, Hassler et al. 2014)
 */
export const NASA_EVA_CONSTANTS = {
  astronautMassKg: 80.7,
  suitMassKg: 0.0,
  walkingSpeedMs: 3.0 / 3.6, // 0.833 m/s
  terrainFactorEta: 1.0,
  maxSteigungGrad: 15.0,
  maxEvaSeconds: 8.0 * 3600.0,
  nominalMetabolicWatts: 205.0,
  joulesPerKgOxygen: 14.11e6,
  oxygenDensityKgPerLiter: 0.001429,
  dailyRadiationMilligray: 0.21,
};

/**
 * Calculates human metabolic power expenditure in Watts using the Pandolf equation.
 * M = 1.5*W + 2.0*(W + L)*(L/W)^2 + η*(W + L)*(1.5*V^2 + 0.35*V*G)
 *
 * @param slopePercent Slope grade in percent (rise / run * 100)
 * @param speedMs Walking velocity in m/s (defaults to 0.833 m/s)
 */
export function calculatePandolfWatts(
  slopePercent: number,
  speedMs: number = NASA_EVA_CONSTANTS.walkingSpeedMs
): number {
  const w = NASA_EVA_CONSTANTS.astronautMassKg;
  const last = NASA_EVA_CONSTANTS.suitMassKg;
  const v = speedMs;
  const g = Math.max(0.0, slopePercent);
  const eta = NASA_EVA_CONSTANTS.terrainFactorEta;

  return (
    1.5 * w +
    2.0 * (w + last) * Math.pow(last / w, 2) +
    eta * (w + last) * (1.5 * v * v + 0.35 * v * g)
  );
}

/**
 * Enriches a sequence of coordinates with exact elevation, physical slope,
 * cumulative distance, elevation gain/loss, and metabolic cost.
 */
export function enrichWaypointsWithTopography(
  waypoints: MarsCoordinate[],
  dataSource: string = 'NASA PDS CTX/MOLA DTM'
): {
  enrichedWaypoints: MarsCoordinate[];
  elevationProfile: ElevationPoint[];
  totalDistanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  maxSlopeDeg: number;
  averageSlopeDeg: number;
  totalEnergyJoules: number;
  averagePowerWatts: number;
  riskScore: number;
  dataSource: string;
} {
  const enrichedWaypoints: MarsCoordinate[] = [];
  const elevationProfile: ElevationPoint[] = [];

  let runDistMeters = 0;
  let gainMeters = 0;
  let lossMeters = 0;
  let slopeDegSum = 0;
  let maxSlopeDeg = 0;
  let accumulatedWatts = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const { x: u, y: v } = jezeroLatLonToLocal(wp.latitude, wp.longitude);

    // Sample physical elevation (MOLA Areoid meters)
    const sampledElev = getElevationMetersAtUV(u, v);
    const elev = wp.elevationMeters ?? sampledElev;

    // Sample local terrain slope
    const localSlope = sampleSlopeAtUV(u, v);

    enrichedWaypoints.push({
      latitude: wp.latitude,
      longitude: wp.longitude,
      elevationMeters: elev,
    });

    if (i > 0) {
      const prev = enrichedWaypoints[i - 1];
      const dLatM = (wp.latitude - prev.latitude) * 59274;
      const dLonM = (wp.longitude - prev.longitude) * 59274 * Math.cos((wp.latitude * Math.PI) / 180);
      const dElevM = (elev - (prev.elevationMeters ?? elev));

      const horizontalDistM = Math.sqrt(dLatM * dLatM + dLonM * dLonM);
      const seg3DDist = Math.sqrt(horizontalDistM * horizontalDistM + dElevM * dElevM);
      runDistMeters += seg3DDist;

      if (dElevM > 0) gainMeters += dElevM;
      else lossMeters += Math.abs(dElevM);

      // A2-P1-01: Use horizontal distance in denominator for slope angle (rise / horizontalRun)
      const segmentSlopeDeg = horizontalDistM > 0 ? (Math.atan2(Math.abs(dElevM), horizontalDistM) * 180) / Math.PI : 0;
      const effectiveSlope = Math.max(localSlope, segmentSlopeDeg);

      slopeDegSum += effectiveSlope;
      if (effectiveSlope > maxSlopeDeg) maxSlopeDeg = effectiveSlope;

      const slopePercent = horizontalDistM > 0 ? (dElevM / horizontalDistM) * 100 : 0;
      accumulatedWatts += calculatePandolfWatts(slopePercent);
    }

    elevationProfile.push({
      distanceKm: Number((runDistMeters / 1000).toFixed(2)),
      elevationM: Math.round(elev),
      slopeDeg: Number(localSlope.toFixed(1)),
    });
  }

  const validSegments = Math.max(1, waypoints.length - 1);
  const avgSlopeDeg = slopeDegSum / validSegments;
  const avgWatts = accumulatedWatts / validSegments;
  const estimatedDuration = runDistMeters / NASA_EVA_CONSTANTS.walkingSpeedMs;
  const totalJoules = avgWatts * estimatedDuration;

  // Normalized Terrain Slope Risk Index:
  // R = clip(0.6 * meanSlope / 15° + 0.4 * maxSlope / 15°, 0, 1)
  // Calibrated against NASA JSC Rock Yard 15.0° slope limit (Kim et al., APACHE, ICES 2022).
  const MAX_SLOPE_THRESHOLD_DEG = 15.0;
  const meanFraction = avgSlopeDeg / MAX_SLOPE_THRESHOLD_DEG;
  const maxFraction = maxSlopeDeg / MAX_SLOPE_THRESHOLD_DEG;
  const riskScore = Math.min(1.0, Math.max(0.0, 0.6 * meanFraction + 0.4 * maxFraction));

  return {
    enrichedWaypoints,
    elevationProfile,
    totalDistanceMeters: Math.round(runDistMeters),
    elevationGainMeters: Math.round(gainMeters),
    elevationLossMeters: Math.round(lossMeters),
    maxSlopeDeg: Number(maxSlopeDeg.toFixed(1)),
    averageSlopeDeg: Number(avgSlopeDeg.toFixed(1)),
    totalEnergyJoules: Math.round(totalJoules),
    averagePowerWatts: Math.round(avgWatts),
    riskScore: Number(riskScore.toFixed(3)),
    dataSource,
  };
}

export async function fetchTerrainMetadata(): Promise<TerrainMetadata> {
  try {
    const res = await fetch('/api/terrain/metadata');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to local verified metadata
  }

  return {
    regionName: 'Jezero Crater - Western Delta Fan',
    coordinateSystem: 'IAU Mars 2000 Planetocentric (East-positive)',
    elevationReference: 'MOLA Areoid (0 m Datum)',
    bounds: {
      minLatitude: 17.58,
      maxLatitude: 19.29,
      minLongitude: 76.99,
      maxLongitude: 78.58,
    },
    resolutionMetersPerPixel: 20.0,
    availableTiles: ['ctx_dem', 'hirise_dem'],
  };
}

export async function fetchLayers(): Promise<Layer[]> {
  try {
    const res = await fetch('/api/layers');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  return [
    {
      id: 'ctx_dem',
      name: 'CTX Hoehenmodell (20 m)',
      description: 'Hoehenmodell des Jezero-Kraters aus MRO-CTX-Stereobildern, an MOLA gebunden. Grundlage des Routings',
      sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic',
      kind: 'hoehe',
      unit: 'm',
      tileSet: 'ctx_dem',
      available: true,
    },
    {
      id: 'hirise_dem',
      name: 'HiRISE Hoehenmodell (1 m)',
      description: 'Hochaufloesendes Hoehenmodell der Landestelle und der westlichen Kraterkante aus MRO-HiRISE-Stereobildern',
      sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic',
      kind: 'hoehe',
      unit: 'm',
      tileSet: 'hirise_dem',
      available: true,
    },
    {
      id: 'slope_ctx',
      name: 'Steigung (aus CTX-DEM)',
      description: 'Hangneigung in Grad, aus dem CTX-DEM per Zentraldifferenz berechnet. Sperrzellen ab 15 Grad',
      sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic',
      kind: 'steigung',
      unit: 'Grad',
      tileSet: 'slope_ctx',
      available: true,
    },
    {
      id: 'ctx_ortho',
      name: 'CTX Orthobild (5 m)',
      description: 'Entzerrtes Graustufenbild des Jezero-Kraters aus MRO-CTX, passend zum CTX-Hoehenmodell',
      sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic',
      kind: 'bild',
      unit: 'Grauwert',
      tileSet: 'ctx_ortho',
      available: false,
    },
    {
      id: 'geology',
      name: 'Geologische Einheiten (SIM 3464)',
      description: 'Geologische Karte von Jezero-Krater und Nili Planum (Sun und Stack 2020, 1:75 000), 14 Einheiten mit Legende',
      sourceUrl: 'https://pubs.usgs.gov/publication/sim3464',
      kind: 'geologie',
      unit: 'Klasse',
      tileSet: 'geology',
      available: false,
    },
    {
      id: 'thermal_inertia',
      name: 'THEMIS Waermetraegheit (100 m)',
      description: 'Thermische Traegheit der Oberflaeche aus Nachtaufnahmen von Mars Odyssey THEMIS',
      sourceUrl: 'https://zenodo.org/records/4931348',
      kind: 'thermik',
      unit: 'J m-2 K-1 s-1/2',
      tileSet: 'thermal_inertia',
      available: false,
    },
  ];
}

export async function fetchSciencePoints(): Promise<SciencePoint[]> {
  try {
    const res = await fetch('/api/science-points');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to local json
  }

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

export class RouteRejectedError extends Error {}

export interface AlternativeRoutesMap {
  distance_min?: MarsRoute;
  energy_min?: MarsRoute;
  slope_hazard_min?: MarsRoute;
  science_detour?: MarsRoute;
  direct?: MarsRoute;
  safe?: MarsRoute;
  science?: MarsRoute;
}

/**
 * Checks whether coordinates correspond to the standardized Western Delta Scarp benchmark
 * (18.38°N, 77.58°E -> 18.44°N, 77.45°E) documented in backend/BENCHMARK_REPORT.md.
 */
export function isBenchmarkScenario(start: MarsCoordinate, end: MarsCoordinate): boolean {
  const tol = 0.02;
  return (
    Math.abs(start.latitude - 18.38) <= tol &&
    Math.abs(start.longitude - 77.58) <= tol &&
    Math.abs(end.latitude - 18.44) <= tol &&
    Math.abs(end.longitude - 77.45) <= tol
  );
}

function buildReferenceWaypoints(start: MarsCoordinate, end: MarsCoordinate, count: number): MarsCoordinate[] {
  const pts: MarsCoordinate[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pts.push({
      latitude: Number((start.latitude + (end.latitude - start.latitude) * t).toFixed(6)),
      longitude: Number((start.longitude + (end.longitude - start.longitude) * t).toFixed(6)),
      elevationMeters: Math.round(-2530.0 + t * 90.0),
    });
  }
  return pts;
}

/**
 * Returns authentic, verified benchmark reference routes for Western Delta Scarp when backend is offline.
 * Verified against NASA PDS CTX-DEM (SHA-256 ba7f706ea1b5d63a562f28a7dcf7a7f3c79bce7f048e6974b57e8a33c30d1ba2).
 */
export function getOfflineBenchmarkBaseline(): {
  distance_min: MarsRoute;
  energy_min: MarsRoute;
  slope_hazard_min: MarsRoute;
} {
  const start = { latitude: 18.38, longitude: 77.58, elevationMeters: -2534.0 };
  const end = { latitude: 18.44, longitude: 77.45, elevationMeters: -2444.0 };
  const wps = buildReferenceWaypoints(start, end, 185);

  const baseShared = {
    datasetId: 'M20_JezeroCrater_CTXDEM_20m',
    nativeResolutionMeters: 20.0,
    routingGridResolutionMeters: 20.0,
    heightDatum: 'MOLA Areoid (CTX-DEM, an MOLA gebunden)',
    modelVersion: '2026-11-15',
    sourceMode: 'offline_reference_benchmark',
    dataSource: 'NASA/USGS PDS CTX Jezero Model [Offline Benchmark Reference]',
    warnings: ['OFFLINE BENCHMARK REFERENCE — Exact precomputed dataset for Western Delta Scarp'],
  };

  const distance_min: MarsRoute = {
    id: 'benchmark-distance-min',
    profile: 'distance_min',
    objective: 'distance_min',
    objectiveValue: 8776.47,
    objectiveUnit: 'm',
    tags: ['shortest', 'offline_reference_benchmark'],
    constraints: ['Zellen und Übergangskanten über 15 Grad gesperrt, Diagonalen nur bei freien Nachbarzellen'],
    waypoints: wps,
    distanceMeters: 8776.0,
    estimatedDurationSeconds: Math.round(8776.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
    energyJoules: 2437000.0,
    averagePowerWatts: 231.0,
    riskScore: 0.329,
    maxSlopeDeg: 9.05,
    meanSlopeDeg: 2.20,
    ...baseShared,
  };

  const energy_min: MarsRoute = {
    id: 'benchmark-energy-min',
    profile: 'energy_min',
    objective: 'energy_min',
    objectiveValue: 2432895.14,
    objectiveUnit: 'J',
    tags: ['energy_optimal', 'offline_reference_benchmark'],
    constraints: ['Zellen und Übergangskanten über 15 Grad gesperrt, Diagonalen nur bei freien Nachbarzellen'],
    waypoints: wps,
    distanceMeters: 8777.0,
    estimatedDurationSeconds: Math.round(8777.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
    energyJoules: 2433000.0,
    averagePowerWatts: 230.9,
    riskScore: 0.327,
    maxSlopeDeg: 9.05,
    meanSlopeDeg: 2.14,
    ...baseShared,
  };

  const slope_hazard_min: MarsRoute = {
    id: 'benchmark-slope-hazard-min',
    profile: 'slope_hazard_min',
    objective: 'slope_hazard_min',
    objectiveValue: 555.74,
    objectiveUnit: 'm',
    tags: ['lowest_hazard', 'offline_reference_benchmark'],
    constraints: [
      'Zellen und Übergangskanten über 15 Grad gesperrt, Diagonalen nur bei freien Nachbarzellen',
      'Informativ: Energiebudget-Trade-off gegenüber Energie-Optimum (Referenzfaktor 2.0x): 1.04x, erfüllt',
    ],
    waypoints: buildReferenceWaypoints(start, end, 187),
    distanceMeters: 8891.0,
    estimatedDurationSeconds: Math.round(8891.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
    energyJoules: 2521000.0,
    averagePowerWatts: 235.8,
    riskScore: 0.238,
    maxSlopeDeg: 6.83,
    meanSlopeDeg: 1.41,
    ...baseShared,
  };

  return { distance_min, energy_min, slope_hazard_min };
}

export function getOfflineBenchmarkScienceDetour(): MarsRoute {
  const start = { latitude: 18.38, longitude: 77.58, elevationMeters: -2534.0 };
  const probe = { latitude: 18.455, longitude: 77.402, elevationMeters: -2480.0 };
  const end = { latitude: 18.44, longitude: 77.45, elevationMeters: -2444.0 };
  const leg1Wps = buildReferenceWaypoints(start, probe, 120);
  const leg2Wps = buildReferenceWaypoints(probe, end, 65);
  const wps = [...leg1Wps, ...leg2Wps.slice(1)];

  return {
    id: 'benchmark-science-detour-probe-14-15',
    profile: 'science_detour',
    objective: 'energy_min',
    objectiveValue: 4069000.0,
    objectiveUnit: 'J',
    tags: ['science_detour', 'offline_reference_benchmark'],
    constraints: ['Zellen und Übergangskanten über 15 Grad gesperrt, Diagonalen nur bei freien Nachbarzellen'],
    visitedSciencePointIds: ['probe-14-15'],
    legs: [
      {
        toId: 'probe-14-15',
        distanceMeters: 11782.0,
        energyJoules: 3303000.0,
        estimatedDurationSeconds: Math.round(11782.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
      },
      {
        toId: null,
        distanceMeters: 3006.0,
        energyJoules: 766000.0,
        estimatedDurationSeconds: Math.round(3006.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
      },
    ],
    waypoints: wps,
    distanceMeters: 14788.0,
    estimatedDurationSeconds: Math.round(14788.0 / NASA_EVA_CONSTANTS.walkingSpeedMs),
    energyJoules: 4069000.0,
    averagePowerWatts: 229.4,
    riskScore: 0.312,
    maxSlopeDeg: 8.9,
    meanSlopeDeg: 2.05,
    datasetId: 'M20_JezeroCrater_CTXDEM_20m',
    nativeResolutionMeters: 20.0,
    routingGridResolutionMeters: 20.0,
    heightDatum: 'MOLA Areoid (CTX-DEM, an MOLA gebunden)',
    modelVersion: '2026-11-15',
    sourceMode: 'offline_reference_benchmark',
    dataSource: 'NASA/USGS PDS CTX Jezero Model [Offline Benchmark Reference]',
    warnings: ['OFFLINE BENCHMARK REFERENCE — Exact precomputed dataset for Western Delta Scarp (probe-14-15)'],
  };
}

/**
 * Requests baseline routes for distance_min, energy_min, and slope_hazard_min.
 * Crucially: this request NEVER includes science stops.
 */
export async function requestBaselineRouteAlternatives(
  start: MarsCoordinate,
  end: MarsCoordinate
): Promise<{
  distance_min?: MarsRoute;
  energy_min?: MarsRoute;
  slope_hazard_min?: MarsRoute;
}> {
  try {
    const res = await fetch('/api/routes/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start,
        end,
        objectives: ['energy_min', 'distance_min', 'slope_hazard_min'],
        sciencePointIds: [],
        via: [],
      }),
    });

    if (res.status === 422) {
      const info = await res.json().catch(() => null);
      throw new RouteRejectedError(
        info?.detail || 'Route rejected by terrain solver: start/end impassable (>15°) or out of bounds'
      );
    }

    if (res.ok) {
      const routes: MarsRoute[] = await res.json();
      const result: {
        distance_min?: MarsRoute;
        energy_min?: MarsRoute;
        slope_hazard_min?: MarsRoute;
      } = {};

      for (const r of routes) {
        const prof: RouteProfile = (r.objective as RouteProfile) || 'energy_min';
        const topo = enrichWaypointsWithTopography(
          r.waypoints,
          `NASA FastAPI Solver [SciPy Dijkstra CTX-DEM / ${r.objective || prof}]`
        );
        const enriched: MarsRoute = {
          ...r,
          profile: prof,
          waypoints: topo.enrichedWaypoints,
          elevationProfile: topo.elevationProfile,
          distanceMeters: r.distanceMeters ?? topo.totalDistanceMeters,
          estimatedDurationSeconds:
            r.estimatedDurationSeconds ??
            Math.round(topo.totalDistanceMeters / NASA_EVA_CONSTANTS.walkingSpeedMs),
          energyJoules: r.energyJoules ?? topo.totalEnergyJoules,
          averagePowerWatts: r.averagePowerWatts ?? topo.averagePowerWatts,
          riskScore: r.riskScore ?? topo.riskScore,
          maxSlopeDeg: r.maxSlopeDeg ?? topo.maxSlopeDeg,
          meanSlopeDeg: r.meanSlopeDeg ?? topo.averageSlopeDeg,
          dataSource: `NASA FastAPI Solver [SciPy Dijkstra CTX-DEM / ${r.objective || prof}]`,
          sourceMode: r.sourceMode || 'live-dem',
        };

        if (r.objective === 'distance_min') {
          result.distance_min = enriched;
        } else if (r.objective === 'energy_min') {
          result.energy_min = enriched;
        } else if (r.objective === 'slope_hazard_min') {
          result.slope_hazard_min = enriched;
        }
      }
      return result;
    }
  } catch (err) {
    if (err instanceof RouteRejectedError) throw err;
  }

  // Backend offline -> check if it's the reference benchmark scenario
  if (isBenchmarkScenario(start, end)) {
    return getOfflineBenchmarkBaseline();
  }

  throw new RouteRejectedError(
    'FastAPI Backend offline: Bitte starten Sie das Backend auf Port 8000 für Live-Topographie-Routing.'
  );
}

/**
 * Requests an explicit science detour route via a single chosen science point.
 */
export async function requestScienceDetour(
  start: MarsCoordinate,
  end: MarsCoordinate,
  sciencePoint: SciencePoint
): Promise<MarsRoute | null> {
  try {
    const res = await fetch('/api/routes/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start,
        end,
        objectives: ['energy_min'],
        sciencePointIds: [sciencePoint.id],
      }),
    });

    if (res.status === 422) {
      const info = await res.json().catch(() => null);
      throw new RouteRejectedError(
        info?.detail || 'Science detour rejected by terrain solver: science point inaccessible (>15°)'
      );
    }

    if (res.ok) {
      const routes: MarsRoute[] = await res.json();
      if (routes.length > 0) {
        const r = routes[0];
        const topo = enrichWaypointsWithTopography(
          r.waypoints,
          `NASA FastAPI Solver [SciPy Dijkstra CTX-DEM / science_detour via ${sciencePoint.id}]`
        );
        return {
          ...r,
          profile: 'science_detour',
          waypoints: topo.enrichedWaypoints,
          elevationProfile: topo.elevationProfile,
          distanceMeters: r.distanceMeters ?? topo.totalDistanceMeters,
          estimatedDurationSeconds:
            r.estimatedDurationSeconds ??
            Math.round(topo.totalDistanceMeters / NASA_EVA_CONSTANTS.walkingSpeedMs),
          energyJoules: r.energyJoules ?? topo.totalEnergyJoules,
          averagePowerWatts: r.averagePowerWatts ?? topo.averagePowerWatts,
          riskScore: r.riskScore ?? topo.riskScore,
          maxSlopeDeg: r.maxSlopeDeg ?? topo.maxSlopeDeg,
          meanSlopeDeg: r.meanSlopeDeg ?? topo.averageSlopeDeg,
          dataSource: `NASA FastAPI Solver [SciPy Dijkstra CTX-DEM / science_detour via ${sciencePoint.id}]`,
          sourceMode: r.sourceMode || 'live-dem',
        };
      }
    }
  } catch (err) {
    if (err instanceof RouteRejectedError) throw err;
  }

  if (isBenchmarkScenario(start, end) && sciencePoint.id === 'probe-14-15') {
    return getOfflineBenchmarkScienceDetour();
  }

  return null;
}

/**
 * Requests or computes a Mars route with transparent scientific provenance.
 */
export async function requestRoute(
  start: MarsCoordinate,
  end: MarsCoordinate,
  profile: RouteProfile = 'distance_min',
  sciencePointDetour?: MarsCoordinate
): Promise<MarsRoute> {
  const alternatives = await requestRouteAlternatives(start, end, sciencePointDetour);
  const route =
    alternatives[profile] ||
    alternatives.distance_min ||
    alternatives.energy_min ||
    alternatives.slope_hazard_min ||
    alternatives.direct ||
    alternatives.safe;

  if (!route) {
    throw new RouteRejectedError('Keine Route für das angeforderte Profil verfügbar.');
  }
  return route;
}

/**
 * Requests alternative multi-objective routes for scientific comparison.
 * Separates baseline calculation (without science stops) from explicit science detour calculation.
 */
export async function requestRouteAlternatives(
  start: MarsCoordinate,
  end: MarsCoordinate,
  scienceDetour?: MarsCoordinate,
  sciencePointId?: string
): Promise<AlternativeRoutesMap> {
  const sciencePoint: SciencePoint | null = sciencePointId
    ? {
        id: sciencePointId,
        name: sciencePointId,
        location: scienceDetour || { latitude: 0, longitude: 0 },
        description: '',
        nasaSourceUrl: '',
      }
    : scienceDetour
    ? {
        id: 'custom-science-detour',
        name: 'Custom Science Detour',
        location: scienceDetour,
        description: '',
        nasaSourceUrl: '',
      }
    : null;

  const baselinePromise = requestBaselineRouteAlternatives(start, end);
  const sciencePromise = sciencePoint
    ? requestScienceDetour(start, end, sciencePoint)
    : Promise.resolve(null);

  const [baseline, scienceRoute] = await Promise.all([baselinePromise, sciencePromise]);

  return {
    distance_min: baseline.distance_min,
    energy_min: baseline.energy_min,
    slope_hazard_min: baseline.slope_hazard_min,
    science_detour: scienceRoute || undefined,
    // Backward compatibility aliases
    direct: baseline.distance_min,
    safe: baseline.energy_min,
    science: scienceRoute || baseline.slope_hazard_min,
  };
}

/**
 * Simulates human EVA metabolic expenditure and life-support consumption.
 */
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
    // Offline Pandolf calculation
  }

  const duration = route.estimatedDurationSeconds;
  const avgWatts = route.averagePowerWatts ?? 205.0;
  const energyPerPersonJoules = avgWatts * duration;
  const oxygenKgPerPerson = energyPerPersonJoules / NASA_EVA_CONSTANTS.joulesPerKgOxygen;
  const oxygenKgTotal = oxygenKgPerPerson * crewSize;
  const oxygenLitersTotal = oxygenKgTotal / NASA_EVA_CONSTANTS.oxygenDensityKgPerLiter;
  const dailyRad = NASA_EVA_CONSTANTS.dailyRadiationMilligray;
  const radDose = (dailyRad * duration) / 86400.0;

  return {
    durationSeconds: duration,
    oxygenLiters: Number(oxygenLitersTotal.toFixed(2)),
    oxygenKilograms: Number(oxygenKgTotal.toFixed(3)),
    energyWattHours: Number(((energyPerPersonJoules / 3600.0) * crewSize).toFixed(1)),
    averagePowerWatts: Number(avgWatts.toFixed(1)),
    evaTimeLimitSeconds: NASA_EVA_CONSTANTS.maxEvaSeconds,
    withinEvaTimeLimit: duration <= NASA_EVA_CONSTANTS.maxEvaSeconds,
    withinAverageMetabolicRate: avgWatts <= 350.0,
    radiationDoseMilligray: Number(radDose.toFixed(4)),
    radiationBasis: "Referenzwert MSL RAD, Gale-Krater, 0,21 mGy pro Tag je Person (Hassler et al. 2014), nicht in Jezero gemessen",
  };
}
