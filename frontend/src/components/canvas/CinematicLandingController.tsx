'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/store/useMissionStore';
import { latLonToVector3, MARS_RADIUS_SCENE, MARS_AXIAL_TILT_RAD } from '@/utils/coordinates';

export default function CinematicLandingController() {
  const { camera } = useThree();
  const isCinematicLanding = useMissionStore((state) => state.isCinematicLanding);
  const cancelCinematicLanding = useMissionStore((state) => state.cancelCinematicLanding);
  const setActiveView = useMissionStore((state) => state.setActiveView);
  const setCinematicStage = useMissionStore((state) => state.setCinematicStage);

  const startTimeRef = useRef<number | null>(null);

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
      setCinematicStage({ stageIndex: 1, telemetryText: 'ATMOSPHERIC ENTRY INTERFACE • MACH 22' });
    } else if (progress < 0.6) {
      setCinematicStage({ stageIndex: 2, telemetryText: 'PARACHUTE DEPLOYMENT & HEATSHIELD SEPARATION' });
    } else if (progress < 0.85) {
      setCinematicStage({ stageIndex: 3, telemetryText: 'SKYCRANE TERRAIN RELATIVE NAVIGATION (TRN)' });
    } else {
      setCinematicStage({ stageIndex: 4, telemetryText: 'TOUCHDOWN CONFIRMED • WELCOME TO JEZERO' });
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

  return null;
}
