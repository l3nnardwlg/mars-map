import * as THREE from 'three';

/**
 * Standard Geodetic Definitions agreed with Backend (Dev B):
 * - Coordinate System: IAU Mars 2000 Planetocentric, East-positive longitude
 * - Elevation Reference: MOLA Areoid Reference Datum (0.0 m)
 * - Mars Equatorial Radius (A): 3,396,190.0 meters (USGS/PDS standard for map projections)
 * - Mars Polar Radius (B): 3,376,200.0 meters
 * - Mars Mean Volumetric Radius (R): 3,389,500.0 meters (IAU standard for spherical approximations)
 * - Axial Tilt (Obliquity): 25.19°
 */
export const MARS_COORDINATE_SYSTEM = 'IAU Mars 2000 Planetocentric (East-positive)';
export const MARS_ELEVATION_REFERENCE = 'MOLA Areoid';
export const MARS_EQUATORIAL_RADIUS_METERS = 3396190.0;
export const MARS_MEAN_RADIUS_METERS = 3389500.0;
export const MARS_POLAR_RADIUS_METERS = 3376200.0;

export const MARS_RADIUS_SCENE = 2.0;
export const MARS_AXIAL_TILT_RAD = (25.19 * Math.PI) / 180; // 25.19 degrees

/**
 * Jezero Crater Bounding Box (agreed NASA PDS CTX/MOLA quad):
 * - South: 17.58° N
 * - North: 19.29° N (ΔLat = 1.71° = 101,358 m)
 * - West:  76.99° E
 * - East:  78.58° E (ΔLon = 1.59° = 89,410 m at mean lat 18.435° N)
 */
export const JEZERO_BOUNDS = {
  minLat: 17.58,
  maxLat: 19.29,
  minLon: 76.99,
  maxLon: 78.58,
};

/**
 * Converts Martian latitude and east-longitude (IAU Mars 2000) to 3D Cartesian coordinates (X, Y, Z)
 * based on Three.js SphereGeometry UV orientation.
 * 
 * @param lat Planetocentric latitude in degrees [-90 to +90] (North positive)
 * @param lon Planetocentric east longitude in degrees [0 to 360] (East positive)
 * @param radius Radius of sphere in scene units (default: MARS_RADIUS_SCENE)
 * @param elevationMeters Elevation relative to MOLA Areoid in meters
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = MARS_RADIUS_SCENE,
  elevationMeters: number = 0
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  // Scaled elevation offset relative to planet radius
  const elevationOffset = (elevationMeters / MARS_MEAN_RADIUS_METERS) * radius;
  const r = radius + elevationOffset;

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Exact inverse: Converts 3D Cartesian coordinates back to IAU Mars 2000 latitude and east-longitude.
 * 
 * @param vec Cartesian vector in Mars globe local frame
 * @returns { lat: number, lon: number, distance: number }
 */
export function vector3ToLatLon(vec: THREE.Vector3): { lat: number; lon: number; r: number } {
  const r = vec.length();
  if (r === 0) return { lat: 0, lon: 0, r: 0 };

  // Y is the polar axis (North)
  const phi = Math.acos(Math.max(-1, Math.min(1, vec.y / r)));
  const lat = 90 - (phi * 180) / Math.PI;

  // X and Z define the equatorial plane
  // In latLonToVector3:
  // x = -r * sin(phi) * cos(theta), z = r * sin(phi) * sin(theta)
  // Therefore: theta = atan2(z, -x)
  const theta = Math.atan2(vec.z, -vec.x);
  let lon = (theta * 180) / Math.PI - 180;

  // Normalize lon into [0, 360)
  while (lon < 0) lon += 360;
  while (lon >= 360) lon -= 360;

  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    r,
  };
}

/**
 * Converts Martian coordinates to normalized local coordinates [0, 1] for the Jezero terrain plane.
 */
export function jezeroLatLonToLocal(
  lat: number,
  lon: number,
  bounds = JEZERO_BOUNDS
): { x: number; y: number } {
  const normX = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const normY = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  return {
    x: Math.max(0, Math.min(1, normX)),
    y: Math.max(0, Math.min(1, normY)),
  };
}

/**
 * Exact inverse: Converts normalized local plane coordinates [0, 1] back to Martian coordinates (lat, lon).
 */
export function jezeroLocalToLatLon(
  u: number,
  v: number,
  bounds = JEZERO_BOUNDS
): { lat: number; lon: number } {
  const clampedU = Math.max(0, Math.min(1, u));
  const clampedV = Math.max(0, Math.min(1, v));
  const lon = bounds.minLon + clampedU * (bounds.maxLon - bounds.minLon);
  const lat = bounds.minLat + clampedV * (bounds.maxLat - bounds.minLat);
  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  };
}

/**
 * Great-Circle Haversine distance in meters on the Mars sphere.
 * Uses the mean volumetric Mars radius of 3,389,500 m.
 */
export function calculateMarsHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return MARS_MEAN_RADIUS_METERS * c;
}

/**
 * Forward Azimuth (compass bearing in degrees [0, 360)) on Mars from Point 1 to Point 2.
 * 0° = True Martian North, 90° = East, 180° = South, 270° = West.
 */
export function calculateMarsBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
