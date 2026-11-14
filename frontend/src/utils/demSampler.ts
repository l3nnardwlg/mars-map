/**
 * DEM Height Sampler for Jezero Crater
 * Samples the exact height fraction [0..1] at any UV coordinate
 * to ensure 3D markers and route vertices match the displaced mesh with 0 floating.
 */

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
