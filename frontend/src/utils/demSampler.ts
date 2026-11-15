/**
 * DEM Height & Slope Sampler for Jezero Crater
 * Samples the exact height fraction [0..1] and calculates scientific topography
 * (elevation relative to MOLA Areoid datum, central-difference slope, and aspect azimuth).
 *
 * CRITICAL SCIENTIFIC INVARIANCE GUARANTEE:
 * Elevation in meters, slope in degrees, and aspect azimuth are derived strictly from
 * georeferenced DEM data and physical metric grid steps. They are 100% INVARIANT to
 * visual 3D mesh exaggeration (`terrainExaggeration`).
 */

export interface DemMetadata {
  dataset: string;
  productId: string;
  sourceInstitution: string;
  crs: string;
  datum: string;
  minElevationMeters: number;
  maxElevationMeters: number;
  elevationSpanMeters: number;
  nativeSpatialResolutionMeters: number;
  sampleResolutionXMeters: number;
  sampleResolutionYMeters: number;
  quantizationLevels: number;
  quantizationStepMeters: number;
  quantizationMaxErrorMeters: number;
  quantizationRmsMeters: number;
  elevationUncertaintyMeters: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * NASA PDS CTX/MOLA DTM Geodetic Ground Truth for Jezero Crater
 *
 * Primary Dataset: M20_JezeroCrater_CTXDEM_20m
 * Native Resolution: 20 meters/pixel (stereo CTX photogrammetry tied to MOLA)
 * Coordinate System: IAU Mars 2000 Planetocentric, East-positive longitude
 * Elevation Datum: MOLA Areoid Reference Datum (0.0 m)
 * 
 * Jezero Quadrangle Bounds:
 * - South: 17.58° N
 * - North: 19.29° N (ΔLat = 1.71° = 101,358 m)
 * - West:  76.99° E
 * - East:  78.58° E (ΔLon = 1.59° = 89,410 m at mean lat 18.435° N)
 * 
 * Elevation Range:
 * - Paleolake floor basin minimum: -2,583.0 m (MOLA Areoid)
 * - Crater rim crest maximum:      -1,280.0 m (MOLA Areoid)
 * - Total elevation span:           1,303.0 m
 *
 * Discrete Sampling Grid:
 * - Display Grid: 256 x 256 pixel normalized heightmap
 * - dx (East-West):   89,410 m / 256 = 349.26 m/pixel
 * - dy (North-South): 101,358 m / 256 = 395.93 m/pixel
 * - 8-Bit PNG Quantization Step: 1,303 m / 255 = 5.11 m/level
 * - Quantization Uncertainty: ± 2.56 m (half-LSB)
 */
export const NASA_DEM_METADATA: DemMetadata = {
  dataset: 'NASA PDS CTX/MOLA Digital Elevation Model',
  productId: 'M20_JezeroCrater_CTXDEM_20m',
  sourceInstitution: 'USGS Astrogeology Science Center / NASA PDS Cartography and Imaging Sciences Node',
  crs: 'IAU Mars 2000 Planetocentric, East Longitude',
  datum: 'MOLA Areoid (0 m Datum)',
  minElevationMeters: -2583.0,
  maxElevationMeters: -1280.0,
  elevationSpanMeters: 1303.0,
  nativeSpatialResolutionMeters: 20.0,
  sampleResolutionXMeters: 349.26,
  sampleResolutionYMeters: 395.93,
  quantizationLevels: 256,
  quantizationStepMeters: 5.11,
  quantizationMaxErrorMeters: 2.555,
  quantizationRmsMeters: 1.475,
  elevationUncertaintyMeters: 2.56,
  bounds: {
    minLat: 17.58,
    maxLat: 19.29,
    minLon: 76.99,
    maxLon: 78.58,
  },
};

let demData: Uint8Array | null = null;
const DEM_SIZE = 256;

export function initDemSampler(): Promise<void> {
  if (demData) return Promise.resolve();

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/terrain/jezero_dem.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = DEM_SIZE;
      canvas.height = DEM_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, DEM_SIZE, DEM_SIZE);
        const imgData = ctx.getImageData(0, 0, DEM_SIZE, DEM_SIZE);
        demData = new Uint8Array(DEM_SIZE * DEM_SIZE);
        for (let i = 0; i < demData.length; i++) {
          demData[i] = imgData.data[i * 4]; // Grayscale R channel
        }
      }
      resolve();
    };
    img.onerror = () => resolve();
  });
}

