'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { Html } from '@react-three/drei';
import RouteMesh from './RouteMesh';

export default function TerrainPrototype() {
  const meshRef = useRef<THREE.Mesh>(null);

  const terrainWireframe = useMissionStore((state) => state.terrainWireframe);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setRoutePoint = useMissionStore((state) => state.setRoutePoint);

  // Load NASA DEM heightmap, Ortho texture, and calculated Slope Risk map
  const [demMap, orthoMap, slopeMap] = useLoader(TextureLoader, [
    '/terrain/jezero_dem.png',
    '/terrain/jezero_ortho.jpg',
    '/terrain/jezero_slope.png',
  ]);

  useMemo(() => {
    if (demMap) {
      demMap.wrapS = THREE.ClampToEdgeWrapping;
      demMap.wrapT = THREE.ClampToEdgeWrapping;
      demMap.minFilter = THREE.LinearFilter;
      demMap.magFilter = THREE.LinearFilter;
    }
    if (orthoMap) {
      orthoMap.colorSpace = THREE.SRGBColorSpace;
      orthoMap.wrapS = THREE.ClampToEdgeWrapping;
      orthoMap.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (slopeMap) {
      slopeMap.colorSpace = THREE.SRGBColorSpace;
      slopeMap.wrapS = THREE.ClampToEdgeWrapping;
      slopeMap.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [demMap, orthoMap, slopeMap]);

  // Hypsometric Colormap texture
  const hypsometricMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 256, 0);
      gradient.addColorStop(0.0, '#1e1b4b'); // Deep crater floor (-2500m)
      gradient.addColorStop(0.2, '#0284c7'); // Lower basin
      gradient.addColorStop(0.4, '#10b981'); // Alluvial plains
      gradient.addColorStop(0.65, '#f59e0b'); // Delta deposits
      gradient.addColorStop(0.85, '#ef4444'); // Crater rim slope
      gradient.addColorStop(1.0, '#ffffff'); // Highest ridge (-1200m)
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  const activeTexture = useMemo(() => {
    if (terrainColorMode === 'hypsometric') return hypsometricMap;
    if (terrainColorMode === 'slope') return slopeMap;
    return orthoMap;
  }, [terrainColorMode, hypsometricMap, slopeMap, orthoMap]);

  // Interactive Click on Terrain to pick Start / Destination waypoint
  const handleTerrainClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();

    // Map UV (0..1) to Jezero Crater Bounding Box [17.58, 19.29]N, [76.99, 78.58]E
    const lat = 17.58 + e.uv.y * (19.29 - 17.58);
    const lon = 76.99 + e.uv.x * (78.58 - 76.99);

    setRoutePoint({
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
    });
  };

  return (
    <group position={[0, -0.5, 0]} rotation={[-Math.PI / 2.3, 0, 0]}>
      {/* 3D Displaced Terrain Mesh */}
      <mesh
        ref={meshRef}
        receiveShadow
        castShadow
        onClick={handleTerrainClick}
      >
        <planeGeometry args={[8, 8, 384, 384]} />
        <meshStandardMaterial
          map={activeTexture}
          displacementMap={demMap}
          displacementScale={0.55 * terrainExaggeration}
          displacementBias={-0.1}
          wireframe={terrainWireframe}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      {/* 3D Rendered Route and Waypoint Beacons */}
      <RouteMesh planeSize={8} />

      {/* Surface Landmark Tags */}
      <group position={[-2.2, 0.4, 0.4]}>
        <Html center distanceFactor={8}>
          <div className="pointer-events-none rounded bg-black/85 px-2 py-1 text-[10px] font-mono text-amber-300 border border-amber-500/40 backdrop-blur-sm whitespace-nowrap shadow-md">
            🌊 Neretva Vallis (Inlet Breach)
          </div>
        </Html>
      </group>

      <group position={[-0.4, 0.6, 0.2]}>
        <Html center distanceFactor={8}>
          <div className="pointer-events-none rounded bg-black/85 px-2 py-1 text-[10px] font-mono text-sky-300 border border-sky-500/40 backdrop-blur-sm whitespace-nowrap shadow-md">
            🎯 Ancient Jezero Delta Fan
          </div>
        </Html>
      </group>

      <group position={[1.2, 0.1, -0.3]}>
        <Html center distanceFactor={8}>
          <div className="pointer-events-none rounded bg-black/85 px-2 py-1 text-[10px] font-mono text-zinc-300 border border-zinc-700 backdrop-blur-sm whitespace-nowrap shadow-md">
            Elevation: -2,500 m (Lakebed)
          </div>
        </Html>
      </group>
    </group>
  );
}
