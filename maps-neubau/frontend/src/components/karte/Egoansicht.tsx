'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type EgoPunkt = { latitude: number; longitude: number; elevationMeters?: number | null };
export type EgoProfil = {
  cumulativeMeters: number[];
  cumulativeSeconds: number[];
  cumulativeJoules: number[];
  slopeDegrees: number[];
  powerWatts: number[];
};
type Patch = {
  rows: number;
  cols: number;
  cellMeters: number;
  westX: number;
  northY: number;
  sphereRadiusMeters: number;
  cosStandardParallel: number;
  minElevationMeters: number;
  gapFraction: number;
  elevationsBase64: string;
};
type Gelaende = { patch: Patch; hoehen: Float32Array; mitteX: number; mitteY: number };
type Ausschnitt = { patch: Patch; hoehen: Float32Array; textur: THREE.Texture };
type Rechteck = { x0: number; x1: number; y0: number; y1: number };
const rechteckVon = (p: Patch, f: number): Rechteck => ({ x0: p.westX * f, x1: (p.westX + p.cols * p.cellMeters) * f, y1: p.northY, y0: p.northY - p.rows * p.cellMeters });

const AUGENHOEHE = 1.7;
const GEHTEMPO = 3.0 / 3.6;
const PATCH_HALB = 2500;
const NACHLADEN_AB = 1400;
const HORIZONT = 0xdcc3a3;
const ZENIT = 0xa9835f;
const FERN_HALB = 40000;
const FERN_NACHLADEN_AB = 12000;
const TEMPI = [1, 10, 60, 300];

