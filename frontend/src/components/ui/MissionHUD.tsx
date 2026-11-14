'use client';

import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import { Landmark } from '@/types/mars';
import { 
  RotateCw, 
  Globe2, 
  Compass, 
  MapPin, 
  ShieldAlert, 
  Crosshair, 
  Radio, 
  Navigation,
  ChevronRight
} from 'lucide-react';

export default function MissionHUD() {
  const cameraDistance = useMissionStore((state) => state.cameraDistance);
  const isAutoRotating = useMissionStore((state) => state.isAutoRotating);
  const toggleAutoRotate = useMissionStore((state) => state.toggleAutoRotate);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const resetToOrbit = useMissionStore((state) => state.resetToOrbit);

  // Scaled altitude in kilometers (Mars mean radius = 3,389.5 km, scene radius = 2.0)
  const altitudeKm = Math.max(0, Math.round(((cameraDistance - 2.0) / 2.0) * 3389.5));

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
                DEV A // 3D ENGINE
              </span>
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>ORBITAL RECONNAISSANCE</span>
              <span>•</span>
              <span className="text-emerald-400">TELEMETRY NOMINAL</span>
            </div>
          </div>
        </div>

        {/* Real-time Telemetry Readout */}
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <div>
              <span className="text-zinc-500 block text-[10px]">ALTITUDE</span>
              <span className="font-semibold text-sky-300 font-mono">
                {altitudeKm.toLocaleString()} KM
              </span>
            </div>
          </div>

          <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <span className="text-zinc-500 block text-[10px]">TILT</span>
              <span className="font-semibold text-amber-300">25.19° (AXIAL)</span>
            </div>
          </div>

          <div className="bg-black/60 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            <div>
              <span className="text-zinc-500 block text-[10px]">CURRENT TARGET</span>
              <span className="font-semibold text-white">
                {selectedLandmark ? selectedLandmark.name : 'GLOBAL ORBIT'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Center Left: Landmark Details Card (if selected) */}
      <div className="flex-1 flex items-center justify-between py-6">
        {selectedLandmark && (
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

              {selectedLandmark.coordinate.elevationMeters !== undefined && (
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
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 font-semibold transition"
                >
                  Back to Orbit
                </button>
                <div className="flex items-center text-[11px] text-amber-400/90 font-medium px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
                  Phase 2: 3D DEM Ready
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Command Dock */}
      <footer className="pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/60 p-3 backdrop-blur-md">
        {/* Preset Navigation Targets */}
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

        {/* Quick Camera & State Actions */}
        <div className="flex items-center gap-2">
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

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-500 px-2 py-1">
            <span>🖱️ Drag to rotate • Scroll to zoom</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
