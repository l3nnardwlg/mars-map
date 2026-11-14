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

export interface LegendEntry {
  classId: number;
  name: string;
  symbol: string;
  color: string;
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  kind?: string | null;
  unit?: string | null;
  tileSet?: string | null;
  available?: boolean;
  legend?: LegendEntry[] | null;
}

export type RouteProfile = 'direct' | 'safe' | 'science';

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  slopeDeg: number;
}

export interface MarsRoute {
  id: string;
  profile?: RouteProfile;
  waypoints: MarsCoordinate[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  riskScore: number;
  energyJoules?: number | null;
  averagePowerWatts?: number | null;
  tags?: string[];
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  maxSlopeDeg?: number;
  averageSlopeDeg?: number;
  dataSource?: string;
  elevationProfile?: ElevationPoint[];
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
  oxygenKilograms: number;
  energyWattHours: number;
  averagePowerWatts: number;
  evaTimeLimitSeconds: number;
  withinEvaTimeLimit: boolean;
  withinAverageMetabolicRate: boolean;
  radiationDoseMilligray?: number | null;
  radiationBasis?: string | null;
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

export interface InspectionPoint {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  slopeDeg: number;
  aspectDeg?: number;
  compassOctant?: string;
  uncertaintyMeters?: number;
  sourceDataset?: string;
  riskLevel: 'safe' | 'caution' | 'hazard';
}

export interface MeasurementResult {
  start: MarsCoordinate;
  end: MarsCoordinate;
  straightDistanceKm: number;
  elevationDeltaM: number;
  bearingDeg: number;
}

export interface AstronautPose {
  x: number;
  y: number;
  z: number;
  headingDeg: number;
  pitchDeg: number;
  speed: number;
}
