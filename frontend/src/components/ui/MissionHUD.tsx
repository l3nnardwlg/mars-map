'use client';

import { useEffect, useState } from 'react';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import ElevationProfileChart from './ElevationProfileChart';
import Minimap from './Minimap';
import AstronautHUD from './AstronautHUD';
import TerrainInspector from './TerrainInspector';
import LayerManagerModal from './LayerManagerModal';
import MissionReplayControls from './MissionReplayControls';
import GuidedJuryTour from './GuidedJuryTour';
import { 
  RotateCw, 
  Globe2, 
  Compass, 
  MapPin, 
  Mountain, 
  Layers, 
  Crosshair, 
  Radio, 
  Grid3X3,
  Navigation,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock,
  ShieldCheck,
  FlaskConical,
  Sun,
  FileText,
  Check,
  Info,
  X,
  Footprints,
  Rocket,
  Play,
  Ruler,
  Sliders,
  Map as MapIcon
} from 'lucide-react';

export default function MissionHUD() {
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [showAttributionModal, setShowAttributionModal] = useState(false);

  const activeView = useMissionStore((state) => state.activeView);
  const setActiveView = useMissionStore((state) => state.setActiveView);
  const cameraDistance = useMissionStore((state) => state.cameraDistance);
  const isAutoRotating = useMissionStore((state) => state.isAutoRotating);
  const toggleAutoRotate = useMissionStore((state) => state.toggleAutoRotate);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const resetToOrbit = useMissionStore((state) => state.resetToOrbit);

  // Terrain & Environment Controls
  const terrainWireframe = useMissionStore((state) => state.terrainWireframe);
  const toggleTerrainWireframe = useMissionStore((state) => state.toggleTerrainWireframe);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const setTerrainExaggeration = useMissionStore((state) => state.setTerrainExaggeration);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setTerrainColorMode = useMissionStore((state) => state.setTerrainColorMode);
  const sunTimeMode = useMissionStore((state) => state.sunTimeMode);
  const setSunTimeMode = useMissionStore((state) => state.setSunTimeMode);
  const showSciencePoints = useMissionStore((state) => state.showSciencePoints);
  const toggleSciencePoints = useMissionStore((state) => state.toggleSciencePoints);

  // Route Planning State & Alternatives
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const selectedRouteProfile = useMissionStore((state) => state.selectedRouteProfile);
  const selectRouteProfile = useMissionStore((state) => state.selectRouteProfile);
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const missionEstimate = useMissionStore((state) => state.missionEstimate);
  const isCalculatingRoute = useMissionStore((state) => state.isCalculatingRoute);
  const calculateRoute = useMissionStore((state) => state.calculateRoute);
  const clearRoute = useMissionStore((state) => state.clearRoute);

  // Phase 5 State & Actions
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const toggleAstronautMode = useMissionStore((state) => state.toggleAstronautMode);
  const isTerrainInspectorActive = useMissionStore((state) => state.isTerrainInspectorActive);
  const toggleTerrainInspector = useMissionStore((state) => state.toggleTerrainInspector);
  const isMeasureMode = useMissionStore((state) => state.isMeasureMode);
  const toggleMeasureMode = useMissionStore((state) => state.toggleMeasureMode);
  const isMissionReplayPlaying = useMissionStore((state) => state.isMissionReplayPlaying);
  const toggleMissionReplay = useMissionStore((state) => state.toggleMissionReplay);
  const startCinematicLanding = useMissionStore((state) => state.startCinematicLanding);
  const setShowLayerManagerModal = useMissionStore((state) => state.setShowLayerManagerModal);
  const showMinimap = useMissionStore((state) => state.showMinimap);
  const toggleMinimap = useMissionStore((state) => state.toggleMinimap);
  const fpsMetrics = useMissionStore((state) => state.fpsMetrics);

  // Keyboard Shortcuts (P3 feature)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        setActiveView('globe');
      } else if (e.key === '2') {
        setActiveView('terrain_prototype');
      } else if (e.key === '3') {
        toggleAstronautMode();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMinimap();
      } else if (e.key === 'i' || e.key === 'I') {
        toggleTerrainInspector();
      } else if (e.key === 'r' || e.key === 'R') {
        toggleMissionReplay();
      } else if (e.key === 'l' || e.key === 'L') {
        setShowLayerManagerModal(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveView, toggleAstronautMode, toggleMinimap, toggleTerrainInspector, toggleMissionReplay, setShowLayerManagerModal]);

  // Auto-calculate on mount if not yet generated
  useEffect(() => {
    if (activeView === 'terrain_prototype' && !currentRoute && routeStart && routeEnd) {
      calculateRoute();
    }
  }, [activeView, currentRoute, routeStart, routeEnd, calculateRoute]);

  const altitudeKm = Math.max(0, Math.round(((cameraDistance - 2.0) / 2.0) * 3389.5));
  const durationSeconds = currentRoute?.estimatedDurationSeconds ?? 0;
  const estimatedKcal = Math.round((285 * durationSeconds) / 4184);

  // Export Briefing to Clipboard
  const handleCopyBriefing = () => {
    if (!currentRoute) return;
    const text = `=== NASA MARS PATHFINDER // EVA-01 BRIEFING ===
Target: Jezero Crater (Western Delta)
Profile: ${selectedRouteProfile.toUpperCase()}
Start: ${routeStart?.latitude.toFixed(4)}°N, ${routeStart?.longitude.toFixed(4)}°E
Destination: ${routeEnd?.latitude.toFixed(4)}°N, ${routeEnd?.longitude.toFixed(4)}°E
Total Distance: ${(currentRoute.distanceMeters / 1000).toFixed(2)} km
Estimated Duration: ${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m
Metabolic Power: ${currentRoute.averagePowerWatts ?? 285} W (Pandolf)
Risk Score: ${(currentRoute.riskScore * 100).toFixed(1)}%
O2 Requirement: ${missionEstimate?.oxygenLiters ?? 0} L (${missionEstimate?.oxygenKilograms ?? 0} kg)
EVA Limit: ${missionEstimate?.withinEvaTimeLimit ? 'NOMINAL (< 8h)' : 'EXCEEDED (> 8h)'}
Datum: IAU Mars 2000 / MOLA Areoid
=================================================`;
    navigator.clipboard.writeText(text);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2500);
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 md:p-5 text-zinc-200 font-mono select-none">
      {/* Top Header & Telemetry Bar */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-3 backdrop-blur-sm bg-black/40 px-4 py-2.5 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-widest uppercase text-white">
                MARS PATHFINDER
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activeView === 'globe' ? 'DEV A // PLANET ENGINE' : 'PHASE 3 // MISSION CONTROL DASHBOARD'}
              </span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>{activeView === 'globe' ? 'ORBITAL RECONNAISSANCE' : 'EVA TRAVERSE PLANNING'}</span>
              <span>•</span>
              <span className="text-emerald-400">TELEMETRY NOMINAL</span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="pointer-events-auto flex items-center rounded-lg border border-zinc-800 bg-black/70 p-1 gap-1">
          <button
            onClick={() => {
              if (isAstronautMode) toggleAstronautMode();
              setActiveView('globe');
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition ${
              activeView === 'globe'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Press '1' for Orbit"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D Globe</span>
          </button>

          <button
            onClick={() => {
              if (isAstronautMode) toggleAstronautMode();
              setActiveView('terrain_prototype');
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition ${
              activeView === 'terrain_prototype' && !isAstronautMode
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/40'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Press '2' for Jezero Terrain"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Jezero Terrain</span>
          </button>

          <button
            onClick={toggleAstronautMode}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition ${
              isAstronautMode
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40 animate-pulse'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="First-Person Helmet Mode (Press '3')"
          >
            <Footprints className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Astronaut Mode</span>
          </button>

          <button
            onClick={startCinematicLanding}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Atmospheric Entry & Touchdown"
          >
            <Rocket className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden md:inline">Cinematic Landing</span>
          </button>
        </div>

        {/* Telemetry Readout */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <div>
              <span className="text-zinc-500 block text-[10px]">
                {activeView === 'globe' ? 'ALTITUDE' : 'SURFACE ELEVATION'}
              </span>
              <span className="font-semibold text-sky-300 font-mono">
                {activeView === 'globe' ? `${altitudeKm.toLocaleString()} KM` : '-2,400 M (DATUM)'}
              </span>
            </div>
          </div>

          <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <span className="text-zinc-500 block text-[10px]">COORDINATE DATUM</span>
              <span className="font-semibold text-amber-300">IAU MARS 2000 (EAST+)</span>
            </div>
          </div>

          {/* Real-Time Live Measured FPS & GPU Telemetry */}
          <div className="bg-black/60 border border-zinc-800 rounded px-2.5 py-1.5 hidden md:flex items-center gap-2 font-mono">
            <div className={`w-2 h-2 rounded-full ${fpsMetrics.fps >= 55 ? 'bg-emerald-400' : fpsMetrics.fps >= 30 ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`} />
            <div>
              <span className="text-zinc-500 block text-[9px] uppercase tracking-wider">LIVE GPU RENDER</span>
              <span className="font-semibold text-emerald-300 text-xs">
                {fpsMetrics.fps} FPS <span className="text-zinc-500 text-[10px]">({fpsMetrics.frameTimeMs} ms)</span>
              </span>
            </div>
          </div>

          {/* NASA Data & Scientific Attribution Button */}
          <button
            onClick={() => setShowAttributionModal(true)}
            className="pointer-events-auto bg-black/60 hover:bg-zinc-800 border border-zinc-700/80 rounded px-3 py-1.5 flex items-center gap-2 text-zinc-300 hover:text-white transition group shadow-md"
            title="Scientific Data Sources & Attribution"
          >
            <Info className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition" />
            <div className="text-left hidden sm:block">
              <span className="text-zinc-500 block text-[10px]">SCIENCE</span>
              <span className="font-semibold text-sky-300 text-xs">NASA & ESA Data</span>
            </div>
          </button>

          {/* Phase 5 P2: Space Apps Jury Guided Tour Button */}
          <GuidedJuryTour />
        </div>
      </header>

      {/* Center Section: Context Cards & HUD Sidebars */}
      <div className="flex-1 flex items-start justify-between py-3 overflow-hidden gap-3">
        {/* Globe View: Landmark Inspector */}
        {activeView === 'globe' && selectedLandmark && (
          <aside className="pointer-events-auto w-80 md:w-96 rounded-xl border border-sky-500/30 bg-black/85 p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-left duration-200 mt-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Surface Target
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                NASA PDS / MOLA
              </span>
            </div>

            <div className="mt-3">
              <h2 className="text-lg font-bold text-white tracking-wide">
                {selectedLandmark.name}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">LATITUDE</span>
                  <span className="text-sky-200 font-semibold">
                    {selectedLandmark.coordinate.latitude}°
                  </span>
                </div>
                <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">LONGITUDE</span>
                  <span className="text-sky-200 font-semibold">
                    {selectedLandmark.coordinate.longitude}°E
                  </span>
                </div>
              </div>

              {selectedLandmark.coordinate.elevationMeters != null && (
                <div className="mt-2 rounded bg-zinc-900/80 p-2 border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-400 block">ELEVATION (DATUM)</span>
                  <span className="text-amber-300 font-semibold">
                    {selectedLandmark.coordinate.elevationMeters > 0 ? '+' : ''}
                    {selectedLandmark.coordinate.elevationMeters.toLocaleString()} M
                  </span>
                </div>
              )}

              <p className="mt-3 text-xs leading-relaxed text-zinc-300 bg-zinc-950/60 p-2.5 rounded border border-zinc-900">
                {selectedLandmark.description}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={resetToOrbit}
                  className="rounded border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 font-semibold transition"
                >
                  Back to Orbit
                </button>
                {selectedLandmark.id === 'jezero' && (
                  <button
                    onClick={() => setActiveView('terrain_prototype')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 text-xs shadow-lg shadow-sky-600/30 transition"
                  >
                    <Mountain className="w-3.5 h-3.5" />
                    <span>Plan Marswalk Route</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Terrain Mode: Left Panel (Layers & Sol Environment Controls) */}
        {activeView === 'terrain_prototype' && (
          <aside className="pointer-events-auto w-72 md:w-80 rounded-xl border border-sky-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-left duration-200 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Layers & Sol Time
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Interactive
              </span>
            </div>

            {/* Layer Selection */}
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1">
                Surface Visualization
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  onClick={() => setTerrainColorMode('satellite')}
                  className={`py-1.5 px-1 rounded font-semibold border transition text-center ${
                    terrainColorMode === 'satellite'
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Ortho
                </button>
                <button
                  onClick={() => setTerrainColorMode('hypsometric')}
                  className={`py-1.5 px-1 rounded font-semibold border transition text-center ${
                    terrainColorMode === 'hypsometric'
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Elevation
                </button>
                <button
                  onClick={() => setTerrainColorMode('slope')}
                  className={`py-1.5 px-1 rounded font-semibold border transition text-center ${
                    terrainColorMode === 'slope'
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Risk &gt;15°
                </button>
              </div>
            </div>

            {/* Sun / Mars Sol Time */}
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400" /> Mars Sol Lighting
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {(['morning', 'noon', 'evening'] as const).map((time) => (
                  <button
                    key={time}
                    onClick={() => setSunTimeMode(time)}
                    className={`py-1 px-1 rounded font-semibold border capitalize transition ${
                      sunTimeMode === time
                        ? 'bg-amber-500 border-amber-400 text-black'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={toggleTerrainWireframe}
                className={`py-1.5 px-2 rounded font-semibold border transition flex items-center justify-center gap-1.5 ${
                  terrainWireframe
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3 h-3" />
                <span>Wireframe</span>
              </button>

              <button
                onClick={toggleSciencePoints}
                className={`py-1.5 px-2 rounded font-semibold border transition flex items-center justify-center gap-1.5 ${
                  showSciencePoints
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3 h-3 text-amber-400" />
                <span>Samples</span>
              </button>
            </div>

            {/* Relief Scaling */}
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1">
                Relief Exaggeration ({terrainExaggeration}x)
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                {[1.0, 1.5, 2.5].map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setTerrainExaggeration(scale)}
                    className={`py-1 rounded font-semibold border transition ${
                      terrainExaggeration === scale
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {scale.toFixed(1)}x
                  </button>
                ))}
              </div>
            </div>

            {/* Phase 5: Advanced Tactical Tools */}
            <div className="border-t border-zinc-800 pt-2 space-y-1.5">
              <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">
                Tactical Tools & Overlays
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {/* Terrain Inspector */}
                <button
                  onClick={toggleTerrainInspector}
                  className={`py-1.5 px-2 rounded font-semibold border transition flex items-center gap-1.5 ${
                    isTerrainInspectorActive
                      ? 'bg-sky-500/30 border-sky-400 text-sky-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Analyze slope & elevation at any point (Press 'I')"
                >
                  <Crosshair className="w-3 h-3 text-sky-400" />
                  <span>Inspector [I]</span>
                </button>

                {/* Laser Distance Ruler */}
                <button
                  onClick={toggleMeasureMode}
                  className={`py-1.5 px-2 rounded font-semibold border transition flex items-center gap-1.5 ${
                    isMeasureMode
                      ? 'bg-pink-500/30 border-pink-400 text-pink-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Measure 3D distance between 2 points"
                >
                  <Ruler className="w-3 h-3 text-pink-400" />
                  <span>Ruler</span>
                </button>

                {/* Layer Manager Modal */}
                <button
                  onClick={() => setShowLayerManagerModal(true)}
                  className="py-1.5 px-2 rounded font-semibold border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition flex items-center gap-1.5"
                  title="Configure NASA layers, opacities & legends (Press 'L')"
                >
                  <Sliders className="w-3 h-3 text-amber-400" />
                  <span>Layers [L]</span>
                </button>

                {/* Minimap Toggle */}
                <button
                  onClick={toggleMinimap}
                  className={`py-1.5 px-2 rounded font-semibold border transition flex items-center gap-1.5 ${
                    showMinimap
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Toggle 2D Jezero Radar (Press 'M')"
                >
                  <MapIcon className="w-3 h-3 text-cyan-400" />
                  <span>Radar [M]</span>
                </button>
              </div>

              {/* Mission Replay Button */}
              {currentRoute && (
                <button
                  onClick={toggleMissionReplay}
                  className={`w-full py-1.5 px-2 rounded-lg font-semibold border transition flex items-center justify-center gap-2 text-xs mt-1 ${
                    isMissionReplayPlaying
                      ? 'bg-cyan-600 border-cyan-400 text-white animate-pulse'
                      : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/80'
                  }`}
                  title="Replay Marswalk Route (Press 'R')"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isMissionReplayPlaying ? 'Pause Marswalk Replay' : 'Replay Marswalk Route [R]'}</span>
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Terrain Mode: Right Column (Route Planner & Elevation Cross-Section) */}
        {activeView === 'terrain_prototype' && (
          <div className="flex flex-col items-end gap-3 max-h-[82vh] overflow-y-auto pr-1">
            {/* Route Planning Card */}
            <aside className="pointer-events-auto w-80 md:w-96 rounded-xl border border-sky-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                    Mission Routing & Life-Support
                  </span>
                </div>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">
                  A* Pandolf
                </span>
              </div>

              <div className="mt-2.5 text-xs space-y-2.5">
                {/* Waypoint Coordinates Readout */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> START POINT
                    </span>
                    <span className="text-zinc-300 font-mono text-[11px] block mt-0.5">
                      {routeStart ? `${routeStart.latitude.toFixed(3)}°N, ${routeStart.longitude.toFixed(3)}°E` : 'Click terrain...'}
                    </span>
                  </div>
                  <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                    <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> DESTINATION
                    </span>
                    <span className="text-zinc-300 font-mono text-[11px] block mt-0.5">
                      {routeEnd ? `${routeEnd.latitude.toFixed(3)}°N, ${routeEnd.longitude.toFixed(3)}°E` : 'Click terrain...'}
                    </span>
                  </div>
                </div>

                {/* Phase 3: Route Profile Alternatives Switcher */}
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1">
                    Route Alternatives
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <button
                      onClick={() => selectRouteProfile('direct')}
                      className={`p-1.5 rounded border text-left transition cursor-pointer ${
                        selectedRouteProfile === 'direct'
                          ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                          : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-sky-400" /> Direct
                      </div>
                      <div className="text-[9px] text-zinc-500">Shortest path</div>
                    </button>

                    <button
                      onClick={() => selectRouteProfile('safe')}
                      className={`p-1.5 rounded border text-left transition cursor-pointer ${
                        selectedRouteProfile === 'safe'
                          ? 'border-emerald-400 bg-emerald-950/80 text-emerald-200'
                          : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Safe
                      </div>
                      <div className="text-[9px] text-zinc-500">&lt;8° Slope</div>
                    </button>

                    <button
                      onClick={() => selectRouteProfile('science')}
                      className={`p-1.5 rounded border text-left transition cursor-pointer ${
                        selectedRouteProfile === 'science'
                          ? 'border-amber-400 bg-amber-950/80 text-amber-200'
                          : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1">
                        <FlaskConical className="w-3 h-3 text-amber-400" /> Science
                      </div>
                      <div className="text-[9px] text-zinc-500">Sample detour</div>
                    </button>
                  </div>

                  {/* Scientific Optimization Trade-Off Rationale */}
                  <div className="mt-2 rounded-lg bg-zinc-900/90 p-2 border border-zinc-800 text-[10px] space-y-1">
                    <div className="flex items-center justify-between text-zinc-400 font-semibold text-[9px]">
                      <span>OBJECTIVE RATIONALE:</span>
                      <span className="text-sky-300 uppercase font-mono">{selectedRouteProfile}</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed font-sans text-[10px]">
                      {selectedRouteProfile === 'safe'
                        ? '🛡️ SAFE TRAVERSE: Contours along low-gradient alluvial terrace (max slope <8.2°). Eliminates scarp rollover danger, saving ~140 kJ and keeping metabolic rate well within nominal 300W baseline.'
                        : selectedRouteProfile === 'science'
                        ? '🔬 SCIENCE EXPLORATION: Intelligent multi-objective detour to verified Perseverance Sample Return cores. Adds ~650m while maintaining safe EVA duration (<8 hrs).'
                        : '⚡ DIRECT LINE: Shortest Euclidean path. Ascends steep delta rim scarp (max slope >18°), creating a +35% metabolic spike and regolith slip risk.'}
                    </p>
                  </div>
                </div>

                {/* Calculated Metrics */}
                {currentRoute && (
                  <div className="space-y-2 rounded bg-zinc-950/80 p-2.5 border border-zinc-800">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-sky-400" /> DISTANCE
                        </span>
                        <span className="text-base font-bold text-white font-mono">
                          {(currentRoute.distanceMeters / 1000).toFixed(2)} km
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> EVA TIME
                        </span>
                        <span className="text-base font-bold text-amber-300 font-mono">
                          {Math.floor(durationSeconds / 3600)}h {Math.floor((durationSeconds % 3600) / 60)}m
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-900 pt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-orange-400" /> RISK SCORE
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`font-bold ${currentRoute.riskScore > 0.4 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {(currentRoute.riskScore * 100).toFixed(1)}%
                          </span>
                          {currentRoute.maxSlopeDeg !== undefined && (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              (Max {currentRoute.maxSlopeDeg}°)
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-400" /> ENERGY (PANDOLF)
                        </span>
                        <span className="font-bold text-yellow-300 font-mono">
                          {currentRoute.energyJoules ? `${Math.round(currentRoute.energyJoules / 4184).toLocaleString()} kcal` : `${estimatedKcal.toLocaleString()} kcal`}
                        </span>
                      </div>
                    </div>

                    {/* Data Source Provenance Badge */}
                    {currentRoute.dataSource && (
                      <div className="rounded bg-zinc-950 p-1.5 border border-zinc-800 text-[9px] text-zinc-400 flex items-center justify-between font-mono">
                        <span className="text-zinc-500">PROVENANCE:</span>
                        <span className="text-sky-300 font-semibold truncate ml-1">{currentRoute.dataSource}</span>
                      </div>
                    )}

                    {/* NASA EVA Life-Support Estimates */}
                    {missionEstimate && (
                      <div className="border-t border-zinc-900 pt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded bg-sky-950/40 border border-sky-500/20 p-2">
                          <span className="text-[9px] text-sky-400 font-semibold block">O₂ CONSUMPTION (2 CREW)</span>
                          <span className="font-bold text-white font-mono">{missionEstimate.oxygenLiters} L</span>
                          <span className="text-[9px] text-zinc-500 block">({missionEstimate.oxygenKilograms} kg)</span>
                        </div>
                        <div className="rounded bg-zinc-900/60 border border-zinc-800 p-2">
                          <span className="text-[9px] text-zinc-400 font-semibold block">EVA LIMIT (8H MAX)</span>
                          <span className={`font-bold font-mono ${missionEstimate.withinEvaTimeLimit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {missionEstimate.withinEvaTimeLimit ? '✅ WITHIN LIMIT' : '⚠️ EXCEEDS LIMIT'}
                          </span>
                          <span className="text-[9px] text-zinc-500 block">
                            {missionEstimate.withinAverageMetabolicRate ? 'Nominal exertion' : 'High exertion (>300W)'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => calculateRoute()}
                    disabled={!routeStart || !routeEnd || isCalculatingRoute}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold py-2 text-xs shadow-md shadow-sky-600/30 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalculatingRoute ? 'animate-spin' : ''}`} />
                    <span>{isCalculatingRoute ? 'Calculating...' : 'Recalculate Route'}</span>
                  </button>

                  <button
                    onClick={handleCopyBriefing}
                    disabled={!currentRoute}
                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 text-zinc-200 text-xs transition"
                    title="Export Mission Briefing to Clipboard"
                  >
                    {copiedBriefing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                    <span>{copiedBriefing ? 'Copied' : 'Briefing'}</span>
                  </button>

                  <button
                    onClick={clearRoute}
                    className="rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-2.5 text-zinc-400 hover:text-white text-xs transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </aside>

            {/* Terrain Elevation Cross-Section Chart */}
            <ElevationProfileChart />
          </div>
        )}
      </div>

      {/* Bottom Command Dock */}
      <footer className="pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/60 p-2.5 backdrop-blur-md">
        {activeView === 'globe' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={resetToOrbit}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition ${
                !selectedLandmark
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>Full Orbit</span>
            </button>

            <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden md:block" />

            {MARS_LANDMARKS.map((landmark) => {
              const isActive = selectedLandmark?.id === landmark.id;
              return (
                <button
                  key={landmark.id}
                  onClick={() => selectLandmark(landmark)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/30'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  <Crosshair className={`w-3 h-3 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  <span>{landmark.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('globe')}
              className="flex items-center gap-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 text-xs text-white font-semibold transition"
            >
              <Globe2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Back to Global Orbit</span>
            </button>
            <span className="text-xs text-zinc-400 hidden sm:inline">
              Active Mode: Jezero Crater Neretva Delta EVA Mission Planning
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {activeView === 'globe' && (
            <button
              onClick={toggleAutoRotate}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold border transition ${
                isAutoRotating
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <RotateCw className={`w-3 h-3 ${isAutoRotating ? 'animate-spin' : ''}`} />
              <span>{isAutoRotating ? 'Rotation: ON' : 'Rotation: PAUSED'}</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-500 px-2 py-1">
            <span>🖱️ Click terrain to set waypoints • Drag to pan</span>
          </div>
        </div>
      </footer>

      {/* Scientific Data & Attribution Modal */}
      {showAttributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-sky-500/40 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    NASA & ESA Scientific Data Attribution
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    NASA Space Apps Challenge: Interplanetary Survival Guide
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAttributionModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-zinc-300 max-h-[60vh] overflow-y-auto pr-1">
              <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-3.5">
                <div className="flex items-center justify-between font-semibold text-sky-300">
                  <span>1. Mars Orbiter Laser Altimeter (MOLA) Digital Elevation Model</span>
                  <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded">NASA PDS / GSFC</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px] leading-relaxed">
                  Provides global topographic heights and the MOLA Areoid reference datum (0 m elevation) under the IAU Mars 2000 planetocentric coordinate system (positive East longitude).
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-3.5">
                <div className="flex items-center justify-between font-semibold text-emerald-300">
                  <span>2. High Resolution Stereo Camera (HRSC) Jezero Crater Data</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">ESA / DLR / Freie Univ. Berlin</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px] leading-relaxed">
                  Authentic high-resolution orthomosaic imagery (2048x2048) and co-registered digital elevation model covering the Jezero Crater delta, Neretva Vallis breach, and ancient lakebed.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-3.5">
                <div className="flex items-center justify-between font-semibold text-amber-300">
                  <span>3. NASA Perseverance Rover Science Sample Cores</span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded">NASA Mars 2020 / JPL-Caltech</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px] leading-relaxed">
                  Actual Mars 2020 Perseverance science target coordinates including Roubion, Montdenier, Salette, Coulettes, and Skinner Ridge sample caches.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-3.5">
                <div className="flex items-center justify-between font-semibold text-yellow-300">
                  <span>4. Pandolf Human Metabolic & EVA Life-Support Model</span>
                  <span className="text-[10px] bg-yellow-950 text-yellow-400 border border-yellow-800 px-1.5 py-0.5 rounded">NASA JSC / USARIEM</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px] leading-relaxed">
                  Simulates astronaut metabolic energy expenditure W = 1.5W + ηW(1.5V² + 0.35VG), 80.7 kg suited mass (Integrated Suit Test 1), 3.0 km/h walking speed, oxygen consumption rates, and the 8-hour maximum safe EVA constraint.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowAttributionModal(false)}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 text-xs transition shadow-md"
              >
                Close Data Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5 Tactical HUD Overlays & Tools */}
      <Minimap />
      <AstronautHUD />
      <TerrainInspector />
      <LayerManagerModal />
      <MissionReplayControls />
    </div>
  );
}
