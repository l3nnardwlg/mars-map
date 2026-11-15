'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Punkt = { latitude: number; longitude: number; elevationMeters?: number | null };
type Patch = {
  rows: number;
  cols: number;
  cellMeters: number;
  westX: number;
  northY: number;
  sphereRadiusMeters: number;
  cosStandardParallel: number;
  minElevationMeters: number;
  maxElevationMeters: number;
  gapFraction: number;
  elevationsBase64: string;
};

const HALB = 20000;

export default function Gelaende3D({
  mitte,
  route,
  routeFarbe,
  start,
  ziel,
  science,
  orte,
  zeigeOrte,
  zeigeScience,
  onPunkt,
  onClose,
}: {
  mitte: Punkt;
  route: Punkt[];
  routeFarbe: string;
  start: Punkt | null;
  ziel: Punkt | null;
  science: (Punkt & { name: string })[];
  orte: { latitude: number; longitude: number; name: string; diameterKm: number; official: boolean }[];
  zeigeOrte: boolean;
  zeigeScience: boolean;
  onPunkt: (p: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}) {
  const halter = useRef<HTMLDivElement>(null);
  const neuester = useRef({ route, routeFarbe, start, ziel, science, orte, zeigeOrte, zeigeScience });
  const aktualisieren = useRef<(() => void) | null>(null);
  const punktMelden = useRef(onPunkt);
  useEffect(() => {
    neuester.current = { route, routeFarbe, start, ziel, science, orte, zeigeOrte, zeigeScience };
    punktMelden.current = onPunkt;
  });
  const ueberhoehung = useRef(4);
  const [faktor] = useState(4);
  const [draht, setDraht] = useState(false);
  const drahtRef = useRef(false);
  const [fps, setFps] = useState(0);
  useEffect(() => {
    drahtRef.current = draht;
  }, [draht]);
  const [tageszeit, setTageszeit] = useState<'morning' | 'noon' | 'evening'>('morning');
  const tageszeitRef = useRef<'morning' | 'noon' | 'evening'>('morning');
  useEffect(() => {
    tageszeitRef.current = tageszeit;
  }, [tageszeit]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<{ min: number; max: number; zelle: number; luecke: number } | null>(null);

  useEffect(() => {
    ueberhoehung.current = faktor;
  }, [faktor]);

  useEffect(() => {
    const behaelter = halter.current;
    if (!behaelter) return;
    let beendet = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
    behaelter.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0x000000);
    szene.fog = new THREE.Fog(0x000000, 40000, 110000);
    const sterne = new Float32Array(2600 * 3);
    for (let i = 0; i < 2600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(150000);
      sterne.set([v.x, Math.abs(v.y) * 0.9 + 5000, v.z], i * 3);
    }
    const sternGeo = new THREE.BufferGeometry();
    sternGeo.setAttribute('position', new THREE.BufferAttribute(sterne, 3));
    const sternfeld = new THREE.Points(sternGeo, new THREE.PointsMaterial({ color: 0xcfe3ff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    szene.add(sternfeld);
    const kamera = new THREE.PerspectiveCamera(45, behaelter.clientWidth / behaelter.clientHeight, 10, 200000);
    szene.add(new THREE.HemisphereLight(0xfbe6cc, 0x7a5236, 1.9));
    const sonne = new THREE.DirectionalLight(0xfff3e2, 3.2);
    sonne.position.set(-0.6, 0.55, 0.5);
    szene.add(sonne);
    const steuerung = new OrbitControls(kamera, renderer.domElement);
    steuerung.enableDamping = true;
    steuerung.maxPolarAngle = 1.2;
    steuerung.minPolarAngle = 0.25;
    steuerung.screenSpacePanning = false;
    steuerung.minDistance = 300;
    steuerung.maxDistance = 60000;

    const gruppe = new THREE.Group();
    szene.add(gruppe);
    let bild = 0;
    let netz: THREE.Mesh | null = null;
    let uebergroessen: THREE.Object3D[] = [];
    const beschriftungen: { el: HTMLDivElement; pos: THREE.Vector3; rang: number }[] = [];
    const ebene = document.createElement('div');
    ebene.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    behaelter.appendChild(ebene);
    const raycaster = new THREE.Raycaster();
    let umrechnung: ((v: THREE.Vector3) => { latitude: number; longitude: number }) | null = null;

    (async () => {
      try {
        const q = `latitude=${mitte.latitude}&longitude=${mitte.longitude}&halfMeters=${HALB}`;
        const antwort = await fetch(`/api/terrain/patch?${q}`);
        if (!antwort.ok) {
          const d = await antwort.json().catch(() => null);
          throw new Error(d && typeof d.detail === 'string' ? d.detail : 'The terrain could not be loaded.');
        }
        const patch: Patch = await antwort.json();
        const roh = atob(patch.elevationsBase64);
        const bytes = new Uint8Array(roh.length);
        for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
        const hoehen = new Float32Array(bytes.buffer);
        const textur = await new THREE.TextureLoader().loadAsync(`/api/terrain/patch-image?${q}`);
        if (beendet) return;
        textur.colorSpace = THREE.SRGBColorSpace;
        textur.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const r = patch.sphereRadiusMeters;
        const c = patch.cosStandardParallel;
        const grad = Math.PI / 180;
        const px = (p: Punkt) => r * c * p.longitude * grad;
        const py = (p: Punkt) => r * p.latitude * grad;
        const ox = patch.westX + (patch.cols * patch.cellMeters) / 2;
        const oy = patch.northY - (patch.rows * patch.cellMeters) / 2;
        const lage = new Float32Array(patch.rows * patch.cols * 3);
        const uv = new Float32Array(patch.rows * patch.cols * 2);
        for (let rr = 0; rr < patch.rows; rr++) {
          for (let cc = 0; cc < patch.cols; cc++) {
            const i = rr * patch.cols + cc;
            lage[i * 3] = patch.westX + (cc + 0.5) * patch.cellMeters - ox;
            lage[i * 3 + 1] = hoehen[i] - patch.minElevationMeters;
            lage[i * 3 + 2] = -(patch.northY - (rr + 0.5) * patch.cellMeters - oy);
            uv[i * 2] = (cc + 0.5) / patch.cols;
            uv[i * 2 + 1] = 1 - (rr + 0.5) / patch.rows;
          }
        }
        const index: number[] = [];
        for (let rr = 0; rr < patch.rows - 1; rr++) {
          for (let cc = 0; cc < patch.cols - 1; cc++) {
            const a = rr * patch.cols + cc;
            index.push(a, a + patch.cols, a + 1, a + 1, a + patch.cols, a + patch.cols + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(lage, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeVertexNormals();
        netz = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: textur, color: new THREE.Color(2.5, 1.75, 1.2), roughness: 1, metalness: 0 }));
        gruppe.add(netz);

        const hoeheBei = (x: number, y: number) => {
          const sp = (x - patch.westX) / patch.cellMeters - 0.5;
          const ze = (patch.northY - y) / patch.cellMeters - 0.5;
          if (sp < 0 || ze < 0 || sp > patch.cols - 1 || ze > patch.rows - 1) return null;
          const c0 = Math.min(patch.cols - 2, Math.floor(sp));
          const r0 = Math.min(patch.rows - 2, Math.floor(ze));
          const fx = sp - c0;
          const fy = ze - r0;
          const h = (a: number, b: number) => hoehen[a * patch.cols + b];
          return h(r0, c0) * (1 - fx) * (1 - fy) + h(r0, c0 + 1) * fx * (1 - fy) + h(r0 + 1, c0) * (1 - fx) * fy + h(r0 + 1, c0 + 1) * fx * fy;
        };
        const aufGelaende = (p: Punkt, lift: number) => {
          const x = px(p);
          const y = py(p);
          const h = hoeheBei(x, y);
          if (h == null) return null;
          return new THREE.Vector3(x - ox, h - patch.minElevationMeters + lift, -(y - oy));
        };
        const neuBauen = () => {
          uebergroessen.forEach((o) => {
            gruppe.remove(o);
            const m = o as THREE.Mesh;
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          });
          uebergroessen = [];
          const jetzt = neuester.current;
          const punkte = jetzt.route.map((p) => aufGelaende(p, 25)).filter((v): v is THREE.Vector3 => v !== null);
          if (punkte.length > 1) {
            const kurve = new THREE.CatmullRomCurve3(punkte, false, 'centripetal', 0.1);
            const rohr = new THREE.Mesh(new THREE.TubeGeometry(kurve, Math.min(1200, punkte.length * 4), 28, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(jetzt.routeFarbe) }));
            gruppe.add(rohr);
            uebergroessen.push(rohr);
          }
          const marke = (p: Punkt | null, farbe: number, radius: number) => {
            if (!p) return;
            const v = aufGelaende(p, 70);
            if (!v) return;
            const kugel = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), new THREE.MeshBasicMaterial({ color: farbe }));
            kugel.position.copy(v);
            gruppe.add(kugel);
            uebergroessen.push(kugel);
          };
          marke(jetzt.start, 0x22d3ee, 110);
          marke(jetzt.ziel, 0xf59e0b, 110);
          if (jetzt.zeigeScience) jetzt.science.forEach((p) => marke(p, 0x67e8f9, 45));
        };
        aktualisieren.current = neuBauen;
        neuBauen();
        umrechnung = (v) => ({ latitude: Number(((oy - v.z) / (r * grad)).toFixed(5)), longitude: Number(((v.x + ox) / (r * c * grad)).toFixed(5)) });
        const beschriften = (name: string, p: Punkt, rang: number, art: 'ort' | 'science') => {
          const v = aufGelaende(p, 380);
          if (!v) return;
          const el = document.createElement('div');
          el.textContent = name;
          el.style.cssText = art === 'ort'
            ? 'position:absolute;left:0;top:0;white-space:nowrap;color:#fde9cf;font:600 13px system-ui;letter-spacing:.04em;text-shadow:0 0 3px #000,0 0 6px #000,0 1px 2px #000'
            : 'position:absolute;left:0;top:0;white-space:nowrap;color:#67e8f9;font:500 11px system-ui;text-shadow:0 0 3px #000,0 0 5px #000';
          ebene.appendChild(el);
          beschriftungen.push({ el, pos: v, rang });
        };
        [...neuester.current.orte].sort((a, b) => b.diameterKm - a.diameterKm).slice(0, 12).forEach((o) => beschriften(o.name, o, (o.official ? 0 : 500) - o.diameterKm, 'ort'));
        beschriftungen.sort((a, b) => a.rang - b.rang);

        const breite = patch.cols * patch.cellMeters;
        kamera.position.set(breite * 0.05, breite * 0.85, breite * 0.95);
        steuerung.target.set(0, (patch.maxElevationMeters - patch.minElevationMeters) * 0.3, 0);
        steuerung.update();
        setInfo({ min: patch.minElevationMeters, max: patch.maxElevationMeters, zelle: patch.cellMeters, luecke: patch.gapFraction });
        setLaedt(false);
      } catch (e) {
        if (!beendet) setFehler(e instanceof Error ? e.message : 'The terrain could not be loaded.');
      }
    })();

    const groesse = () => {
      renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
      kamera.aspect = behaelter.clientWidth / behaelter.clientHeight;
      kamera.updateProjectionMatrix();
    };
    window.addEventListener('resize', groesse);
    const doppelklick = (e: MouseEvent) => {
      if (!netz || !umrechnung) return;
      const kasten = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - kasten.left) / kasten.width) * 2 - 1, -((e.clientY - kasten.top) / kasten.height) * 2 + 1), kamera);
      gruppe.updateMatrixWorld(true);
      const treffer = raycaster.intersectObject(netz, false)[0];
      if (!treffer) return;
      const lokal = gruppe.worldToLocal(treffer.point.clone());
      punktMelden.current(umrechnung(lokal));
    };
    renderer.domElement.addEventListener('dblclick', doppelklick);
    let bilder = 0;
    let letzteFps = performance.now();
    const schleife = () => {
      bild = requestAnimationFrame(schleife);
      gruppe.scale.y = ueberhoehung.current;
      if (netz) (netz.material as THREE.MeshStandardMaterial).wireframe = drahtRef.current;
      bilder++;
      const jetztZeit = performance.now();
      if (jetztZeit - letzteFps > 600) {
        setFps(Math.round((bilder * 1000) / (jetztZeit - letzteFps)));
        bilder = 0;
        letzteFps = jetztZeit;
      }
      sternfeld.position.copy(kamera.position);
      const sonnenstand = { morning: [-0.9, 0.34, 0.3, 0xffd9b4, 3.0], noon: [0.05, 0.95, 0.15, 0xfff6ea, 3.4], evening: [0.9, 0.3, -0.3, 0xffc196, 2.8] }[tageszeitRef.current];
      sonne.position.set(sonnenstand[0] as number, sonnenstand[1] as number, sonnenstand[2] as number);
      sonne.color.setHex(sonnenstand[3] as number);
      sonne.intensity = sonnenstand[4] as number;
      steuerung.update();
      renderer.render(szene, kamera);
      const breiteBild = behaelter.clientWidth;
      const hoeheBild = behaelter.clientHeight;
      const belegt: { x: number; y: number; b: number; h: number }[] = [];
      const v = new THREE.Vector3();
      beschriftungen.forEach((bz) => {
        v.copy(bz.pos);
        v.y *= ueberhoehung.current;
        v.project(kamera);
        const sichtbar = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
        const x = (v.x * 0.5 + 0.5) * breiteBild;
        const y = (-v.y * 0.5 + 0.5) * hoeheBild;
        const b = bz.el.textContent ? bz.el.textContent.length * 7.4 + 8 : 40;
        const frei = neuester.current.zeigeOrte && sichtbar && !belegt.some((q) => x - b / 2 < q.x + q.b && x + b / 2 > q.x && y - 9 < q.y + q.h && y + 9 > q.y);
        if (frei) belegt.push({ x: x - b / 2, y: y - 9, b, h: 18 });
        bz.el.style.display = frei ? 'block' : 'none';
        if (frei) bz.el.style.transform = `translate(${x - b / 2}px, ${y - 9}px)`;
      });
    };
    bild = requestAnimationFrame(schleife);

    return () => {
      beendet = true;
      cancelAnimationFrame(bild);
      window.removeEventListener('resize', groesse);
      renderer.domElement.removeEventListener('dblclick', doppelklick);
      ebene.remove();
      steuerung.dispose();
      szene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const material = m.material as THREE.MeshStandardMaterial | undefined;
        if (material) {
          material.map?.dispose();
          material.dispose();
        }
      });
      uebergroessen = [];
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mitte.latitude, mitte.longitude]);

  useEffect(() => {
    aktualisieren.current?.();
  }, [route, routeFarbe, start, ziel, zeigeScience]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-14 z-[900] bg-black">
      <div ref={halter} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute left-1/2 top-3 w-max max-w-[34vw] -translate-x-1/2 border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
        <span className="font-semibold tracking-wide">3D TERRAIN</span>
        <span className="ml-3">Drag orbit, right-drag pan, scroll zoom, double-click sets start and destination.</span>
      </div>
      <div className="absolute bottom-[20rem] right-4 w-[232px] border border-white/20 bg-black/80 p-3 text-sm text-white backdrop-blur">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Height exaggeration (fixed)</span>
          <span className="tabular-nums text-slate-200">{faktor.toFixed(1)}x</span>
        </div>
        <div className="mt-1 h-1 w-full bg-cyan-400" />
        {info && (
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between"><span>Lowest</span><span className="tabular-nums text-slate-200">{Math.round(info.min)} m</span></div>
            <div className="flex justify-between"><span>Highest</span><span className="tabular-nums text-slate-200">{Math.round(info.max)} m</span></div>
            <div className="flex justify-between"><span>Grid</span><span className="tabular-nums text-slate-200">{Math.round(info.zelle)} m</span></div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button onClick={() => setDraht((d) => !d)} className={`flex-1 border px-2 py-1 text-xs ${draht ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/20 hover:bg-white/10'}`}>Wireframe</button>
          <div className="flex items-center border border-white/20 px-2 py-1 text-xs tabular-nums">{fps} FPS</div>
        </div>
        <div className="mt-3 text-xs text-slate-400">Sol time (sun position)</div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {(['morning', 'noon', 'evening'] as const).map((t) => (
            <button key={t} onClick={() => setTageszeit(t)} className={`rounded-md border px-2 py-1 text-xs capitalize ${tageszeit === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 hover:bg-white/5'}`}>{t}</button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-500">Illustrative sun positions, not a calculation for a date.</p>
        <button onClick={onClose} className="mt-3 w-full rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10">Back to globe</button>
      </div>
      {laedt && !fehler && <div className="absolute inset-0 flex items-center justify-center text-slate-200">Loading terrain...</div>}
      {fehler && <div className="absolute inset-x-0 top-1/2 mx-auto w-fit rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100">{fehler}</div>}
      <p className="pointer-events-none absolute bottom-3 left-4 max-w-xl text-[11px] leading-snug text-slate-500">
        CTX elevation model (20 m, averaged to the grid shown) with the CTX image, tinted for display. Heights are exaggerated as set. {info && info.luecke > 0.01 ? `${Math.round(info.luecke * 100)} % of this area has no elevation data and is drawn flat.` : ''}
      </p>
    </div>
  );
}
