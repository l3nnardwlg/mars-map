'use client';

import { useState, useEffect } from 'react';
import { useMissionStore } from '@/store/useMissionStore';
import { Rocket, ShieldCheck, Compass, Sparkles, X, ArrowRight } from 'lucide-react';

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const setActiveView = useMissionStore((state) => state.setActiveView);
  const calculateRoute = useMissionStore((state) => state.calculateRoute);

  useEffect(() => {
    // Show only once per browser session
    const seen = sessionStorage.getItem('mars_pathfinder_onboarding_seen');
    if (!seen) {
      const frame = requestAnimationFrame(() => setIsOpen(true));
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('mars_pathfinder_onboarding_seen', 'true');
    setIsOpen(false);
  };

  const handleStartJezero = () => {
    sessionStorage.setItem('mars_pathfinder_onboarding_seen', 'true');
    setIsOpen(false);
    setActiveView('terrain_prototype');
    calculateRoute();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 pointer-events-auto font-mono text-zinc-300">
      <div className="w-full max-w-lg rounded-2xl border border-sky-500/50 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
              <Rocket className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-widest">
                  MARS PATHFINDER
                </h2>
                <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-700/60 px-1.5 py-0.5 rounded font-bold">
                  NASA SPACE APPS
                </span>
              </div>
              <p className="text-xs text-sky-300">
                Interplanetary EVA & Science Traverse Planning System
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 15-Second Value Proposition */}
        <div className="mt-4 space-y-3.5 text-xs">
          <div className="rounded-xl bg-zinc-900/80 p-3 border border-zinc-800 space-y-1">
            <div className="text-amber-400 font-bold flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              1. THE MARTIAN CHALLENGE
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              On Mars, the shortest direct path can be fatal. Steep crater walls, loose regolith scree, and extreme metabolic loads threaten astronaut safety and life-support margins.
            </p>
          </div>

          <div className="rounded-xl bg-zinc-900/80 p-3 border border-zinc-800 space-y-1">
            <div className="text-sky-400 font-bold flex items-center gap-1.5 text-[11px]">
              <Compass className="w-4 h-4" />
              2. NASA TOPOGRAPHIC FUSION & BIO-ENERGETICS
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              We fuse NASA PDS CTX Digital Elevation Models (20m) and USGS HiRISE Topography (1m) with the NASA Pandolf bio-energetic model to compute multi-objective, slope-safe routes.
            </p>
          </div>

          <div className="rounded-xl bg-zinc-900/80 p-3 border border-zinc-800 space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-4 h-4" />
              3. IMMERSIVE SCIENTIFIC VALIDATION
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              Examine true MOLA Areoid elevations, test real-time slope hazard detection, collect Perseverance sample return cores, and experience boots-on-the-ground EVA simulation.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto text-xs text-zinc-400 hover:text-white transition px-3 py-2 cursor-pointer"
          >
            Explore Orbit First
          </button>

          <button
            onClick={handleStartJezero}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 text-xs transition shadow-lg shadow-sky-600/30 cursor-pointer"
          >
            <span>Enter Jezero Crater</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
