'use client';

import { useMissionStore } from '@/store/useMissionStore';
import { Mountain, AlertTriangle, TrendingUp } from 'lucide-react';

export default function ElevationProfileChart() {
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const showElevationProfile = useMissionStore((state) => state.showElevationProfile);
  const toggleElevationProfile = useMissionStore((state) => state.toggleElevationProfile);

  if (!currentRoute || !currentRoute.elevationProfile || currentRoute.elevationProfile.length < 2) {
    return null;
  }

  const profile = currentRoute.elevationProfile;
  const elevations = profile.map((p) => p.elevationM);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const totalDistKm = profile[profile.length - 1].distanceKm;
  const elevDelta = maxElev - minElev;

  // SVG Chart Dimensions
  const svgWidth = 320;
  const svgHeight = 70;
  const padTop = 10;
  const padBottom = 15;
  const chartHeight = svgHeight - padTop - padBottom;

  // Generate SVG path points
  const points = profile.map((pt, idx) => {
    const x = (idx / (profile.length - 1)) * svgWidth;
    const normY = elevDelta > 0 ? (pt.elevationM - minElev) / elevDelta : 0.5;
    const y = svgHeight - padBottom - normY * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M 0,${svgHeight - padBottom} L ${points.join(' L ')} L ${svgWidth},${svgHeight - padBottom} Z`;

  const maxSlope = Math.max(...profile.map((p) => p.slopeDeg));

  return (
    <div className="pointer-events-auto rounded-xl border border-sky-500/30 bg-black/90 p-3 shadow-2xl backdrop-blur-md text-xs font-mono select-none w-80 md:w-88">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Mountain className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold uppercase tracking-wider text-sky-300 text-[11px]">
            Terrain Cross-Section
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            ΔZ: +{Math.round(elevDelta)}m
          </span>
          <button
            onClick={toggleElevationProfile}
            className="text-zinc-500 hover:text-white transition"
          >
            {showElevationProfile ? '−' : '+'}
          </button>
        </div>
      </div>

      {showElevationProfile && (
        <div className="mt-2 space-y-2">
          {/* Mini Elevation Graph */}
          <div className="relative bg-zinc-950/80 rounded border border-zinc-800/80 p-1">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-16 overflow-visible"
            >
              <defs>
                <linearGradient id="elevAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Area Fill */}
              <path d={areaD} fill="url(#elevAreaGrad)" />

              {/* Elevation Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Y Axis Baseline */}
              <line
                x1="0"
                y1={svgHeight - padBottom}
                x2={svgWidth}
                y2={svgHeight - padBottom}
                stroke="#3f3f46"
                strokeDasharray="2,2"
              />
            </svg>

            {/* Labels overlay */}
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono px-1 mt-0.5">
              <span>0 km ({Math.round(profile[0].elevationM)}m)</span>
              <span>{totalDistKm} km ({Math.round(profile[profile.length - 1].elevationM)}m)</span>
            </div>
          </div>

          {/* Slope & Risk Footnote */}
          <div className="flex items-center justify-between text-[10px] px-1 text-zinc-400">
            <span>Peak Elevation: <strong className="text-white">{Math.round(maxElev)} m</strong></span>
            <span className="flex items-center gap-1">
              {maxSlope > 15 ? (
                <span className="text-red-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3 h-3" /> Max Slope: {maxSlope}° (Hazard!)
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">
                  Safe Incline (&lt;{maxSlope}°)
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