/**
 * Returns exact height fraction [0..1] at normalized coordinate (u, v).
 */
export function sampleHeightAtUV(u: number, v: number): number {
  if (!demData) {
    // Deterministic mathematical synthetic fall-back prior to image decode
    const dx = u - 0.5;
    const dy = v - 0.5;
    return Math.min(1.0, Math.sqrt(dx * dx + dy * dy) * 1.2);
  }

  const clampedU = Math.max(0, Math.min(1, u));
  const clampedV = Math.max(0, Math.min(1, v));

  const px = Math.min(DEM_SIZE - 1, Math.floor(clampedU * (DEM_SIZE - 1)));
  // Invert V because Three.js Plane UV (0,0) is bottom-left (South-West), while image canvas (0,0) is top-left (North-West)
  const py = Math.min(DEM_SIZE - 1, Math.floor((1 - clampedV) * (DEM_SIZE - 1)));

  return demData[py * DEM_SIZE + px] / 255.0;
}

/**
 * Returns exact 3D displacement Z on the Three.js mesh surface for given UV and exaggeration.
 * (This is purely a visual scene coordinate, NOT a physical elevation value).
 */
export function getSurfaceZ(u: number, v: number, exaggeration: number): number {
  const h = sampleHeightAtUV(u, v);
  const scale = 0.55 * exaggeration;
  const bias = -0.1;
  return h * scale + bias;
}

/**
 * Returns estimated real-world elevation in meters relative to MOLA Areoid (-2,583m to -1,280m).
 * NOTE: Strictly invariant to visual 3D mesh exaggeration!
 */
export function getElevationMetersAtUV(u: number, v: number): number {
  const frac = sampleHeightAtUV(u, v);
  return Math.round(
    NASA_DEM_METADATA.minElevationMeters + frac * NASA_DEM_METADATA.elevationSpanMeters
  );
}

/**
 * Returns calculated terrain slope in degrees at (u, v) using central finite differences
 * evaluated over physical metric space (dx = 349.3m, dy = 395.9m).
 * NOTE: Strictly invariant to visual 3D mesh exaggeration!
 */
export function sampleSlopeAtUV(u: number, v: number): number {
  const delta = 1.0 / DEM_SIZE;
  const dxMeters = NASA_DEM_METADATA.sampleResolutionXMeters;
  const dyMeters = NASA_DEM_METADATA.sampleResolutionYMeters;
  const span = NASA_DEM_METADATA.elevationSpanMeters;

  const hRight = sampleHeightAtUV(u + delta, v) * span;
  const hLeft = sampleHeightAtUV(u - delta, v) * span;
  const hTop = sampleHeightAtUV(u, v + delta) * span;
  const hBottom = sampleHeightAtUV(u, v - delta) * span;

  // Real physical metric gradient in meters/meter
  const dzDx = (hRight - hLeft) / (2 * dxMeters);
  const dzDy = (hTop - hBottom) / (2 * dyMeters);

  const grad = Math.sqrt(dzDx * dzDx + dzDy * dzDy);
  const slopeDeg = Math.atan(grad) * (180.0 / Math.PI);
  return Number(slopeDeg.toFixed(1));
}

/**
 * Returns downslope aspect azimuth in degrees [0, 360) clockwise from true Martian North (+Y).
 * Also returns the compass octant string (e.g. "N", "NE", "E", "SE", "S", "SW", "W", "NW").
 * NOTE: Strictly invariant to visual 3D mesh exaggeration!
 */
