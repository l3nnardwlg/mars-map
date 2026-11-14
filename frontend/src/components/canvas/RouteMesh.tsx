'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { Html } from '@react-three/drei';

interface RouteMeshProps {
  planeSize?: number;
}

export default function RouteMesh({ planeSize = 7 }: RouteMeshProps) {
  const currentRoute = useMissionStore((state) => state.currentRoute);
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  // Map Mars coordinates into local terrain plane space
  const localPoints = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return null;

    return currentRoute.waypoints.map((wp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);

      // Center around (0,0) on plane [-planeSize/2, planeSize/2]
      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;

      // Scaled displacement elevation Z (matching displacement map)
      const normElev = ((wp.elevationMeters ?? -2400) - (-2560)) / (1320);
      const localZ = (normElev * 0.9 * terrainExaggeration) - 0.2 + 0.06;

      return new THREE.Vector3(localX, localY, localZ);
    });
  }, [currentRoute, planeSize, terrainExaggeration]);

  // Construct 3D smooth curve & tube
  const tubeGeometry = useMemo(() => {
    if (!localPoints || localPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(localPoints);
    return new THREE.TubeGeometry(curve, 100, 0.032, 8, false);
  }, [localPoints]);

  const startPoint = useMemo(() => {
    if (!routeStart) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeStart.latitude, routeStart.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = ((routeStart.elevationMeters ?? -2450) - (-2560)) / (1320);
    const localZ = (normElev * 0.9 * terrainExaggeration) - 0.2 + 0.08;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeStart, planeSize, terrainExaggeration]);

  const endPoint = useMemo(() => {
    if (!routeEnd) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeEnd.latitude, routeEnd.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = ((routeEnd.elevationMeters ?? -2200) - (-2560)) / (1320);
    const localZ = (normElev * 0.9 * terrainExaggeration) - 0.2 + 0.08;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeEnd, planeSize, terrainExaggeration]);

  return (
    <group>
      {/* Glowing 3D Path Tube */}
      {tubeGeometry && (
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={2.8}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      )}

      {/* Start Waypoint Beacon (Green) */}
      {startPoint && (
        <group position={startPoint}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial
              color="#22c55e"
              emissive="#16a34a"
              emissiveIntensity={3.0}
            />
          </mesh>
          <Html center distanceFactor={7}>
            <div className="pointer-events-none rounded bg-emerald-950/90 border border-emerald-400 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 whitespace-nowrap shadow-lg">
              START (EVA-01)
            </div>
          </Html>
        </group>
      )}

      {/* Destination Waypoint Beacon (Red/Amber) */}
      {endPoint && (
        <group position={endPoint}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={3.0}
            />
          </mesh>
          <Html center distanceFactor={7}>
            <div className="pointer-events-none rounded bg-red-950/90 border border-red-400 px-1.5 py-0.5 text-[9px] font-mono text-red-300 whitespace-nowrap shadow-lg">
              TARGET DESTINATION
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
