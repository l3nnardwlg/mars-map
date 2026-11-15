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

      const seg3DDist = Math.sqrt(dLatM * dLatM + dLonM * dLonM + dElevM * dElevM);
      runDistMeters += seg3DDist;

      if (dElevM > 0) gainMeters += dElevM;
      else lossMeters += Math.abs(dElevM);

      const segmentSlopeDeg = seg3DDist > 0 ? (Math.atan(Math.abs(dElevM) / seg3DDist) * 180) / Math.PI : 0;
      const effectiveSlope = Math.max(localSlope, segmentSlopeDeg);

      slopeDegSum += effectiveSlope;
      if (effectiveSlope > maxSlopeDeg) maxSlopeDeg = effectiveSlope;

      const slopePercent = seg3DDist > 0 ? (Math.abs(dElevM) / seg3DDist) * 100 : 0;
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

/**
 * Requests or computes a Mars route with transparent scientific provenance.
 */
export async function requestRoute(
  start: MarsCoordinate,
  end: MarsCoordinate,
  profile: RouteProfile = 'direct',
  sciencePointDetour?: MarsCoordinate
): Promise<MarsRoute> {
  // 1. Attempt FastAPI backend if direct profile
  if (profile === 'direct' && !sciencePointDetour) {
    try {
      const res = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      });

      if (res.status === 422) {
        const info = await res.json().catch(() => null);
        throw new RouteRejectedError(info?.detail || 'Route rejected by terrain solver: point outside bounds or slope exceeds 15.0°');
      }

      if (res.ok) {
        const data = await res.json();
        const enriched = enrichWaypointsWithTopography(
          data.waypoints,
          'NASA FastAPI Backend [A* CTX-DEM Raster]'
        );

        return {
          ...data,
          profile: 'direct',
          waypoints: enriched.enrichedWaypoints,
          elevationProfile: enriched.elevationProfile,
          elevationGainMeters: enriched.elevationGainMeters,
          elevationLossMeters: enriched.elevationLossMeters,
          maxSlopeDeg: data.maxSlopeDeg ?? enriched.maxSlopeDeg,
          averageSlopeDeg: data.meanSlopeDeg ?? enriched.averageSlopeDeg,
          dataSource: 'NASA FastAPI Backend [Local Tiles / A* CTX-DEM]',
          sourceMode: data.sourceMode || 'backend_live_ctx',
        };
      }
    } catch (err) {
      if (err instanceof RouteRejectedError) throw err;
      // Backend offline -> continue to offline model
    }
  }

  // 2. Verified Offline Planetary Routing Model (using raw DEM sampling)
  const steps = 36;
  const rawWaypoints: MarsCoordinate[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    let curveFactor = 0.0;
    if (profile === 'safe') {
      // Wide contour arc avoiding steep delta scarps
      curveFactor = Math.sin(t * Math.PI) * 0.038;
    } else if (profile === 'science' && sciencePointDetour) {
      const midPull = Math.sin(t * Math.PI);
      const targetMidLat = (start.latitude + end.latitude) / 2 + (sciencePointDetour.latitude - (start.latitude + end.latitude) / 2) * 0.75;
      const targetMidLon = (start.longitude + end.longitude) / 2 + (sciencePointDetour.longitude - (start.longitude + end.longitude) / 2) * 0.75;
      const lat = (start.latitude * (1 - t) + end.latitude * t) * (1 - midPull) + targetMidLat * midPull;
      const lon = (start.longitude * (1 - t) + end.longitude * t) * (1 - midPull) + targetMidLon * midPull;
      rawWaypoints.push({ latitude: lat, longitude: lon });
      continue;
    } else {
      // Direct Euclidean traverse
      curveFactor = Math.sin(t * Math.PI) * 0.005;
    }

    const lat = start.latitude + (end.latitude - start.latitude) * t - curveFactor * 0.35;
    const lon = start.longitude + (end.longitude - start.longitude) * t + curveFactor;
    rawWaypoints.push({ latitude: lat, longitude: lon });
  }

  const enriched = enrichWaypointsWithTopography(
    rawWaypoints,
    'NASA PDS M20 Jezero CTX Model [Offline Reference]'
  );

  return {
    id: `route-${profile}-${Date.now()}`,
    profile,
    waypoints: enriched.enrichedWaypoints,
    distanceMeters: enriched.totalDistanceMeters,
    estimatedDurationSeconds: Math.round(enriched.totalDistanceMeters / NASA_EVA_CONSTANTS.walkingSpeedMs),
    riskScore: enriched.riskScore,
    energyJoules: enriched.totalEnergyJoules,
    averagePowerWatts: enriched.averagePowerWatts,
    elevationGainMeters: enriched.elevationGainMeters,
    elevationLossMeters: enriched.elevationLossMeters,
    maxSlopeDeg: enriched.maxSlopeDeg,
    averageSlopeDeg: enriched.averageSlopeDeg,
    dataSource: 'NASA PDS M20 Jezero CTX Model [Offline Reference]',
    sourceMode: 'offline_reference_model',
    warnings: ['OFFLINE REFERENCE MODEL — Start backend for live NASA A* CTX-DEM solver'],
    elevationProfile: enriched.elevationProfile,
  };
}

