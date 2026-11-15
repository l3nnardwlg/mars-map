'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { getSurfaceZ } from '@/utils/demSampler';
import { SciencePoint } from '@/types/mars';
import { Html } from '@react-three/drei';

interface SciencePointsLayerProps {
  planeSize?: number;
}

function SciencePointMarker({ 
  point, 
  planeSize, 
  terrainExaggeration 
}: { 
  point: SciencePoint; 
  planeSize: number; 
  terrainExaggeration: number;
}) {
  const selectedPoint = useMissionStore((state) => state.selectedSciencePoint);
  const selectSciencePoint = useMissionStore((state) => state.selectSciencePoint);
  const routeToSciencePoint = useMissionStore((state) => state.routeToSciencePoint);

  const isSelected = selectedPoint?.id === point.id;

  const pos = useMemo(() => {
    const { x: nx, y: ny } = jezeroLatLonToLocal(point.location.latitude, point.location.longitude);
    const localX = (nx - 0.5) * planeSize;
    const localY = (ny - 0.5) * planeSize;
    const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);

    return new THREE.Vector3(localX, localY, surfaceZ + 0.012);
  }, [point, planeSize, terrainExaggeration]);

  return (
    <group position={pos} renderOrder={998}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          selectSciencePoint(isSelected ? null : point);
        }}
      >
        <octahedronGeometry args={[isSelected ? 0.035 : 0.02, 0]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : '#38bdf8'}
          depthTest={false}
        />
      </mesh>

      {/* Tiny compact badge on select/hover */}
      {isSelected && (
        <Html position={[0, 0, 0.05]} center style={{ pointerEvents: 'auto', userSelect: 'none' }}>
          <div className="flex flex-col items-center gap-1 rounded bg-black/90 border border-amber-400 p-2 text-[10px] font-mono text-zinc-200 shadow-2xl backdrop-blur-md w-48 pointer-events-auto">
            <div className="flex items-center gap-1 font-bold text-amber-300 border-b border-zinc-800 pb-1 w-full">
              <span>🔬</span>
              <span className="truncate">{point.name}</span>
            </div>
            <p className="text-[9px] text-zinc-400 line-clamp-2 leading-relaxed">
              {point.description}
            </p>
            <div className="flex gap-1 w-full mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  routeToSciencePoint(point);
                }}
                className="flex-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold py-1 text-[9px] transition"
              >
                Plan Route Here
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function SciencePointsLayer({ planeSize = 8 }: SciencePointsLayerProps) {
  const showSciencePoints = useMissionStore((state) => state.showSciencePoints);
  const sciencePoints = useMissionStore((state) => state.sciencePoints);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  if (!showSciencePoints) return null;

  return (
    <group>
      {sciencePoints.map((point) => (
        <SciencePointMarker
          key={point.id}
          point={point}
          planeSize={planeSize}
          terrainExaggeration={terrainExaggeration}
        />
      ))}
    </group>
  );
}
