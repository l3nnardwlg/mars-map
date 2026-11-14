'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { Html } from '@react-three/drei';

interface RouteMeshProps {
  planeSize?: number;
}

export default function RouteMesh({ planeSize = 8 }: RouteMeshProps) {
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  // Map Mars coordinates into local terrain plane space
  const localPoints = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return null;

    return currentRoute.waypoints.map((wp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);

      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;

      // Realistic elevation clearance
      const normElev = Math.max(0.05, Math.min(1.0, ((wp.elevationMeters ?? -2300) - (-2560)) / 1320));
      const localZ = (normElev * 0.55 * terrainExaggeration) + 0.045;

      return new THREE.Vector3(localX, localY, localZ);
    });
  }, [currentRoute, planeSize, terrainExaggeration]);

  // Precision 3D smooth curve & thin tactical path
  const tubeGeometry = useMemo(() => {
    if (!localPoints || localPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(localPoints);
    // Radius 0.022: precision GPS trail (not thick hose)
    return new THREE.TubeGeometry(curve, 160, 0.022, 8, false);
  }, [localPoints]);

  const startPoint = useMemo(() => {
    if (!routeStart) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeStart.latitude, routeStart.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = Math.max(0.05, Math.min(1.0, ((routeStart.elevationMeters ?? -2450) - (-2560)) / 1320));
    const localZ = (normElev * 0.55 * terrainExaggeration) + 0.05;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeStart, planeSize, terrainExaggeration]);

  const endPoint = useMemo(() => {
    if (!routeEnd) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeEnd.latitude, routeEnd.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = Math.max(0.05, Math.min(1.0, ((routeEnd.elevationMeters ?? -2200) - (-2560)) / 1320));
    const localZ = (normElev * 0.55 * terrainExaggeration) + 0.05;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeEnd, planeSize, terrainExaggeration]);

  // Intermediate breadcrumb milestones
  const intermediateWaypoints = useMemo(() => {
    if (!localPoints || localPoints.length < 10) return [];
    const step = Math.floor(localPoints.length / 5);
    const milestones = [];
    for (let i = step; i < localPoints.length - 1; i += step) {
      milestones.push(localPoints[i]);
    }
    return milestones;
  }, [localPoints]);

  return (
    <group renderOrder={999}>
      {/* Precision Tactical Laser Path */}
      {tubeGeometry && (
        <mesh geometry={tubeGeometry} renderOrder={999}>
          <meshBasicMaterial
            color="#00f5ff"
            depthTest={false}
            transparent
            opacity={0.95}
          />
        </mesh>
      )}

      {/* Intermediate Waypoint Dots */}
      {intermediateWaypoints.map((pt, i) => (
        <mesh key={i} position={pt} renderOrder={999}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color="#38bdf8" depthTest={false} />
        </mesh>
      ))}

      {/* Sleek Tactical START Pin */}
      {startPoint && (
        <group position={startPoint} renderOrder={1000}>
          {/* Ground Contact Pulse Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.07, 24]} />
            <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          {/* Vertical Needle Stem */}
          <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.36, 8]} />
            <meshBasicMaterial color="#22c55e" depthTest={false} />
          </mesh>

          {/* Needle Head */}
          <mesh position={[0, 0, 0.36]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshBasicMaterial color="#4ade80" depthTest={false} />
          </mesh>

          {/* Compact HUD Pill Label */}
          <Html position={[0, 0, 0.42]} center distanceFactor={14}>
            <div className="pointer-events-none flex items-center gap-1 rounded-full bg-black/90 border border-emerald-400/80 px-2 py-0.5 text-[10px] font-mono text-emerald-300 shadow-xl backdrop-blur-sm whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold tracking-wide">START</span>
              <span className="text-[9px] text-zinc-400">
                {routeStart?.latitude.toFixed(3)}°N
              </span>
            </div>
          </Html>
        </group>
      )}

      {/* Sleek Tactical TARGET Pin */}
      {endPoint && (
        <group position={endPoint} renderOrder={1000}>
          {/* Ground Contact Pulse Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.07, 24]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          {/* Vertical Needle Stem */}
          <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.36, 8]} />
            <meshBasicMaterial color="#ef4444" depthTest={false} />
          </mesh>

          {/* Needle Head */}
          <mesh position={[0, 0, 0.36]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshBasicMaterial color="#f87171" depthTest={false} />
          </mesh>

          {/* Compact HUD Pill Label */}
          <Html position={[0, 0, 0.42]} center distanceFactor={14}>
            <div className="pointer-events-none flex items-center gap-1 rounded-full bg-black/90 border border-red-400/80 px-2 py-0.5 text-[10px] font-mono text-red-300 shadow-xl backdrop-blur-sm whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="font-bold tracking-wide">TARGET</span>
              <span className="text-[9px] text-zinc-400">
                {routeEnd?.latitude.toFixed(3)}°N
              </span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
