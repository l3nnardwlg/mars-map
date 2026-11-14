'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { MARS_RADIUS_SCENE, MARS_AXIAL_TILT_RAD } from '@/utils/coordinates';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import Atmosphere from './Atmosphere';
import LandmarkMarker from './LandmarkMarker';

export default function MarsGlobe() {
  const globeGroupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const isAutoRotating = useMissionStore((state) => state.isAutoRotating);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);

  // Load textures
  const [colorMap, bumpMap] = useLoader(TextureLoader, [
    '/textures/mars_color.jpg',
    '/textures/mars_bump.jpg',
  ]);

  useMemo(() => {
    if (colorMap) {
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.wrapS = THREE.ClampToEdgeWrapping;
      colorMap.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (bumpMap) {
      bumpMap.wrapS = THREE.ClampToEdgeWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [colorMap, bumpMap]);

  // Handle slow planet rotation (only when auto-rotate is enabled and no landmark is focused)
  useFrame((_, delta) => {
    if (globeGroupRef.current && isAutoRotating && !selectedLandmark) {
      globeGroupRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    // Outer group with Martian axial tilt of 25.19 degrees
    <group rotation={[0, 0, MARS_AXIAL_TILT_RAD]}>
      {/* Inner group rotating around its tilted polar axis */}
      <group ref={globeGroupRef}>
        {/* Main Mars Globe Mesh */}
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[MARS_RADIUS_SCENE, 64, 64]} />
          <meshStandardMaterial
            map={colorMap}
            bumpMap={bumpMap}
            bumpScale={0.06}
            roughness={0.88}
            metalness={0.05}
          />
        </mesh>

        {/* Mars Atmospheric Glow */}
        <Atmosphere />

        {/* Science and Landing Site Markers locked to planet coordinates */}
        {MARS_LANDMARKS.map((landmark) => (
          <LandmarkMarker key={landmark.id} landmark={landmark} />
        ))}
      </group>
    </group>
  );
}
