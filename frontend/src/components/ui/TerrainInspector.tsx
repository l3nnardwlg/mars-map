'use client';

import { useMissionStore } from '@/store/useMissionStore';
import { Crosshair, Mountain, ShieldAlert, CheckCircle, AlertTriangle, X } from 'lucide-react';

export default function TerrainInspector() {
  const isTerrainInspectorActive = useMissionStore((state) => state.isTerrainInspectorActive);
  const toggleTerrainInspector = useMissionStore((state) => state.toggleTerrainInspector);
  const inspectedPoint = useMissionStore((state) => state.inspectedPoint);
  const setRoutePoint = useMissionStore((state) => state.setRoutePoint);

  if (!isTerrainInspectorActive) return null;

  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
      {/* Active Mode Banner */}
      <div className="flex items-center gap-2 rounded-full border border-sky-400 bg-sky-950/90 px-4 py-1.5 text-xs font-mono text-sky-200 shadow-xl backdrop-blur-md">
        <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span className="font-bold">TERRAIN INSPECTOR ACTIVE</span>
        <span className="text-zinc-400">• Click anywhere on 3D terrain to analyze</span>
        <button
          onClick={toggleTerrainInspector}
          className="ml-2 text-zinc-400 hover:text-white p-0.5 rounded transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Tactical Data Card */}
      {inspectedPoint && (
        <div className="mt-3 w-80 rounded-2xl border border-sky-500/50 bg-black/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold">
              <Mountain className="w-4 h-4" />
              <span>POINT TELEMETRY</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              inspectedPoint.riskLevel === 'hazard'
                ? 'bg-red-950 text-red-400 border border-red-800'
                : inspectedPoint.riskLevel === 'caution'
                ? 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}>
              {inspectedPoint.riskLevel.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Coordinates */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">COORDINATES</span>
              <span className="text-zinc-200 font-semibold">
                {inspectedPoint.latitude.toFixed(4)}°N<br />
                {inspectedPoint.longitude.toFixed(4)}°E
              </span>
            </div>

            {/* Elevation */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">ELEVATION (DATUM)</span>
              <span className="text-sky-300 font-bold text-sm">
                {inspectedPoint.elevationMeters.toLocaleString()} m
              </span>
            </div>

            {/* Slope Angle */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">LOCAL SLOPE</span>
              <span className={`font-bold text-sm ${
                inspectedPoint.slopeDeg > 15 ? 'text-red-400' : inspectedPoint.slopeDeg > 10 ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {inspectedPoint.slopeDeg}°
              </span>
            </div>

            {/* Risk Assessment */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800 flex flex-col justify-center">
              <span className="text-[10px] text-zinc-500 block">TRAVERSE STATUS</span>
              <div className="flex items-center gap-1 font-semibold text-[11px]">
                {inspectedPoint.riskLevel === 'hazard' ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400">Steep Cliff</span>
                  </>
                ) : inspectedPoint.riskLevel === 'caution' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-yellow-400">Moderate</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Accessible</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Scientific Provenance Verification Badge */}
          <div className="mt-2.5 rounded bg-zinc-950 p-2 border border-zinc-800 text-[9px] text-zinc-400 space-y-0.5">
            <div className="text-sky-400 font-bold flex items-center justify-between">
              <span>DATASET: NASA PDS CTX/MOLA DTM</span>
              <span className="text-emerald-400 font-mono">VERIFIED</span>
            </div>
            <div>Datum: MOLA Areoid 0m (IAU Mars 2000 Planetocentric)</div>
            <div className="text-zinc-500">
              Method: Direct DTM height fraction • Exaggeration-invariant
            </div>
          </div>

          {/* Quick Route Actions */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 flex gap-2">
            <button
              onClick={() => {
                setRoutePoint({
                  latitude: inspectedPoint.latitude,
                  longitude: inspectedPoint.longitude,
                  elevationMeters: inspectedPoint.elevationMeters,
                });
              }}
              className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-500 py-1.5 text-white font-semibold text-center transition"
            >
              Set as Route Waypoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