export function sampleAspectAtUV(u: number, v: number): { azimuthDeg: number; compassOctant: string } {
  const delta = 1.0 / DEM_SIZE;
  const dxMeters = NASA_DEM_METADATA.sampleResolutionXMeters;
  const dyMeters = NASA_DEM_METADATA.sampleResolutionYMeters;
  const span = NASA_DEM_METADATA.elevationSpanMeters;

  const hRight = sampleHeightAtUV(u + delta, v) * span;
  const hLeft = sampleHeightAtUV(u - delta, v) * span;
  const hTop = sampleHeightAtUV(u, v + delta) * span;
  const hBottom = sampleHeightAtUV(u, v - delta) * span;

  const dzDx = (hRight - hLeft) / (2 * dxMeters);
  const dzDy = (hTop - hBottom) / (2 * dyMeters);

  // If terrain is essentially flat (< 0.2° slope), aspect is undefined / flat
  const grad = Math.sqrt(dzDx * dzDx + dzDy * dzDy);
  if (grad < 0.0035) {
    return { azimuthDeg: 0, compassOctant: 'Flat' };
  }

  // Downslope gradient direction is (-dzDx, -dzDy)
  // Azimuth clockwise from North (+Y / +dy):
  // 0° = North, 90° = East, 180° = South, 270° = West
  const rad = Math.atan2(-dzDx, -dzDy);
  let deg = (rad * 180.0) / Math.PI;
  if (deg < 0) deg += 360;

  const octants = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const octantIndex = Math.round(deg / 45) % 8;

  return {
    azimuthDeg: Math.round(deg),
    compassOctant: octants[octantIndex],
  };
}

/**
 * Classifies terrain slope risk with documented NASA/JPL rover and human EVA thresholds:
 * - Nominal (< 10°): safe for wheeled and foot traversal with standard traction.
 * - Moderate (10° - threshold°): caution, regolith shear and increased slip risk; reduced velocity.
 * - Hazard (> threshold°): severe obstacle, steep cliff or scree slope, excessive metabolic burn.
 *
 * NOTE: Scientific disclaimer — slope alone does NOT guarantee safety (rock abundance,
 * sub-surface voids, and thermal shadowing also govern EVA safety).
 */
export function classifySlopeRisk(
  slopeDeg: number,
  thresholdDeg: number = 15
): 'safe' | 'caution' | 'hazard' {
  if (slopeDeg < 10) return 'safe';
  if (slopeDeg <= thresholdDeg) return 'caution';
  return 'hazard';
}

/**
 * Scientific Hypsometric Color Ramp Interpolator
 * Maps height fraction t in [0, 1] relative to MOLA Areoid (-2,583m to -1,280m)
 * to exact RGB color values.
 */
export function getHypsometricRgb(t: number): [number, number, number] {
  const stops = [
    { t: 0.0, r: 30, g: 27, b: 75 },    // -2583m (#1e1b4b) Deep basin floor
    { t: 0.2, r: 2, g: 132, b: 199 },   // -2322m (#0284c7) Lower crater floor
    { t: 0.4, r: 16, g: 185, b: 129 },  // -2062m (#10b981) Alluvial plains
    { t: 0.65, r: 245, g: 158, b: 11 }, // -1736m (#f59e0b) Western delta fan
    { t: 0.85, r: 239, g: 68, b: 68 },  // -1475m (#ef4444) Crater rim scarp
    { t: 1.0, r: 255, g: 255, b: 255 }, // -1280m (#ffffff) Rim crest
  ];

  if (t <= 0) return [stops[0].r, stops[0].g, stops[0].b];
  if (t >= 1) return [stops[stops.length - 1].r, stops[stops.length - 1].g, stops[stops.length - 1].b];

  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (t >= s0.t && t <= s1.t) {
      const frac = (t - s0.t) / (s1.t - s0.t);
      const r = Math.round(s0.r + frac * (s1.r - s0.r));
      const g = Math.round(s0.g + frac * (s1.g - s0.g));
      const b = Math.round(s0.b + frac * (s1.b - s0.b));
      return [r, g, b];
    }
  }
  return [255, 255, 255];
}

/**
 * Generates an exact 2D hypsometric elevation raster canvas from a DEM image or canvas.
 * Every pixel is georeferenced and colored according to its actual elevation fraction.
 */
export function generateHypsometricCanvas(
  sourceImage: HTMLImageElement | HTMLCanvasElement
): HTMLCanvasElement {
  const width = sourceImage.width || 256;
  const height = sourceImage.height || 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(sourceImage, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const elevByte = data[i]; // Grayscale red channel [0..255]
    const t = elevByte / 255.0;
    const [r, g, b] = getHypsometricRgb(t);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
