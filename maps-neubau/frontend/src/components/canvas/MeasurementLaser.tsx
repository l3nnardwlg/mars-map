'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/store/useMissionStore';
import { jezeroLatLonToLocal } from '@/utils/coordinates';
import { getSurfaceZ } from '@/utils/demSampler';
import { Html } from '@react-three/drei';

interface MeasurementLaserProps {
  planeSize?: number;
}

export default function MeasurementLaser({ planeSize = 8 }: MeasurementLaserProps) {
  const isMeasureMode = useMissionStore((state) => state.isMeasureMode);
  const measurePoints = useMissionStore((state) => state.measurePoints);
  const terrainExaggeration = useMissionStore((state) => state.terrainExaggeration);

  const points3D = useMemo(() => {
    return measurePoints.map((pt) => {
      const { x: nx, y: ny } = jezeroLatLonToLocal(pt.latitude, pt.longitude);
      const localX = (nx - 0.5) * planeSize;
      const localY = (ny - 0.5) * planeSize;
      const surfaceZ = getSurfaceZ(nx, ny, terrainExaggeration);
      return new THREE.Vector3(localX, localY, surfaceZ + 0.02);
    });
  }, [measurePoints, planeSize, terrainExaggeration]);

  const stats = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const p1 = measurePoints[0];
    const p2 = measurePoints[1];

    const dLat = (p2.latitude - p1.latitude) * 59274;
    const dLon = (p2.longitude - p1.longitude) * 59274 * Math.cos((p1.latitude * Math.PI) / 180);
    const dElev = (p2.elevationMeters ?? -2400) - (p1.elevationMeters ?? -2400);

    const distM = Math.sqrt(dLat * dLat + dLon * dLon + dElev * dElev);
    const distKm = distM / 1000;

    // Compass bearing (0..360)
    let bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
    if (bearing < 0) bearing += 360;

    return {
      distanceKm: Number(distKm.toFixed(2)),
      deltaElevM: Math.round(dElev),
      bearingDeg: Math.round(bearing),
    };
  }, [measurePoints]);

  if (!isMeasureMode || points3D.length === 0) return null;

  return (
    <group renderOrder={1002}>
      {/* Markers for selected measure points */}
      {points3D.map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshBasicMaterial color="#ec4899" depthTest={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.04, 0.05, 32]} />
            <meshBasicMaterial color="#f472b6" side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        </group>
      ))}

      {/* Laser line between points */}
      {points3D.length >= 2 && stats && (
        <>
          {/* Laser Tube */}
          <mesh>
            <tubeGeometry
              args={[
                new THREE.CatmullRomCurve3([points3D[0], points3D[1]]),
                20,
                0.008,
                8,
                false,
              ]}
            />
            <meshBasicMaterial color="#ec4899" depthTest={false} />
          </mesh>

          {/* Floating Midpoint Tactical Metric Pill */}
          <group
            position={[
              (points3D[0].x + points3D[1].x) / 2,
              (points3D[0].y + points3D[1].y) / 2,
              (points3D[0].z + points3D[1].z) / 2 + 0.08,
            ]}
          >
            <Html center style={{ pointerEvents: 'none' }}>
              <div className="rounded-xl border border-pink-500/70 bg-black/90 px-3 py-1.5 font-mono text-[11px] text-pink-300 shadow-2xl backdrop-blur-md whitespace-nowrap flex items-center gap-2">
                <span className="font-bold text-white text-xs">{stats.distanceKm} km</span>
                <span className="text-zinc-500">|</span>
                <span className="text-amber-400">
                  {stats.deltaElevM > 0 ? `+${stats.deltaElevM}` : stats.deltaElevM} m ΔZ
                </span>
                <span className="text-zinc-500">|</span>
                <span className="text-sky-400">{stats.bearingDeg}° HDG</span>
              </div>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}
