'use client';

import { useEffect } from 'react';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
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
  Activity,
  Flame,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock
} from 'lucide-react';

export default function MissionHUD() {
  const activeView = useMissionStore((state) => state.activeView);
  const setActiveView = useMissionStore((state) => state.setActiveView);
  const cameraDistance = useMissionStore((state) => state.cameraDistance);
  const isAutoRotating = useMissionStore((state) => state.isAutoRotating);
  const toggleAutoRotate = useMissionStore((state) => state.toggleAutoRotate);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const resetToOrbit = useMissionStore((state) => state.resetToOrbit);

  // Terrain Controls
  const terrainWireframe = useMissionStore((state) => state.terrainWireframe);
  const toggleTerrainWireframe = useMissionStore((state) => state.toggleTerrainWireframe);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const setTerrainExaggeration = useMissionStore((state) => state.setTerrainExaggeration);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setTerrainColorMode = useMissionStore((state) => state.setTerrainColorMode);

  // Route Planning State
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const isCalculatingRoute = useMissionStore((state) => state.isCalculatingRoute);
  const calculateRoute = useMissionStore((state) => state.calculateRoute);
  const clearRoute = useMissionStore((state) => state.clearRoute);

  // Calculate default demo route once terrain is entered
  useEffect(() => {
    if (activeView === 'terrain_prototype' && !currentRoute && routeStart && routeEnd) {
      calculateRoute();
    }
  }, [activeView, currentRoute, routeStart, routeEnd, calculateRoute]);

  // Scaled altitude in kilometers
  const altitudeKm = Math.max(0, Math.round(((cameraDistance - 2.0) / 2.0) * 3389.5));

  // Pandolf Energy calculation: Watts to kcal (1 Watt * 1 sec = 1 Joule, 4184 J = 1 kcal)
  const durationSeconds = currentRoute?.estimatedDurationSeconds ?? 0;
  const estimatedKcal = Math.round((285 * durationSeconds) / 4184);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6 text-zinc-200 font-mono select-none">
      {/* Top Header & Telemetry Bar */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-4 backdrop-blur-sm bg-black/40 px-4 py-3 rounded-lg">
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
                {activeView === 'globe' ? 'DEV A // PLANET ENGINE' : 'DEV A // ROUTING & TERRAIN ENGINE'}
              </span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>{activeView === 'globe' ? 'ORBITAL RECONNAISSANCE' : 'EVA MISSION PLANNING'}</span>
              <span>•</span>
              <span className="text-emerald-400">TELEMETRY NOMINAL</span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="pointer-events-auto flex items-center rounded-lg border border-zinc-800 bg-black/70 p-1">
          <button
            onClick={() => setActiveView('globe')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition ${
              activeView === 'globe'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>3D Mars Globe</span>
          </button>

          <button
            onClick={() => setActiveView('terrain_prototype')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition ${
              activeView === 'terrain_prototype'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/40'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Jezero 3D Terrain & Routing</span>
          </button>
        </div>

        {/* Real-time Telemetry Readout */}
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
        </div>
      </header>

      {/* Center Section: Context Cards & Route Planning Panel */}
      <div className="flex-1 flex items-center justify-between py-4">
        {/* Globe View: Landmark Inspector */}
        {activeView === 'globe' && selectedLandmark && (
          <aside className="pointer-events-auto w-80 md:w-96 rounded-xl border border-sky-500/30 bg-black/85 p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-left duration-200">
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

        {/* Terrain Mode: Left Panel (Layers & Mesh Controls) */}
        {activeView === 'terrain_prototype' && (
          <aside className="pointer-events-auto w-72 md:w-80 rounded-xl border border-sky-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Mountain className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Terrain & Layers
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                256² Tiles Ready
              </span>
            </div>

            <div className="mt-3 text-xs space-y-3">
              {/* Layer Selection */}
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1.5">
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

              {/* Wireframe Toggle */}
              <div className="rounded bg-zinc-900/80 p-2.5 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-white">Wireframe Mesh</span>
                </div>
                <button
                  onClick={toggleTerrainWireframe}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold border transition ${
                    terrainWireframe
                      ? 'bg-amber-500 border-amber-400 text-black'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                  }`}
                >
                  {terrainWireframe ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Elevation Exaggeration */}
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1">
                  Relief Scaling ({terrainExaggeration}x)
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[1.0, 1.5, 2.5].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setTerrainExaggeration(scale)}
                      className={`py-1 rounded text-xs font-semibold border transition ${
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

              {/* Coordinate info */}
              <div className="rounded bg-black/60 p-2 border border-zinc-800 text-[10px] text-zinc-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Jezero Datum:</span>
                  <span className="text-zinc-200">MOLA Areoid 0m</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Safe Slope:</span>
                  <span className="text-red-400 font-semibold">15.0° (Pandolf)</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Terrain Mode: Right Panel (Interactive Route Planner) */}
        {activeView === 'terrain_prototype' && (
          <aside className="pointer-events-auto w-80 md:w-96 rounded-xl border border-sky-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                  Marswalk Routing Engine
                </span>
              </div>
              <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">
                A* Engine Active
              </span>
            </div>

            <div className="mt-3 text-xs space-y-3">
              <div className="rounded bg-sky-950/40 border border-sky-500/30 p-2.5 text-[11px] text-sky-200 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Click directly on the 3D terrain to place <strong>Start</strong> and <strong>Destination</strong>.</span>
              </div>

              {/* Waypoint Coordinates Readout */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                  <span className="text-[10px] text-emerald-400 font-semibold block flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> START POINT
                  </span>
                  <span className="text-zinc-300 font-mono text-[11px]">
                    {routeStart ? `${routeStart.latitude.toFixed(3)}°N, ${routeStart.longitude.toFixed(3)}°E` : 'Select on map...'}
                  </span>
                </div>
                <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                  <span className="text-[10px] text-red-400 font-semibold block flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> DESTINATION
                  </span>
                  <span className="text-zinc-300 font-mono text-[11px]">
                    {routeEnd ? `${routeEnd.latitude.toFixed(3)}°N, ${routeEnd.longitude.toFixed(3)}°E` : 'Select on map...'}
                  </span>
                </div>
              </div>

              {/* Calculated Metrics */}
              {currentRoute && (
                <div className="space-y-2 rounded bg-zinc-950/80 p-3 border border-zinc-800">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-sky-400" /> DISTANCE
                      </span>
                      <span className="text-base font-bold text-white font-mono">
                        {(currentRoute.distanceMeters / 1000).toFixed(2)} km
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        ({currentRoute.distanceMeters.toLocaleString()} m)
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" /> EVA TIME
                      </span>
                      <span className="text-base font-bold text-amber-300 font-mono">
                        {Math.floor(durationSeconds / 3600)}h {Math.floor((durationSeconds % 3600) / 60)}m
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        @ 3.0 km/h NASA pace
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-400" /> RISK SCORE
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`font-bold ${currentRoute.riskScore > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {(currentRoute.riskScore * 100).toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div 
                            className={`h-full ${currentRoute.riskScore > 0.5 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(100, currentRoute.riskScore * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" /> ENERGY (PANDOLF)
                      </span>
                      <span className="font-bold text-yellow-300 font-mono">
                        {estimatedKcal.toLocaleString()} kcal
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        (avg. 285 W exertion)
                      </span>
                    </div>
                  </div>
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
                  <span>{isCalculatingRoute ? 'Calculating A*...' : 'Calculate Route'}</span>
                </button>
                <button
                  onClick={clearRoute}
                  className="rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-3 text-zinc-400 hover:text-white text-xs transition"
                >
                  Reset
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Command Dock */}
      <footer className="pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/60 p-3 backdrop-blur-md">
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
              Active Mode: 3D Marswalk Planning on Jezero Crater Western Delta
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
            <span>🖱️ Click terrain to place waypoints • Drag to rotate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
