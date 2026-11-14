'use client';

import { useMissionStore, TerrainColorMode } from '@/store/useMissionStore';
import { Layers, ShieldAlert, X } from 'lucide-react';

export default function LayerManagerModal() {
  const showLayerManagerModal = useMissionStore((state) => state.showLayerManagerModal);
  const setShowLayerManagerModal = useMissionStore((state) => state.setShowLayerManagerModal);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setTerrainColorMode = useMissionStore((state) => state.setTerrainColorMode);
  const slopeThresholdDeg = useMissionStore((state) => state.slopeThresholdDeg);
  const setSlopeThresholdDeg = useMissionStore((state) => state.setSlopeThresholdDeg);

  if (!showLayerManagerModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto font-mono">
      <div className="w-full max-w-lg rounded-2xl border border-sky-500/40 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                NASA SCIENTIFIC LAYER MANAGER
              </h3>
              <p className="text-[11px] text-zinc-400">
                Opacity, Heatmap Color Ramps & Hazard Thresholds
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLayerManagerModal(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-4 text-xs text-zinc-300">
          {/* Active Color Mode Selector */}
          <div>
            <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1.5">
              Primary Surface Texture Map
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'satellite', label: 'HRSC Ortho', sub: 'ESA Natural Color' },
                { id: 'hypsometric', label: 'DEM Elevation', sub: 'MOLA Topography' },
                { id: 'slope', label: 'Slope Risk', sub: 'Gradient Heatmap' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTerrainColorMode(m.id as TerrainColorMode)}
                  className={`p-2 rounded-xl border text-left transition ${
                    terrainColorMode === m.id
                      ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold">{m.label}</div>
                  <div className="text-[9px] text-zinc-500">{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Slope Hazard Threshold Slider */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                SLOPE HAZARD THRESHOLD
              </span>
              <span className="font-bold text-white bg-amber-950 border border-amber-800 px-2 py-0.5 rounded">
                &gt; {slopeThresholdDeg}°
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Adjusts the critical incline angle where terrain is flagged as high rollover danger for astronauts and rovers.
            </p>
            <input
              type="range"
              min="8"
              max="25"
              step="1"
              value={slopeThresholdDeg}
              onChange={(e) => setSlopeThresholdDeg(parseInt(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
            />
          </div>

          {/* Scientific Color Legends */}
          <div className="space-y-3 pt-1">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">
              Scientific Color Ramps & Legends
            </span>

            {/* Hypsometric Legend */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5 space-y-1.5">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>-2,500 m (Basin Floor)</span>
                <span className="font-bold text-sky-300">MOLA Areoid Elevation</span>
                <span>-1,200 m (Crater Rim)</span>
              </div>
              <div className="h-3 w-full rounded-md bg-gradient-to-r from-[#1e1b4b] via-[#0284c7] via-[#10b981] via-[#f59e0b] via-[#ef4444] to-[#ffffff]" />
            </div>

            {/* Slope Gradient Legend */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5 space-y-1.5">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>0° (Flat Basin)</span>
                <span className="font-bold text-emerald-300">Grade & Hazard</span>
                <span>30°+ (Steep Cliff)</span>
              </div>
              <div className="h-3 w-full rounded-md bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#dc2626]" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => setShowLayerManagerModal(false)}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 text-xs transition shadow-md"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
