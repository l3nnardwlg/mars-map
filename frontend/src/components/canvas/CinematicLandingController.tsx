'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/store/useMissionStore';
import { latLonToVector3, MARS_RADIUS_SCENE, MARS_AXIAL_TILT_RAD } from '@/utils/coordinates';
import { FastForward, Rocket } from 'lucide-react';

export default function CinematicLandingController() {
  const { camera } = useThree();
  const isCinematicLanding = useMissionStore((state) => state.isCinematicLanding);
  const cancelCinematicLanding = useMissionStore((state) => state.cancelCinematicLanding);
  const setActiveView = useMissionStore((state) => state.setActiveView);

  const startTimeRef = useRef<number | null>(null);
  const [telemetryText, setTelemetryText] = useState('ENTRY INTERFACE INITIATED');
  const [stageIndex, setStageIndex] = useState(1);

  // Jezero Crater coordinates in tilted world space
  const jezeroWorldPos = useRef<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    if (isCinematicLanding) {
      startTimeRef.current = null;
      const local = latLonToVector3(18.38, 77.58, MARS_RADIUS_SCENE);
      const tilted = local.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), MARS_AXIAL_TILT_RAD);
      jezeroWorldPos.current.copy(tilted);
    }
  }, [isCinematicLanding]);

  useFrame((state) => {
    if (!isCinematicLanding) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.getElapsedTime();
    }

    const elapsed = state.clock.getElapsedTime() - startTimeRef.current;
    const duration = 12.0; // 12 seconds total cinematic sequence

    if (elapsed > duration) {
      // Sequence completed: Switch to Jezero terrain and exit cinematic
      setActiveView('terrain_prototype');
      cancelCinematicLanding();
      return;
    }

    const progress = elapsed / duration;

    // Stage updates
    if (progress < 0.3) {
      setStageIndex(1);
      setTelemetryText('ATMOSPHERIC ENTRY INTERFACE • MACH 22');
    } else if (progress < 0.6) {
      setStageIndex(2);
      setTelemetryText('PARACHUTE DEPLOYMENT & HEATSHIELD SEPARATION');
    } else if (progress < 0.85) {
      setStageIndex(3);
      setTelemetryText('SKYCRANE TERRAIN RELATIVE NAVIGATION (TRN)');
    } else {
      setStageIndex(4);
      setTelemetryText('TOUCHDOWN CONFIRMED • WELCOME TO JEZERO');
    }

    // Camera trajectory interpolation
    if (progress < 0.75) {
      // Orbit to Low Entry
      const t = progress / 0.75;
      const startCam = new THREE.Vector3(0, 2.0, 12.0);
      const targetCam = jezeroWorldPos.current.clone().normalize().multiplyScalar(2.6);

      const currentCam = new THREE.Vector3().lerpVectors(startCam, targetCam, THREE.MathUtils.smoothstep(t, 0, 1));
      camera.position.copy(currentCam);
      camera.lookAt(jezeroWorldPos.current);
    } else {
      // Switch view to terrain at 75% progress
      if (useMissionStore.getState().activeView !== 'terrain_prototype') {
        setActiveView('terrain_prototype');
      }

      // Smooth arrival at default terrain camera position
      const t = (progress - 0.75) / 0.25;
      const startTerrainCam = new THREE.Vector3(0, 8.0, 9.0);
      const endTerrainCam = new THREE.Vector3(0, 3.8, 4.8);

      camera.position.lerpVectors(startTerrainCam, endTerrainCam, THREE.MathUtils.smoothstep(t, 0, 1));
      camera.lookAt(0, 0, 0);
    }
  });

  if (!isCinematicLanding) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-8 font-mono select-none">
      {/* Cinematic Top Letterbox */}
      <div className="flex items-center justify-between border-b border-sky-500/30 bg-black/80 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-sky-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-widest">
                MISSION MARS 2026 • DESCENT & LANDING SEQUENCE
              </h2>
              <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/60 px-1.5 py-0.5 rounded">
                SIMULATED ENTRY PROFILE
              </span>
            </div>
            <p className="text-xs text-sky-300 font-semibold mt-0.5">
              STAGE {stageIndex}/4: {telemetryText}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setActiveView('terrain_prototype');
            cancelCinematicLanding();
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-950/80 hover:bg-sky-900 px-4 py-2 text-xs font-bold text-sky-200 transition shadow-lg"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Skip to Surface</span>
        </button>
      </div>

      {/* Cinematic Bottom HUD Overlay */}
      <div className="flex items-center justify-center">
        <div className="rounded-full border border-sky-400/40 bg-black/80 px-6 py-2 text-xs text-sky-300 backdrop-blur-md flex items-center gap-4">
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
