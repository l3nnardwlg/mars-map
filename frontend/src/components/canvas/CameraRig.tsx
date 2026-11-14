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

  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);
  const setCameraDistance = useMissionStore((state) => state.setCameraDistance);
  const cameraDesiredPosition = useMissionStore((state) => state.cameraDesiredPosition);
  const setCameraDesiredPosition = useMissionStore((state) => state.setCameraDesiredPosition);

  // Target destination vector for smooth camera transitions
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // React to landmark selection or reset
  useEffect(() => {
    if (selectedLandmark) {
      // Landmark surface coordinate in un-tilted coordinate space
      const localPos = latLonToVector3(
        selectedLandmark.coordinate.latitude,
        selectedLandmark.coordinate.longitude,
        MARS_RADIUS_SCENE
      );

      // Apply Martian axial tilt (Z-axis rotation by 25.19°)
      const tiltedPos = localPos.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), MARS_AXIAL_TILT_RAD);

      // Look target is the landmark
      targetLookAt.current.copy(tiltedPos);

      // Camera position offset slightly above the landmark for zoomed perspective
      const viewOffset = tiltedPos.clone().normalize().multiplyScalar(3.2);
      targetCamPos.current = viewOffset;
    } else if (cameraDesiredPosition) {
      targetCamPos.current = new THREE.Vector3(...cameraDesiredPosition);
      targetLookAt.current.set(0, 0, 0);
      setCameraDesiredPosition(null);
    }
  }, [selectedLandmark, cameraDesiredPosition, setCameraDesiredPosition]);

  useFrame(() => {
    // Smooth transition interpolation
    if (targetCamPos.current && controlsRef.current) {
      camera.position.lerp(targetCamPos.current, 0.05);
      controlsRef.current.target.lerp(targetLookAt.current, 0.05);
      controlsRef.current.update();

      // Stop interpolating once close enough
      if (camera.position.distanceTo(targetCamPos.current) < 0.05) {
        targetCamPos.current = null;
      }
    }

    // Update camera distance for telemetry HUD
    const dist = camera.position.length();
    setCameraDistance(dist);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={2.35}
      maxDistance={15.0}
      rotateSpeed={0.8}
      zoomSpeed={1.0}
    />
  );
}
