'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/store/useMissionStore';
import { getSurfaceZ, sampleSlopeAtUV } from '@/utils/demSampler';

interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export default function AstronautController() {
  const { camera, gl } = useThree();
  const isAstronautMode = useMissionStore((state) => state.isAstronautMode);
  const setAstronautMode = useMissionStore((state) => state.setAstronautMode);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);
  const setAstronautPose = useMissionStore((state) => state.setAstronautPose);

  // Astronaut local position on the 8x8 plane (range -3.8 to +3.8)
  const posRef = useRef<THREE.Vector2>(new THREE.Vector2(0, -0.6));
  const yawRef = useRef<number>(0); // radians around local Up (Z)
  const pitchRef = useRef<number>(0); // radians pitch
  const keysRef = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  const isLockedRef = useRef(false);

  // Keyboard Event Listeners
  useEffect(() => {
    if (!isAstronautMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.sprint = true;
          break;
        case 'Escape':
          setAstronautMode(false);
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.sprint = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAstronautMode, setAstronautMode]);

  // PointerLock Mouse Controls
  useEffect(() => {
    if (!isAstronautMode) return;

    const domElement = gl.domElement;

    const handlePointerLockChange = () => {
      isLockedRef.current = document.pointerLockElement === domElement;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;

      const sensitivity = 0.0022;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current -= e.movementY * sensitivity;

      // Clamp pitch between -70 deg and +70 deg
      const maxPitch = (70 * Math.PI) / 180;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    const handleClick = () => {
      if (!isLockedRef.current && isAstronautMode) {
        domElement.requestPointerLock?.();
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    domElement.addEventListener('mousemove', handleMouseMove);
    domElement.addEventListener('click', handleClick);

    // Automatically request pointer lock when entering astronaut mode
    domElement.requestPointerLock?.();

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      domElement.removeEventListener('mousemove', handleMouseMove);
      domElement.removeEventListener('click', handleClick);
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [isAstronautMode, gl.domElement]);

  // Animation Frame Loop: Movement & Exact Surface Height Integration
  useFrame((_, delta) => {
    if (!isAstronautMode) return;

    const keys = keysRef.current;

    // Physical slope-aware speed modulation:
    const currentU = posRef.current.x / 8.0 + 0.5;
    const currentV = posRef.current.y / 8.0 + 0.5;
    const slopeDeg = sampleSlopeAtUV(currentU, currentV);

    let slopeSpeedFactor = 1.0;
    if (slopeDeg > 12.0) {
      slopeSpeedFactor = 0.35; // Steep scree incline
    } else if (slopeDeg > 8.0) {
      slopeSpeedFactor = 0.65; // Moderate incline
    }

    const baseSpeed = (keys.sprint ? 1.6 : 0.85) * slopeSpeedFactor; // scene units per second
    const moveDist = baseSpeed * Math.min(delta, 0.1);

    // Movement relative to current yaw heading
    const yaw = yawRef.current;
    const forwardX = -Math.sin(yaw);
    const forwardY = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightY = Math.sin(yaw);

    let moveX = 0;
    let moveY = 0;

    if (keys.forward) {
      moveX += forwardX * moveDist;
      moveY += forwardY * moveDist;
    }
    if (keys.backward) {
      moveX -= forwardX * moveDist;
      moveY -= forwardY * moveDist;
    }
    if (keys.right) {
      moveX += rightX * moveDist;
      moveY += rightY * moveDist;
    }
    if (keys.left) {
      moveX -= rightX * moveDist;
      moveY -= rightY * moveDist;
    }

    // Passability check: Slopes > 15.0° are impassable barriers (matching backend solver)
    const candidateX = Math.max(-3.7, Math.min(3.7, posRef.current.x + moveX));
    const candidateY = Math.max(-3.7, Math.min(3.7, posRef.current.y + moveY));
    const targetU = candidateX / 8.0 + 0.5;
    const targetV = candidateY / 8.0 + 0.5;
    const targetSlopeDeg = sampleSlopeAtUV(targetU, targetV);

    if (targetSlopeDeg <= 15.0) {
      posRef.current.x = candidateX;
      posRef.current.y = candidateY;
    }

    // Convert local plane coords [-4, 4] to normalized UV [0, 1]
    const u = posRef.current.x / 8.0 + 0.5;
    const v = posRef.current.y / 8.0 + 0.5;

    // Stylized first-person perspective: eye height offset 0.045 scene units
    const eyeHeight = 0.045;
    const surfaceZ = getSurfaceZ(u, v, terrainExaggeration) + eyeHeight;

    // Terrain group transform:
    // rotation: [-Math.PI / 2.3, 0, 0]
    // position: [0, -0.5, 0]
    const terrainRot = new THREE.Euler(-Math.PI / 2.3, 0, 0, 'XYZ');
    const localPos = new THREE.Vector3(posRef.current.x, posRef.current.y, surfaceZ);
    const worldPos = localPos.clone().applyEuler(terrainRot).add(new THREE.Vector3(0, -0.5, 0));

    // Direction vector in local space
    const pitch = pitchRef.current;
    const localDir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.cos(yaw) * Math.cos(pitch),
      Math.sin(pitch)
    ).normalize();

    const worldDir = localDir.clone().applyEuler(terrainRot);
    const worldTarget = worldPos.clone().add(worldDir);

    // Set camera position and orientation
    camera.position.copy(worldPos);
    camera.up.set(0, 0, 1).applyEuler(terrainRot);
    camera.lookAt(worldTarget);

    // Sync pose to store for Minimap & HUD
    const headingDeg = (Math.round(((-yaw * 180) / Math.PI) % 360) + 360) % 360;
    const currentSpeed = (moveX !== 0 || moveY !== 0) ? (keys.sprint ? 5.5 : 3.0) * slopeSpeedFactor : 0;

    setAstronautPose({
      x: posRef.current.x,
      y: posRef.current.y,
      z: surfaceZ,
      headingDeg,
      pitchDeg: Math.round((pitch * 180) / Math.PI),
      speed: currentSpeed,
    });
  });

  return null;
}
