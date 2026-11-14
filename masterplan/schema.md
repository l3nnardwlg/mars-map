interface MarsCoordinate {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
}

interface MarsRoute {
  id: string;
  waypoints: MarsCoordinate[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  riskScore: number;
}

interface SciencePoint {
  id: string;
  name: string;
  location: MarsCoordinate;
  description: string;
  nasaSourceUrl: string;
}