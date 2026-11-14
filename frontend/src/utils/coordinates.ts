import * as THREE from 'three';

/**
 * Standard Geodetic Definitions agreed with Backend (Dev B):
 * - Coordinate System: IAU Mars 2000 (planetozentrisch, Laenge nach Osten positiv)
 * - Elevation Reference: MOLA Areoid (0 m Datum)
 * - Mean Volumetric Radius: 3,389,500 meters
 */
export const MARS_COORDINATE_SYSTEM = 'IAU Mars 2000';
export const MARS_ELEVATION_REFERENCE = 'MOLA Areoid';
export const MARS_MEAN_RADIUS_METERS = 3389500;

export const MARS_RADIUS_SCENE = 2.0;
export const MARS_AXIAL_TILT_RAD = (25.19 * Math.PI) / 180; // 25.19 degrees

/**
 * Converts Martian latitude and east-longitude (IAU Mars 2000) to 3D Cartesian coordinates (X, Y, Z)
 * based on Three.js SphereGeometry UV orientation.
 * 
 * @param lat Planetocentric latitude in degrees [-90 to +90] (North positive)
 * @param lon Planetocentric east longitude in degrees [0 to 360] or [-180 to 180] (East positive)
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

  // Scaled elevation offset: 10,000 m = ~0.005 scene units
  const elevationOffset = (elevationMeters / MARS_MEAN_RADIUS_METERS) * radius;
  const r = radius + elevationOffset;

  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts Martian coordinates to normalized local coordinates [0, 1] for Jezero terrain plane.
 */
export function jezeroLatLonToLocal(
  lat: number,
  lon: number,
  bounds = {
    minLat: 17.58,
    maxLat: 19.29,
    minLon: 76.99,
    maxLon: 78.58,
  }
): { x: number; y: number } {
  const normX = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const normY = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  return {
    x: Math.max(0, Math.min(1, normX)),
    y: Math.max(0, Math.min(1, normY)),
  };
}
