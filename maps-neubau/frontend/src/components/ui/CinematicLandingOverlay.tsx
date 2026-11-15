'use client';

import { useMissionStore } from '@/store/useMissionStore';
import { FastForward, Rocket } from 'lucide-react';

export default function CinematicLandingOverlay() {
  const isCinematicLanding = useMissionStore((state) => state.isCinematicLanding);
  const cancelCinematicLanding = useMissionStore((state) => state.cancelCinematicLanding);
  const setActiveView = useMissionStore((state) => state.setActiveView);
  const cinematicStage = useMissionStore((state) => state.cinematicStage);

  if (!isCinematicLanding) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-8 font-mono select-none">
      {/* Cinematic Top Letterbox */}
      <div className="flex items-center justify-between border-b border-sky-500/30 bg-black/85 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-sky-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-widest">
                MISSION MARS 2026 • DESCENT & LANDING SEQUENCE
              </h2>
              <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/60 px-1.5 py-0.5 rounded font-bold">
                SIMULATED ENTRY PROFILE
              </span>
            </div>
            <p className="text-xs text-sky-300 font-semibold mt-0.5">
              STAGE {cinematicStage.stageIndex}/4: {cinematicStage.telemetryText}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setActiveView('terrain_prototype');
            cancelCinematicLanding();
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-950/80 hover:bg-sky-900 px-4 py-2 text-xs font-bold text-sky-200 transition shadow-lg cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Skip to Surface</span>
        </button>
      </div>

      {/* Cinematic Bottom HUD Overlay */}
      <div className="flex items-center justify-center">
        <div className="rounded-full border border-sky-400/40 bg-black/85 px-6 py-2 text-xs text-sky-300 backdrop-blur-md flex items-center gap-4 shadow-xl">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          <span>AUTONOMOUS GUIDANCE IN CONTROL</span>
          <span className="text-zinc-600">•</span>
          <span>RADAR ALTIMETER LOCK</span>
        </div>
      </div>
    </div>
  );
}
