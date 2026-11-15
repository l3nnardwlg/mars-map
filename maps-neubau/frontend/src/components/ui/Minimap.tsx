'use client';

import { useMemo, useState } from 'react';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { Maximize2, Minimize2, Crosshair } from 'lucide-react';

export default function Minimap() {
  const [isExpanded, setIsExpanded] = useState(false);
  const showMinimap = useMissionStore((state) => state.showMinimap);
  const toggleMinimap = useMissionStore((state) => state.toggleMinimap);
  const activeView = useMissionStore((state) => state.activeView);
  const astronautPose = useMissionStore((state) => state.astronautPose);
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const sciencePoints = useMissionStore((state) => state.sciencePoints);

  const size = isExpanded ? 240 : 160;

  // Convert astronaut local plane position [-4, 4] to Minimap pixel coords [0, size]
  const astronautPixel = useMemo(() => {
    const u = astronautPose.x / 8.0 + 0.5;
    const v = 1.0 - (astronautPose.y / 8.0 + 0.5); // SVG Y is top-down
    return { x: u * size, y: v * size };
  }, [astronautPose.x, astronautPose.y, size]);

  // Convert Route Waypoints to SVG polyline points string
  const routePointsSvg = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return '';
    return currentRoute.waypoints
      .map((wp) => {
        const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);
        const px = nx * size;
        const py = (1.0 - ny) * size;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  }, [currentRoute, size]);

  // Convert Start & End coordinates to pixel coords
  const startPixel = useMemo(() => {
    if (!routeStart) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeStart.latitude, routeStart.longitude);
    return { x: nx * size, y: (1.0 - ny) * size };
  }, [routeStart, size]);

  const endPixel = useMemo(() => {
    if (!routeEnd) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeEnd.latitude, routeEnd.longitude);
    return { x: nx * size, y: (1.0 - ny) * size };
  }, [routeEnd, size]);

  // Convert Science Points
  const sciencePixels = useMemo(() => {
    return sciencePoints.slice(0, 10).map((sp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(sp.location.latitude, sp.location.longitude);
      return { id: sp.id, name: sp.name, x: nx * size, y: (1.0 - ny) * size };
    });
  }, [sciencePoints, size]);

  if (!showMinimap || activeView !== 'terrain_prototype') return null;

  return (
    <div className="pointer-events-auto absolute bottom-14 right-4 z-30 flex flex-col items-end">
      {/* Tactical Container */}
      <div 
        className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-black/85 p-2 shadow-2xl backdrop-blur-md transition-all duration-200"
        style={{ width: size + 16, height: size + 44 }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-1.5 px-1 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <Crosshair className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>JEZERO RADAR</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-zinc-400 hover:text-white p-0.5 rounded transition"
              title={isExpanded ? 'Shrink' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            <button
              onClick={toggleMinimap}
              className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition"
              title="Close Minimap"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Radar Map Canvas */}
        <div 
          className="relative mt-1 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-900"
          style={{ width: size, height: size }}
        >
          {/* Subtle Jezero Crater Background Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.18)_0%,rgba(15,23,42,0.85)_80%)]" />

          {/* Radar Sweep Concentric Circles */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
            <circle cx={size / 2} cy={size / 2} r={size * 0.45} fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
            <circle cx={size / 2} cy={size / 2} r={size * 0.25} fill="none" stroke="#38bdf8" strokeWidth="0.8" />
            <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="#38bdf8" strokeWidth="0.5" />
            <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="#38bdf8" strokeWidth="0.5" />
          </svg>

          {/* SVG Elements: Route, Waypoints, Science Points */}
          <svg className="absolute inset-0 w-full h-full">
            {/* Planned Route Line */}
            {routePointsSvg && (
              <polyline
                points={routePointsSvg}
                fill="none"
                stroke="#00f5ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_4px_#00f5ff]"
              />
            )}

            {/* Science Points (Amber Diamonds) */}
            {sciencePixels.map((sp) => (
              <g key={sp.id} transform={`translate(${sp.x}, ${sp.y})`}>
                <polygon points="0,-3 3,0 0,3 -3,0" fill="#f59e0b" />
              </g>
            ))}

            {/* Start Waypoint (Emerald) */}
            {startPixel && (
              <g transform={`translate(${startPixel.x}, ${startPixel.y})`}>
                <circle r="4" fill="#10b981" />
                <circle r="7" fill="none" stroke="#10b981" strokeWidth="1" className="animate-ping opacity-60" />
              </g>
            )}

            {/* End Waypoint (Red) */}
            {endPixel && (
              <g transform={`translate(${endPixel.x}, ${endPixel.y})`}>
                <circle r="4" fill="#ef4444" />
                <circle r="7" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping opacity-60" />
              </g>
            )}

            {/* Astronaut Location & Vision Cone */}
            {isAstronautMode && (
              <g transform={`translate(${astronautPixel.x}, ${astronautPixel.y}) rotate(${astronautPose.headingDeg})`}>
                {/* Vision Cone (FoV arc) */}
                <path
                  d="M0,0 L-14,-26 A30,30 0 0,1 14,-26 Z"
                  fill="rgba(56, 189, 248, 0.28)"
                  stroke="rgba(56, 189, 248, 0.6)"
                  strokeWidth="0.8"
                />
                {/* Astronaut Position Marker */}
                <circle r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
              </g>
            )}
          </svg>

          {/* Scale Legend */}
          <div className="absolute bottom-1 left-2 flex items-center gap-1 text-[8px] font-mono text-zinc-400">
            <div className="w-5 h-0.5 bg-zinc-400" />
            <span>5 km</span>
          </div>
        </div>
      </div>
    </div>
  );
}
