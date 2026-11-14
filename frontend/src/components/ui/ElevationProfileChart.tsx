'use client';

import { useState } from 'react';
import { useMissionStore } from '@/store/useMissionStore';
import { Mountain, Layers } from 'lucide-react';

export default function ElevationProfileChart() {
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const alternativeRoutes = useMissionStore((state) => state.alternativeRoutes);
  const showElevationProfile = useMissionStore((state) => state.showElevationProfile);
  const toggleElevationProfile = useMissionStore((state) => state.toggleElevationProfile);
  const setHoveredRoutePoint = useMissionStore((state) => state.setHoveredRoutePoint);
  const isComparingRoutes = useMissionStore((state) => state.isComparingRoutes);
  const toggleComparingRoutes = useMissionStore((state) => state.toggleComparingRoutes);
  const selectRouteProfile = useMissionStore((state) => state.selectRouteProfile);
  const selectedRouteProfile = useMissionStore((state) => state.selectedRouteProfile);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
  const svgWidth = 340;
  const svgHeight = 85;
  const padTop = 12;
  const padBottom = 18;
  const chartHeight = svgHeight - padTop - padBottom;

  // Map elevation point to SVG coordinates
  const getSvgCoords = (pts: typeof profile) => {
    return pts.map((pt, idx) => {
      const x = (idx / (pts.length - 1)) * svgWidth;
      const normY = elevDelta > 0 ? (pt.elevationM - minElev) / elevDelta : 0.5;
      const y = svgHeight - padBottom - normY * chartHeight;
      return { x, y, pt };
    });
  };

  const currentCoords = getSvgCoords(profile);
  const pathD = `M ${currentCoords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')}`;
  const areaD = `M 0,${svgHeight - padBottom} L ${currentCoords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')} L ${svgWidth},${svgHeight - padBottom} Z`;

  // Secondary alternative route lines for multi-comparison
  const altLines = (['direct', 'safe', 'science'] as const).map((prof) => {
    const alt = alternativeRoutes[prof];
    if (!alt || !alt.elevationProfile || alt.elevationProfile.length < 2 || prof === selectedRouteProfile) {
      return null;
    }
    const coords = getSvgCoords(alt.elevationProfile);
    const d = `M ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')}`;
    const stroke = prof === 'safe' ? '#10b981' : prof === 'science' ? '#f59e0b' : '#38bdf8';
    return { prof, d, stroke, route: alt };
  }).filter(Boolean);

  const maxSlope = Math.max(...profile.map((p) => p.slopeDeg));
  const hoveredData = hoverIndex !== null && currentCoords[hoverIndex] ? currentCoords[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, mouseX / rect.width));
    const nearestIdx = Math.round(fraction * (currentRoute.waypoints.length - 1));

    setHoverIndex(nearestIdx);
    const wp = currentRoute.waypoints[nearestIdx];
    if (wp) {
      setHoveredRoutePoint(wp);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoveredRoutePoint(null);
  };

  return (
    <div className="pointer-events-auto rounded-2xl border border-sky-500/40 bg-black/92 p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono select-none w-84 sm:w-92 text-zinc-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-sky-400" />
          <span className="font-bold uppercase tracking-wider text-sky-200 text-[11px]">
            Terrain Cross-Section
          </span>
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono uppercase">
            {selectedRouteProfile}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle multi-route comparison overlay */}
          <button
            onClick={toggleComparingRoutes}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition cursor-pointer border ${
              isComparingRoutes
                ? 'bg-sky-950 text-sky-300 border-sky-500/60'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title="Toggle Multi-Route Elevation Overlay"
          >
            <Layers className="w-3 h-3" />
            <span>Compare</span>
          </button>

          <button
            onClick={toggleElevationProfile}
            className="text-zinc-500 hover:text-white transition px-1 cursor-pointer font-bold"
          >
            {showElevationProfile ? '−' : '+'}
          </button>
        </div>
      </div>

      {showElevationProfile && (
        <div className="mt-2.5 space-y-2">
          {/* SVG Profile Chart with Synchronized Hover */}
          <div className="relative bg-zinc-950 rounded-xl border border-zinc-800/80 p-2 overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-20 overflow-visible cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="elevAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area Fill for Active Route */}
              <path d={areaD} fill="url(#elevAreaGrad)" />

              {/* Inactive Alternative Overlays when Compare Mode is enabled */}
              {isComparingRoutes && altLines.map((alt) => alt && (
                <path
                  key={alt.prof}
                  d={alt.d}
                  fill="none"
                  stroke={alt.stroke}
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  opacity={0.6}
                />
              ))}

              {/* Active Route Main Contour */}
              <path
                d={pathD}
                fill="none"
                stroke={selectedRouteProfile === 'safe' ? '#22c55e' : selectedRouteProfile === 'science' ? '#f59e0b' : '#38bdf8'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Baseline */}
              <line
                x1="0"
                y1={svgHeight - padBottom}
                x2={svgWidth}
                y2={svgHeight - padBottom}
                stroke="#3f3f46"
                strokeDasharray="2,2"
              />

              {/* Interactive Hover Vertical Cursor & Dot */}
              {hoveredData && (
                <g>
                  <line
                    x1={hoveredData.x}
                    y1={padTop}
                    x2={hoveredData.x}
                    y2={svgHeight - padBottom}
                    stroke="#facc15"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  />
                  <circle
                    cx={hoveredData.x}
                    cy={hoveredData.y}
                    r="4"
                    fill="#facc15"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>

            {/* Live Hover Tooltip */}
            {hoveredData && (
              <div 
                className="absolute top-1.5 left-2 bg-black/95 border border-yellow-400/80 px-2 py-1 rounded text-[10px] font-mono text-zinc-200 shadow-xl flex items-center gap-2 pointer-events-none"
              >
                <span className="text-yellow-400 font-bold">{hoveredData.pt.distanceKm} km</span>
                <span className="text-zinc-500">•</span>
                <span className="text-white font-semibold">{hoveredData.pt.elevationM}m MOLA</span>
                <span className="text-zinc-500">•</span>
                <span className={hoveredData.pt.slopeDeg > 15 ? 'text-red-400 font-bold' : hoveredData.pt.slopeDeg > 10 ? 'text-yellow-400' : 'text-emerald-400'}>
                  {hoveredData.pt.slopeDeg}° Slope
                </span>
              </div>
            )}

            {/* X-Axis Range & Waypoint Labels */}
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono px-1 mt-1">
              <span>0.0 km (START)</span>
              <span className="text-zinc-400">ΔZ: {elevDelta > 0 ? `+${Math.round(elevDelta)}m` : '0m'}</span>
              <span>{totalDistKm} km (TARGET)</span>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded bg-zinc-900/80 p-1.5 border border-zinc-800">
              <span className="text-[9px] text-zinc-500 block">PEAK HEIGHT</span>
              <span className="font-bold text-white text-xs">{Math.round(maxElev)} m</span>
            </div>

            <div className="rounded bg-zinc-900/80 p-1.5 border border-zinc-800">
              <span className="text-[9px] text-zinc-500 block">MAX SLOPE</span>
              <span className={`font-bold text-xs ${maxSlope > 15 ? 'text-red-400' : maxSlope > 10 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {maxSlope}°
              </span>
            </div>

            <div className="rounded bg-zinc-900/80 p-1.5 border border-zinc-800">
              <span className="text-[9px] text-zinc-500 block">ELEVATION GAIN</span>
              <span className="font-bold text-emerald-400 text-xs">+{Math.round(currentRoute.elevationGainMeters ?? elevDelta)} m</span>
            </div>
          </div>

          {/* Provenance & Risk Index Definition */}
          <div className="flex items-center justify-between text-[9px] bg-zinc-900/60 rounded px-2 py-1 border border-zinc-800/80 font-mono">
            <span className="text-zinc-400 truncate max-w-[55%]">
              SOURCE: <span className="text-sky-300">{currentRoute.dataSource?.includes('Backend') ? 'A* Backend Live' : 'Reference Case Study'}</span>
            </span>
            <span
              className="text-amber-300 font-semibold"
              title="Risk Formula: 0.6*(Mean Slope / 20°) + 0.4*(Max Slope / 20°)"
            >
              RISK: {((currentRoute.riskScore ?? 0) * 100).toFixed(0)}% <span className="text-zinc-500 font-normal">(0.6·μ + 0.4·max)</span>
            </span>
          </div>

          {/* Multi-Route Quick Selector under Comparison */}
          {isComparingRoutes && (
            <div className="pt-2 border-t border-zinc-800 space-y-1">
              <div className="text-[9px] text-zinc-400 flex items-center justify-between">
                <span>ALTERNATIVE TRAVERSES:</span>
                <span className="text-sky-400">Click to Switch Active</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['direct', 'safe', 'science'] as const).map((prof) => {
                  const r = alternativeRoutes[prof];
                  if (!r) return null;
                  const isAct = selectedRouteProfile === prof;
                  return (
                    <button
                      key={prof}
                      onClick={() => selectRouteProfile(prof)}
                      className={`rounded p-1 text-center transition cursor-pointer border ${
                        isAct
                          ? 'border-sky-400 bg-sky-950/80 text-white font-bold'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[10px] capitalize">{prof}</div>
                      <div className="text-[9px] text-zinc-400">{(r.distanceMeters / 1000).toFixed(2)} km</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
