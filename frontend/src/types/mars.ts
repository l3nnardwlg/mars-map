/**
 * IAU Mars 2000 Geodetic Coordinate
 * Latitude: -90° to +90° (North positive)
 * Longitude: 0° to 360° or -180° to 180° (East positive)
 * Elevation: meters relative to MOLA Areoid datum
 */
export interface MarsCoordinate {
  latitude: number;
  longitude: number;
  elevationMeters?: number | null;
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface TerrainMetadata {
  regionName: string;
  coordinateSystem: string;
  elevationReference: string;
  bounds: BoundingBox;
  resolutionMetersPerPixel: number;
  availableTiles: string[];
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
}

export interface MarsRoute {
  id: string;
  waypoints: MarsCoordinate[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  riskScore: number;
}

export interface RouteRequest {
  start: MarsCoordinate;
  end: MarsCoordinate;
}

export interface MissionRequest {
  route: MarsRoute;
  crewSize: number;
}

export interface MissionEstimate {
  durationSeconds: number;
  oxygenLiters: number;
  energyWattHours: number;
}

export interface SciencePoint {
  id: string;
  name: string;
  location: MarsCoordinate;
  description: string;
  nasaSourceUrl: string;
}

export interface Landmark {
  id: string;
  name: string;
  type: 'crater' | 'volcano' | 'canyon' | 'landing_site';
  coordinate: MarsCoordinate;
  description: string;
}

export type CameraViewMode = 'orbit' | 'targeting' | 'surface';

export interface CameraState {
  mode: CameraViewMode;
  distance: number;
  target: [number, number, number];
  isAutoRotating: boolean;
  selectedLandmarkId: string | null;
}
