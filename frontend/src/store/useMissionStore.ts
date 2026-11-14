import { create } from 'zustand';
import { 
  Landmark, 
  CameraViewMode, 
  MarsCoordinate, 
  MarsRoute, 
  RouteProfile,
  SciencePoint, 
  MissionEstimate,
  InspectionPoint,
  AstronautPose
} from '@/types/mars';
import { 
  requestRouteAlternatives, 
  fetchSciencePoints, 
  simulateMission 
} from '@/services/marsApi';

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

export type { RouteProfile } from '@/types/mars';
export type ActiveView = 'globe' | 'terrain_prototype';
export type TerrainColorMode = 'satellite' | 'hypsometric' | 'slope';
export type SunTimeMode = 'morning' | 'noon' | 'evening';

interface MissionStore {
  // Global View State
  activeView: ActiveView;
  cameraMode: CameraViewMode;
  cameraDistance: number;
  isAutoRotating: boolean;
  selectedLandmark: Landmark | null;
  cameraTarget: [number, number, number];
  cameraDesiredPosition: [number, number, number] | null;

  // DEM Terrain & Environment State
  terrainWireframe: boolean;
  terrainExaggeration: number;
  terrainColorMode: TerrainColorMode;
  sunTimeMode: SunTimeMode;
  showSciencePoints: boolean;
  showElevationProfile: boolean;

  // Phase 5: Astronaut Mode & Controls
  isAstronautMode: boolean;
  astronautPose: AstronautPose;
  showHelmetHUD: boolean;

  // Phase 5: Minimap
  showMinimap: boolean;

  // Phase 5: Terrain Inspector & Slope Heatmap
  isTerrainInspectorActive: boolean;
  inspectedPoint: InspectionPoint | null;
  slopeThresholdDeg: number;

  // Phase 5: Distance Measurement Tool
  isMeasureMode: boolean;
  measurePoints: MarsCoordinate[];

  // Phase 5: Mission Replay
  isMissionReplayPlaying: boolean;
  replayProgress: number; // 0.0 to 1.0
  replaySpeed: number; // 1, 2, 5

  // Phase 5: Cinematic Landing
  isCinematicLanding: boolean;
  cinematicStage: { stageIndex: number; telemetryText: string };

  // Phase 5: Layer Manager & Opacity
  showLayerManagerModal: boolean;
  layerOpacity: { satellite: number; hypsometric: number; slope: number };

  // Route Planning State (Phase 3 Multi-Profile)
  routeStart: MarsCoordinate | null;
  routeEnd: MarsCoordinate | null;
  selectedRouteProfile: RouteProfile;
  currentRoute: MarsRoute | null;
  alternativeRoutes: { direct?: MarsRoute; safe?: MarsRoute; science?: MarsRoute };
  isCalculatingRoute: boolean;

  // Phase 3 Science & Mission Simulation
  sciencePoints: SciencePoint[];
  selectedSciencePoint: SciencePoint | null;
  missionEstimate: MissionEstimate | null;

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
  setSunTimeMode: (time: SunTimeMode) => void;
  toggleSciencePoints: () => void;
  toggleElevationProfile: () => void;

  // Phase 5 Actions
  toggleAstronautMode: () => void;
  setAstronautMode: (active: boolean) => void;
  setAstronautPose: (pose: Partial<AstronautPose>) => void;
  toggleHelmetHUD: () => void;
  toggleMinimap: () => void;
  toggleTerrainInspector: () => void;
  setInspectedPoint: (point: InspectionPoint | null) => void;
  setSlopeThresholdDeg: (val: number) => void;

  toggleMeasureMode: () => void;
  addMeasurePoint: (c: MarsCoordinate) => void;
  clearMeasure: () => void;

  toggleMissionReplay: () => void;
  setReplayProgress: (val: number) => void;
  setReplaySpeed: (val: number) => void;

  startCinematicLanding: () => void;
  cancelCinematicLanding: () => void;
  setCinematicStage: (stage: { stageIndex: number; telemetryText: string }) => void;

  setShowLayerManagerModal: (open: boolean) => void;
  setLayerOpacity: (layer: 'satellite' | 'hypsometric' | 'slope', opacity: number) => void;

  // Route Planning Actions
  setRoutePoint: (coord: MarsCoordinate) => void;
  clearRoute: () => void;
  calculateRoute: () => Promise<void>;
  selectRouteProfile: (profile: RouteProfile) => Promise<void>;

  // Science Points Actions
  loadSciencePoints: () => Promise<void>;
  selectSciencePoint: (point: SciencePoint | null) => void;
  routeToSciencePoint: (point: SciencePoint) => void;
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
  sunTimeMode: 'morning',
  showSciencePoints: true,
  showElevationProfile: true,

  // Phase 5 State Initializers
  isAstronautMode: false,
  astronautPose: { x: 0, y: -0.5, z: 0.1, headingDeg: 0, pitchDeg: 0, speed: 0 },
  showHelmetHUD: true,
  showMinimap: true,
  isTerrainInspectorActive: false,
  inspectedPoint: null,
  slopeThresholdDeg: 15,
  isMeasureMode: false,
  measurePoints: [],
  isMissionReplayPlaying: false,
  replayProgress: 0.0,
  replaySpeed: 1,
  isCinematicLanding: false,
  cinematicStage: { stageIndex: 1, telemetryText: 'ENTRY INTERFACE INITIATED' },
  showLayerManagerModal: false,
  layerOpacity: { satellite: 1.0, hypsometric: 1.0, slope: 1.0 },

