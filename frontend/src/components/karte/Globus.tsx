'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { latLonToVector3 } from '@/utils/coordinates';

const JEZERO = { latitude: 18.44, longitude: 77.45 };
const RADIUS = 2;

export default function Globus({ onEnter, eintauchen }: { onEnter: () => void; eintauchen: number }) {
  const halter = useRef<HTMLDivElement>(null);
  const flug = useRef<{ start: number } | null>(null);
  const ansichtsZiel = useRef<{ gier: number; neigung: number } | null>(null);
  const fertig = useRef(onEnter);
  useEffect(() => {
    fertig.current = onEnter;
  });

  useEffect(() => {
    if (eintauchen > 0 && !flug.current) flug.current = { start: performance.now() };
  }, [eintauchen]);

  useEffect(() => {
    const behaelter = halter.current;
    if (!behaelter) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
    behaelter.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0x04060b);
    const kamera = new THREE.PerspectiveCamera(40, behaelter.clientWidth / behaelter.clientHeight, 0.01, 200);

    const sterne = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(90);
      sterne.set([v.x, v.y, v.z], i * 3);
    }
    const sternGeo = new THREE.BufferGeometry();
    sternGeo.setAttribute('position', new THREE.BufferAttribute(sterne, 3));
    szene.add(new THREE.Points(sternGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.7 })));

    const lader = new THREE.TextureLoader();
    const farbe = lader.load('/textures/mars_color.jpg');
    farbe.colorSpace = THREE.SRGBColorSpace;
    farbe.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const relief = lader.load('/textures/mars_bump.jpg');
    const kugel = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 128, 96), new THREE.MeshStandardMaterial({ map: farbe, bumpMap: relief, bumpScale: 2.2, roughness: 1, metalness: 0 }));
    const gruppe = new THREE.Group();
    gruppe.add(kugel);
    szene.add(gruppe);

    const dunst = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.035, 96, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 n; void main(){ float k = pow(0.72 - dot(n, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.95, 0.62, 0.42, 1.0) * k; }',
      }),
    );
    szene.add(dunst);

    const ort = latLonToVector3(JEZERO.latitude, JEZERO.longitude, RADIUS * 1.003);
    const punkt = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
    punkt.position.copy(ort);
    gruppe.add(punkt);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 48), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.position.copy(ort);
    ring.lookAt(ort.clone().multiplyScalar(2));
    gruppe.add(ring);

    szene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sonne = new THREE.DirectionalLight(0xfff2e0, 2.6);
    szene.add(sonne);

    const richtung = ort.clone().normalize();
    let gier = Math.atan2(richtung.x, richtung.z) - 0.5;
    let neigung = Math.asin(richtung.y) * 0.6;
    let abstand = 7.2;
    let beruehrt = false;
    let ziehen: { x: number; y: number; weg: number } | null = null;
    const runter = (e: PointerEvent) => { ziehen = { x: e.clientX, y: e.clientY, weg: 0 }; beruehrt = true; ansichtsZiel.current = null; };
    const bewegen = (e: PointerEvent) => {
      if (!ziehen) return;
      gier -= (e.clientX - ziehen.x) * 0.005;
      neigung = Math.max(-1.3, Math.min(1.3, neigung + (e.clientY - ziehen.y) * 0.005));
      ziehen = { x: e.clientX, y: e.clientY, weg: ziehen.weg + Math.abs(e.movementX) + Math.abs(e.movementY) };
    };
    const hoch = () => { ziehen = null; };
    const rad = (e: WheelEvent) => { abstand = Math.max(3.2, Math.min(12, abstand * (e.deltaY > 0 ? 1.08 : 0.92))); beruehrt = true; };
    renderer.domElement.addEventListener('pointerdown', runter);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    renderer.domElement.addEventListener('wheel', rad, { passive: true });
    const groesse = () => {
      renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
      kamera.aspect = behaelter.clientWidth / behaelter.clientHeight;
      kamera.updateProjectionMatrix();
    };
    window.addEventListener('resize', groesse);

    const zielGier = Math.atan2(richtung.x, richtung.z);
    const zielNeigung = Math.asin(richtung.y);
    let bild = 0;
    let letzte = performance.now();
    let gemeldet = false;
    const schleife = (jetzt: number) => {
      bild = requestAnimationFrame(schleife);
      const dt = Math.min(0.1, (jetzt - letzte) / 1000);
      letzte = jetzt;
      let d = abstand;
      if (flug.current) {
        const t = Math.min(1, (jetzt - flug.current.start) / 1600);
        const weich = t * t * (3 - 2 * t);
        let dg = zielGier - gier;
        while (dg > Math.PI) dg -= 2 * Math.PI;
        while (dg < -Math.PI) dg += 2 * Math.PI;
        gier += dg * Math.min(1, dt * 5);
        neigung += (zielNeigung - neigung) * Math.min(1, dt * 5);
        d = abstand + (RADIUS * 1.06 - abstand) * weich;
        if (t >= 1 && !gemeldet) {
          gemeldet = true;
          fertig.current();
        }
      } else if (ansichtsZiel.current) {
        let dg = ansichtsZiel.current.gier - gier;
        while (dg > Math.PI) dg -= 2 * Math.PI;
        while (dg < -Math.PI) dg += 2 * Math.PI;
        gier += dg * Math.min(1, dt * 4);
        neigung += (ansichtsZiel.current.neigung - neigung) * Math.min(1, dt * 4);
        if (Math.abs(dg) < 0.003) ansichtsZiel.current = null;
      } else if (!beruehrt) {
        gier += dt * 0.05;
      }
      kamera.position.set(Math.sin(gier) * Math.cos(neigung) * d, Math.sin(neigung) * d, Math.cos(gier) * Math.cos(neigung) * d);
      kamera.lookAt(0, 0, 0);
      sonne.position.copy(kamera.position).add(new THREE.Vector3(4, 2, 1).applyQuaternion(kamera.quaternion));
      dunst.quaternion.copy(kamera.quaternion);
      ring.scale.setScalar(1 + 0.25 * Math.sin(jetzt / 350));
      renderer.render(szene, kamera);
    };
    bild = requestAnimationFrame(schleife);

    return () => {
      cancelAnimationFrame(bild);
      renderer.domElement.removeEventListener('pointerdown', runter);
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', hoch);
      window.removeEventListener('resize', groesse);
      szene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const material = m.material as THREE.Material | undefined;
        if (material && 'dispose' in material) material.dispose();
      });
      farbe.dispose();
      relief.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-0 top-14 z-[1500] bg-[#000000]">
      <div ref={halter} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 text-slate-100">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-[0.2em]">MARS</div>
          <div className="mt-1 text-sm text-slate-400">Jezero crater, 18.44°N 77.45°E, landing site of NASA Perseverance</div>
        </div>
        <button className="pointer-events-auto rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-[#000000] shadow-2xl hover:bg-cyan-300" onClick={() => { if (!flug.current) flug.current = { start: performance.now() }; }}>
          Fly to Jezero and plan a traverse
        </button>
        <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
          {[
            { name: 'Jezero crater', lat: 18.44, lon: 77.45 },
            { name: 'Olympus Mons', lat: 18.65, lon: 226.2 },
            { name: 'Valles Marineris', lat: -13.9, lon: 301.0 },
            { name: 'Gale crater', lat: -5.4, lon: 137.8 },
          ].map((o) => (
            <button
              key={o.name}
              className="rounded-lg border border-white/15 bg-[#000000]/70 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              onClick={() => {
                const v = latLonToVector3(o.lat, o.lon, 1).normalize();
                ansichtsZiel.current = { gier: Math.atan2(v.x, v.z), neigung: Math.asin(v.y) };
              }}
            >
              {o.name}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">Drag to rotate, scroll to zoom. Globe texture and relief are for orientation only.</div>
      </div>
    </div>
  );
}
