'use client';

import { useMissionStore } from '@/store/useMissionStore';
import { 
  Crosshair, 
  Mountain, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Compass, 
  Info, 
  Database 
} from 'lucide-react';
import { NASA_DEM_METADATA } from '@/utils/demSampler';

export default function TerrainInspector() {
  const isTerrainInspectorActive = useMissionStore((state) => state.isTerrainInspectorActive);
  const toggleTerrainInspector = useMissionStore((state) => state.toggleTerrainInspector);
  const inspectedPoint = useMissionStore((state) => state.inspectedPoint);
  const setRoutePoint = useMissionStore((state) => state.setRoutePoint);
  const slopeThresholdDeg = useMissionStore((state) => state.slopeThresholdDeg);

  if (!isTerrainInspectorActive) return null;

  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
      {/* Active Mode Banner */}
      <div className="flex items-center gap-2 rounded-full border border-sky-400 bg-sky-950/95 px-4 py-1.5 text-xs font-mono text-sky-200 shadow-xl backdrop-blur-md">
        <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span className="font-bold">SCIENTIFIC TERRAIN INSPECTOR ACTIVE</span>
        <span className="text-zinc-400 hidden sm:inline">• Click 3D surface to analyze physical DEM cell</span>
        <button
          onClick={toggleTerrainInspector}
          className="ml-2 text-zinc-400 hover:text-white p-0.5 rounded transition cursor-pointer"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Tactical & Scientific Data Card */}
      {inspectedPoint && (
        <div className="mt-3 w-88 rounded-2xl border border-sky-500/50 bg-black/92 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 font-mono text-xs text-zinc-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold">
              <Mountain className="w-4 h-4" />
              <span>TERRAIN CELL TELEMETRY</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                inspectedPoint.riskLevel === 'hazard'
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : inspectedPoint.riskLevel === 'caution'
                  ? 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {inspectedPoint.riskLevel} TRAVERSE
            </span>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Coordinates */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">IAU MARS 2000</span>
              <span className="text-zinc-200 font-semibold leading-tight block">
                {inspectedPoint.latitude.toFixed(4)}° N<br />
                {inspectedPoint.longitude.toFixed(4)}° E
              </span>
            </div>

            {/* Elevation with Datum & Uncertainty */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">ELEVATION (MOLA)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sky-300 font-bold text-sm">
                  {inspectedPoint.elevationMeters.toLocaleString()} m
                </span>
                <span className="text-[9px] text-zinc-500">
                  ±{inspectedPoint.uncertaintyMeters ?? NASA_DEM_METADATA.elevationUncertaintyMeters}m
                </span>
              </div>
            </div>

            {/* Local Slope */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">LOCAL GRADIENT</span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`font-bold text-sm ${
                    inspectedPoint.slopeDeg > slopeThresholdDeg
                      ? 'text-red-400'
                      : inspectedPoint.slopeDeg > 10
                      ? 'text-yellow-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {inspectedPoint.slopeDeg}°
                </span>
                <span className="text-[9px] text-zinc-500">
                  ({(Math.tan((inspectedPoint.slopeDeg * Math.PI) / 180) * 100).toFixed(1)}% grade)
                </span>
              </div>
            </div>

            {/* Aspect & Downslope Azimuth */}
            <div className="rounded-lg bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block flex items-center gap-1">
                <Compass className="w-3 h-3 text-sky-400" />
                ASPECT (DOWNSLOPE)
              </span>
              <span className="text-sky-300 font-bold text-sm">
                {inspectedPoint.aspectDeg !== undefined ? `${inspectedPoint.aspectDeg}°` : '—'}{' '}
                <span className="text-[10px] text-zinc-400 font-normal">
                  ({inspectedPoint.compassOctant ?? 'Flat'})
                </span>
              </span>
            </div>
          </div>

          {/* Risk Classification & Traverse Status */}
          <div className="mt-2 rounded-lg bg-zinc-900/70 p-2 border border-zinc-800 flex items-center gap-2">
            {inspectedPoint.riskLevel === 'hazard' ? (
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            ) : inspectedPoint.riskLevel === 'caution' ? (
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div className="text-[10px] leading-tight">
              <span className="font-semibold text-zinc-200">
                {inspectedPoint.riskLevel === 'hazard'
                  ? `Slope > ${slopeThresholdDeg}° (Critical obstacle, high slip & metabolic spike)`
                  : inspectedPoint.riskLevel === 'caution'
                  ? 'Moderate slope 10°–15° (Traction degradation, reduce EVA speed to ~1.9 km/h)'
                  : 'Nominal slope < 10° (Stable footing, standard 3.0 km/h walking pace)'}
              </span>
            </div>
          </div>

          {/* Scientific Disclaimer & Provenance */}
          <div className="mt-2.5 rounded bg-zinc-950 p-2 border border-zinc-800 text-[9px] text-zinc-400 space-y-1">
            <div className="text-sky-400 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                SOURCE: {NASA_DEM_METADATA.productId}
              </span>
              <span className="text-emerald-400 font-mono">PDS VERIFIED</span>
            </div>
            <div>Datum: MOLA Areoid 0m • IAU Mars 2000 Planetocentric</div>
            <div>Native Res: 20m/px • Mesh Sampling: 349m × 396m / cell</div>
            <div className="text-zinc-500 pt-1 border-t border-zinc-800 flex items-start gap-1">
              <Info className="w-3 h-3 text-amber-500/80 shrink-0 mt-0.5" />
              <span>
                Safety note: Slope angle is a primary proxy, but does not alone guarantee EVA safety. Rock distribution, soil cohesion, and thermal shadowing also govern traverse risk.
              </span>
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
              className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-500 py-1.5 text-white font-semibold text-center transition cursor-pointer"
            >
              Set as Route Waypoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
