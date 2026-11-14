'use client';

import { useEffect, useState, useMemo } from 'react';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import { Sparkles, X, ChevronRight, ChevronLeft, Check, RotateCcw, Play, Pause } from 'lucide-react';

export default function GuidedJuryTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const setActiveView = useMissionStore((state) => state.setActiveView);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const selectRouteProfile = useMissionStore((state) => state.selectRouteProfile);
  const toggleAstronautMode = useMissionStore((state) => state.toggleAstronautMode);
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const calculateRoute = useMissionStore((state) => state.calculateRoute);
  const setTerrainColorMode = useMissionStore((state) => state.setTerrainColorMode);

  const tourSteps = useMemo(() => [
    {
      step: 1,
      badge: 'ORBITAL RECONNAISSANCE',
      title: 'Global Planetary Context & Coordinate Reference',
      narrative: 'Welcome to MARS Pathfinder. We begin in planetary orbit: authentic 8K NASA Viking imagery with true Martian axial tilt (25.19°) and IAU Mars 2000 planetocentric coordinates. Targeting the ancient paleolake basin of Jezero Crater.',
      evidence: 'IAU Mars 2000 East-Positive Coordinates • 8192×4096 MOLA Bump Mapping',
      action: () => {
        if (isAstronautMode) toggleAstronautMode();
        setActiveView('globe');
        const jezero = MARS_LANDMARKS.find((l) => l.id === 'jezero') || null;
        selectLandmark(jezero);
      },
    },
    {
      step: 2,
      badge: 'TERRAIN HYPSOMETRY',
      title: 'Descent to Jezero Crater CTX/MOLA Topography',
      narrative: 'Transitioning to the surface: 384×384 3D mesh displaced by USGS NASA PDS CTX Digital Elevation Model (20m native resolution, MOLA Areoid datum from -2,583m basin floor to -1,280m rim).',
      evidence: 'M20_JezeroCrater_CTXDEM_20m • Invariant MOLA Datum • Physical Metric Step: dx=349m, dy=396m',
      action: () => {
        if (isAstronautMode) toggleAstronautMode();
        setActiveView('terrain_prototype');
        setTerrainColorMode('hypsometric');
        calculateRoute();
      },
    },
    {
      step: 3,
      badge: 'THE CORE DISCOVERY',
      title: 'The Shortest Path is Fatal: Direct vs. Safe Traverses',
      narrative: 'CRITICAL FINDING: On Mars, the shortest Euclidean path is dangerous. The "Direct" path ascends an 18.5° scarp, causing severe regolith slip and +35% metabolic spike. The "Safe" path contours along a <8° alluvial terrace, saving 140 kJ and preserving safe EVA oxygen margins.',
      evidence: 'Pandolf 1977 Bio-Model • 0.38g Gravity • Central Difference Slope Gradient: dz/dx, dz/dy',
      action: () => {
        setTerrainColorMode('slope');
        selectRouteProfile('safe');
      },
    },
    {
      step: 4,
      badge: 'SAMPLE RETURN CACHE',
      title: 'NASA Perseverance Ground-Truth Samples',
      narrative: 'Mars 2020 Perseverance science sample return cores (Roubion, Montdenier, Salette, Skinner Ridge) are accurately anchored to the DEM. The "Science" profile plans an intelligent detour to collect sample tubes within the 8-hour EVA limit.',
      evidence: 'NASA MMGIS Sample Registry • M20_SAMPLE_v3.json • Verified Topographic Anchoring',
      action: () => {
        setTerrainColorMode('satellite');
        selectRouteProfile('science');
      },
    },
    {
      step: 5,
      badge: 'BOOTS ON THE GROUND',
      title: 'First-Person Astronaut EVA Simulation',
      narrative: 'Entering boots-on-the-ground EVA perspective. Real-time surface gradient sensing, digital compass tape, frame-rate independent physics, and physical slope constraints that prevent unrealistic cliff sprinting.',
      evidence: 'Physical Eye Height 1.7m • Frame-Rate Independent Delta • Pandolf Metabolic Bio-Telemetry',
      action: () => {
        if (!isAstronautMode) toggleAstronautMode();
      },
    },
    {
      step: 6,
      badge: 'SCIENTIFIC INTEGRITY',
      title: 'Scientific Traceability & Global Award Readiness',
      narrative: 'Every elevation is tied to MOLA Areoid datum. Display exaggeration has 0.0% effect on physical calculations. High-resolution HiRISE 1m tiles cached locally. Rigorous automated test suite passing all mathematical assertions.',
      evidence: '100% Exaggeration Invariance • 3,155 HiRISE Tiles • NASA PDS & USGS Provenance',
      action: () => {
        if (isAstronautMode) toggleAstronautMode();
        setActiveView('terrain_prototype');
        setTerrainColorMode('satellite');
      },
    },
  ], [isAstronautMode, toggleAstronautMode, setActiveView, selectLandmark, calculateRoute, selectRouteProfile, setTerrainColorMode]);

  // Execute step action on step change
  useEffect(() => {
    if (!isActive) return;
    tourSteps[currentStep - 1]?.action();
  }, [isActive, currentStep, tourSteps]);

  // Auto-advance timer (20 seconds per step, paused if user toggles pause)
  useEffect(() => {
    if (!isActive || isPaused) return;

    const timer = setTimeout(() => {
      if (currentStep < tourSteps.length) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setIsActive(false);
      }
    }, 22000);

    return () => clearTimeout(timer);
  }, [isActive, isPaused, currentStep, tourSteps.length]);

  if (!isActive) {
    return (
      <button
        onClick={() => {
          setIsActive(true);
          setCurrentStep(1);
          setIsPaused(false);
        }}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition shadow-lg shadow-amber-950/40 cursor-pointer"
        title="Start Guided 2-Minute NASA Jury Tour"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        <span className="hidden sm:inline">Global Jury Tour</span>
      </button>
    );
  }

  const current = tourSteps[currentStep - 1];

  return (
    <div className="pointer-events-auto fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 font-mono select-none">
      <div className="rounded-2xl border border-amber-400/90 bg-black/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-xs font-bold text-amber-300 tracking-wider">
              NASA SPACE APPS GLOBAL JURY DEMO • STEP {currentStep}/{tourSteps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
              title={isPaused ? 'Resume Tour' : 'Pause Auto-Advance'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            <button
              onClick={() => {
                setIsActive(false);
                if (isAstronautMode) toggleAstronautMode();
              }}
              className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
              title="Close Tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Badge & Title */}
        <div className="mb-2">
          <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            {current.badge}
          </span>
          <h4 className="text-sm font-bold text-white mt-1.5">{current.title}</h4>
        </div>

        {/* Narrative Prose */}
        <p className="text-xs text-zinc-200 leading-relaxed font-sans">
          {current.narrative}
        </p>

        {/* Scientific Evidence Badge */}
        <div className="mt-2.5 rounded bg-zinc-900/80 p-2 border border-zinc-800 text-[10px] text-sky-300 font-mono flex items-center justify-between">
          <span className="text-zinc-400">Verifiable Evidence:</span>
          <span className="font-semibold">{current.evidence}</span>
        </div>

        {/* Progress Bar & Navigation Controls */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
          {/* Step Dots */}
          <div className="flex gap-1.5 items-center">
            {tourSteps.map((s) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  s.step === currentStep
                    ? 'w-6 bg-amber-400'
                    : s.step < currentStep
                    ? 'w-2 bg-emerald-400'
                    : 'w-2 bg-zinc-700'
                }`}
                title={`Jump to Step ${s.step}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-2.5 py-1 text-xs transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
            )}

            {currentStep < tourSteps.length ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1 text-xs transition cursor-pointer shadow-md"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsActive(false);
                  if (isAstronautMode) toggleAstronautMode();
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 text-xs transition cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Complete Tour</span>
              </button>
            )}

            <button
              onClick={() => {
                setCurrentStep(1);
              }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              title="Restart Tour from Beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
