import { create } from 'zustand';
import { Landmark, CameraViewMode } from '@/types/mars';

export const MARS_LANDMARKS: Landmark[] = [
  {
    id: 'jezero',
    name: 'Jezero Crater',
    type: 'landing_site',
    coordinate: { latitude: 18.38, longitude: 77.58, elevationMeters: -2500 },
    description: 'NASA Perseverance Landing Site & Ancient Paleolake Delta',
  },
  {
    id: 'olympus-mons',
    name: 'Olympus Mons',
    type: 'volcano',
    coordinate: { latitude: 18.65, longitude: 226.2, elevationMeters: 21287 },
    description: 'The largest planetary volcano and shield mountain in the Solar System',
  },
  {
    id: 'valles-marineris',
    name: 'Valles Marineris',
    type: 'canyon',
    coordinate: { latitude: -13.9, longitude: 300.8, elevationMeters: -7000 },
    description: 'Vast canyon system stretching over 4,000 km along the Martian equator',
  },
  {
    id: 'gale-crater',
    name: 'Gale Crater',
    type: 'landing_site',
    coordinate: { latitude: -4.59, longitude: 137.44, elevationMeters: -4500 },
    description: 'NASA Curiosity Rover exploration site with Mount Sharp at its center',
  },
];

interface MissionStore {
  cameraMode: CameraViewMode;
  cameraDistance: number;
  isAutoRotating: boolean;
  selectedLandmark: Landmark | null;
  cameraTarget: [number, number, number];
  cameraDesiredPosition: [number, number, number] | null;

  setCameraMode: (mode: CameraViewMode) => void;
  setCameraDistance: (dist: number) => void;
  toggleAutoRotate: () => void;
  setAutoRotate: (val: boolean) => void;
  selectLandmark: (landmark: Landmark | null) => void;
  resetToOrbit: () => void;
  setCameraDesiredPosition: (pos: [number, number, number] | null) => void;
  setCameraTarget: (target: [number, number, number]) => void;
}

export const useMissionStore = create<MissionStore>((set) => ({
  cameraMode: 'orbit',
  cameraDistance: 6.0,
  isAutoRotating: true,
  selectedLandmark: null,
  cameraTarget: [0, 0, 0],
  cameraDesiredPosition: null,

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setCameraDistance: (dist) => set({ cameraDistance: dist }),
  toggleAutoRotate: () => set((state) => ({ isAutoRotating: !state.isAutoRotating })),
  setAutoRotate: (val) => set({ isAutoRotating: val }),
  selectLandmark: (landmark) =>
    set({
      selectedLandmark: landmark,
      cameraMode: landmark ? 'targeting' : 'orbit',
      isAutoRotating: false,
    }),
  resetToOrbit: () =>
    set({
      selectedLandmark: null,
      cameraMode: 'orbit',
      cameraTarget: [0, 0, 0],
      cameraDesiredPosition: [0, 1.5, 6.0],
      isAutoRotating: true,
    }),
  setCameraDesiredPosition: (pos) => set({ cameraDesiredPosition: pos }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
}));
