import { create } from 'zustand';
import { Landmark, CameraViewMode, MarsCoordinate, MarsRoute } from '@/types/mars';
import { requestRoute } from '@/services/marsApi';

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

export type ActiveView = 'globe' | 'terrain_prototype';
export type TerrainColorMode = 'satellite' | 'hypsometric' | 'slope';

interface MissionStore {
  // Global View State
  activeView: ActiveView;
  cameraMode: CameraViewMode;
  cameraDistance: number;
  isAutoRotating: boolean;
  selectedLandmark: Landmark | null;
  cameraTarget: [number, number, number];
  cameraDesiredPosition: [number, number, number] | null;

  // DEM Terrain State
  terrainWireframe: boolean;
  terrainExaggeration: number;
  terrainColorMode: TerrainColorMode;

  // Route Planning State (Phase 2)
  routeStart: MarsCoordinate | null;
  routeEnd: MarsCoordinate | null;
  currentRoute: MarsRoute | null;
  isCalculatingRoute: boolean;

  // Actions
  setActiveView: (view: ActiveView) => void;
  setCameraMode: (mode: CameraViewMode) => void;
  setCameraDistance: (dist: number) => void;
  toggleAutoRotate: () => void;
  setAutoRotate: (val: boolean) => void;
  selectLandmark: (landmark: Landmark | null) => void;
  resetToOrbit: () => void;
  setCameraDesiredPosition: (pos: [number, number, number] | null) => void;
  setCameraTarget: (target: [number, number, number]) => void;

  setTerrainWireframe: (val: boolean) => void;
  toggleTerrainWireframe: () => void;
  setTerrainExaggeration: (val: number) => void;
  setTerrainColorMode: (mode: TerrainColorMode) => void;

  // Route Planning Actions
  setRoutePoint: (coord: MarsCoordinate) => void;
  clearRoute: () => void;
  calculateRoute: () => Promise<void>;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  activeView: 'globe',
  cameraMode: 'orbit',
  cameraDistance: 6.0,
  isAutoRotating: true,
  selectedLandmark: null,
  cameraTarget: [0, 0, 0],
  cameraDesiredPosition: null,

  terrainWireframe: false,
  terrainExaggeration: 1.5,
  terrainColorMode: 'satellite',

  routeStart: { latitude: 18.38, longitude: 77.45, elevationMeters: -2480 },
  routeEnd: { latitude: 18.42, longitude: 77.62, elevationMeters: -2210 },
  currentRoute: null,
  isCalculatingRoute: false,

  setActiveView: (view) =>
    set({
      activeView: view,
      isAutoRotating: view === 'globe',
    }),
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
      activeView: 'globe',
      selectedLandmark: null,
      cameraMode: 'orbit',
      cameraTarget: [0, 0, 0],
      cameraDesiredPosition: [0, 1.5, 6.0],
      isAutoRotating: true,
    }),
  setCameraDesiredPosition: (pos) => set({ cameraDesiredPosition: pos }),
  setCameraTarget: (target) => set({ cameraTarget: target }),

  setTerrainWireframe: (val) => set({ terrainWireframe: val }),
  toggleTerrainWireframe: () => set((state) => ({ terrainWireframe: !state.terrainWireframe })),
  setTerrainExaggeration: (val) => set({ terrainExaggeration: val }),
  setTerrainColorMode: (mode) => set({ terrainColorMode: mode }),

  setRoutePoint: (coord: MarsCoordinate) => {
    const { routeStart, routeEnd } = get();
    if (!routeStart || (routeStart && routeEnd)) {
      set({ routeStart: coord, routeEnd: null, currentRoute: null });
    } else {
      set({ routeEnd: coord });
      get().calculateRoute();
    }
  },

  clearRoute: () =>
    set({
      routeStart: null,
      routeEnd: null,
      currentRoute: null,
    }),

  calculateRoute: async () => {
    const { routeStart, routeEnd } = get();
    if (!routeStart || !routeEnd) return;

    set({ isCalculatingRoute: true });
    try {
      const route = await requestRoute(routeStart, routeEnd);
      set({ currentRoute: route, isCalculatingRoute: false });
    } catch {
      set({ isCalculatingRoute: false });
    }
  },
}));