  routeStart: { latitude: 18.4276, longitude: 77.4516, elevationMeters: -2583 },
  routeEnd: { latitude: 18.4438, longitude: 77.4542, elevationMeters: -2560 },
  selectedRouteProfile: 'direct',
  currentRoute: null,
  alternativeRoutes: {},
  isCalculatingRoute: false,

  sciencePoints: [],
  selectedSciencePoint: null,
  missionEstimate: null,

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
  setSunTimeMode: (time) => set({ sunTimeMode: time }),
  toggleSciencePoints: () => set((state) => ({ showSciencePoints: !state.showSciencePoints })),
  toggleElevationProfile: () => set((state) => ({ showElevationProfile: !state.showElevationProfile })),

  setRoutePoint: (coord: MarsCoordinate) => {
    const { routeStart, routeEnd } = get();
    if (!routeStart || (routeStart && routeEnd)) {
      set({ 
        routeStart: coord, 
        routeEnd: null, 
        currentRoute: null, 
        alternativeRoutes: {}, 
        missionEstimate: null 
      });
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
      alternativeRoutes: {},
      missionEstimate: null,
    }),

  calculateRoute: async () => {
    const { routeStart, routeEnd, sciencePoints, selectedRouteProfile } = get();
    if (!routeStart || !routeEnd) return;

    set({ isCalculatingRoute: true });
    try {
      const nearestScience = sciencePoints[0]?.location;
      const alternatives = await requestRouteAlternatives(routeStart, routeEnd, nearestScience);
      const active = alternatives[selectedRouteProfile] || alternatives.direct;
      const estimate = await simulateMission(active, 2);

      set({ 
        alternativeRoutes: alternatives,
        currentRoute: active, 
        missionEstimate: estimate, 
        isCalculatingRoute: false 
      });
    } catch {
      set({ isCalculatingRoute: false });
    }
  },

  selectRouteProfile: async (profile: RouteProfile) => {
    const { alternativeRoutes } = get();
    const targetRoute = alternativeRoutes[profile];
    if (!targetRoute) return;

    set({ selectedRouteProfile: profile, currentRoute: targetRoute });
    try {
      const estimate = await simulateMission(targetRoute, 2);
      set({ missionEstimate: estimate });
    } catch {
      // ignore
    }
  },

  loadSciencePoints: async () => {
    const points = await fetchSciencePoints();
    set({ sciencePoints: points });
  },

  selectSciencePoint: (point) => set({ selectedSciencePoint: point }),

  routeToSciencePoint: (point) => {
    const { routeStart } = get();
    const start = routeStart || { latitude: 18.4276, longitude: 77.4516, elevationMeters: -2583 };
    set({
      routeStart: start,
      routeEnd: point.location,
      selectedSciencePoint: point,
    });
    get().calculateRoute();
  },

  // Phase 5 Action Implementations
  toggleAstronautMode: () => {
    const next = !get().isAstronautMode;
    set({ 
      isAstronautMode: next, 
      activeView: next ? 'terrain_prototype' : get().activeView,
      isAutoRotating: false,
    });
  },
  setAstronautMode: (active) => set({ 
    isAstronautMode: active,
    activeView: active ? 'terrain_prototype' : get().activeView,
    isAutoRotating: false,
  }),
  setAstronautPose: (pose) => set((state) => ({ 
    astronautPose: { ...state.astronautPose, ...pose } 
  })),
  toggleHelmetHUD: () => set((state) => ({ showHelmetHUD: !state.showHelmetHUD })),
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
  toggleTerrainInspector: () => set((state) => ({ 
    isTerrainInspectorActive: !state.isTerrainInspectorActive,
    inspectedPoint: null,
    isMeasureMode: false,
  })),
  setInspectedPoint: (point) => set({ inspectedPoint: point }),
  setSlopeThresholdDeg: (val) => set({ slopeThresholdDeg: val }),

  toggleMeasureMode: () => set((state) => ({ 
    isMeasureMode: !state.isMeasureMode,
    measurePoints: [],
    isTerrainInspectorActive: false,
  })),
  addMeasurePoint: (c) => set((state) => {
    if (state.measurePoints.length >= 2) {
      return { measurePoints: [c] };
    }
    return { measurePoints: [...state.measurePoints, c] };
  }),
  clearMeasure: () => set({ measurePoints: [] }),

  toggleMissionReplay: () => set((state) => ({ 
    isMissionReplayPlaying: !state.isMissionReplayPlaying,
    activeView: 'terrain_prototype',
  })),
  setReplayProgress: (val) => set({ replayProgress: Math.max(0, Math.min(1, val)) }),
  setReplaySpeed: (val) => set({ replaySpeed: val }),

  startCinematicLanding: () => set({
    isCinematicLanding: true,
    activeView: 'globe',
    selectedLandmark: null,
    isAutoRotating: false,
    cinematicStage: { stageIndex: 1, telemetryText: 'ENTRY INTERFACE INITIATED' },
  }),
  cancelCinematicLanding: () => set({ isCinematicLanding: false }),
  setCinematicStage: (stage) => set({ cinematicStage: stage }),

  setShowLayerManagerModal: (open) => set({ showLayerManagerModal: open }),
  setLayerOpacity: (layer, opacity) => set((state) => ({
    layerOpacity: { ...state.layerOpacity, [layer]: opacity }
  })),
}));
