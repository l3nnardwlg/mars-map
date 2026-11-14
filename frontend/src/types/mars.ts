export interface MarsCoordinate {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
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
