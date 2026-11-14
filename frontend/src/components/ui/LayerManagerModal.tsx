'use client';

import { useMissionStore, TerrainColorMode } from '@/store/useMissionStore';
import { Layers, ShieldAlert, X, ExternalLink, Info, Database } from 'lucide-react';
import { NASA_DEM_METADATA } from '@/utils/demSampler';

export default function LayerManagerModal() {
  const showLayerManagerModal = useMissionStore((state) => state.showLayerManagerModal);
  const setShowLayerManagerModal = useMissionStore((state) => state.setShowLayerManagerModal);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setTerrainColorMode = useMissionStore((state) => state.setTerrainColorMode);
  const slopeThresholdDeg = useMissionStore((state) => state.slopeThresholdDeg);
  const setSlopeThresholdDeg = useMissionStore((state) => state.setSlopeThresholdDeg);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const setTerrainExaggeration = useMissionStore((state) => state.setTerrainExaggeration);

  if (!showLayerManagerModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 pointer-events-auto font-mono">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-sky-500/40 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                NASA & USGS SCIENTIFIC LAYER MANAGER
              </h3>
              <p className="text-[11px] text-zinc-400">
                Planetary Topography, Heatmaps & Geodetic Provenance
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLayerManagerModal(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Active Color Mode Selector */}
          <div>
            <span className="text-[10px] text-zinc-400 block uppercase tracking-wider mb-1.5">
              Primary Surface Texture Map
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'satellite', label: 'HRSC / Ortho', sub: 'Visible Surface Color' },
                { id: 'hypsometric', label: 'DEM Elevation', sub: 'MOLA Topography Ramp' },
                { id: 'slope', label: 'Slope Risk', sub: 'Gradient Heatmap' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTerrainColorMode(m.id as TerrainColorMode)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    terrainColorMode === m.id
                      ? 'border-sky-400 bg-sky-950/80 text-sky-200 shadow-md'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">{m.label}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Relief Exaggeration Slider with Invariance Notice */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sky-400 font-bold text-[11px]">
                3D VISUAL VERTICAL EXAGGERATION
              </span>
              <span className="font-bold text-white bg-sky-950 border border-sky-800 px-2 py-0.5 rounded text-[11px]">
                {terrainExaggeration.toFixed(1)}× Relief
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              Controls visual mesh height displacement for crater rim clarity.
              <strong className="text-emerald-400 ml-1">
                Scientific Note: Has 0.0% impact on physical elevations, slope angles, or distance calculations.
              </strong>
            </p>
            <input
              type="range"
              min="1.0"
              max="2.8"
              step="0.1"
              value={terrainExaggeration}
              onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
            />
          </div>

          {/* Slope Hazard Threshold Slider */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <ShieldAlert className="w-4 h-4" />
                SLOPE HAZARD THRESHOLD
              </span>
              <span className="font-bold text-white bg-amber-950 border border-amber-800 px-2 py-0.5 rounded text-[11px]">
                &gt; {slopeThresholdDeg}° Critical
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              Defines the threshold where inclines are classified as severe slip & rollover hazards for human EVA and robotic rovers.
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
          <div className="space-y-2 pt-1">
            <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">
              Scientific Color Ramps & Units
            </span>

            {/* Hypsometric Legend */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5 space-y-1.5">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>-2,583 m (Crater Basin Floor)</span>
                <span className="font-bold text-sky-300">MOLA Areoid Datum</span>
                <span>-1,280 m (Delta & Rim)</span>
              </div>
              <div className="h-3 w-full rounded-md bg-gradient-to-r from-[#1e1b4b] via-[#0284c7] via-[#10b981] via-[#f59e0b] via-[#ef4444] to-[#ffffff]" />
            </div>

            {/* Slope Gradient Legend */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5 space-y-1.5">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>0° (Flat Basin)</span>
                <span className="font-bold text-emerald-300">Finite Difference Incline</span>
                <span>25°+ (Impassable Wall)</span>
              </div>
              <div className="h-3 w-full rounded-md bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#dc2626]" />
            </div>
          </div>

          {/* NASA & USGS Provenance Specifications */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
            <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Verified Dataset Specifications
            </div>

            <div className="space-y-1.5 text-[10px] text-zinc-400">
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">Primary DEM Product:</span>
                <span className="text-zinc-200 font-semibold">{NASA_DEM_METADATA.productId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">Source Agency:</span>
                <span className="text-zinc-200">USGS Astrogeology / NASA PDS</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">Coordinate Reference:</span>
                <span className="text-zinc-200">{NASA_DEM_METADATA.crs}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">Elevation Datum:</span>
                <span className="text-zinc-200">{NASA_DEM_METADATA.datum}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">Native Resolution:</span>
                <span className="text-zinc-200">20.0 m/pixel (CTX Stereo Photogrammetry)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">HiRISE Micro-DTM:</span>
                <span className="text-zinc-200">1.64 m/pixel (Jezero Western Fan MSR TRN Aug 2024)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Quantization Uncertainty:</span>
                <span className="text-amber-300 font-bold">±{NASA_DEM_METADATA.elevationUncertaintyMeters} m (8-bit client) / ±0.02 m (16-bit server)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800 text-[9px] text-zinc-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span>
                Limitations: Micro-topographic features smaller than 20 meters (such as small boulders and dust dunes) are below CTX native resolution. HiRISE delta tiles provide sub-2m validation.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
          <a
            href="https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
          >
            <span>USGS Planetary Data Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setShowLayerManagerModal(false)}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 text-xs transition shadow-md cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
