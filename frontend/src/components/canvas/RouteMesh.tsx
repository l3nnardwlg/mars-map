'use client';

import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { initDemSampler, getSurfaceZ } from '@/utils/demSampler';
import { MarsCoordinate } from '@/types/mars';
import { Html } from '@react-three/drei';

interface RouteMeshProps {
  planeSize?: number;
}

function buildPathGeometry(
  waypoints: MarsCoordinate[],
  planeSize: number,
  terrainExaggeration: number,
  radius: number = 0.018
) {
  if (waypoints.length < 2) return null;

  const points = waypoints.map((wp) => {
    const { x: nx, y: ny } = jezeroLatLonToLocal(wp.latitude, wp.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);
    return new THREE.Vector3(localX, localY, surfaceZ + 0.014);
  });

  // Strict linear polyline path adhering faithfully to solver waypoints without spline overshoot
  const curvePath = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]));
  }
  const tubularSegments = Math.max(points.length * 2, 80);
  return new THREE.TubeGeometry(curvePath, tubularSegments, radius, 8, false);
}

export default function RouteMesh({ planeSize = 8 }: RouteMeshProps) {
  const [demLoaded, setDemLoaded] = useState(false);

  const currentRoute = useMissionStore((state) => state.currentRoute);
  const alternativeRoutes = useMissionStore((state) => state.alternativeRoutes);
  const selectedRouteProfile = useMissionStore((state) => state.selectedRouteProfile);
  const routeStart = useMissionStore((state) => state.routeStart);
  const routeEnd = useMissionStore((state) => state.routeEnd);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const hoveredRoutePoint = useMissionStore((state) => state.hoveredRoutePoint);

  useEffect(() => {
    initDemSampler().then(() => setDemLoaded(true));
  }, []);

  // Primary Active Route Geometry
  const activeGeometry = useMemo(() => {
    if (!currentRoute || !demLoaded) return null;
    return buildPathGeometry(currentRoute.waypoints, planeSize, terrainExaggeration, 0.018);
  }, [currentRoute, planeSize, terrainExaggeration, demLoaded]);

  // Secondary Inactive Alternative Geometries (for visual route comparison)
  const secondaryGeometries = useMemo(() => {
    if (!demLoaded) return [];
    const list: { geo: THREE.TubeGeometry; color: string; profile: string }[] = [];

    (['direct', 'safe', 'science'] as const).forEach((prof) => {
      if (prof !== selectedRouteProfile && alternativeRoutes[prof]) {
        const altRoute = alternativeRoutes[prof];
        if (altRoute && altRoute.waypoints.length > 1) {
          const geo = buildPathGeometry(altRoute.waypoints, planeSize, terrainExaggeration, 0.009);
          if (geo) {
            const color = prof === 'safe' ? '#10b981' : prof === 'science' ? '#f59e0b' : '#38bdf8';
            list.push({ geo, color, profile: prof });
          }
        }
      }
    });

    return list;
  }, [alternativeRoutes, selectedRouteProfile, planeSize, terrainExaggeration, demLoaded]);

  // Exact Start Point anchored on surface
  const startPointData = useMemo(() => {
    if (!routeStart || !demLoaded) return null;
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
    if (!routeEnd || !demLoaded) return null;
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

  // Synchronized Hover Cursor from Elevation Profile Chart
  const hoveredPointData = useMemo(() => {
    if (!hoveredRoutePoint || !demLoaded) return null;
    const { x: nx, y: ny } = jezeroLatLonToLocal(hoveredRoutePoint.latitude, hoveredRoutePoint.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);
    return new THREE.Vector3(localX, localY, surfaceZ + 0.025);
  }, [hoveredRoutePoint, planeSize, terrainExaggeration, demLoaded]);

  // Active color based on profile
  const activeColor = selectedRouteProfile === 'safe' 
    ? '#22c55e' 
    : selectedRouteProfile === 'science' 
    ? '#f59e0b' 
    : '#00f5ff';

  return (
    <group renderOrder={999}>
      {/* Secondary Alternative Trails */}
      {secondaryGeometries.map((item, idx) => (
        <mesh key={idx} geometry={item.geo} renderOrder={998}>
          <meshBasicMaterial
            color={item.color}
            depthTest={false}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}

      {/* Primary Active Route Tube */}
      {activeGeometry && (
        <mesh geometry={activeGeometry} renderOrder={999}>
          <meshBasicMaterial
            color={activeColor}
            depthTest={false}
            transparent
            opacity={0.95}
          />
        </mesh>
      )}

      {/* START Pin: Anchored right on the ground surface */}
      {startPointData && (
        <group renderOrder={1000}>
          <mesh position={startPointData.base} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.045, 24]} />
            <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          <mesh position={startPointData.stemPos} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.08, 8]} />
            <meshBasicMaterial color="#22c55e" depthTest={false} />
          </mesh>

          <mesh position={startPointData.headPos}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshBasicMaterial color="#4ade80" depthTest={false} />
          </mesh>

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
          <mesh position={endPointData.base} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.045, 24]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} depthTest={false} />
          </mesh>

          <mesh position={endPointData.stemPos} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.08, 8]} />
            <meshBasicMaterial color="#ef4444" depthTest={false} />
          </mesh>

          <mesh position={endPointData.headPos}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshBasicMaterial color="#f87171" depthTest={false} />
          </mesh>

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

      {/* Synchronized Elevation Chart Hover Beacon on 3D Surface */}
      {hoveredPointData && (
        <group position={hoveredPointData} renderOrder={1002}>
          <mesh>
            <sphereGeometry args={[0.028, 16, 16]} />
            <meshBasicMaterial color="#facc15" depthTest={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.065, 32]} />
            <meshBasicMaterial color="#fde047" side={THREE.DoubleSide} depthTest={false} />
          </mesh>
          <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div className="rounded bg-black/90 border border-yellow-400 px-1.5 py-0.5 text-[9px] font-mono text-yellow-300 shadow whitespace-nowrap">
              {hoveredRoutePoint?.elevationMeters ? `${hoveredRoutePoint.elevationMeters}m MOLA` : 'WAYPOINT'}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
