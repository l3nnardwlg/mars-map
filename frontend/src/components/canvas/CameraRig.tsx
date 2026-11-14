'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useMissionStore } from '@/store/useMissionStore';
import { latLonToVector3, MARS_RADIUS_SCENE, MARS_AXIAL_TILT_RAD } from '@/utils/coordinates';

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const activeView = useMissionStore((state) => state.activeView);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);
  const setCameraDistance = useMissionStore((state) => state.setCameraDistance);
  const cameraDesiredPosition = useMissionStore((state) => state.cameraDesiredPosition);
  const setCameraDesiredPosition = useMissionStore((state) => state.setCameraDesiredPosition);

  // Target destination vector for smooth camera transitions
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Handle activeView transitions
  useEffect(() => {
    if (activeView === 'terrain_prototype') {
      targetCamPos.current = new THREE.Vector3(0, 3.8, 4.8);
      targetLookAt.current = new THREE.Vector3(0, 0, 0);
    } else if (activeView === 'globe' && !selectedLandmark) {
      targetCamPos.current = new THREE.Vector3(0, 1.5, 6.0);
      targetLookAt.current = new THREE.Vector3(0, 0, 0);
    }
  }, [activeView, selectedLandmark]);

  // React to landmark selection or reset
  useEffect(() => {
    if (activeView === 'globe') {
      if (selectedLandmark) {
        const localPos = latLonToVector3(
          selectedLandmark.coordinate.latitude,
          selectedLandmark.coordinate.longitude,
          MARS_RADIUS_SCENE
        );
        const tiltedPos = localPos.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), MARS_AXIAL_TILT_RAD);

        targetLookAt.current.copy(tiltedPos);
        const viewOffset = tiltedPos.clone().normalize().multiplyScalar(3.2);
        targetCamPos.current = viewOffset;
      } else if (cameraDesiredPosition) {
        targetCamPos.current = new THREE.Vector3(...cameraDesiredPosition);
        targetLookAt.current.set(0, 0, 0);
        setCameraDesiredPosition(null);
      }
    }
  }, [activeView, selectedLandmark, cameraDesiredPosition, setCameraDesiredPosition]);

  useFrame(() => {
    if (targetCamPos.current && controlsRef.current) {
      camera.position.lerp(targetCamPos.current, 0.05);
      controlsRef.current.target.lerp(targetLookAt.current, 0.05);
      controlsRef.current.update();

      if (camera.position.distanceTo(targetCamPos.current) < 0.05) {
        targetCamPos.current = null;
      }
    }

    const dist = camera.position.length();
    setCameraDistance(dist);
  });

  const isTerrain = activeView === 'terrain_prototype';

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={isTerrain ? 0.9 : 2.35}
      maxDistance={isTerrain ? 12.0 : 15.0}
      rotateSpeed={0.8}
      zoomSpeed={1.0}
      maxPolarAngle={isTerrain ? Math.PI / 2.05 : Math.PI}
    />
  );
}
