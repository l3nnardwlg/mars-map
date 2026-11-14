'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { getSurfaceZ } from '@/utils/demSampler';
import { Html } from '@react-three/drei';

interface MissionReplayFollowerProps {
  planeSize?: number;
}

export default function MissionReplayFollower({ planeSize = 8 }: MissionReplayFollowerProps) {
  const { camera } = useThree();
  const isMissionReplayPlaying = useMissionStore((state) => state.isMissionReplayPlaying);
  const replayProgress = useMissionStore((state) => state.replayProgress);
  const setReplayProgress = useMissionStore((state) => state.setReplayProgress);
  const replaySpeed = useMissionStore((state) => state.replaySpeed);
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  const markerRef = useRef<THREE.Group>(null);

  // Build CatmullRom spline from route waypoints
  const spline = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return null;

    const points = currentRoute.waypoints.map((wp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);
      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;
      const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);
      return new THREE.Vector3(localX, localY, surfaceZ + 0.02);
    });

    return new THREE.CatmullRomCurve3(points);
  }, [currentRoute, planeSize, terrainExaggeration]);

  // Frame tick: advance progress and follow rover/astronaut with camera
  useFrame((_, delta) => {
    if (!spline) return;

    if (isMissionReplayPlaying) {
      // Complete route in ~45 seconds at 1x speed
      const rate = (1.0 / 45.0) * replaySpeed;
      const nextProgress = Math.min(1.0, replayProgress + delta * rate);
      setReplayProgress(nextProgress);

      if (nextProgress >= 1.0) {
        useMissionStore.getState().toggleMissionReplay(); // Pause at end
      }
    }

    // Evaluate point on spline at current progress
    const pt = spline.getPointAt(replayProgress);
    const tangent = spline.getTangentAt(replayProgress);

    if (markerRef.current) {
      markerRef.current.position.copy(pt);
      markerRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    }

    // Camera chase mode during replay
    if (isMissionReplayPlaying) {
      const terrainRot = new THREE.Euler(-Math.PI / 2.3, 0, 0, 'XYZ');
      const worldTarget = pt.clone().applyEuler(terrainRot).add(new THREE.Vector3(0, -0.5, 0));

      // Chase camera offset behind tangent
      const chaseOffset = tangent.clone().multiplyScalar(-0.6).add(new THREE.Vector3(0, 0, 0.45));
      const worldCamPos = pt.clone().add(chaseOffset).applyEuler(terrainRot).add(new THREE.Vector3(0, -0.5, 0));

      camera.position.lerp(worldCamPos, 0.06);
      camera.lookAt(worldTarget);
    }
  });

  if (!spline || (!isMissionReplayPlaying && replayProgress === 0)) return null;

  return (
    <group ref={markerRef} renderOrder={1001}>
      {/* Astronaut / Rover 3D Beacon */}
      <mesh>
        <boxGeometry args={[0.04, 0.07, 0.03]} />
        <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={0.6} />
      </mesh>

      {/* Headlight cone */}
      <mesh position={[0, 0.06, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.08, 16]} />
        <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
      </mesh>

      {/* Floating HUD callout */}
      <Html position={[0, 0, 0.08]} center style={{ pointerEvents: 'none' }}>
        <div className="rounded-lg border border-cyan-400 bg-black/85 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300 shadow whitespace-nowrap">
          MARSWALK EVA {(replayProgress * 100).toFixed(0)}%
        </div>
      </Html>
    </group>
  );
}
