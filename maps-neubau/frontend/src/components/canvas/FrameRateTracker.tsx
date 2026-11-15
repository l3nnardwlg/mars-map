'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/store/useMissionStore';

export default function FrameRateTracker() {
  const setFpsMetrics = useMissionStore((state) => state.setFpsMetrics);
  const gl = useThree((state) => state.gl);

  const frameCount = useRef(0);
  const lastTime = useRef<number | null>(null);
  const rollingDeltas = useRef<number[]>([]);

  useFrame(() => {
    const now = performance.now();
    if (lastTime.current === null) {
      lastTime.current = now;
      return;
    }
    const deltaMs = now - lastTime.current;
    lastTime.current = now;

    rollingDeltas.current.push(deltaMs);
    if (rollingDeltas.current.length > 30) {
      rollingDeltas.current.shift();
    }

    frameCount.current += 1;
    if (frameCount.current % 25 === 0 && rollingDeltas.current.length > 0) {
      const avgDelta = rollingDeltas.current.reduce((a, b) => a + b, 0) / rollingDeltas.current.length;
      const measuredFps = Math.min(144, Math.round(1000 / Math.max(1, avgDelta)));
      const calls = gl.info.render.calls;
      const triangles = gl.info.render.triangles;

      setFpsMetrics({
        fps: measuredFps,
        frameTimeMs: Number(avgDelta.toFixed(1)),
        drawCalls: calls,
        triangles,
      });
    }
  });

  return null;
}
