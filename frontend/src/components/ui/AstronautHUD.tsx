'use client';

import { useMemo } from 'react';
import { useMissionStore } from '@/store/useMissionStore';
import { getElevationMetersAtUV, sampleSlopeAtUV } from '@/utils/demSampler';
import { 
  Heart, 
  Wind, 
  ShieldAlert, 
  Compass, 
  Navigation, 
  Footprints, 
  X,
  Gauge,
  Thermometer
} from 'lucide-react';

export default function AstronautHUD() {
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const setAstronautMode = useMissionStore((state) => state.setAstronautMode);
  const showHelmetHUD = useMissionStore((state) => state.showHelmetHUD);
  const astronautPose = useMissionStore((state) => state.astronautPose);
  const currentRoute = useMissionStore((state) => state.currentRoute);

  // Derive real-time elevation and slope from astronaut's normalized position on terrain
  const { currentElevM, currentSlopeDeg, slopeRisk } = useMemo(() => {
    const u = astronautPose.x / 8.0 + 0.5;
    const v = astronautPose.y / 8.0 + 0.5;
    const elev = getElevationMetersAtUV(u, v);
    const slope = sampleSlopeAtUV(u, v);
    const risk = slope > 15 ? 'HAZARD' : slope > 10 ? 'CAUTION' : 'NOMINAL';
    return { currentElevM: elev, currentSlopeDeg: slope, slopeRisk: risk };
  }, [astronautPose.x, astronautPose.y]);

  // Dynamic heart rate based on movement speed (simulated)
  const bpm = useMemo(() => {
    if (astronautPose.speed > 4) return 132; // Sprinting
    if (astronautPose.speed > 0) return 96;  // Walking
    return 72; // Resting
  }, [astronautPose.speed]);

  if (!isAstronautMode || !showHelmetHUD) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden font-mono">
      {/* Helmet Visor Curvature Vignette & Reflection */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(3,7,18,0.7)_85%,rgba(2,6,23,0.95)_100%)] shadow-[inset_0_0_120px_rgba(56,189,248,0.12)]" />

      {/* Visor Edge Frame Lines */}
      <div className="absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
      <div className="absolute inset-x-8 bottom-6 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />

      {/* Top Center: Digital Compass HUD Tape */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-center gap-2 rounded-full border border-sky-500/40 bg-black/75 px-5 py-1.5 backdrop-blur-md shadow-lg shadow-sky-950/50">
          <Compass className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest text-white">
            {astronautPose.headingDeg.toString().padStart(3, '0')}°
          </span>
          <span className="text-xs font-semibold text-amber-400">
            {astronautPose.headingDeg >= 338 || astronautPose.headingDeg < 23
              ? 'N'
              : astronautPose.headingDeg >= 23 && astronautPose.headingDeg < 68
              ? 'NE'
              : astronautPose.headingDeg >= 68 && astronautPose.headingDeg < 113
              ? 'E'
              : astronautPose.headingDeg >= 113 && astronautPose.headingDeg < 158
              ? 'SE'
              : astronautPose.headingDeg >= 158 && astronautPose.headingDeg < 203
              ? 'S'
              : astronautPose.headingDeg >= 203 && astronautPose.headingDeg < 248
              ? 'SW'
              : astronautPose.headingDeg >= 248 && astronautPose.headingDeg < 293
              ? 'W'
              : 'NW'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-sky-400/80">
          <span>IAU MARS 2000 PLANETOCENTRIC HEADING</span>
        </div>
      </div>

      {/* Center Reticle / Tactical Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-70">
        <div className="w-8 h-8 rounded-full border border-sky-400/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
        </div>
        <div className="absolute -left-6 w-3 h-px bg-sky-400/50" />
        <div className="absolute -right-6 w-3 h-px bg-sky-400/50" />
        <div className="absolute -top-6 h-3 w-px bg-sky-400/50" />
        <div className="absolute -bottom-6 h-3 w-px bg-sky-400/50" />
      </div>

      {/* Left Column: Astronaut Life Support (Simulated) */}
      <div className="absolute left-8 top-28 w-64 space-y-3">
        <div className="rounded-xl border border-sky-500/30 bg-black/80 p-3.5 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2.5">
            <span className="text-[10px] font-bold tracking-wider text-sky-400">EVA LIFE SUPPORT</span>
            <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 rounded border border-emerald-800">
              NOMINAL
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Heart Rate */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Heart className={`w-3.5 h-3.5 text-red-400 ${astronautPose.speed > 0 ? 'animate-ping' : ''}`} />
                PULSE
              </span>
              <span className="font-bold text-red-300">
                {bpm} <span className="text-[10px] text-zinc-500 font-normal">BPM</span>
              </span>
            </div>

            {/* O2 Partial Pressure */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                O₂ PRESSURE
              </span>
              <span className="font-bold text-sky-300">
                20.7 <span className="text-[10px] text-zinc-500 font-normal">kPa</span>
              </span>
            </div>

            {/* Suit Pressure */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                SUIT PRESS
              </span>
              <span className="font-bold text-amber-300">
                29.6 <span className="text-[10px] text-zinc-500 font-normal">kPa</span>
              </span>
            </div>

            {/* Core Temp */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                CORE TEMP
              </span>
              <span className="font-bold text-emerald-300">36.8°C</span>
            </div>
          </div>
        </div>

        {/* Tactical Slope Hazard Warning if slope > 15 deg */}
        <div className={`rounded-xl border p-3 backdrop-blur-md transition ${
          slopeRisk === 'HAZARD'
            ? 'border-red-500/70 bg-red-950/80 text-red-200 animate-pulse'
            : slopeRisk === 'CAUTION'
            ? 'border-yellow-500/50 bg-yellow-950/70 text-yellow-200'
            : 'border-zinc-800 bg-black/60 text-zinc-400'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold tracking-wider">
              TERRAIN SLOPE: {currentSlopeDeg}°
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-300 leading-tight">
            {slopeRisk === 'HAZARD'
              ? 'WARNING: Steep grade >15°! High slip and rollover risk.'
              : slopeRisk === 'CAUTION'
              ? 'CAUTION: Moderate incline. Watch foot traction.'
              : 'Grade nominal (<10°). Safe traverse.'}
          </p>
        </div>
      </div>

      {/* Right Column: Surface Telemetry & Navigation */}
      <div className="absolute right-8 top-28 w-64 space-y-3">
        <div className="rounded-xl border border-sky-500/30 bg-black/80 p-3.5 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2.5">
            <span className="text-[10px] font-bold tracking-wider text-sky-400">SURFACE TELEMETRY</span>
            <span className="text-[9px] text-zinc-500">MOLA AREOID</span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Elevation */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">ELEVATION</span>
              <span className="font-bold text-sky-200 text-sm">
                {currentElevM.toLocaleString()} m
              </span>
            </div>

            {/* Walking / Running Speed */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Footprints className="w-3.5 h-3.5 text-amber-400" />
                EVA SPEED
              </span>
              <span className="font-bold text-white">
                {astronautPose.speed.toFixed(1)} <span className="text-[10px] text-zinc-500 font-normal">km/h</span>
              </span>
            </div>

            {/* Planned Route Progress */}
            {currentRoute && (
              <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5">
                <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  TOTAL ROUTE
                </span>
                <span className="font-bold text-emerald-300">
                  {(currentRoute.distanceMeters / 1000).toFixed(2)} km
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Exit Helmet View Button */}
        <div className="flex gap-2">
          <button
            onClick={() => setAstronautMode(false)}
            className="pointer-events-auto flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/80 hover:bg-red-900/90 py-2 text-xs font-semibold text-white transition shadow-lg"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Helmet Mode (ESC)</span>
          </button>
        </div>
      </div>

      {/* Bottom Center: Controls Bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full border border-sky-500/20 bg-black/80 px-6 py-2 text-[11px] text-zinc-300 backdrop-blur-md shadow-2xl">
        <span className="text-sky-400 font-bold">W / A / S / D</span> Move
        <span className="text-zinc-600">•</span>
        <span className="text-sky-400 font-bold">SHIFT</span> Sprint
        <span className="text-zinc-600">•</span>
        <span className="text-sky-400 font-bold">MOUSE</span> Look
        <span className="text-zinc-600">•</span>
        <span className="text-amber-400 font-bold">ESC</span> Exit Mode
      </div>
    </div>
  );
}
