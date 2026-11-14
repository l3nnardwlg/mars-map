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

  // Map Mars coordinates into local terrain plane space with guaranteed surface clearance
  const localPoints = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return null;

    return currentRoute.waypoints.map((wp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);

      // Center around (0,0) on plane [-planeSize/2, planeSize/2]
      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;

      // Scaled displacement elevation Z (matching displacement map)
      const normElev = Math.max(0.1, Math.min(1.0, ((wp.elevationMeters ?? -2200) - (-2560)) / 1320));
      // Guaranteed clearance above highest surface vertices (+0.18 scene units)
      const localZ = (normElev * 0.55 * terrainExaggeration) + 0.16;

      return new THREE.Vector3(localX, localY, localZ);
    });
  }, [currentRoute, planeSize, terrainExaggeration]);

  // Construct 3D smooth curve & prominent tube
  const tubeGeometry = useMemo(() => {
    if (!localPoints || localPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(localPoints);
    return new THREE.TubeGeometry(curve, 120, 0.065, 10, false);
  }, [localPoints]);

  const startPoint = useMemo(() => {
    if (!routeStart) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeStart.latitude, routeStart.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = Math.max(0.1, Math.min(1.0, ((routeStart.elevationMeters ?? -2450) - (-2560)) / 1320));
    const localZ = (normElev * 0.55 * terrainExaggeration) + 0.22;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeStart, planeSize, terrainExaggeration]);

  const endPoint = useMemo(() => {
    if (!routeEnd) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeEnd.latitude, routeEnd.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const normElev = Math.max(0.1, Math.min(1.0, ((routeEnd.elevationMeters ?? -2200) - (-2560)) / 1320));
    const localZ = (normElev * 0.55 * terrainExaggeration) + 0.22;
    return new THREE.Vector3(localX, localY, localZ);
  }, [routeEnd, planeSize, terrainExaggeration]);

  return (
    <group renderOrder={999}>
      {/* High-visibility Neon Glowing 3D Route Tube (Rendered over terrain) */}
      {tubeGeometry && (
        <mesh geometry={tubeGeometry} renderOrder={999}>
          <meshBasicMaterial
            color="#00f5ff"
            depthTest={false}
            transparent
            opacity={0.92}
          />
        </mesh>
      )}

      {/* Start Waypoint Beacon (Glowing Emerald Green) */}
      {startPoint && (
        <group position={startPoint} renderOrder={1000}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#22c55e" depthTest={false} />
          </mesh>
          <Html center distanceFactor={7}>
            <div className="pointer-events-none rounded bg-emerald-950/95 border border-emerald-400 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 whitespace-nowrap shadow-xl">
              🟢 START (EVA-01)
            </div>
          </Html>
        </group>
      )}

      {/* Destination Waypoint Beacon (Glowing Red) */}
      {endPoint && (
        <group position={endPoint} renderOrder={1000}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#ef4444" depthTest={false} />
          </mesh>
          <Html center distanceFactor={7}>
            <div className="pointer-events-none rounded bg-red-950/95 border border-red-400 px-2 py-0.5 text-[10px] font-mono font-bold text-red-300 whitespace-nowrap shadow-xl">
              🎯 TARGET DESTINATION
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
