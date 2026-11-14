'use client';

import { useEffect, useState, useMemo } from 'react';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import { Sparkles, X, ChevronRight, Check } from 'lucide-react';

export default function GuidedJuryTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const setActiveView = useMissionStore((state) => state.setActiveView);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const selectRouteProfile = useMissionStore((state) => state.selectRouteProfile);
  const toggleAstronautMode = useMissionStore((state) => state.toggleAstronautMode);
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const calculateRoute = useMissionStore((state) => state.calculateRoute);

  const tourSteps = useMemo(() => [
    {
      step: 1,
      title: 'Global Planetary Reconnaissance',
      description: 'Fully interactive 3D Mars globe with authentic NASA Viking imagery, 25.19° Martian axial tilt, and IAU Mars 2000 planetocentric coordinate reference.',
      action: () => {
        if (isAstronautMode) toggleAstronautMode();
        setActiveView('globe');
        const jezero = MARS_LANDMARKS.find((l) => l.id === 'jezero') || null;
        selectLandmark(jezero);
      },
    },
    {
      step: 2,
      title: 'Descent to Jezero Crater Surface',
      description: 'Seamless transition to high-resolution ESA HRSC 2048x2048 orthomosaic & NASA CTX/MOLA digital elevation model (384x384 3D mesh).',
      action: () => {
        if (isAstronautMode) toggleAstronautMode();
        setActiveView('terrain_prototype');
        calculateRoute();
      },
    },
    {
      step: 3,
      title: 'A* Routing & Pandolf Life-Support Model',
      description: 'Dynamic multi-profile route comparison (Direct, Safe, Science Recon) with real-time SVG elevation cross-sections, slope hazard detection, and NASA IST-1 metabolic simulation.',
      action: () => {
        selectRouteProfile('safe');
      },
    },
    {
      step: 4,
      title: 'NASA Perseverance Ground-Truth Samples',
      description: 'Integration of verified Mars 2020 Perseverance sample cores (Roubion, Montdenier, Salette, Skinner Ridge) anchored with 0-floating precision.',
      action: () => {
        selectRouteProfile('science');
      },
    },
    {
      step: 5,
      title: 'First-Person Astronaut Surface Exploration',
      description: 'Immersive surface helmet interface with WASD controls, digital compass tape, real-time DEM surface gradient detection, and 2D tactical radar minimap.',
      action: () => {
        if (!isAstronautMode) toggleAstronautMode();
      },
    },
  ], [isAstronautMode, toggleAstronautMode, setActiveView, selectLandmark, calculateRoute, selectRouteProfile]);

  // Auto-advance step every 20 seconds if tour is active
  useEffect(() => {
    if (!isActive) return;

    tourSteps[currentStep - 1]?.action();

    const timer = setTimeout(() => {
      if (currentStep < tourSteps.length) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setIsActive(false);
      }
    }, 20000);

    return () => clearTimeout(timer);
  }, [isActive, currentStep, tourSteps]);

  if (!isActive) {
    return (
      <button
        onClick={() => {
          setIsActive(true);
          setCurrentStep(1);
        }}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition shadow-lg shadow-amber-950/40"
        title="Start Guided 2-Minute Jury Tour"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        <span className="hidden sm:inline">Jury Guided Tour</span>
      </button>
    );
  }

  const current = tourSteps[currentStep - 1];

  return (
    <div className="pointer-events-auto fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 font-mono select-none">
      <div className="rounded-2xl border border-amber-400 bg-black/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-xs font-bold text-amber-300 tracking-wider">
              NASA SPACE APPS JURY GUIDED TOUR • STEP {currentStep}/5
            </span>
          </div>

          <button
            onClick={() => {
              setIsActive(false);
              if (isAstronautMode) toggleAstronautMode();
            }}
            className="text-zinc-400 hover:text-white transition p-0.5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-1">{current.title}</h4>
          <p className="text-xs text-zinc-300 leading-relaxed">{current.description}</p>
        </div>

        {/* Progress & Next Step Button */}
        <div className="mt-3.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="flex gap-1.5">
            {tourSteps.map((s) => (
              <div
                key={s.step}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s.step === currentStep
                    ? 'w-6 bg-amber-400'
                    : s.step < currentStep
                    ? 'w-2 bg-emerald-400'
                    : 'w-2 bg-zinc-700'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep < tourSteps.length ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1 text-xs transition"
              >
                <span>Next Feature</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsActive(false);
                  if (isAstronautMode) toggleAstronautMode();
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 text-xs transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Tour Completed</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
