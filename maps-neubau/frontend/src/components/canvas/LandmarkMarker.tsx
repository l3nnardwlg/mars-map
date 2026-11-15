'use client';

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { Landmark } from '@/types/mars';
import { latLonToVector3, MARS_RADIUS_SCENE } from '@/utils/coordinates';
import { useMissionStore } from '@/store/useMissionStore';

interface LandmarkMarkerProps {
  landmark: Landmark;
}

export default function LandmarkMarker({ landmark }: LandmarkMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const selectLandmark = useMissionStore((state) => state.selectLandmark);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);

  const isSelected = selectedLandmark?.id === landmark.id;

  const position = useMemo(() => {
    return latLonToVector3(
      landmark.coordinate.latitude,
      landmark.coordinate.longitude,
      MARS_RADIUS_SCENE,
      0.035
    );
  }, [landmark]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectLandmark(landmark);
  };

  return (
    <group position={position}>
      {/* Outer pulsing ring / indicator */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[isSelected ? 0.045 : 0.03, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#38bdf8' : hovered ? '#fb923c' : '#f97316'}
          emissive={isSelected ? '#0284c7' : hovered ? '#ea580c' : '#c2410c'}
          emissiveIntensity={isSelected ? 1.5 : hovered ? 1.0 : 0.6}
          roughness={0.2}
        />
      </mesh>

      {/* HTML Tag */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.08, 0]}
          center
          distanceFactor={6}
          zIndexRange={[100, 0]}
        >
          <div
            onClick={handleClick}
            className={`pointer-events-auto cursor-pointer rounded border px-2 py-1 text-xs font-mono whitespace-nowrap shadow-lg backdrop-blur-md transition-all ${
              isSelected
                ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                : 'border-amber-500/50 bg-black/80 text-amber-200 hover:border-amber-400'
            }`}
          >
            <div className="font-semibold flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-400 animate-ping' : 'bg-amber-400'}`} />
              {landmark.name}
            </div>
            <div className="text-[10px] text-zinc-400">
              {landmark.coordinate.latitude > 0 ? `${landmark.coordinate.latitude}°N` : `${Math.abs(landmark.coordinate.latitude)}°S`},{' '}
              {landmark.coordinate.longitude}°E
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
