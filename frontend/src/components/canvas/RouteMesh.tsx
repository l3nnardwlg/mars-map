'use client';

import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { initDemSampler, getSurfaceZ } from '@/utils/demSampler';
import { Html } from '@react-three/drei';

interface RouteMeshProps {
  planeSize?: number;
}

export default function RouteMesh({ planeSize = 8 }: RouteMeshProps) {
  const [demLoaded, setDemLoaded] = useState(false);

  const currentRoute = useMissionStore((state) => state.currentRoute);
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  useEffect(() => {
    initDemSampler().then(() => setDemLoaded(true));
  }, []);

  // Map Mars coordinates into local terrain plane space with exact surface adherence
  const localPoints = useMemo(() => {
    if (!currentRoute || currentRoute.waypoints.length < 2) return null;

    return currentRoute.waypoints.map((wp) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);

      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;

      // Sample exact surface displacement height + 0.012 clearance
      const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);
      const localZ = surfaceZ + 0.014;

      return new THREE.Vector3(localX, localY, localZ);
    });
  }, [currentRoute, planeSize, terrainExaggeration, demLoaded]);

  // Precision 3D smooth curve & thin tactical path
  const tubeGeometry = useMemo(() => {
    if (!localPoints || localPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(localPoints);
    return new THREE.TubeGeometry(curve, 160, 0.016, 8, false);
  }, [localPoints]);

  // Exact Start Point anchored on surface
  const startPointData = useMemo(() => {
    if (!routeStart) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeStart.latitude, routeStart.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);

    return {
      base: new THREE.Vector3(localX, localY, surfaceZ + 0.003),
      stemPos: new THREE.Vector3(localX, localY, surfaceZ + 0.045),
      headPos: new THREE.Vector3(localX, localY, surfaceZ + 0.09),
    };
  }, [routeStart, planeSize, terrainExaggeration, demLoaded]);

  // Exact Destination Point anchored on surface
  const endPointData = useMemo(() => {
    if (!routeEnd) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(routeEnd.latitude, routeEnd.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);

    return {
      base: new THREE.Vector3(localX, localY, surfaceZ + 0.003),
      stemPos: new THREE.Vector3(localX, localY, surfaceZ + 0.045),
      headPos: new THREE.Vector3(localX, localY, surfaceZ + 0.09),
    };
  }, [routeEnd, planeSize, terrainExaggeration, demLoaded]);

  return (
    <group renderOrder={999}>
      {/* Precision Tactical Laser Path adhering tightly to terrain contours */}
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

      {/* START Pin: Anchored right on the ground surface */}
      {startPointData && (
        <group renderOrder={1000}>
          {/* Ground Footprint Ring */}
          <mesh position={startPointData.base} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.045, 24]} />
            <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          {/* Micro Vertical Needle Stem */}
          <mesh position={startPointData.stemPos} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.08, 8]} />
            <meshBasicMaterial color="#22c55e" depthTest={false} />
          </mesh>

          {/* Needle Head Point */}
          <mesh position={startPointData.headPos}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshBasicMaterial color="#4ade80" depthTest={false} />
          </mesh>

          {/* Fixed-Size HUD Tag (Does NOT blow up on zoom!) */}
          <Html
            position={[startPointData.headPos.x, startPointData.headPos.y, startPointData.headPos.z + 0.03]}
            center
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div className="flex items-center gap-1 rounded bg-black/85 border border-emerald-400/70 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 shadow-lg whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-bold">START</span>
            </div>
          </Html>
        </group>
      )}

      {/* TARGET Pin: Anchored right on the ground surface */}
      {endPointData && (
        <group renderOrder={1000}>
          {/* Ground Footprint Ring */}
          <mesh position={endPointData.base} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.045, 24]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          {/* Micro Vertical Needle Stem */}
          <mesh position={endPointData.stemPos} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.08, 8]} />
            <meshBasicMaterial color="#ef4444" depthTest={false} />
          </mesh>

          {/* Needle Head Point */}
          <mesh position={endPointData.headPos}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshBasicMaterial color="#f87171" depthTest={false} />
          </mesh>

          {/* Fixed-Size HUD Tag (Does NOT blow up on zoom!) */}
          <Html
            position={[endPointData.headPos.x, endPointData.headPos.y, endPointData.headPos.z + 0.03]}
            center
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div className="flex items-center gap-1 rounded bg-black/85 border border-red-400/70 px-1.5 py-0.5 text-[9px] font-mono text-red-300 shadow-lg whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="font-bold">TARGET</span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
