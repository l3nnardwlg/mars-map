'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import MarsGlobe from './MarsGlobe';
import TerrainPrototype from './TerrainPrototype';
import CameraRig from './CameraRig';
import { useMissionStore } from '@/store/useMissionStore';

function SceneLoadingFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-amber-500 font-mono z-50">
      <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
      <div className="text-sm tracking-wider uppercase">Loading Planetary Assets...</div>
      <div className="text-xs text-zinc-500 mt-1">NASA MOLA Elevation & High-Res Textures</div>
    </div>
  );
}

export default function MarsScene() {
  const activeView = useMissionStore((state) => state.activeView);

  return (
    <div className="relative w-full h-full bg-[#030308] overflow-hidden">
      <Suspense fallback={<SceneLoadingFallback />}>
        <Canvas
          camera={{
            position: [0, 1.5, 6.0],
            fov: 45,
            near: 0.1,
            far: 1000,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          {/* Deep Space Background Stars */}
          <Stars
            radius={120}
            depth={60}
            count={4000}
            factor={3.5}
            saturation={0}
            fade
            speed={0.5}
          />

          {/* Solar Illumination */}
          <ambientLight intensity={activeView === 'globe' ? 0.12 : 0.25} color="#ffe8d6" />
          <directionalLight
            position={activeView === 'globe' ? [12, 6, 10] : [6, 10, 8]}
            intensity={activeView === 'globe' ? 2.8 : 3.2}
            color="#fff8f2"
            castShadow
          />

          {/* Secondary Fill Light */}
          <directionalLight
            position={[-10, -4, -8]}
            intensity={0.12}
            color="#38bdf8"
          />

          {/* Mode Switch: 3D Mars Globe vs. DEM Terrain Prototype */}
          {activeView === 'globe' ? <MarsGlobe /> : <TerrainPrototype />}

          <CameraRig />
        </Canvas>
      </Suspense>
    </div>
  );
}
