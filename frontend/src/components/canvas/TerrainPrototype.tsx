'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { Html } from '@react-three/drei';
import RouteMesh from './RouteMesh';
import SciencePointsLayer from './SciencePointsLayer';
import MeasurementLaser from './MeasurementLaser';
import MissionReplayFollower from './MissionReplayFollower';
import { 
  getElevationMetersAtUV, 
  sampleSlopeAtUV, 
  sampleAspectAtUV, 
  classifySlopeRisk, 
  NASA_DEM_METADATA 
} from '@/utils/demSampler';
import { useEffect } from 'react';

export default function TerrainPrototype() {
  const meshRef = useRef<THREE.Mesh>(null);

  const terrainWireframe = useMissionStore((state) => state.terrainWireframe);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const terrainColorMode = useMissionStore((state) => state.terrainColorMode);
  const setRoutePoint = useMissionStore((state) => state.setRoutePoint);
  const loadSciencePoints = useMissionStore((state) => state.loadSciencePoints);

  const isMeasureMode = useMissionStore((state) => state.isMeasureMode);
  const addMeasurePoint = useMissionStore((state) => state.addMeasurePoint);
  const isTerrainInspectorActive = useMissionStore((state) => state.isTerrainInspectorActive);
  const setInspectedPoint = useMissionStore((state) => state.setInspectedPoint);
  const slopeThresholdDeg = useMissionStore((state) => state.slopeThresholdDeg);

  useEffect(() => {
    loadSciencePoints();
  }, [loadSciencePoints]);

  // Load NASA DEM heightmap, Ortho texture, and calculated Slope Risk map
  const [demMap, orthoMap, slopeMap] = useLoader(TextureLoader, [
    '/terrain/jezero_dem.png',
    '/terrain/jezero_ortho.jpg',
    '/terrain/jezero_slope.png',
  ]);

  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
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
    /* eslint-enable react-hooks/immutability */
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

  // Interactive Click on Terrain
  const handleTerrainClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();

    // Map UV (0..1) to Jezero Crater Bounding Box [17.58, 19.29]N, [76.99, 78.58]E
    const lat = Number((17.58 + e.uv.y * (19.29 - 17.58)).toFixed(4));
    const lon = Number((76.99 + e.uv.x * (78.58 - 76.99)).toFixed(4));
    const elev = getElevationMetersAtUV(e.uv.x, e.uv.y);
    const slope = sampleSlopeAtUV(e.uv.x, e.uv.y);

    if (isMeasureMode) {
      addMeasurePoint({ latitude: lat, longitude: lon, elevationMeters: elev });
      return;
    }

    if (isTerrainInspectorActive) {
      const risk = classifySlopeRisk(slope, slopeThresholdDeg);
      const aspect = sampleAspectAtUV(e.uv.x, e.uv.y);
      setInspectedPoint({
        latitude: lat,
        longitude: lon,
        elevationMeters: elev,
        slopeDeg: slope,
        aspectDeg: aspect.azimuthDeg,
        compassOctant: aspect.compassOctant,
        uncertaintyMeters: NASA_DEM_METADATA.elevationUncertaintyMeters,
        sourceDataset: NASA_DEM_METADATA.productId,
        riskLevel: risk,
      });
      return;
    }

    setRoutePoint({
      latitude: lat,
      longitude: lon,
      elevationMeters: elev,
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

      {/* Real NASA Perseverance Science Sample Points */}
      <SciencePointsLayer planeSize={8} />

      {/* Phase 5: Distance Measurement Laser Tool */}
      <MeasurementLaser planeSize={8} />

      {/* Phase 5: 3D Mission Replay Rover / EVA Follower */}
      <MissionReplayFollower planeSize={8} />

      {/* Surface Landmark Tags - Fixed compact size, never scales up to cover screen */}
      <group position={[-2.2, 0.4, 0.2]}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div className="rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono text-amber-300 border border-amber-500/40 whitespace-nowrap shadow">
            🌊 Neretva Vallis
          </div>
        </Html>
      </group>

      <group position={[-0.4, 0.6, 0.15]}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div className="rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono text-sky-300 border border-sky-500/40 whitespace-nowrap shadow">
            🎯 Delta Fan
          </div>
        </Html>
      </group>

      <group position={[1.2, 0.1, -0.05]}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div className="rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 border border-zinc-800 whitespace-nowrap shadow">
            Crater Basin (-2,500m)
          </div>
        </Html>
      </group>
    </group>
  );
}
