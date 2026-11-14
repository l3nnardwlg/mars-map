/**
 * DEM Height Sampler for Jezero Crater
 * Samples the exact height fraction [0..1] at any UV coordinate
 * to ensure 3D markers and route vertices match the displaced mesh with 0 floating.
 */

/**
 * NASA PDS CTX/MOLA DTM Geodetic Ground Truth for Jezero Crater
 *
 * Primary Dataset: M20_JezeroCrater_CTXDEM_20m
 * Coordinate System: IAU Mars 2000 Planetocentric (East positive)
 * Elevation Datum: MOLA Areoid Reference Datum (0.0 m)
 * 
 * Geographic Bounds (agreed with Backend / Dev B):
 * - Latitude: 17.58° N to 19.29° N (Span: 1.71° = 101,358 m)
 * - Longitude: 76.99° E to 78.58° E (Span: 1.59° = 89,410 m at mean lat 18.435° N)
 * 
 * Elevation Range:
 * - Basin minimum (paleolake floor): -2,583.0 m (MOLA Areoid)
 * - Rim maximum (crater rim ridge):  -1,280.0 m (MOLA Areoid)
 * - Total elevation span:             1,303.0 m
 *
 * Spatial Resolution of 256x256 DEM Sample Grid:
 * - dx (East-West):   89,410 m / 256 = 349.26 m/pixel
 * - dy (North-South): 101,358 m / 256 = 395.93 m/pixel
 */
export const NASA_DEM_METADATA = {
  dataset: 'NASA PDS CTX/MOLA Digital Elevation Model (20m native resolution)',
  productId: 'M20_JezeroCrater_CTXDEM_20m',
  crs: 'IAU Mars 2000 Planetocentric, East Longitude',
  datum: 'MOLA Areoid (0 m)',
  minElevationMeters: -2583.0,
  maxElevationMeters: -1280.0,
  elevationSpanMeters: 1303.0,
  pixelResolutionXMeters: 349.26,
  pixelResolutionYMeters: 395.93,
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
 * Returns exact height fraction [0..1] at normalized coordinate (u, v)
 */
export function sampleHeightAtUV(u: number, v: number): number {
  if (!demData) {
    // Fallback if image not yet loaded
    const dx = u - 0.5;
    const dy = v - 0.5;
    return Math.min(1.0, Math.sqrt(dx * dx + dy * dy) * 1.2);
  }

  const clampedU = Math.max(0, Math.min(1, u));
  const clampedV = Math.max(0, Math.min(1, v));

  const px = Math.min(DEM_SIZE - 1, Math.floor(clampedU * (DEM_SIZE - 1)));
  // Invert V because Three.js Plane UV (0,0) is bottom-left, while image canvas (0,0) is top-left
  const py = Math.min(DEM_SIZE - 1, Math.floor((1 - clampedV) * (DEM_SIZE - 1)));

  return demData[py * DEM_SIZE + px] / 255.0;
}

/**
 * Returns exact 3D displacement Z on the mesh surface for given UV
 */
export function getSurfaceZ(u: number, v: number, exaggeration: number): number {
  const h = sampleHeightAtUV(u, v);
  const scale = 0.55 * exaggeration;
  const bias = -0.1;
  return h * scale + bias;
}

/**
 * Returns estimated real-world elevation in meters relative to MOLA Areoid (-2583m to -1280m).
 * Note: Calculated purely from raw DEM height fraction, completely invariant to visual 3D mesh exaggeration!
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
 * Note: Independent of visual 3D mesh exaggeration!
 */
export function sampleSlopeAtUV(u: number, v: number): number {
  const delta = 1.0 / DEM_SIZE;
  const dxMeters = NASA_DEM_METADATA.pixelResolutionXMeters;
  const dyMeters = NASA_DEM_METADATA.pixelResolutionYMeters;
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