function zeit(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = Math.floor(s % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(sek).padStart(2, '0')} s`;
}

function hoeheBei(g: Gelaende, x: number, y: number): number | null {
  const p = g.patch;
  const sp = (x - p.westX) / p.cellMeters - 0.5;
  const ze = (p.northY - y) / p.cellMeters - 0.5;
  if (sp < 0 || ze < 0 || sp > p.cols - 1 || ze > p.rows - 1) return null;
  const c0 = Math.min(p.cols - 2, Math.floor(sp));
  const r0 = Math.min(p.rows - 2, Math.floor(ze));
  const fx = sp - c0;
  const fy = ze - r0;
  const h = (r: number, c: number) => g.hoehen[r * p.cols + c];
  return h(r0, c0) * (1 - fx) * (1 - fy) + h(r0, c0 + 1) * fx * (1 - fy) + h(r0 + 1, c0) * (1 - fx) * fy + h(r0 + 1, c0 + 1) * fx * fy;
}

export default function Egoansicht({
  wegpunkte,
  profil,
  farbe,
  startTempo,
  onClose,
}: {
  wegpunkte: EgoPunkt[];
  profil: EgoProfil;
  farbe: string;
  startTempo?: number;
  onClose: () => void;
}) {
  const halter = useRef<HTMLDivElement>(null);
  const zustand = useRef({ s: 0, laeuft: true, tempo: startTempo ?? 60, gier: 0, neigung: 0, sprung: false });
  const [anzeige, setAnzeige] = useState({ s: 0, hoehe: 0, steigung: 0, watt: 0, joule: 0, sekunden: 0, kurs: 0 });
  const [laeuft, setLaeuft] = useState(true);
  const [tempo, setTempo] = useState(startTempo ?? 60);
  const [laedt, setLaedt] = useState(true);
  const [hirise, setHirise] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [luecke, setLuecke] = useState(0);
  const gesamt = profil.cumulativeMeters[profil.cumulativeMeters.length - 1] || 1;

  useEffect(() => {
    const behaelter = halter.current;
    if (!behaelter) return;
    let beendet = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
    behaelter.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(HORIZONT);
    szene.fog = new THREE.Fog(HORIZONT, 500, 70000);
    const kamera = new THREE.PerspectiveCamera(68, behaelter.clientWidth / behaelter.clientHeight, 0.3, 120000);
    szene.add(new THREE.HemisphereLight(0xf6dfc4, 0x6b4630, 1.25));
    const sonnenrichtung = new THREE.Vector3(-0.55, 0.5, 0.45).normalize();
    const sonne = new THREE.DirectionalLight(0xfff3e2, 2.4);
    sonne.position.copy(sonnenrichtung);
    szene.add(sonne);

    const himmel = new THREE.Mesh(
      new THREE.SphereGeometry(90000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { unten: { value: new THREE.Color(HORIZONT) }, oben: { value: new THREE.Color(ZENIT) } },
        vertexShader: 'varying vec3 r; void main(){ r = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 unten; uniform vec3 oben; varying vec3 r; void main(){ float h = clamp(r.y, 0.0, 1.0); gl_FragColor = vec4(mix(unten, oben, pow(h, 0.55)), 1.0); }',
      }),
    );
    szene.add(himmel);
    const scheibe = document.createElement('canvas');
    scheibe.width = scheibe.height = 256;
    const stift = scheibe.getContext('2d');
    if (stift) {
      const verlauf = stift.createRadialGradient(128, 128, 0, 128, 128, 128);
      verlauf.addColorStop(0, 'rgba(255,255,255,1)');
      verlauf.addColorStop(0.06, 'rgba(255,255,255,1)');
      verlauf.addColorStop(0.1, 'rgba(225,238,255,0.55)');
      verlauf.addColorStop(0.4, 'rgba(215,230,250,0.12)');
      verlauf.addColorStop(1, 'rgba(215,230,250,0)');
      stift.fillStyle = verlauf;
      stift.fillRect(0, 0, 256, 256);
    }
    const sonnenbild = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(scheibe), fog: false, depthWrite: false, transparent: true }));
    sonnenbild.scale.setScalar(9000);
    szene.add(sonnenbild);

    const kornFlaeche = document.createElement('canvas');
    kornFlaeche.width = kornFlaeche.height = 256;
    const kornStift = kornFlaeche.getContext('2d');
    if (kornStift) {
      const bild = kornStift.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const v = 90 + Math.random() * 165;
        bild.data[i * 4] = bild.data[i * 4 + 1] = bild.data[i * 4 + 2] = v;
        bild.data[i * 4 + 3] = 255;
      }
      kornStift.putImageData(bild, 0, 0);
    }
    const korn = new THREE.CanvasTexture(kornFlaeche);
    korn.wrapS = korn.wrapT = THREE.RepeatWrapping;
    korn.generateMipmaps = true;
    korn.minFilter = THREE.LinearMipmapLinearFilter;

    let gelaende: Gelaende | null = null;
    let netz: THREE.Mesh | null = null;
    let fern: { netz: THREE.Mesh; patch: Patch; mitteX: number; mitteY: number } | null = null;
    let fernLaedt = false;
    let band: THREE.Mesh | null = null;
    let ursprung: { x: number; y: number; h: number } | null = null;
    let projektion: { r: number; c: number } | null = null;
    let laedtGerade = false;
    const bandMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(farbe), transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: true });

    const grad = Math.PI / 180;
    const projiziert = (p: EgoPunkt) => (projektion ? { x: projektion.r * projektion.c * p.longitude * grad, y: projektion.r * p.latitude * grad } : { x: 0, y: 0 });
    const punktBei = (s: number): EgoPunkt => {
      const m = profil.cumulativeMeters;
      const ziel = Math.min(Math.max(s, 0), gesamt);
      let i = 1;
      while (i < m.length - 1 && m[i] < ziel) i++;
      const a = wegpunkte[i - 1];
      const b = wegpunkte[i];
      const t = (ziel - m[i - 1]) / Math.max(m[i] - m[i - 1], 1e-6);
      return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
    };
    const abschnitt = (s: number) => {
      const m = profil.cumulativeMeters;
      let i = 1;
      while (i < m.length - 1 && m[i] < s) i++;
      const t = (s - m[i - 1]) / Math.max(m[i] - m[i - 1], 1e-6);
      return { i, t: Math.min(1, Math.max(0, t)) };
    };

    const bandBauen = () => {
      if (!gelaende || !ursprung) return;
      const ecken: number[] = [];
      const von = Math.max(0, zustand.current.s - 3200);
      const bis = Math.min(gesamt, zustand.current.s + 3200);
      let vorher: { x: number; y: number } | null = null;
      for (let s = von; s <= bis; s += 6) {
        const p = projiziert(punktBei(s));
        const h = hoeheAn(p.x, p.y);
        if (h == null) {
          vorher = null;
          continue;
        }
        const weiter = projiziert(punktBei(Math.min(gesamt, s + 6)));
        let dx = weiter.x - p.x;
        let dy = weiter.y - p.y;
        if (dx === 0 && dy === 0 && vorher) {
          dx = p.x - vorher.x;
          dy = p.y - vorher.y;
        }
        const l = Math.hypot(dx, dy) || 1;
        const qx = (-dy / l) * 0.3;
        const qy = (dx / l) * 0.3;
        const y3 = h - ursprung.h + 0.12;
        ecken.push(p.x + qx - ursprung.x, y3, -(p.y + qy - ursprung.y), p.x - qx - ursprung.x, y3, -(p.y - qy - ursprung.y));
        vorher = p;
      }
      const anzahl = ecken.length / 6;
      if (anzahl < 2) return;
      const index: number[] = [];
      for (let i = 0; i < anzahl - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(ecken, 3));
      geo.setIndex(index);
      if (band) {
        szene.remove(band);
        band.geometry.dispose();
      }
      band = new THREE.Mesh(geo, bandMaterial);
      szene.add(band);
    };

    const ausschnittLaden = async (mitte: EgoPunkt, halb: number): Promise<Ausschnitt> => {
      const q = `latitude=${mitte.latitude}&longitude=${mitte.longitude}&halfMeters=${halb}`;
      const antwort = await fetch(`/api/terrain/patch?${q}`);
      if (!antwort.ok) {
        const d = await antwort.json().catch(() => null);
        throw new Error(d && typeof d.detail === 'string' ? d.detail : 'The terrain could not be loaded.');
      }
      const patch: Patch = await antwort.json();
      const roh = atob(patch.elevationsBase64);
      const bytes = new Uint8Array(roh.length);
      for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
      const textur = await new THREE.TextureLoader().loadAsync(`/api/terrain/patch-image?${q}`);
      textur.colorSpace = THREE.SRGBColorSpace;
      textur.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return { patch, hoehen: new Float32Array(bytes.buffer), textur };
    };

    const netzIndex = (patch: Patch, loch: Rechteck | null, f = 1) => {
      const index: number[] = [];
      const rand = patch.cellMeters * 1.5;
      for (let r = 0; r < patch.rows - 1; r++) {
        for (let c = 0; c < patch.cols - 1; c++) {
          if (loch) {
            const x = (patch.westX + (c + 1) * patch.cellMeters) * f;
            const y = patch.northY - (r + 1) * patch.cellMeters;
            if (x > loch.x0 + rand && x < loch.x1 - rand && y < loch.y1 - rand && y > loch.y0 + rand) continue;
          }
          const a = r * patch.cols + c;
          const b = a + 1;
          const d = a + patch.cols;
          const e = d + 1;
          index.push(a, d, b, b, d, e);
        }
      }
      return index;
    };

    const netzBauen = (a: Ausschnitt, mitKorn: boolean, loch: Rechteck | null, xf = 1) => {
      const { patch, hoehen, textur } = a;
      if (!ursprung) ursprung = { x: patch.westX, y: patch.northY, h: patch.minElevationMeters };
      const lage = new Float32Array(patch.rows * patch.cols * 3);
      const uv = new Float32Array(patch.rows * patch.cols * 2);
      for (let r = 0; r < patch.rows; r++) {
        for (let c = 0; c < patch.cols; c++) {
          const i = r * patch.cols + c;
          lage[i * 3] = (patch.westX + (c + 0.5) * patch.cellMeters) * xf - ursprung.x;
          lage[i * 3 + 1] = hoehen[i] - ursprung.h;
          lage[i * 3 + 2] = -(patch.northY - (r + 0.5) * patch.cellMeters - ursprung.y);
          uv[i * 2] = (c + 0.5) / patch.cols;
          uv[i * 2 + 1] = 1 - (r + 0.5) / patch.rows;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(lage, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(netzIndex(patch, loch, xf));
      geo.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ map: textur, color: new THREE.Color(1.7, 1.12, 0.74), roughness: 1, metalness: 0 });
      if (mitKorn) {
        const relief = korn.clone();
        relief.repeat.set(patch.cols * patch.cellMeters / 2.4, patch.rows * patch.cellMeters / 2.4);
        relief.needsUpdate = true;
        material.bumpMap = relief;
        material.bumpScale = 3.2;
        material.onBeforeCompile = (shader) => {
          shader.uniforms.kornKarte = { value: korn };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWelt;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvWelt = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform sampler2D kornKarte;\nvarying vec3 vWelt;')
            .replace(
              '#include <map_fragment>',
              '#include <map_fragment>\nfloat nah = texture2D(kornKarte, vWelt.xz * 0.31).r;\nfloat mittel = texture2D(kornKarte, vWelt.xz * 0.019).r;\nfloat staerke = 1.0 - smoothstep(40.0, 700.0, length(vWelt - cameraPosition));\ndiffuseColor.rgb *= mix(1.0, (0.8 + 0.4 * nah) * (0.86 + 0.28 * mittel), staerke);',
            );
        };
      }
      return new THREE.Mesh(geo, material);
    };

    const netzEntfernen = (m: THREE.Mesh | null) => {
      if (!m) return;
      szene.remove(m);
      m.geometry.dispose();
      const material = m.material as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.dispose();
    };

    const fernLaden = async () => {
      if (fernLaedt) return;
      fernLaedt = true;
      try {
        const mitte = punktBei(zustand.current.s);
        const a = await ausschnittLaden(mitte, FERN_HALB);
        if (beendet) return;
        projektion = { r: a.patch.sphereRadiusMeters, c: a.patch.cosStandardParallel };
        const m = projiziert(mitte);
        const neu = netzBauen(a, false, gelaende ? rechteckVon(gelaende.patch, 1) : null);
        netzEntfernen(fern?.netz ?? null);
        fern = { netz: neu, patch: a.patch, mitteX: m.x, mitteY: m.y };
        szene.add(neu);
      } catch {
        fern = fern ?? null;
      } finally {
        fernLaedt = false;
      }
    };

    let felsen: THREE.InstancedMesh | null = null;
    const felsenBauen = () => {
      if (!gelaende || !ursprung) return;
      if (felsen) {
        szene.remove(felsen);
        felsen.geometry.dispose();
        (felsen.material as THREE.Material).dispose();
        felsen = null;
      }
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const k = 0.72 + 0.5 * Math.abs(Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719));
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true });
      const maximal = 14000;
      const netzFelsen = new THREE.InstancedMesh(geo, material, maximal);
      const zufall = (() => {
        let z = 12345;
        return () => {
          z = (z * 1664525 + 1013904223) % 4294967296;
          return z / 4294967296;
        };
      })();
      const matrix = new THREE.Matrix4();
      const drehung = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const farbe = new THREE.Color();
      let anzahl = 0;
      const von = Math.max(0, zustand.current.s - 2600);
      const bis = Math.min(gesamt, zustand.current.s + 2600);
      for (let s = von; s <= bis && anzahl < maximal; s += 4) {
        const mitteP = projiziert(punktBei(s));
        for (let k = 0; k < 7 && anzahl < maximal; k++) {
          const winkel = zufall() * Math.PI * 2;
          const abstand = Math.pow(zufall(), 0.8) * 90;
          const x = mitteP.x + Math.cos(winkel) * abstand;
          const y = mitteP.y + Math.sin(winkel) * abstand;
          const h = hoeheBei(gelaende, x, y);
          if (h == null) continue;
          const hx = hoeheBei(gelaende, x + 10, y);
          const hy = hoeheBei(gelaende, x, y + 10);
          if (hx == null || hy == null) continue;
          const hang = Math.atan(Math.hypot(hx - h, hy - h) / 10);
          if (hang > 0.55) continue;
          const groesse = 0.06 + Math.pow(zufall(), 3.2) * 1.9 + (zufall() < 0.012 ? 1.2 + zufall() * 2.5 : 0);
          euler.set(zufall() * 0.5, zufall() * Math.PI * 2, zufall() * 0.5);
          drehung.setFromEuler(euler);
          matrix.compose(new THREE.Vector3(x - ursprung.x, h - ursprung.h + groesse * 0.18, -(y - ursprung.y)), drehung, new THREE.Vector3(groesse * (0.8 + zufall() * 0.5), groesse, groesse * (0.8 + zufall() * 0.5)));
          netzFelsen.setMatrixAt(anzahl, matrix);
          const ton = 0.32 + zufall() * 0.3;
          netzFelsen.setColorAt(anzahl, farbe.setRGB(ton * 1.1, ton * 0.74, ton * 0.52));
          anzahl++;
        }
      }
      netzFelsen.count = anzahl;
      netzFelsen.instanceMatrix.needsUpdate = true;
      if (netzFelsen.instanceColor) netzFelsen.instanceColor.needsUpdate = true;
      felsen = netzFelsen;
      szene.add(netzFelsen);
    };

    let nah: { netz: THREE.Mesh; patch: Patch; hoehen: Float32Array; mitteX: number; mitteY: number } | null = null;
    let nahLaedt = false;
    let nahFehlt: { x: number; y: number } | null = null;
    const nahHoehe = (x: number, y: number): number | null => {
      if (!nah || !projektion) return null;
      const p = nah.patch;
      const sp = (x / projektion.c - p.westX) / p.cellMeters - 0.5;
      const ze = (p.northY - y) / p.cellMeters - 0.5;
      if (sp < 0 || ze < 0 || sp > p.cols - 1 || ze > p.rows - 1) return null;
      const c0 = Math.min(p.cols - 2, Math.floor(sp));
      const r0 = Math.min(p.rows - 2, Math.floor(ze));
      const fx = sp - c0;
      const fy = ze - r0;
      const h = (a: number, b: number) => nah!.hoehen[a * p.cols + b];
      return h(r0, c0) * (1 - fx) * (1 - fy) + h(r0, c0 + 1) * fx * (1 - fy) + h(r0 + 1, c0) * (1 - fx) * fy + h(r0 + 1, c0 + 1) * fx * fy;
    };
    const hoeheAn = (x: number, y: number): number | null => nahHoehe(x, y) ?? (gelaende ? hoeheBei(gelaende, x, y) : null);

    const nahLaden = async () => {
      if (nahLaedt || !projektion || !gelaende) return;
      nahLaedt = true;
      try {
        const mitte = punktBei(zustand.current.s);
        const q = `latitude=${mitte.latitude}&longitude=${mitte.longitude}&halfMeters=600`;
        const antwort = await fetch(`/api/terrain/hirise-patch?${q}`);
        if (!antwort.ok) {
          nahFehlt = projiziert(mitte);
          if (nah) {
            netzEntfernen(nah.netz);
            nah = null;
            netz?.geometry.setIndex(netzIndex(gelaende.patch, null));
            setHirise(false);
          }
          return;
        }
        const patch: Patch = await antwort.json();
        const roh = atob(patch.elevationsBase64);
        const bytes = new Uint8Array(roh.length);
        for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
        const textur = await new THREE.TextureLoader().loadAsync(`/api/terrain/hirise-image?${q}`);
        if (beendet) return;
        textur.colorSpace = THREE.SRGBColorSpace;
        textur.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const hoehen = new Float32Array(bytes.buffer);
        const f = projektion.c;
        const neu = netzBauen({ patch, hoehen, textur }, false, null, f);
        netzEntfernen(nah?.netz ?? null);
        const m = projiziert(mitte);
        nah = { netz: neu, patch, hoehen, mitteX: m.x, mitteY: m.y };
        szene.add(neu);
        nahFehlt = null;
        netz?.geometry.setIndex(netzIndex(gelaende.patch, rechteckVon(patch, f)));
        setHirise(true);
      } catch {
        nahFehlt = projiziert(punktBei(zustand.current.s));
      } finally {
        nahLaedt = false;
      }
    };

    const patchLaden = async () => {
      if (laedtGerade) return;
      laedtGerade = true;
      try {
        const mitte = punktBei(zustand.current.s);
        const a = await ausschnittLaden(mitte, PATCH_HALB);
        if (beendet) return;
        projektion = { r: a.patch.sphereRadiusMeters, c: a.patch.cosStandardParallel };
        const m = projiziert(mitte);
        const neu = netzBauen(a, false, null);
        netzEntfernen(netz);
        netz = neu;
        szene.add(neu);
        gelaende = { patch: a.patch, hoehen: a.hoehen, mitteX: m.x, mitteY: m.y };
        if (fern) fern.netz.geometry.setIndex(netzIndex(fern.patch, rechteckVon(a.patch, 1)));
        if (nah && projektion) netz.geometry.setIndex(netzIndex(a.patch, rechteckVon(nah.patch, projektion.c)));
        setLuecke(a.patch.gapFraction);
        bandBauen();
        void nahLaden();
        setLaedt(false);
      } catch (e) {
        if (!beendet) setFehler(e instanceof Error ? e.message : 'The terrain could not be loaded.');
      } finally {
        laedtGerade = false;
      }
    };
    void patchLaden().then(() => void fernLaden());

    let ziehen: { x: number; y: number } | null = null;
    const runter = (e: PointerEvent) => { ziehen = { x: e.clientX, y: e.clientY }; };
    const bewegen = (e: PointerEvent) => {
      if (!ziehen) return;
      zustand.current.gier -= (e.clientX - ziehen.x) * 0.004;
      zustand.current.neigung = Math.max(-0.9, Math.min(0.9, zustand.current.neigung - (e.clientY - ziehen.y) * 0.003));
      ziehen = { x: e.clientX, y: e.clientY };
    };
    const hoch = () => { ziehen = null; };
    renderer.domElement.addEventListener('pointerdown', runter);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    const groesse = () => {
      renderer.setSize(behaelter.clientWidth, behaelter.clientHeight);
      kamera.aspect = behaelter.clientWidth / behaelter.clientHeight;
      kamera.updateProjectionMatrix();
    };
    window.addEventListener('resize', groesse);

    let letzte = performance.now();
    let kursGlatt: number | null = null;
    let letzteAnzeige = 0;
    let bild = 0;
    const schleife = (jetzt: number) => {
      bild = requestAnimationFrame(schleife);
      const dt = Math.min(0.1, (jetzt - letzte) / 1000);
      letzte = jetzt;
      const z = zustand.current;
      if (z.laeuft && gelaende) {
        z.s = Math.min(gesamt, z.s + GEHTEMPO * z.tempo * dt);
        if (z.s >= gesamt) {
          z.laeuft = false;
          setLaeuft(false);
        }
      }
      if (gelaende && ursprung) {
        const p = projiziert(punktBei(z.s));
        if ((Math.hypot(p.x - gelaende.mitteX, p.y - gelaende.mitteY) > NACHLADEN_AB || hoeheBei(gelaende, p.x, p.y) == null) && !laedtGerade) void patchLaden();
        if (!nahLaedt && ((nah && Math.hypot(p.x - nah.mitteX, p.y - nah.mitteY) > 350) || (!nah && (!nahFehlt || Math.hypot(p.x - nahFehlt.x, p.y - nahFehlt.y) > 500)))) void nahLaden();
        if (fern && Math.hypot(p.x - fern.mitteX, p.y - fern.mitteY) > FERN_NACHLADEN_AB && !fernLaedt) void fernLaden();
        const h = hoeheAn(p.x, p.y);
        if (h != null) {
          const voraus = projiziert(punktBei(Math.min(gesamt, z.s + 25)));
          const zurueck = projiziert(punktBei(Math.max(0, z.s - 25)));
          const von = z.s + 25 <= gesamt ? p : zurueck;
          const nach = z.s + 25 <= gesamt ? voraus : p;
          const kurs = Math.atan2(nach.x - von.x, nach.y - von.y);
          if (kursGlatt == null || z.sprung) kursGlatt = kurs;
          else {
            let d = kurs - kursGlatt;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            kursGlatt += d * Math.min(1, dt * (z.tempo > 60 ? 6 : 2.5));
          }
          z.sprung = false;
          const schritt = z.laeuft && z.tempo <= 10 ? Math.sin((z.s / 0.7) * Math.PI) * 0.025 : 0;
          kamera.position.set(p.x - ursprung.x, h - ursprung.h + AUGENHOEHE + schritt, -(p.y - ursprung.y));
          const hVoraus = hoeheAn(nach.x, nach.y) ?? h;
          const hang = Math.atan2(hVoraus - h, 25) * 0.5;
          const blick = kursGlatt + z.gier;
          const hoehenwinkel = hang + z.neigung;
          kamera.lookAt(
            kamera.position.x + Math.sin(blick) * Math.cos(hoehenwinkel),
            kamera.position.y + Math.sin(hoehenwinkel),
            kamera.position.z - Math.cos(blick) * Math.cos(hoehenwinkel),
          );
          if (jetzt - letzteAnzeige > 120) {
            letzteAnzeige = jetzt;
            const { i, t } = abschnitt(z.s);
            const mische = (feld: number[]) => feld[i - 1] + (feld[i] - feld[i - 1]) * t;
            setAnzeige({
              s: z.s,
              hoehe: h,
              steigung: profil.slopeDegrees[i],
              watt: profil.powerWatts[i],
              joule: mische(profil.cumulativeJoules),
              sekunden: mische(profil.cumulativeSeconds),
              kurs: ((blick / grad) % 360 + 360) % 360,
            });
          }
        }
      }
      himmel.position.copy(kamera.position);
      sonnenbild.position.copy(kamera.position).addScaledVector(sonnenrichtung, 80000);
      renderer.render(szene, kamera);
    };
    bild = requestAnimationFrame(schleife);

    return () => {
      beendet = true;
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
      korn.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [wegpunkte, profil, farbe, gesamt]);

  const springen = (anteil: number) => {
    zustand.current.s = anteil * gesamt;
    zustand.current.sprung = true;
    zustand.current.laeuft = false;
    setLaeuft(false);
  };

  return (
    <div className="absolute inset-0 z-[2000] bg-[#000000]">
      <div ref={halter} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#000000]/80 px-4 py-2 text-sm text-slate-100 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        <span className="font-semibold tracking-wide">SURFACE VIEW</span>
        <span className="text-slate-400">eye height 1.7 m, true scale</span>
        <span className={`rounded-md px-2 py-0.5 text-xs ${hirise ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>{hirise ? 'HiRISE image 25 cm, elevation 1 m' : 'CTX image 10 m, elevation 20 m'}</span>
      </div>
      <button onClick={onClose} className="absolute right-4 top-4 rounded-xl border border-white/15 bg-[#000000]/80 px-4 py-2 text-sm text-slate-100 backdrop-blur hover:bg-white/10">
        Back to map
      </button>

      <div className="pointer-events-none absolute right-4 top-20 w-56 space-y-2 rounded-xl border border-white/10 bg-[#000000]/80 p-3 text-sm text-slate-100 backdrop-blur">
        {[
          ['Elevation', `${Math.round(anzeige.hoehe)} m`],
          ['Slope here', `${anzeige.steigung >= 0 ? '+' : ''}${anzeige.steigung.toFixed(1)}°`],
          ['Heading', `${Math.round(anzeige.kurs)}°`],
          ['Metabolic power', `${Math.round(anzeige.watt)} W`],
          ['Energy so far', `${(anzeige.joule / 1e6).toFixed(2)} MJ`],
        ].map(([name, wert]) => (
          <div key={name} className="flex justify-between">
            <span className="text-slate-400">{name}</span>
            <span className="tabular-nums">{wert}</span>
          </div>
        ))}
      </div>

      {laedt && !fehler && <div className="absolute inset-0 flex items-center justify-center text-slate-200">Loading terrain...</div>}
      {fehler && <div className="absolute inset-x-0 top-1/2 mx-auto w-fit rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-red-100">{fehler}</div>}

      <div className="absolute bottom-5 left-1/2 w-[720px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#000000]/85 p-4 text-slate-100 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            className="w-20 rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-[#000000]"
            onClick={() => {
              if (zustand.current.s >= gesamt) zustand.current.s = 0;
              zustand.current.laeuft = !zustand.current.laeuft;
              setLaeuft(zustand.current.laeuft);
            }}
          >
            {laeuft ? 'Pause' : 'Walk'}
          </button>
          <input type="range" min={0} max={1000} value={Math.round((anzeige.s / gesamt) * 1000)} onChange={(e) => springen(Number(e.target.value) / 1000)} className="flex-1 accent-cyan-400" />
          <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs">
            {TEMPI.map((t) => (
              <button key={t} onClick={() => { zustand.current.tempo = t; setTempo(t); }} className={`px-2.5 py-1.5 ${tempo === t ? 'bg-cyan-400 font-semibold text-[#000000]' : 'hover:bg-white/10'}`}>
                {t === 1 ? 'real time' : `${t}x`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-slate-300">
          <span>{(anzeige.s / 1000).toFixed(2)} of {(gesamt / 1000).toFixed(2)} km</span>
          <span>EVA time {zeit(anzeige.sekunden)} so far</span>
          <span>{zeit(Math.max(0, (profil.cumulativeSeconds[profil.cumulativeSeconds.length - 1] ?? 0) - anzeige.sekunden))} left</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Terrain from the CTX elevation model (20 m) and CTX image (10 m), tinted for display. Where HiRISE covers the route (delta and western crater rim) the ground is the real HiRISE image, tinted for display. Elsewhere it is the CTX image at 10 m, which is soft up close. Nothing is generated or added. Beyond 2.5 km the terrain is shown at about 200 m. Drag to look around.
          {luecke > 0.01 ? ` ${Math.round(luecke * 100)} % of this area has no elevation data and is drawn flat.` : ''}
        </p>
      </div>
    </div>
  );
}
