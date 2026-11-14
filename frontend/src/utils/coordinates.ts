import * as THREE from 'three';

export const MARS_RADIUS_SCENE = 2.0;
export const MARS_AXIAL_TILT_RAD = (25.19 * Math.PI) / 180; // 25.19 degrees

/**
 * Converts Martian latitude and longitude to 3D Cartesian coordinates (X, Y, Z)
 * based on Three.js SphereGeometry UV orientation.
 * 
 * @param lat Latitude in degrees [-90 to +90]
 * @param lon East longitude in degrees [0 to 360] or [-180 to 180]
 * @param radius Radius of sphere (default: MARS_RADIUS_SCENE)
 * @param altitudeOffset Additional elevation offset above surface
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = MARS_RADIUS_SCENE,
  altitudeOffset: number = 0
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  // Three.js Sphere UV alignment offset
  const theta = (lon + 180) * (Math.PI / 180);
  const r = radius + altitudeOffset;

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}