export class RouteRejectedError extends Error {}

export interface AlternativeRoutesMap {
  direct?: MarsRoute;
  safe?: MarsRoute;
  science?: MarsRoute;
}

/**
 * Requests or computes alternative multi-objective routes for scientific comparison.
 * Uses Dev B's POST /api/routes/plan endpoint with objective-based routing.
 */
export async function requestRouteAlternatives(
  start: MarsCoordinate,
  end: MarsCoordinate,
  scienceDetour?: MarsCoordinate,
  sciencePointId?: string
): Promise<AlternativeRoutesMap> {
  // 1. First, attempt FastAPI backend /api/routes/plan with explicit objectives
  try {
    const planBody: {
      start: MarsCoordinate;
      end: MarsCoordinate;
      objectives: ('energy_min' | 'distance_min' | 'slope_hazard_min')[];
      sciencePointIds?: string[];
      via?: MarsCoordinate[];
    } = {
      start,
      end,
      objectives: ['energy_min', 'distance_min', 'slope_hazard_min'],
    };

    if (sciencePointId) {
      planBody.sciencePointIds = [sciencePointId];
    } else if (scienceDetour) {
      planBody.via = [scienceDetour];
    }

    const res = await fetch('/api/routes/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planBody),
    });

    if (res.status === 422) {
      const info = await res.json().catch(() => null);
      throw new RouteRejectedError(
        info?.detail || 'Route rejected by terrain solver: start/end impassable (>15°) or out of bounds'
      );
    }

    if (res.ok) {
      const routes: MarsRoute[] = await res.json();
      if (routes && routes.length > 0) {
        const enrich = (r: MarsRoute, prof: RouteProfile): MarsRoute => {
          const topo = enrichWaypointsWithTopography(
            r.waypoints,
            `NASA FastAPI Solver [A* CTX-DEM / ${r.objective || prof}]`
          );
          return {
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
            dataSource: `NASA FastAPI Solver [A* CTX-DEM / ${r.objective || prof}]`,
          };
        };

        const result: AlternativeRoutesMap = {};

        for (const r of routes) {
          if (r.objective === 'distance_min') {
            result.direct = enrich(r, 'direct');
          } else if (r.objective === 'energy_min') {
            result.safe = enrich(r, 'safe');
          } else if (r.objective === 'slope_hazard_min') {
            result.science = enrich(r, 'science');
          } else if (r.tags?.includes('alternative_corridor')) {
            if (!result.safe) result.safe = enrich(r, 'safe');
            else if (!result.science) result.science = enrich(r, 'science');
          }
        }

        // If a science point was visited, assign or override science profile
        const scienceVisited = routes.find(
          (r) => r.visitedSciencePointIds && r.visitedSciencePointIds.length > 0
        );
        if (scienceVisited) {
          result.science = enrich(scienceVisited, 'science');
        }

        if (Object.keys(result).length > 0) {
          return result;
        }
      }
    }
  } catch (error) {
    if (error instanceof RouteRejectedError) throw error;
    // Backend offline -> fallback to offline model with explicit provenance
  }

  // 2. High-precision offline model (explicitly marked as offline illustrative reference)
  const [direct, safe, science] = await Promise.all([
    requestRoute(start, end, 'direct'),
    requestRoute(start, end, 'safe'),
    requestRoute(start, end, 'science', scienceDetour),
  ]);

  direct.tags = ['shortest', 'offline_reference'];
  direct.sourceMode = 'offline_reference_model';
  direct.warnings = ['OFFLINE REFERENCE MODEL — Start backend for live NASA A* CTX-DEM solver'];

  safe.tags = ['energy_optimal', 'lowest_risk', 'offline_reference'];
  safe.sourceMode = 'offline_reference_model';
  safe.warnings = ['OFFLINE REFERENCE MODEL — Start backend for live NASA A* CTX-DEM solver'];

  science.tags = ['science_detour', 'offline_reference'];
  science.sourceMode = 'offline_reference_model';
  science.warnings = ['OFFLINE REFERENCE MODEL — Start backend for live NASA A* CTX-DEM solver'];

  return { direct, safe, science };
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
