'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { MARS_RADIUS_SCENE, MARS_AXIAL_TILT_RAD } from '@/utils/coordinates';
import { useMissionStore, MARS_LANDMARKS } from '@/store/useMissionStore';
import Atmosphere from './Atmosphere';
import LandmarkMarker from './LandmarkMarker';

export default function MarsGlobe() {
  const globeGroupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  const isAutoRotating = useMissionStore((state) => state.isAutoRotating);
  const selectedLandmark = useMissionStore((state) => state.selectedLandmark);

  // Load 8K textures
  const [colorMap, bumpMap] = useLoader(TextureLoader, [
    '/textures/mars_color.jpg',
    '/textures/mars_bump.jpg',
  ]);

  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    const maxAniso = gl.capabilities.getMaxAnisotropy?.() || 16;

    if (colorMap) {
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.wrapS = THREE.ClampToEdgeWrapping;
      colorMap.wrapT = THREE.ClampToEdgeWrapping;
      colorMap.minFilter = THREE.LinearMipmapLinearFilter;
      colorMap.magFilter = THREE.LinearFilter;
      colorMap.anisotropy = Math.min(16, maxAniso);
      colorMap.generateMipmaps = true;
      colorMap.needsUpdate = true;
    }
    if (bumpMap) {
      bumpMap.wrapS = THREE.ClampToEdgeWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
      bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
      bumpMap.magFilter = THREE.LinearFilter;
      bumpMap.anisotropy = Math.min(16, maxAniso);
      bumpMap.generateMipmaps = true;
      bumpMap.needsUpdate = true;
      /* eslint-enable react-hooks/immutability */
    }
  }, [colorMap, bumpMap, gl]);

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
        {/* Main Mars Globe Mesh with 128x128 high-fidelity sphere subdivision */}
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[MARS_RADIUS_SCENE, 128, 128]} />
          <meshStandardMaterial
            map={colorMap}
            bumpMap={bumpMap}
            bumpScale={0.08}
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
