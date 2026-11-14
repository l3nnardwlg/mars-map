'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { MARS_RADIUS_SCENE } from '@/utils/coordinates';

// Fresnel atmospheric glow shader for Mars
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 uColor;
    uniform vec3 uSunPosition;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
      fresnel = pow(fresnel, 3.2);

      // Light direction from Sun
      vec3 lightDir = normalize(uSunPosition);
      float sunDot = max(dot(vNormal, lightDir), 0.0);

      // Blend Mars dust reddish atmosphere with subtle upper limb scattering
      vec3 atmosphereColor = mix(uColor, vec3(0.85, 0.55, 0.35), fresnel * 0.5);

      float alpha = fresnel * (0.3 + 0.7 * sunDot);
      gl_FragColor = vec4(atmosphereColor, alpha * 0.85);
    }
  `,
};

export default function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#d16238') },
      uSunPosition: { value: new THREE.Vector3(12, 6, 10) },
    }),
    []
  );

  return (
    <mesh scale={1.03}>
      <sphereGeometry args={[MARS_RADIUS_SCENE, 64, 64]} />
      <shaderMaterial
        vertexShader={AtmosphereShader.vertexShader}
        fragmentShader={AtmosphereShader.fragmentShader}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
