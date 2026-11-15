'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import Egoansicht, { type EgoProfil } from './Egoansicht';
import Globus from './Globus';
import Gelaende3D from './Gelaende3D';

type Punkt = { latitude: number; longitude: number; elevationMeters?: number | null };
type Route = {
  id: string;
  waypoints: Punkt[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  riskScore: number;
  energyJoules?: number | null;
  averagePowerWatts?: number | null;
  objective?: string | null;
  maxSlopeDeg?: number | null;
  meanSlopeDeg?: number | null;
  datasetId?: string | null;
  heightDatum?: string | null;
  routingGridResolutionMeters?: number | null;
  visitedSciencePointIds?: string[];
  constraints?: string[];
  warnings?: string[];
};
type Science = { id: string; name: string; description: string; location: Punkt; nasaSourceUrl: string };
type Ort = { name: string; latitude: number; longitude: number; kind: string; diameterKm: number; official: boolean; origin: string; sourceUrl: string };
type Probe = { latitude: number; longitude: number; hasData: boolean; elevationMeters?: number | null; slopeDegrees?: number | null; dataset?: string | null; validated?: boolean | null; aspectDegrees?: number | null; aspectCompass?: string | null; thermalInertia?: number | null; geologyUnit?: string | null; distanceToLandingMeters?: number | null };
type Mission = {
  durationSeconds: number;
  oxygenLiters: number;
  oxygenKilograms: number;
  energyWattHours: number;
  averagePowerWatts: number;
  peakPowerWatts?: number | null;
  withinEvaTimeLimit: boolean;
  withinAverageMetabolicRate: boolean;
  withinPeakMetabolicRate?: boolean | null;
  radiationDoseMilligray?: number | null;
  radiationBasis?: string | null;
  assumptions?: { bodyMassKg: number; suitLoadKg: number; walkingSpeedMetersPerSecond: number; terrainFactor: number; gravityTreatment: string; downhillTreatment: string; maxSlopeDegrees: number } | null;
  warnings: string[];
};
type KachelInfo = {
  bounds: { west: number; south: number; east: number; north: number };
  wurzelKachel: { west: number; north: number; groesseGrad: number };
  maxZoom: number;
  wertMin?: number;
  wertMax?: number;
  einheit?: string;
  legende?: { klasse: number; name: string; symbol: string; farbe: string }[];
};
type Auswahl =
  | { art: 'punkt'; probe: Probe }
  | { art: 'science'; punkt: Science }
  | { art: 'ort'; ort: Ort };
type Ueberlagerung = 'risk_ctx' | 'geology_rgb' | 'thermal_rgb';

const ZIELE: Record<string, { label: string; color: string }> = {
  energy_min: { label: 'Lowest energy', color: '#22d3ee' },
  distance_min: { label: 'Shortest distance', color: '#f59e0b' },
  slope_hazard_min: { label: 'Lowest slope hazard', color: '#a78bfa' },
};
const UEBERLAGERUNGEN: { id: Ueberlagerung; name: string; quelle: string }[] = [
  { id: 'risk_ctx', name: 'Slope hazard', quelle: 'From the CTX elevation model, same grid as routing' },
  { id: 'geology_rgb', name: 'Geologic units', quelle: 'USGS SIM 3464 (Sun and Stack 2020), Jezero only' },
  { id: 'thermal_rgb', name: 'Thermal inertia', quelle: 'Mars Odyssey THEMIS, 100 m, Jezero only' },
];
const BASIS_BREITE = 18.5;
const KACHELN = process.env.NEXT_PUBLIC_TILE_BASE ?? '/api/terrain/tiles';

function dauer(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function megajoule(j?: number | null) {
  return j == null ? '-' : `${(j / 1e6).toFixed(1)} MJ`;
}
function koord(p: { latitude: number; longitude: number }) {
  return `${p.latitude.toFixed(4)}°N  ${p.longitude.toFixed(4)}°E`;
}
function meterAbstand(a: Punkt, b: Punkt) {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r * 3396190;
  const dLon = (b.longitude - a.longitude) * r * 3396190 * Math.cos(((a.latitude + b.latitude) / 2) * r);
  return Math.hypot(dLat, dLon);
}

function neigungsFarbe(grad: number) {
  const a = Math.abs(grad);
  return a >= 15 ? '#ef4444' : a >= 8 ? '#f59e0b' : '#22c55e';
}

function Profil({ route, farbe }: { route: Route; farbe: string }) {
  const daten = useMemo(() => {
    const punkte: { x: number; y: number; grad: number }[] = [];
    let gesamt = 0;
    route.waypoints.forEach((w, i) => {
      let grad = 0;
      if (i > 0) {
        const d = meterAbstand(route.waypoints[i - 1], w);
        gesamt += d;
        const vor = route.waypoints[i - 1].elevationMeters;
        if (d > 0 && vor != null && w.elevationMeters != null) grad = (Math.atan2(w.elevationMeters - vor, d) * 180) / Math.PI;
      }
      if (w.elevationMeters != null) punkte.push({ x: gesamt, y: w.elevationMeters, grad });
    });
    return punkte;
  }, [route]);
  if (daten.length < 2) return null;
  const maxX = daten[daten.length - 1].x || 1;
  const minY = Math.min(...daten.map((p) => p.y));
  const maxY = Math.max(...daten.map((p) => p.y));
  const spanne = Math.max(maxY - minY, 1);
  const px = (p: { x: number }) => ((p.x / maxX) * 300).toFixed(1);
  const py = (p: { y: number }) => (50 - ((p.y - minY) / spanne) * 44).toFixed(1);
  const pfad = daten.map((p, i) => `${i ? 'L' : 'M'}${px(p)},${py(p)}`).join(' ');
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
        <span>Elevation along the route</span>
        <span>
          {Math.round(minY)} to {Math.round(maxY)} m
        </span>
      </div>
      <svg viewBox="0 0 300 56" preserveAspectRatio="none" className="h-14 w-full">
        <path d={`${pfad} L300,56 L0,56 Z`} fill={farbe} opacity="0.14" />
        <path d={pfad} fill="none" stroke={farbe} strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity="0.6" />
        {daten.slice(1).map((p, i) => (
          <line key={i} x1={px(daten[i])} y1={py(daten[i])} x2={px(p)} y2={py(p)} stroke={neigungsFarbe(p.grad)} strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        ))}
        <line x1="0" y1="53" x2="300" y2="53" stroke="#fff" strokeOpacity="0.15" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-green-500" />under 8°</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-amber-500" />8° to 15°</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-red-500" />15° or more</span>
        <span className="ml-auto">slope per waypoint</span>
      </div>
    </div>
  );
}

const HIMMELSRICHTUNGEN = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function richtung(a: Punkt, b: Punkt) {
  const r = Math.PI / 180;
  const y = Math.sin((b.longitude - a.longitude) * r) * Math.cos(b.latitude * r);
  const x = Math.cos(a.latitude * r) * Math.sin(b.latitude * r) - Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos((b.longitude - a.longitude) * r);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function Schritte({ route, onFlug }: { route: Route; onFlug: (p: Punkt) => void }) {
  const [offen, setOffen] = useState(false);
  const schritte = useMemo(() => {
    const w = route.waypoints;
    const liste: { text: string; meter: number; hoehe: number; ziel: Punkt }[] = [];
    let von = 0;
    let meter = 0;
    let kurs: number | null = null;
    const abschliessen = (bis: number) => {
      const a = w[von];
      const b = w[bis];
      const k = richtung(a, b);
      const hoehe = (b.elevationMeters ?? 0) - (a.elevationMeters ?? 0);
      liste.push({ text: `Head ${HIMMELSRICHTUNGEN[Math.round(k / 45) % 8]}`, meter, hoehe, ziel: b });
      von = bis;
      meter = 0;
      kurs = null;
    };
    for (let i = 1; i < w.length; i++) {
      meter += meterAbstand(w[i - 1], w[i]);
      const k = richtung(w[i - 1], w[i]);
      if (kurs == null) kurs = k;
      const abweichung = Math.abs(((k - kurs + 540) % 360) - 180);
      if ((meter > 1500 && abweichung > 35) || meter > 6000) abschliessen(i);
    }
    if (von < w.length - 1) abschliessen(w.length - 1);
    return liste;
  }, [route]);
  if (schritte.length === 0) return null;
  return (
    <div className="mt-3">
      <button className="flex w-full items-center justify-between text-left text-xs text-cyan-300 hover:underline" onClick={() => setOffen((o) => !o)}>
        <span>{offen ? 'Hide directions' : `Show directions (${schritte.length} steps)`}</span>
        <span>{offen ? '-' : '+'}</span>
      </button>
      {offen && (
        <ol className="mt-2 space-y-1 text-sm">
          {schritte.map((st, i) => (
            <li key={i}>
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5" onClick={() => onFlug(st.ziel)}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px]">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{st.text}</span>
                  <span className="block text-[11px] text-slate-400">{km(st.meter)}, {st.hoehe >= 0 ? 'climb' : 'descent'} {Math.abs(Math.round(st.hoehe))} m</span>
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-3 px-2 py-1.5 text-slate-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-[#000000]">B</span>
            Arrive at the destination
          </li>
        </ol>
      )}
    </div>
  );
}

const QUELLEN_LISTE: { name: string; was: string; aufloesung: string; url: string; lizenz: string }[] = [
  { name: 'CTX DEM Jezero (USGS, Calef et al. 2021)', was: 'Elevation, routing grid', aufloesung: '20 m', url: 'https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic', lizenz: 'public domain' },
  { name: 'HiRISE DTM and orthoimage (USGS, Bland et al. 2024)', was: 'Ground view at the landing area', aufloesung: '1 m and 25 cm', url: 'https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic', lizenz: 'public domain' },
  { name: 'CTX multistrip NE Syrtis (Caltech, Quinn)', was: 'Elevation and image outside Jezero', aufloesung: '9.9 m, used at 20 m', url: 'https://data.caltech.edu/records/hhzzq-yw058', lizenz: 'CC0' },
  { name: 'Viking MDIM 2.1 colour mosaic (USGS)', was: 'Surface colour', aufloesung: '232 m', url: 'https://astrogeology.usgs.gov/search/map/mars_viking_mdim21_clrmosaic_global_232m', lizenz: 'public domain' },
  { name: 'MOLA/HRSC blended DEM (USGS)', was: 'Elevation base map', aufloesung: '200 m', url: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m', lizenz: 'public domain' },
  { name: 'Geologic map SIM 3464 (USGS, Sun and Stack 2020)', was: 'Geologic units layer', aufloesung: '1:75 000', url: 'https://pubs.usgs.gov/publication/sim3464', lizenz: 'public domain' },
  { name: 'THEMIS thermal inertia (Zenodo 4931348)', was: 'Thermal inertia layer', aufloesung: '100 m', url: 'https://zenodo.org/records/4931348', lizenz: 'CC BY 4.0' },
  { name: 'Mars 2020 MMGIS (NASA/JPL)', was: 'Science points, rover waypoints', aufloesung: 'point data', url: 'https://mars.nasa.gov/mmgis-maps/M20/', lizenz: 'NASA, public' },
  { name: 'IAU planetary names (USGS gazetteer)', was: 'Place names', aufloesung: 'point data', url: 'https://planetarynames.wr.usgs.gov/', lizenz: 'public' },
];

function UeberUns({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-[880px] max-w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#03070d] p-6 text-sm text-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-lg font-semibold tracking-wide">About this map and its data</div>
            <p className="mt-1 text-slate-400">Mars Pathfinder plans EVA walking routes on Mars from NASA and USGS data. All figures are planning estimates.</p>
          </div>
          <button className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10" onClick={onClose}>Close (Esc)</button>
        </div>

        <div className="mt-5 text-[11px] uppercase tracking-wider text-slate-400">Data sources</div>
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
          {QUELLEN_LISTE.map((q) => (
            <div key={q.name} className="grid grid-cols-[1.6fr_1.2fr_0.8fr_0.7fr] gap-3 border-b border-white/5 px-3 py-2 last:border-b-0">
              <a href={q.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">{q.name}</a>
              <span className="text-slate-300">{q.was}</span>
              <span className="text-slate-400">{q.aufloesung}</span>
              <span className="text-slate-400">{q.lizenz}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Model and limits</div>
            <ul className="mt-2 space-y-1 text-slate-300">
              <li>Energy: Pandolf equation, 80.7 kg body mass, 3.0 km/h, no extra load, 1 g.</li>
              <li>Cells with a slope of 15° or more are blocked for routing.</li>
              <li>EVA limits: 8 h, 350 W average, 530 W peak metabolic rate.</li>
              <li>Oxygen from energy at 14.11 MJ per kg, radiation from the MSL RAD reference of 0.21 mGy per day (Hassler et al. 2014, Gale crater).</li>
              <li>The slope index (0 to 100) is this project&apos;s own measure, not an accident probability.</li>
              <li>Heights are relative to the MOLA areoid, coordinates are IAU Mars 2000, east positive.</li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Accuracy, stated openly</div>
            <ul className="mt-2 space-y-1 text-slate-300">
              <li>Jezero CTX elevation against 708 NASA rover positions: RMSE 3.3 m. HiRISE against 320 positions: RMSE 1.1 m.</li>
              <li>NE Syrtis is not checked against rover positions. It was shifted by about 480 m to fit the Jezero model, and still differs from it by about 24 m (RMSE).</li>
              <li>The search runs on a 20 m to 40 m grid and can miss small obstacles.</li>
              <li>The ground view uses HiRISE where it exists (delta and western rim) and CTX elsewhere. Nothing in it is generated.</li>
              <li>Not safety-certified and not a forecast for a real EVA.</li>
            </ul>
          </div>
        </div>
        <p className="mt-5 text-[11px] text-slate-500">Parts of this software were written with AI assistance. Images and elevation: NASA/JPL/MSSS, USGS, Caltech. Names: IAU/USGS.</p>
      </div>
    </div>
  );
}

function Radar({ mitte, reichweite, onReichweite, route, start, ziel, science, onClose }: { mitte: Punkt; reichweite: number; onReichweite: () => void; route: Punkt[]; start: Punkt | null; ziel: Punkt | null; science: Punkt[]; onClose: () => void }) {
  const R = 92;
  const proM = 59275;
  const abl = (p: Punkt) => {
    const dx = (p.longitude - mitte.longitude) * Math.cos((mitte.latitude * Math.PI) / 180) * proM;
    const dy = (p.latitude - mitte.latitude) * proM;
    return { x: (dx / reichweite) * R, y: (-dy / reichweite) * R, m: Math.hypot(dx, dy) };
  };
  const innen = (p: Punkt) => abl(p).m <= reichweite * 1.02;
  const linie = route.map((w) => abl(w)).map((q) => `${(100 + q.x).toFixed(1)},${(100 + q.y).toFixed(1)}`);
  const rand = (p: Punkt) => {
    const q = abl(p);
    const f = q.m > reichweite ? (reichweite / q.m) : 1;
    return { x: 100 + q.x * f, y: 100 + q.y * f, aussen: q.m > reichweite };
  };
  const text = reichweite >= 1000 ? `${reichweite / 1000} km` : `${reichweite} m`;
  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-[1000] w-[232px] rounded-2xl border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">
        <span>Radar</span>
        <span className="flex items-center gap-2">
          <button className="rounded border border-white/15 px-1.5 py-0.5 normal-case text-slate-200 hover:bg-white/10" onClick={onReichweite}>range {text}</button>
          <button className="text-slate-400 hover:text-white" onClick={onClose} aria-label="Close radar">x</button>
        </span>
      </div>
      <svg viewBox="0 0 200 200" className="w-full">
        <defs>
          <radialGradient id="radar-grund" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0b2a3a" />
            <stop offset="100%" stopColor="#06101c" />
          </radialGradient>
          <linearGradient id="radar-strahl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#radar-grund)" stroke="#22d3ee" strokeOpacity="0.5" />
        {[0.25, 0.5, 0.75].map((f) => <circle key={f} cx="100" cy="100" r={96 * f} fill="none" stroke="#22d3ee" strokeOpacity="0.18" strokeDasharray="3 3" />)}
        <line x1="100" y1="4" x2="100" y2="196" stroke="#22d3ee" strokeOpacity="0.18" />
        <line x1="4" y1="100" x2="196" y2="100" stroke="#22d3ee" strokeOpacity="0.18" />
        <text x="100" y="14" textAnchor="middle" fontSize="9" fill="#94a3b8">N</text>
        <g>
          <path d="M100,100 L196,100 A96,96 0 0,0 188,64 Z" fill="url(#radar-strahl)" />
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="5s" repeatCount="indefinite" />
        </g>
        {science.filter(innen).map((p, i) => { const q = abl(p); return <circle key={i} cx={100 + q.x} cy={100 + q.y} r="2" fill="#67e8f9" />; })}
        {linie.length > 1 && <polyline points={linie.join(' ')} fill="none" stroke="#22d3ee" strokeWidth="1.6" />}
        {start && (() => { const q = rand(start); return <circle cx={q.x} cy={q.y} r="4.5" fill="#22d3ee" stroke="#000000" />; })()}
        {ziel && (() => { const q = rand(ziel); return <circle cx={q.x} cy={q.y} r="4.5" fill="#f59e0b" stroke="#000000" strokeDasharray={q.aussen ? '2 2' : undefined} />; })()}
        <circle cx="100" cy="100" r="2.5" fill="#fff" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>centre: {start ? 'start A' : 'map centre'}</span>
        <span>rings every {reichweite / 4000} km</span>
      </div>
    </div>
  );
}

const UMWELT: { name: string; wert: string; hinweis: string }[] = [
  { name: 'Air temperature', wert: 'mean about -55 °C', hinweis: 'Day to night swing of 50 to 60 °C. Early mission readings reached -83 °C and -22 °C.' },
  { name: 'Surface pressure', wert: 'about 718 Pa', hinweis: 'Models predicted 705 to 735 Pa for that time. It changes daily and with the season (CO2 frost at the poles).' },
  { name: 'Wind', wert: 'gusts up to about 25 m/s', hinweis: 'Daily cycle: calm before dawn, about 7 m/s in the afternoon, direction reverses at night.' },
  { name: 'Dust devils', wert: '0.3 to 6.5 Pa dips', hinweis: 'Short pressure drops when a vortex passes.' },
  { name: 'Gravity', wert: '3.71 m/s2 (0.38 g)', hinweis: 'The energy model assumes 1 g, so real effort is probably lower.' },
  { name: 'Length of a day', wert: '24 h 39 min 35 s', hinweis: 'One sol. The atmosphere is about 95 % carbon dioxide.' },
];

function briefingText(route: Route, mission: Mission | null, start: Punkt | null, ziel: Punkt | null, crew: number, stoppNamen: string[]) {
  const z = ZIELE[route.objective ?? '']?.label ?? 'Route';
  const zeilen = [
    '=== MARS PATHFINDER // EVA BRIEFING ===',
    'Region: Jezero crater and surroundings',
    `Profile: ${z}`,
    `Start: ${start ? koord(start) : '-'}`,
    ...stoppNamen.map((n, i) => `Stop ${i + 1}: ${n}`),
    `Destination: ${ziel ? koord(ziel) : '-'}`,
    `Distance: ${km(route.distanceMeters)}`,
    `Walking time: ${dauer(route.estimatedDurationSeconds)} at 3.0 km/h`,
    `Energy per person (Pandolf, 1 g): ${megajoule(route.energyJoules)}`,
    `Steepest slope: ${route.maxSlopeDeg?.toFixed(1)} deg, mean ${route.meanSlopeDeg?.toFixed(1)} deg (limit 15 deg)`,
    `Slope index: ${Math.round(route.riskScore * 100)} of 100 (own index, not an accident probability)`,
  ];
  if (mission) {
    zeilen.push(
      `Oxygen (${crew} crew): ${Math.round(mission.oxygenLiters)} L, ${mission.oxygenKilograms.toFixed(2)} kg`,
      `Average power: ${Math.round(mission.averagePowerWatts)} W (limit 350 W), peak ${mission.peakPowerWatts != null ? Math.round(mission.peakPowerWatts) : '-'} W (limit 530 W)`,
      `EVA time limit 8 h: ${mission.withinEvaTimeLimit ? 'within' : 'EXCEEDED'}`,
      `Radiation per person: ${mission.radiationDoseMilligray?.toFixed(3)} mGy (MSL RAD reference from Gale crater, not measured at Jezero)`,
    );
  }
  zeilen.push(
    `Elevation data: ${route.datasetId?.startsWith('REGION') ? 'USGS CTX Jezero plus Caltech CTX NE Syrtis (NE Syrtis not checked against rover positions)' : 'USGS CTX DEM Jezero 20 m (RMSE 3.3 m against rover positions)'}`,
    'Datum: IAU Mars 2000, MOLA areoid',
    ...(route.warnings ?? []).map((w) => `Note: ${w}`),
    'Screening estimate with the stated assumptions. Not safety-certified and not a forecast for a real EVA.',
    '=======================================',
  );
  return zeilen.join('\n');
}

function Kennzahl({ name, wert, hinweis }: { name: string; wert: string; hinweis?: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{name}</div>
      <div className="tabular-nums">{wert}</div>
      {hinweis && <div className="text-[10px] text-slate-500">{hinweis}</div>}
    </div>
  );
}

export default function Karte() {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<Leaflet.Map | null>(null);
  const bib = useRef<typeof Leaflet | null>(null);
  const ebenen = useRef<{
    route: Leaflet.LayerGroup | null;
    marker: Leaflet.LayerGroup | null;
    wissen: Leaflet.LayerGroup | null;
    orte: Leaflet.LayerGroup | null;
    auswahl: Leaflet.LayerGroup | null;
    basis: Record<string, Leaflet.TileLayer>;
    unter: Record<string, Leaflet.TileLayer>;
    ueber: Record<string, Leaflet.TileLayer>;
  }>({ route: null, marker: null, wissen: null, orte: null, auswahl: null, basis: {}, unter: {}, ueber: {} });
  const startRef = useRef<Punkt | null>(null);
  const zielRef = useRef<Punkt | null>(null);
  const stoppsRef = useRef<string[]>([]);

  const [bereit, setBereit] = useState(false);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [start, setStart] = useState<Punkt | null>(null);
  const [ziel, setZiel] = useState<Punkt | null>(null);
  const [stopps, setStopps] = useState<string[]>([]);
  const [routen, setRouten] = useState<Route[]>([]);
  const [gewaehlt, setGewaehlt] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [rechnet, setRechnet] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);
  const [annahmenOffen, setAnnahmenOffen] = useState(false);
  const [crew, setCrew] = useState(2);
  const [suche, setSuche] = useState('');
  const [science, setScience] = useState<Science[]>([]);
  const [orte, setOrte] = useState<Ort[]>([]);
  const [infos, setInfos] = useState<Record<string, KachelInfo>>({});
  const [basis, setBasis] = useState<'ctx_ortho' | 'relief_rgb'>('ctx_ortho');
  const [aktiv, setAktiv] = useState<Record<Ueberlagerung, boolean>>({ risk_ctx: false, geology_rgb: false, thermal_rgb: false });
  const [zeigeOrte, setZeigeOrte] = useState(true);
  const [bewegung, setBewegung] = useState(0);
  const [about, setAbout] = useState(false);
  const [lineal, setLineal] = useState(false);
  const [linealPunkte, setLinealPunkte] = useState<Punkt[]>([]);
  const [briefingOffen, setBriefingOffen] = useState(false);
  const linealGruppe = useRef<Leaflet.LayerGroup | null>(null);
  const [radarAn, setRadarAn] = useState(true);
  const [radarReichweite, setRadarReichweite] = useState(10000);
  const [umweltOffen, setUmweltOffen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const sucheFeld = useRef<HTMLInputElement>(null);
  const [zeigeScience, setZeigeScience] = useState(true);
  const [zoom, setZoom] = useState(4.5);
  const [maus, setMaus] = useState<Punkt | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [ego, setEgo] = useState<{ profil: EgoProfil; tempo: number } | null>(null);
  const [demo, setDemo] = useState<{ text: string; sekunde: number } | null>(null);
  const [demoRest, setDemoRest] = useState(30);
  const demoStart = useRef(0);
  const [ansicht, setAnsicht] = useState<'globus' | 'karte' | 'gelaende'>('globus');
  const [mitteFuer3D, setMitteFuer3D] = useState<Punkt>({ latitude: 18.44, longitude: 77.45 });
  const [eintauchen, setEintauchen] = useState(0);

  const route = routen[gewaehlt] ?? null;
  const farbe = ZIELE[route?.objective ?? '']?.color ?? '#22d3ee';

  const routeBerechnen = useCallback(async () => {
    const a = startRef.current;
    const b = zielRef.current;
    if (!a || !b) return;
    setRechnet(true);
    setFehler(null);
    setMission(null);
    try {
      const antwort = await fetch('/api/routes/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { latitude: a.latitude, longitude: a.longitude },
          end: { latitude: b.latitude, longitude: b.longitude },
          sciencePointIds: stoppsRef.current,
        }),
      });
      const daten = await antwort.json();
      if (!antwort.ok) {
        setRouten([]);
        setFehler(typeof daten.detail === 'string' ? daten.detail : 'The route could not be calculated.');
        return;
      }
      setRouten(daten as Route[]);
      setGewaehlt(0);
    } catch {
      setRouten([]);
      setFehler('The server is not reachable.');
    } finally {
      setRechnet(false);
    }
  }, []);

  const startSetzen = useCallback(
    (p: Punkt) => {
      startRef.current = p;
      setStart(p);
      setAuswahl(null);
      if (zielRef.current) void routeBerechnen();
    },
    [routeBerechnen],
  );
  const zielSetzen = useCallback(
    (p: Punkt) => {
      zielRef.current = p;
      setZiel(p);
      setAuswahl(null);
      if (startRef.current) void routeBerechnen();
    },
    [routeBerechnen],
  );
  const stoppUmschalten = useCallback(
    (id: string) => {
      const neu = stoppsRef.current.includes(id) ? stoppsRef.current.filter((s) => s !== id) : [...stoppsRef.current, id].slice(0, 3);
      stoppsRef.current = neu;
      setStopps(neu);
      if (startRef.current && zielRef.current) void routeBerechnen();
    },
    [routeBerechnen],
  );
  const allesLeeren = useCallback(() => {
    startRef.current = null;
    zielRef.current = null;
    stoppsRef.current = [];
    setStart(null);
    setZiel(null);
    setStopps([]);
    setRouten([]);
    setFehler(null);
    setMission(null);
    setAuswahl(null);
  }, []);
  const punktSetzen = useCallback(
    (p: Punkt) => {
      if (!startRef.current || (startRef.current && zielRef.current)) {
        zielRef.current = null;
        setZiel(null);
        setRouten([]);
        setFehler(null);
        setMission(null);
        startSetzen(p);
      } else {
        zielSetzen(p);
      }
    },
    [startSetzen, zielSetzen],
  );
  const pruefen = useCallback(async (p: Punkt) => {
    try {
      const antwort = await fetch(`/api/terrain/sample?latitude=${p.latitude}&longitude=${p.longitude}`);
      if (antwort.ok) setAuswahl({ art: 'punkt', probe: (await antwort.json()) as Probe });
    } catch {
      setAuswahl(null);
    }
  }, []);

  const linealKlick = useCallback((p: Punkt) => setLinealPunkte((l) => [...l, p]), []);
  const handler = useRef({ punktSetzen, pruefen, lineal, linealKlick });
  handler.current = { punktSetzen, pruefen, lineal, linealKlick };

  useEffect(() => {
    let abgebrochen = false;
    let aufraeumen = () => {};
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const namen = ['ctx_ortho', 'relief_rgb', 'risk_ctx', 'geology_rgb', 'thermal_rgb', 'viking_rgb', 'ctx_color', 'relief_global_rgb'];
        const geladen = await Promise.all(
          namen.map((n) =>
            fetch(`${KACHELN}/${n}/metadata.json`)
              .then((r) => (r.ok ? (r.json() as Promise<KachelInfo>) : null))
              .catch(() => null),
          ),
        );
        const alle: Record<string, KachelInfo> = {};
        namen.forEach((n, i) => {
          const info = geladen[i];
          if (info) alle[n] = info;
        });
        const info = alle.ctx_ortho;
        if (abgebrochen || !behaelter.current) return;
        if (!info) {
          setLadefehler('The map tiles are not available. Is the backend running?');
          return;
        }
        if ((behaelter.current as unknown as { _leaflet_id?: number })._leaflet_id) return;
        bib.current = L;
        const c = Math.round(256 * Math.cos((BASIS_BREITE * Math.PI) / 180)) / 256;
        const G = info.wurzelKachel.groesseGrad;
        const crs = L.Util.extend({}, L.CRS, {
          projection: {
            project: (ll: Leaflet.LatLng) => new L.Point(ll.lng * c, ll.lat),
            unproject: (p: Leaflet.Point) => new L.LatLng(p.y, p.x / c),
          },
          transformation: new L.Transformation(1, -info.wurzelKachel.west * c, -1, info.wurzelKachel.north),
          scale: (z: number) => (256 * 2 ** z) / G,
          zoom: (s: number) => Math.log((s * G) / 256) / Math.LN2,
          infinite: true,
        }) as unknown as Leaflet.CRS;
        const m = L.map(behaelter.current, {
          crs,
          zoomControl: false,
          attributionControl: false,
          doubleClickZoom: false,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          wheelPxPerZoomLevel: 100,
          minZoom: 2,
          maxZoom: 10,
        });
        const grenzen = L.latLngBounds([info.wurzelKachel.north - G, info.wurzelKachel.west], [info.wurzelKachel.north, info.wurzelKachel.west + G / c]);
        const arbeitsgebiet = L.latLngBounds([17.05, 76.1], [19.85, 78.6]);
        m.fitBounds(arbeitsgebiet, { animate: false });
        m.setMinZoom(m.getZoom());
        m.setMaxBounds(arbeitsgebiet.pad(0.04));
        const kachelGroesse = L.point(256 * c, 256);
        const schicht = (name: string, klasse: string, deckkraft: number) =>
          L.tileLayer(`${KACHELN}/${name}/{z}/{x}/{y}.png`, {
            tileSize: kachelGroesse,
            maxNativeZoom: alle[name]?.maxZoom ?? 7,
            minZoom: 0,
            maxZoom: 10,
            noWrap: true,
            bounds: grenzen,
            keepBuffer: 3,
            opacity: deckkraft,
            className: klasse,
          });
        ebenen.current.basis = {
          ctx_ortho: alle.ctx_color ? schicht('ctx_color', 'ebene-farbe', 1) : schicht('ctx_ortho', 'ebene-ortho', 1),
          relief_rgb: schicht('relief_rgb', '', 1),
        };
        ebenen.current.unter = {};
        if (alle.viking_rgb) ebenen.current.unter.ctx_ortho = schicht('viking_rgb', '', 1);
        if (alle.relief_global_rgb) ebenen.current.unter.relief_rgb = schicht('relief_global_rgb', '', 1);
        ebenen.current.ueber = { risk_ctx: schicht('risk_ctx', '', 0.9), geology_rgb: schicht('geology_rgb', '', 0.9), thermal_rgb: schicht('thermal_rgb', '', 0.9) };
        ebenen.current.basis.ctx_ortho.addTo(m);
        ebenen.current.orte = L.layerGroup().addTo(m);
        ebenen.current.wissen = L.layerGroup().addTo(m);
        ebenen.current.route = L.layerGroup().addTo(m);
        ebenen.current.auswahl = L.layerGroup().addTo(m);
        ebenen.current.marker = L.layerGroup().addTo(m);
        let einzel: ReturnType<typeof setTimeout> | null = null;
        m.on('click', (e: Leaflet.LeafletMouseEvent) => {
          if (einzel) clearTimeout(einzel);
          const p = { latitude: Number(e.latlng.lat.toFixed(5)), longitude: Number(e.latlng.lng.toFixed(5)) };
          if (handler.current.lineal) {
            handler.current.linealKlick(p);
            return;
          }
          einzel = setTimeout(() => void handler.current.pruefen(p), 260);
        });
        m.on('dblclick', (e: Leaflet.LeafletMouseEvent) => {
          if (einzel) clearTimeout(einzel);
          if (handler.current.lineal) return;
          handler.current.punktSetzen({ latitude: Number(e.latlng.lat.toFixed(5)), longitude: Number(e.latlng.lng.toFixed(5)) });
        });
        m.on('mousemove', (e: Leaflet.LeafletMouseEvent) => setMaus({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
        m.on('zoomend', () => setZoom(m.getZoom()));
        m.on('moveend', () => setBewegung((n) => n + 1));
        karte.current = m;
        setInfos(alle);
        setBereit(true);
        aufraeumen = () => m.remove();
      } catch {
        if (!abgebrochen) setLadefehler('The map could not be started.');
      }
    })();
    return () => {
      abgebrochen = true;
      aufraeumen();
      karte.current = null;
      setBereit(false);
    };
  }, []);

  useEffect(() => {
    fetch('/api/science-points').then((r) => r.json()).then((d: Science[]) => setScience(d)).catch(() => setScience([]));
    fetch('/api/places').then((r) => (r.ok ? r.json() : [])).then((d: Ort[]) => setOrte(d)).catch(() => setOrte([]));
  }, []);

  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m) return;
    Object.entries(ebenen.current.basis).forEach(([name, schicht]) => {
      if (name === basis) schicht.addTo(m).bringToBack();
      else m.removeLayer(schicht);
    });
    Object.entries(ebenen.current.unter).forEach(([name, schicht]) => {
      if (name === basis) schicht.addTo(m).bringToBack();
      else m.removeLayer(schicht);
    });
    Object.entries(ebenen.current.ueber).forEach(([name, schicht]) => {
      if (aktiv[name as Ueberlagerung]) schicht.addTo(m);
      else m.removeLayer(schicht);
    });
  }, [bereit, basis, aktiv]);

  useEffect(() => {
    const L = bib.current;
    const gruppe = ebenen.current.wissen;
    if (!bereit || !L || !gruppe) return;
    gruppe.clearLayers();
    if (!zeigeScience) return;
    science.forEach((s) => {
      const istStopp = stopps.includes(s.id);
      L.circleMarker([s.location.latitude, s.location.longitude], {
        radius: istStopp ? 7 : 5,
        color: '#000000',
        weight: 1.5,
        fillColor: istStopp ? '#f59e0b' : '#22d3ee',
        fillOpacity: 1,
      })
        .bindTooltip(s.name, { direction: 'top', className: 'karte-tip' })
        .on('click', (e: Leaflet.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          setAuswahl({ art: 'science', punkt: s });
        })
        .addTo(gruppe);
    });
  }, [bereit, science, stopps, zeigeScience]);

  useEffect(() => {
    const L = bib.current;
    const gruppe = ebenen.current.orte;
    if (!bereit || !L || !gruppe) return;
    gruppe.clearLayers();
    if (!zeigeOrte) return;
    const m = karte.current;
    if (!m) return;
    const sicht = m.getBounds().pad(0.02);
    const belegt: { x: number; y: number; b: number; h: number }[] = [];
    [...orte]
      .sort((a, b) => (b.official ? 0 : 1000) - (a.official ? 0 : 1000) || b.diameterKm - a.diameterKm)
      .filter((o) => sicht.contains([o.latitude, o.longitude]))
      .filter((o) => {
        const p = m.latLngToContainerPoint([o.latitude, o.longitude]);
        const b = o.name.length * (o.diameterKm > 30 ? 11 : 7.2) + 14;
        const h = o.diameterKm > 30 ? 24 : 18;
        const x0 = p.x - b / 2;
        const y0 = p.y - h / 2;
        if (belegt.some((r) => x0 < r.x + r.b && x0 + b > r.x && y0 < r.y + r.h && y0 + h > r.y)) return false;
        belegt.push({ x: x0, y: y0, b, h });
        return true;
      })
      .forEach((o) => {
        const gross = o.diameterKm > 30;
        L.marker([o.latitude, o.longitude], {
          icon: L.divIcon({
            className: '',
            iconSize: [0, 0],
            html: `<div class="karte-ort${gross ? ' karte-ort-gross' : ''}">${o.name}</div>`,
          }),
        })
          .on('click', (e: Leaflet.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            setAuswahl({ art: 'ort', ort: o });
          })
          .addTo(gruppe);
      });
  }, [bereit, orte, zoom, zeigeOrte, infos, bewegung]);

  useEffect(() => {
    const L = bib.current;
    const gruppe = ebenen.current.auswahl;
    if (!bereit || !L || !gruppe) return;
    gruppe.clearLayers();
    if (auswahl?.art === 'punkt') {
      L.circleMarker([auswahl.probe.latitude, auswahl.probe.longitude], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#000000', fillOpacity: 0.6 }).addTo(gruppe);
    }
  }, [bereit, auswahl]);

  useEffect(() => {
    const L = bib.current;
    const gruppe = ebenen.current.marker;
    if (!bereit || !L || !gruppe) return;
    gruppe.clearLayers();
    const symbol = (text: string, f: string) =>
      L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${f};color:#000000;font:700 13px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #000000;box-shadow:0 2px 8px #000a">${text}</div>`,
      });
    const verschiebbar = (p: Punkt, text: string, f: string, setzen: (neu: Punkt) => void) => {
      const mk = L.marker([p.latitude, p.longitude], { icon: symbol(text, f), draggable: true, zIndexOffset: 1000 }).addTo(gruppe);
      mk.on('dragend', () => {
        const ll = mk.getLatLng();
        setzen({ latitude: Number(ll.lat.toFixed(5)), longitude: Number(ll.lng.toFixed(5)) });
      });
    };
    if (start) verschiebbar(start, 'A', '#22d3ee', startSetzen);
    if (ziel) verschiebbar(ziel, 'B', '#f59e0b', zielSetzen);
  }, [bereit, start, ziel, startSetzen, zielSetzen]);

  useEffect(() => {
    const L = bib.current;
    const gruppe = ebenen.current.route;
    if (!bereit || !L || !gruppe) return;
    gruppe.clearLayers();
    routen.forEach((r, i) => {
      if (i === gewaehlt) return;
      L.polyline(r.waypoints.map((w) => [w.latitude, w.longitude] as [number, number]), { color: ZIELE[r.objective ?? '']?.color ?? '#94a3b8', weight: 4, opacity: 0.55, dashArray: '2 8' })
        .on('click', (e: Leaflet.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          setGewaehlt(i);
          setMission(null);
        })
        .addTo(gruppe);
    });
    const gewaehlteRoute = routen[gewaehlt];
    if (gewaehlteRoute) {
      const linie = gewaehlteRoute.waypoints.map((w) => [w.latitude, w.longitude] as [number, number]);
      L.polyline(linie, { color: '#000000', weight: 9, opacity: 0.85, interactive: false }).addTo(gruppe);
      L.polyline(linie, { color: ZIELE[gewaehlteRoute.objective ?? '']?.color ?? '#22d3ee', weight: 4.5, opacity: 1, interactive: false }).addTo(gruppe);
    }
  }, [bereit, routen, gewaehlt]);

  useEffect(() => {
    const L = bib.current;
    const m = karte.current;
    if (!bereit || !L || !m) return;
    if (!linealGruppe.current) linealGruppe.current = L.layerGroup().addTo(m);
    const g = linealGruppe.current;
    g.clearLayers();
    if (linealPunkte.length > 1) L.polyline(linealPunkte.map((p) => [p.latitude, p.longitude] as [number, number]), { color: '#ffffff', weight: 2.5, dashArray: '6 6', interactive: false }).addTo(g);
    linealPunkte.forEach((p) => L.circleMarker([p.latitude, p.longitude], { radius: 4, color: '#000000', weight: 1.5, fillColor: '#ffffff', fillOpacity: 1, interactive: false }).addTo(g));
  }, [bereit, linealPunkte]);

  useEffect(() => {
    const c = karte.current?.getContainer();
    if (c) c.style.cursor = lineal ? 'crosshair' : '';
  }, [lineal, bereit]);

  const einpassen = useCallback((r: Route | null) => {
    const m = karte.current;
    const L = bib.current;
    if (!m || !L || !r) return;
    m.fitBounds(L.latLngBounds(r.waypoints.map((w) => [w.latitude, w.longitude] as [number, number])), { paddingTopLeft: [440, 110], paddingBottomRight: [300, 80], maxZoom: 8 });
  }, []);

  useEffect(() => {
    if (routen.length) einpassen(routen[0]);
  }, [routen, einpassen]);

  const missionRechnen = useCallback(async (r: Route | null, n: number) => {
    if (!r) return;
    const antwort = await fetch('/api/mission/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ route: r, crewSize: n }) });
    if (antwort.ok) setMission((await antwort.json()) as Mission);
    else setFehler('The EVA estimate could not be calculated.');
  }, []);

  const egoStarten = useCallback(async (r: Route | null, tempo: number) => {
    if (!r) return;
    const antwort = await fetch('/api/routes/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waypoints: r.waypoints }) });
    if (antwort.ok) setEgo({ profil: (await antwort.json()) as EgoProfil, tempo });
    else setFehler('The surface view could not be started.');
  }, []);

  const aktuell = useRef({ routen, missionRechnen, egoStarten, punktSetzen, allesLeeren, crew });
  aktuell.current = { routen, missionRechnen, egoStarten, punktSetzen, allesLeeren, crew };
  const demoLauf = useRef(0);

  const demoStarten = useCallback(async () => {
    const lauf = ++demoLauf.current;
    const m = karte.current;
    if (!m) return;
    demoStart.current = performance.now();
    setDemoRest(30);
    const warte = (s: number) => new Promise<void>((ok) => setTimeout(ok, s * 1000));
    const laeuft = () => demoLauf.current === lauf;
    const zeile = (text: string, sekunde: number) => laeuft() && setDemo({ text, sekunde });
    aktuell.current.allesLeeren();
    setEgo(null);
    setAnsicht('globus');
    setEintauchen(0);
    setBasis('ctx_ortho');
    setAktiv({ risk_ctx: false, geology_rgb: false, thermal_rgb: false });
    m.setView([18.5, 77.3], m.getMinZoom(), { animate: false });
    zeile('Mars Pathfinder plans a walk on Mars from real NASA data', 0);
    await warte(2);
    if (!laeuft()) return;
    setEintauchen((n) => n + 1);
    await warte(1.8);
    if (!laeuft()) return;
    zeile('Jezero crater: orbiter images and elevation, Perseverance science points', 3.5);
    m.flyTo([18.42, 77.5], 6.5, { duration: 2 });
    await warte(2.4);
    if (!laeuft()) return;
    setAktiv({ risk_ctx: true, geology_rgb: false, thermal_rgb: false });
    zeile('Slopes of 15 degrees or more are blocked for the crew', 6);
    await warte(3);
    if (!laeuft()) return;
    zeile('Two double-clicks set start and destination', 9);
    aktuell.current.punktSetzen({ latitude: 18.38, longitude: 77.58 });
    await warte(1);
    if (!laeuft()) return;
    aktuell.current.punktSetzen({ latitude: 18.44, longitude: 77.45 });
    await warte(3);
    if (!laeuft()) return;
    setAktiv({ risk_ctx: false, geology_rgb: false, thermal_rgb: false });
    zeile('Three routes: lowest energy, shortest distance, lowest slope hazard', 13);
    await warte(2.5);
    if (!laeuft()) return;
    setGewaehlt(2);
    zeile('The safest route avoids steep ground and takes a little longer', 15.5);
    await warte(2.5);
    if (!laeuft()) return;
    setGewaehlt(0);
    zeile('EVA estimate: time, oxygen, power and radiation for the crew', 18);
    await aktuell.current.missionRechnen(aktuell.current.routen[0] ?? null, aktuell.current.crew);
    await warte(3.5);
    if (!laeuft()) return;
    zeile('Walk the route on the surface, in true scale', 21.5);
    await aktuell.current.egoStarten(aktuell.current.routen[0] ?? null, 60);
    await warte(7);
    if (!laeuft()) return;
    zeile('A planning estimate with stated assumptions, not flight-certified', 28.5);
    await warte(1.5);
    if (laeuft()) setDemo(null);
  }, []);

  useEffect(() => {
    if (bereit && new URLSearchParams(window.location.search).get('demo') === '1') {
      const t = setTimeout(() => void demoStarten(), 900);
      return () => clearTimeout(t);
    }
  }, [bereit, demoStarten]);

  useEffect(() => {
    if (!demo) return;
    const takt = setInterval(() => setDemoRest(Math.max(0, 30 - (performance.now() - demoStart.current) / 1000)), 200);
    return () => clearInterval(takt);
  }, [demo]);

  const teilen = useCallback(() => {
    if (!startRef.current || !zielRef.current) return;
    const a = startRef.current;
    const b = zielRef.current;
    const q = new URLSearchParams({ a: `${a.latitude},${a.longitude}`, b: `${b.latitude},${b.longitude}` });
    if (stoppsRef.current.length) q.set('s', stoppsRef.current.join(','));
    const adresse = `${window.location.origin}${window.location.pathname}?${q.toString()}`;
    void navigator.clipboard?.writeText(adresse).then(
      () => {
        setKopiert(true);
        setTimeout(() => setKopiert(false), 2200);
      },
      () => window.prompt('Copy this link', adresse),
    );
  }, []);

  useEffect(() => {
    if (!bereit) return;
    const q = new URLSearchParams(window.location.search);
    const a = (q.get('a') ?? '').split(',').map(Number);
    const b = (q.get('b') ?? '').split(',').map(Number);
    const gueltig = (v: number[]) => v.length === 2 && v.every((n) => Number.isFinite(n)) && Math.abs(v[0]) <= 90 && v[1] >= -180 && v[1] <= 360;
    if (!gueltig(a) || !gueltig(b)) return;
    stoppsRef.current = (q.get('s') ?? '').split(',').filter((id) => /^[a-z0-9-]{1,60}$/.test(id)).slice(0, 3);
    setStopps(stoppsRef.current);
    startRef.current = { latitude: a[0], longitude: a[1] };
    zielRef.current = { latitude: b[0], longitude: b[1] };
    setStart(startRef.current);
    setZiel(zielRef.current);
    setAnsicht('karte');
    void routeBerechnen();
  }, [bereit, routeBerechnen]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const imFeld = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Escape') {
        setAbout(false);
        setBriefingOffen(false);
        setLineal(false);
        setAuswahl(null);
        setSuche('');
        (document.activeElement as HTMLElement | null)?.blur();
      } else if (e.key === '/' && !imFeld) {
        e.preventDefault();
        sucheFeld.current?.focus();
      } else if (!imFeld && (e.key === '+' || e.key === '=')) karte.current?.zoomIn(0.5);
      else if (!imFeld && (e.key === '-' || e.key === '_')) karte.current?.zoomOut(0.5);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return [];
    const a = orte.filter((o) => o.name.toLowerCase().includes(q)).map((o) => ({ schluessel: `o-${o.name}`, name: o.name, art: o.kind, punkt: { latitude: o.latitude, longitude: o.longitude }, zoom: o.diameterKm > 40 ? 6 : 8 }));
    const b = science.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)).map((s) => ({ schluessel: `s-${s.id}`, name: s.name, art: 'Science point', punkt: s.location, zoom: 8 }));
    return [...a, ...b].slice(0, 7);
  }, [suche, science, orte]);

  const fliegen = (p: Punkt, z: number) => {
    karte.current?.flyTo([p.latitude, p.longitude], z, { duration: 0.8 });
    setSuche('');
  };
  const umschalten = (id: Ueberlagerung) => setAktiv((a) => ({ ...a, [id]: !a[id] }));
  const massstab = useMemo(() => {
    const meterProPixel = (1846 * 7.972) / (infos.ctx_ortho?.wurzelKachel.groesseGrad ?? 7.972) / 2 ** zoom;
    const stufen = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
    const laenge = stufen.find((s) => s / meterProPixel >= 60) ?? 100000;
    return { pixel: laenge / meterProPixel, text: laenge >= 1000 ? `${laenge / 1000} km` : `${laenge} m` };
  }, [zoom, infos]);
  const stoppNamen = stopps.map((id) => science.find((s) => s.id === id)?.name ?? id);

  return (
    <div className="sq relative h-screen w-screen overflow-hidden bg-black text-white" data-ansicht={ansicht} style={{ fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .sq *, .sq *::before, .sq *::after { border-radius:0 !important }
        .sq .text-slate-300, .sq .text-slate-400 { color:#e2e8f0 !important }
        .sq .text-slate-500 { color:#b6c2d4 !important }
        .sq[data-ansicht="gelaende"] .zoomgruppe, .sq[data-ansicht="globus"] .zoomgruppe { display:none }
        .leaflet-container { background:#000; outline:none; cursor:grab; font-family:inherit }
        .leaflet-container:active { cursor:grabbing }
        .ebene-farbe img.leaflet-tile { filter:brightness(1.28) contrast(1.06) saturate(1.1) }
        .ebene-ortho img.leaflet-tile { filter:sepia(1) saturate(2.1) hue-rotate(-16deg) brightness(.92) contrast(1.06) }
        .karte-tip { background:#03070d; color:#e2e8f0; border:1px solid #22d3ee55; border-radius:6px; font-size:12px; box-shadow:none }
        .karte-tip:before { display:none }
        .karte-ort { transform:translate(-50%,-50%); white-space:nowrap; width:max-content; color:#f8e7d2; font-size:12px; font-weight:600; letter-spacing:.04em; text-shadow:0 0 3px #000,0 0 6px #000,0 1px 2px #000; cursor:pointer }
        .karte-ort-gross { font-size:17px; letter-spacing:.22em; text-transform:uppercase; color:#fde9cf; opacity:.9 }
        .karte-ort:hover { color:#67e8f9 }
      `}</style>
      <div ref={behaelter} className="absolute inset-0" style={{ visibility: 'hidden', pointerEvents: 'none' }} />

      <header className="absolute left-0 right-0 top-0 z-[1000] flex h-14 items-center gap-4 border-b border-white/10 bg-[#000000]/90 px-4 backdrop-blur">
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
        <div className="whitespace-nowrap leading-tight">
          <div className="text-sm font-semibold tracking-[0.18em]">MARS PATHFINDER</div>
          <div className="text-[11px] text-slate-400">EVA traverse planning, Jezero crater and NE Syrtis</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <div className="hidden rounded-lg border border-white/10 px-3 py-1.5 lg:block">
            <div className="text-slate-500">CURSOR</div>
            <div className="tabular-nums text-slate-200">{maus ? koord(maus) : '-'}</div>
          </div>
          <div className="hidden rounded-lg border border-white/10 px-3 py-1.5 lg:block">
            <div className="text-slate-500">SELECTED ELEVATION</div>
            <div className="tabular-nums text-cyan-300">{auswahl?.art === 'punkt' && auswahl.probe.hasData ? `${auswahl.probe.elevationMeters?.toFixed(0)} m` : 'click the map'}</div>
          </div>
          <div className="hidden rounded-lg border border-white/10 px-3 py-1.5 xl:block">
            <div className="text-slate-500">COORDINATES AND DATUM</div>
            <div className="text-amber-300">IAU Mars 2000, east positive, MOLA areoid</div>
          </div>
          <div className="hidden rounded-lg border border-white/10 px-3 py-1.5 2xl:block">
            <div className="text-slate-500">DATA</div>
            <div className="text-slate-200">NASA MRO CTX, HiRISE, Viking, Mars 2020, USGS</div>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-white/10 text-sm">
            {(['globus', 'gelaende'] as const).map((a) => (
              <button key={a} onClick={() => { if (a === 'gelaende') { const c = karte.current?.getCenter(); if (c) setMitteFuer3D({ latitude: c.lat, longitude: c.lng }); } setAnsicht(a); setEintauchen(0); }} className={`whitespace-nowrap px-3 py-2 ${ansicht === a ? 'bg-cyan-400 font-semibold text-[#000000]' : 'hover:bg-white/10'}`}>
                {a === 'globus' ? '3D globe' : '3D terrain'}
              </button>
            ))}
          </div>
          <button className="whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setAbout(true)}>About and data</button>
          <button
            className="whitespace-nowrap rounded-lg border border-amber-400/60 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10"
            onClick={() => {
              if (demo) {
                demoLauf.current++;
                setDemo(null);
              } else void demoStarten();
            }}
          >
            {demo ? 'Stop demo' : '30 s demo'}
          </button>
        </div>
      </header>

      {ladefehler && <div className="absolute left-1/2 top-24 z-[1000] -translate-x-1/2 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">{ladefehler}</div>}

      <div className="pointer-events-none absolute bottom-4 left-4 top-[4.5rem] z-[1000] flex w-[400px] flex-col gap-3">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur">
          <input
            ref={sucheFeld}
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && treffer[0] && fliegen(treffer[0].punkt, treffer[0].zoom)}
            placeholder="Search places and science points"
            className="w-full rounded-xl border border-white/10 bg-[#000000] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
          {treffer.length > 0 && (
            <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
              {treffer.map((t) => (
                <li key={t.schluessel} className="flex items-center gap-2 bg-[#000000] px-3 py-2 text-sm">
                  <button className="min-w-0 flex-1 text-left hover:text-cyan-300" onClick={() => fliegen(t.punkt, t.zoom)}>
                    <div className="truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.art}</div>
                  </button>
                  <button className="rounded-md border border-cyan-400/40 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-400/10" onClick={() => { startSetzen(t.punkt); fliegen(t.punkt, t.zoom); }}>From</button>
                  <button className="rounded-md border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-400/10" onClick={() => { zielSetzen(t.punkt); setSuche(''); }}>To</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pointer-events-auto min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3 text-sm">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-[#000000]">A</span>
                <span className={start ? 'tabular-nums' : 'text-slate-500'}>{start ? koord(start) : 'Double-click the map to set the start'}</span>
              </div>
              {stoppNamen.map((name, i) => (
                <div key={stopps[i]} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400 text-[11px] text-amber-300">{i + 1}</span>
                  <span className="flex-1 truncate">{name}</span>
                  <button className="text-xs text-slate-400 hover:text-white" onClick={() => stoppUmschalten(stopps[i])}>remove</button>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-[#000000]">B</span>
                <span className={ziel ? 'tabular-nums' : 'text-slate-500'}>{ziel ? koord(ziel) : 'Double-click again to set the destination'}</span>
              </div>
            </div>
            {(start || ziel) && <button className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={allesLeeren}>Clear</button>}
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-cyan-400/50 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-400/10"
            onClick={() => { const c = karte.current?.getCenter(); if (c) setMitteFuer3D({ latitude: c.lat, longitude: c.lng }); setAnsicht('gelaende'); }}
          >
            View this area in 3D
          </button>
          {!route && !rechnet && !fehler && <p className="mt-3 text-xs text-slate-500">Click a science point or a place to add it as a stop or a target. Drag A or B to move them.</p>}
          {!route && !rechnet && orte.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Places in this area</div>
              <ul className="max-h-64 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10">
                {[...orte].sort((a, b) => b.diameterKm - a.diameterKm).map((o) => (
                  <li key={o.name} className="flex items-center gap-2 bg-[#000000]/60 px-3 py-1.5 text-sm">
                    <button className="min-w-0 flex-1 text-left hover:text-cyan-300" onClick={() => { karte.current?.flyTo([o.latitude, o.longitude], o.diameterKm > 30 ? 6.5 : 8, { duration: 0.8 }); setAuswahl({ art: 'ort', ort: o }); }}>
                      <div className="truncate">{o.name}</div>
                      <div className="text-[11px] text-slate-500">{o.kind}, {o.diameterKm.toFixed(1)} km</div>
                    </button>
                    <button className="rounded-md border border-cyan-400/40 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-400/10" onClick={() => startSetzen({ latitude: o.latitude, longitude: o.longitude })}>From</button>
                    <button className="rounded-md border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-400/10" onClick={() => zielSetzen({ latitude: o.latitude, longitude: o.longitude })}>To</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rechnet && <p className="mt-4 text-sm text-cyan-300">Calculating routes...</p>}
          {fehler && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{fehler}</p>}

          {routen.length > 0 && (
            <div className="mt-4 space-y-2">
              {routen.map((r, i) => {
                const z = ZIELE[r.objective ?? ''];
                return (
                  <button
                    key={r.id}
                    onClick={() => { setGewaehlt(i); setMission(null); }}
                    className={`w-full rounded-xl border p-3 text-left transition ${i === gewaehlt ? 'border-white/40 bg-white/[0.07]' : 'border-white/10 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: z?.color }} />
                      <span className="text-sm font-medium">{z?.label ?? r.objective}</span>
                      <span className="ml-auto text-sm tabular-nums">{dauer(r.estimatedDurationSeconds)}</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-2 text-xs tabular-nums text-slate-400">
                      <span>{km(r.distanceMeters)}</span>
                      <span>{megajoule(r.energyJoules)}</span>
                      <span>max {r.maxSlopeDeg?.toFixed(1)}°</span>
                      <span>index {Math.round(r.riskScore * 100)}</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11px] text-slate-500">Columns: distance, energy (Pandolf), steepest slope, slope index 0 to 100 (own index, not an accident probability).</p>
            </div>
          )}

          {route && (
            <>
              <Profil route={route} farbe={farbe} />
              <Schritte route={route} onFlug={(p) => karte.current?.flyTo([p.latitude, p.longitude], 8, { duration: 0.7 })} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div>Elevation data: <span className="text-slate-200">{route.datasetId?.startsWith('REGION') ? 'Jezero CTX plus NE Syrtis' : 'USGS CTX DEM Jezero 20 m'}</span></div>
                <div>Search grid: <span className="text-slate-200">{route.routingGridResolutionMeters?.toFixed(0)} m</span></div>
              </div>
              {route.warnings && route.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">
                  {route.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#000000] hover:bg-cyan-300" onClick={() => void egoStarten(route, 60)}>Walk the route in 3D</button>
                <select value={crew} onChange={(e) => { setCrew(Number(e.target.value)); setMission(null); }} className="rounded-lg border border-white/10 bg-[#000000] px-2 py-2 text-sm">
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} crew</option>)}
                </select>
                <button className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5" onClick={() => void missionRechnen(route, crew)}>EVA estimate</button>
                <button className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5" onClick={() => { setBriefingOffen(true); if (!mission) void missionRechnen(route, crew); }}>Briefing</button>
                <button className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5" onClick={teilen}>{kopiert ? 'Link copied' : 'Copy link'}</button>
              </div>
            </>
          )}

          {mission && (
            <div className="mt-4 rounded-xl border border-white/10 p-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Kennzahl name="EVA time" wert={dauer(mission.durationSeconds)} hinweis={mission.withinEvaTimeLimit ? 'within the 8 h limit' : 'over the 8 h limit'} />
                <Kennzahl name={`Oxygen, ${crew} crew`} wert={`${Math.round(mission.oxygenLiters)} L`} hinweis={`${mission.oxygenKilograms.toFixed(2)} kg`} />
                <Kennzahl name="Average power" wert={`${Math.round(mission.averagePowerWatts)} W`} hinweis={mission.withinAverageMetabolicRate ? 'within 350 W' : 'over 350 W'} />
                <Kennzahl name="Peak power" wert={mission.peakPowerWatts != null ? `${Math.round(mission.peakPowerWatts)} W` : '-'} hinweis={mission.withinPeakMetabolicRate === false ? 'over 530 W' : 'within 530 W'} />
                <Kennzahl name={`Energy, ${crew} crew`} wert={`${Math.round(mission.energyWattHours)} Wh`} />
                <Kennzahl name="Radiation per person" wert={`${mission.radiationDoseMilligray?.toFixed(3)} mGy`} hinweis="Gale crater reference value" />
              </div>
              {mission.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-md bg-red-500/10 p-2 text-xs text-red-200">{mission.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              )}
              <button className="mt-3 text-xs text-cyan-300 hover:underline" onClick={() => setAnnahmenOffen((o) => !o)}>{annahmenOffen ? 'Hide assumptions' : 'Show assumptions'}</button>
              {annahmenOffen && mission.assumptions && (
                <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <li>Body mass {mission.assumptions.bodyMassKg} kg, extra load {mission.assumptions.suitLoadKg} kg</li>
                  <li>Walking speed {(mission.assumptions.walkingSpeedMetersPerSecond * 3.6).toFixed(1)} km/h, terrain factor {mission.assumptions.terrainFactor}</li>
                  <li>Gravity: {mission.assumptions.gravityTreatment}</li>
                  <li>Downhill: {mission.assumptions.downhillTreatment}</li>
                  <li>Slopes over {mission.assumptions.maxSlopeDegrees}° are blocked</li>
                  <li>{mission.radiationBasis}</li>
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-snug text-slate-500">Screening estimate with the stated assumptions. Not safety-certified and not a forecast for a real EVA. Time, energy, oxygen and radiation use the totals of the full route, the same as the route card.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-10 right-4 top-[4.5rem] z-[1000] flex w-[280px] flex-col gap-3">
        <div className="pointer-events-auto max-h-[60%] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-3 text-sm shadow-2xl backdrop-blur">
          <div className="hidden">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">Base map</div>
          <div className="grid grid-cols-2 gap-2">
            {([['ctx_ortho', 'Image'], ['relief_rgb', 'Elevation']] as const).map(([id, name]) => (
              <button key={id} disabled={!infos[id]} onClick={() => setBasis(id)} className={`rounded-lg border px-2 py-1.5 text-sm disabled:opacity-40 ${basis === id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 hover:bg-white/5'}`}>{name}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            {basis === 'ctx_ortho'
              ? infos.ctx_color
                ? 'Colour from the Viking orbiter mosaic (232 m), fine detail from the CTX camera (5 to 10 m) where it exists. CTX itself is grayscale.'
                : 'CTX is a grayscale camera. The image is tinted for display, the colour is not measured.'
              : infos.relief_rgb
                ? `Shaded relief, ${Math.round(infos.relief_rgb.wertMin ?? 0)} m (dark blue) to ${Math.round(infos.relief_rgb.wertMax ?? 0)} m (white).`
                : 'Not built yet.'}
          </p>
          {basis === 'relief_rgb' && <div className="mt-2 h-2 rounded" style={{ background: 'linear-gradient(90deg,#1e1b4b,#0284c7,#10b981,#f59e0b,#ef4444,#ffffff)' }} />}

          <div className="mb-2 mt-4 text-[11px] uppercase tracking-wider text-slate-400">Data layers</div>
          {UEBERLAGERUNGEN.map((u) => (
            <div key={u.id} className="mb-2">
              <label className={`flex items-center gap-2 ${infos[u.id] ? 'cursor-pointer' : 'opacity-40'}`}>
                <input type="checkbox" disabled={!infos[u.id]} checked={aktiv[u.id]} onChange={() => umschalten(u.id)} className="accent-cyan-400" />
                {u.name}
              </label>
              <div className="ml-5 text-[11px] text-slate-500">{infos[u.id] ? u.quelle : 'Not built yet'}</div>
              {aktiv[u.id] && u.id === 'risk_ctx' && (
                <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-green-500" />under 8°</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-amber-500" />8° to 15°</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-red-500" />15° or more, blocked for routing</div>
                </div>
              )}
              {aktiv[u.id] && u.id === 'thermal_rgb' && infos.thermal_rgb && (
                <div className="ml-5 mt-1 text-[11px] text-slate-300">
                  <div className="h-2 rounded" style={{ background: 'linear-gradient(90deg,#0d0887,#7e03a8,#cc4778,#f89540,#f0f921)' }} />
                  <div className="mt-0.5 flex justify-between"><span>{Math.round(infos.thermal_rgb.wertMin ?? 0)} (dust, sand)</span><span>{Math.round(infos.thermal_rgb.wertMax ?? 0)} (rock)</span></div>
                  <div className="text-slate-500">{infos.thermal_rgb.einheit}</div>
                </div>
              )}
              {aktiv[u.id] && u.id === 'geology_rgb' && infos.geology_rgb?.legende && (
                <div className="ml-5 mt-1 grid grid-cols-1 gap-0.5 text-[11px] text-slate-300">
                  {infos.geology_rgb.legende.map((e) => (
                    <div key={e.klasse} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: e.farbe }} /><span className="truncate">{e.name}</span></div>
                  ))}
                </div>
              )}
            </div>
          ))}

          </div>

          <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">Markers</div>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={zeigeScience} onChange={(e) => setZeigeScience(e.target.checked)} className="accent-cyan-400" />Science points ({science.length})</label>
          <div className="ml-5 text-[11px] text-slate-500">NASA Mars 2020: landing site, samples, rover path</div>
          <label className="mt-2 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={zeigeOrte} onChange={(e) => setZeigeOrte(e.target.checked)} className="accent-cyan-400" />Place names ({orte.length})</label>
          <div className="ml-5 text-[11px] text-slate-500">IAU names from the USGS gazetteer</div>
          <label className="mt-2 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={radarAn} onChange={(e) => setRadarAn(e.target.checked)} className="accent-cyan-400" />Radar</label>

          <button className="mb-1 mt-4 flex w-full items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200" onClick={() => setUmweltOffen((o) => !o)}>
            <span>Mars environment</span>
            <span>{umweltOffen ? '-' : '+'}</span>
          </button>
          {umweltOffen && (
            <div className="space-y-2">
              {UMWELT.map((u) => (
                <div key={u.name} className="text-[12px]">
                  <div className="flex justify-between gap-2"><span className="text-slate-400">{u.name}</span><span className="text-right text-slate-100">{u.wert}</span></div>
                  <div className="text-[10px] leading-snug text-slate-500">{u.hinweis}</div>
                </div>
              ))}
              <p className="text-[10px] leading-snug text-slate-500">
                Reference values from the Perseverance weather station MEDA at Jezero (
                <a className="text-cyan-300 hover:underline" href="https://doi.org/10.1038/s41561-022-01084-0" target="_blank" rel="noreferrer">Rodriguez-Manfredi et al. 2023</a>
                ) and the{' '}
                <a className="text-cyan-300 hover:underline" href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" target="_blank" rel="noreferrer">NASA Mars fact sheet</a>
                . They are not a live forecast and do not depend on the route or the time of day.
              </p>
            </div>
          )}
        </div>

        {auswahl && (
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/80 p-3 text-sm shadow-2xl backdrop-blur">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {auswahl.art === 'punkt' && (
                  <>
                    <div className="font-medium tabular-nums">{koord(auswahl.probe)}</div>
                    {auswahl.probe.hasData ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Kennzahl name="Elevation" wert={`${auswahl.probe.elevationMeters?.toFixed(1)} m`} />
                        <Kennzahl name="Slope" wert={auswahl.probe.slopeDegrees != null ? `${auswahl.probe.slopeDegrees.toFixed(1)}°` : '-'} hinweis={auswahl.probe.slopeDegrees != null && auswahl.probe.slopeDegrees >= 15 ? 'blocked for routing' : undefined} />
                        <Kennzahl name="Faces" wert={auswahl.probe.aspectCompass ? `${auswahl.probe.aspectCompass} (${auswahl.probe.aspectDegrees}°)` : 'flat'} hinweis="downhill direction" />
                        <Kennzahl name="To landing site" wert={auswahl.probe.distanceToLandingMeters != null ? km(auswahl.probe.distanceToLandingMeters) : '-'} hinweis="straight line" />
                        {auswahl.probe.thermalInertia != null && <Kennzahl name="Thermal inertia" wert={`${auswahl.probe.thermalInertia}`} hinweis="THEMIS, higher is rockier" />}
                        {auswahl.probe.geologyUnit && <div className="col-span-2"><div className="text-[11px] text-slate-400">Geologic unit</div><div>{auswahl.probe.geologyUnit}</div></div>}
                        <div className="col-span-2 text-[11px] text-slate-400">{auswahl.probe.dataset}{auswahl.probe.validated ? ', checked against rover positions (RMSE 3.3 m)' : ''}</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400">No elevation data at this point.</div>
                    )}
                  </>
                )}
                {auswahl.art === 'science' && (
                  <>
                    <div className="font-medium">{auswahl.punkt.name}</div>
                    <div className="text-[11px] tabular-nums text-slate-400">{koord(auswahl.punkt.location)}</div>
                    <p className="mt-2 text-xs leading-snug text-slate-300">{auswahl.punkt.description}</p>
                    <a href={auswahl.punkt.nasaSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-cyan-300 hover:underline">NASA source</a>
                  </>
                )}
                {auswahl.art === 'ort' && (
                  <>
                    <div className="font-medium">{auswahl.ort.name}</div>
                    <div className="text-[11px] text-slate-400">{auswahl.ort.kind}, about {auswahl.ort.diameterKm.toFixed(1)} km{auswahl.ort.official ? ', IAU name' : ''}</div>
                    <p className="mt-2 text-xs leading-snug text-slate-300">{auswahl.ort.origin}</p>
                    <a href={auswahl.ort.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-cyan-300 hover:underline">Source</a>
                  </>
                )}
              </div>
              <button className="text-slate-400 hover:text-white" onClick={() => setAuswahl(null)} aria-label="Close">x</button>
            </div>
            {(() => {
              const p: Punkt | null = auswahl.art === 'punkt' ? (auswahl.probe.hasData ? auswahl.probe : null) : auswahl.art === 'science' ? auswahl.punkt.location : { latitude: auswahl.ort.latitude, longitude: auswahl.ort.longitude };
              if (!p) return null;
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-md border border-cyan-400/50 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-400/10" onClick={() => startSetzen({ latitude: p.latitude, longitude: p.longitude })}>Start here</button>
                  <button className="rounded-md border border-amber-400/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-400/10" onClick={() => zielSetzen({ latitude: p.latitude, longitude: p.longitude })}>Go here</button>
                  {auswahl.art === 'science' && (
                    <button className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10" onClick={() => stoppUmschalten(auswahl.punkt.id)}>
                      {stopps.includes(auswahl.punkt.id) ? 'Remove stop' : stopps.length >= 3 ? 'Replace last stop' : 'Add as stop'}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="pointer-events-auto zoomgruppe absolute bottom-24 right-[19rem] z-[1000] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-2xl">
        <button className="px-3 py-2 text-lg hover:bg-white/10" onClick={() => karte.current?.zoomIn(1)} aria-label="Zoom in">+</button>
        <button className="border-t border-white/10 px-3 py-2 text-lg hover:bg-white/10" onClick={() => karte.current?.zoomOut(1)} aria-label="Zoom out">-</button>
        <button className={`border-t border-white/10 px-3 py-2 text-xs ${lineal ? 'bg-cyan-400 font-semibold text-[#000000]' : 'hover:bg-white/10'}`} onClick={() => { setLineal((a) => !a); setLinealPunkte([]); }} aria-label="Ruler" title="Ruler: click points to measure">Ruler</button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-4 z-[1000] flex items-end gap-4 text-[11px] text-slate-300">
        <span className="text-slate-500">Images and elevation: NASA/JPL/MSSS, USGS, Caltech. Names: IAU/USGS.</span>
        <div>
          <div className="text-center">{massstab.text}</div>
          <div className="h-1.5 border-x border-b border-slate-300" style={{ width: massstab.pixel }} />
        </div>
      </div>

      {demo && (
        <>
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-[3000] h-1 bg-white/10">
            <div className="h-full bg-cyan-400 transition-all duration-1000 ease-linear" style={{ width: `${Math.min(100, ((30 - demoRest) / 30) * 100)}%` }} />
          </div>
          <div className="pointer-events-none absolute right-5 top-[4.5rem] z-[3000] rounded-xl border border-amber-400/50 bg-[#000000]/90 px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-amber-300">Demo ends in</div>
            <div className="text-2xl font-semibold tabular-nums text-amber-200">{Math.ceil(demoRest)} s</div>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-20 z-[3000] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#000000]/90 px-6 py-3 text-center text-lg font-medium shadow-2xl backdrop-blur">{demo.text}</div>
        </>
      )}

      {ansicht === 'globus' && <Globus eintauchen={eintauchen} onEnter={() => { setAnsicht('gelaende'); setEintauchen(0); karte.current?.invalidateSize(); }} />}

      {ansicht === 'gelaende' && (
        <Gelaende3D
          mitte={mitteFuer3D}
          route={route?.waypoints ?? []}
          routeFarbe={farbe}
          start={start}
          ziel={ziel}
          science={science.map((s) => ({ ...s.location, name: s.name }))}
          zeigeOrte={zeigeOrte}
          zeigeScience={zeigeScience}
          orte={orte.map((o) => ({ latitude: o.latitude, longitude: o.longitude, name: o.name, diameterKm: o.diameterKm, official: o.official }))}
          onPunkt={(p) => punktSetzen(p)}
          onClose={() => setAnsicht('globus')}
        />
      )}

      {radarAn && ansicht !== 'globus' && (() => {
        const mitteRadar: Punkt = start ?? mitteFuer3D;
        return (
          <Radar
            mitte={mitteRadar}
            reichweite={radarReichweite}
            onReichweite={() => setRadarReichweite((r) => (r >= 40000 ? 5000 : r * 2))}
            route={route?.waypoints ?? []}
            start={start}
            ziel={ziel}
            science={science.map((s) => s.location)}
            onClose={() => setRadarAn(false)}
          />
        );
      })()}

      {lineal && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 z-[1200] flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm shadow-2xl backdrop-blur">
          <span className="text-slate-400">Ruler</span>
          <span className="tabular-nums text-lg font-semibold">{linealPunkte.length > 1 ? km(linealPunkte.slice(1).reduce((s, p, i) => s + meterAbstand(linealPunkte[i], p), 0)) : 'click two or more points'}</span>
          {linealPunkte.length > 1 && <span className="text-xs text-slate-500">straight lines on the surface</span>}
          <button className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/10" onClick={() => setLinealPunkte([])}>Clear</button>
          <button className="rounded-md border border-cyan-400/50 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10" onClick={() => { setLineal(false); setLinealPunkte([]); }}>Done</button>
        </div>
      )}

      {briefingOffen && route && (
        <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setBriefingOffen(false)}>
          <div className="w-[640px] max-w-full rounded-2xl border border-white/10 bg-[#03070d] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold tracking-wide">EVA briefing</div>
              <button className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10" onClick={() => setBriefingOffen(false)}>Close (Esc)</button>
            </div>
            <pre className="mt-4 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#000000] p-4 text-[12px] leading-relaxed text-slate-200">{briefingText(route, mission, start, ziel, crew, stoppNamen)}</pre>
            <div className="mt-4 flex gap-2">
              <button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#000000] hover:bg-cyan-300" onClick={() => void navigator.clipboard?.writeText(briefingText(route, mission, start, ziel, crew, stoppNamen))}>Copy text</button>
              <button
                className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                onClick={() => {
                  const datei = new Blob([briefingText(route, mission, start, ziel, crew, stoppNamen)], { type: 'text/plain' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(datei);
                  a.download = 'mars-eva-briefing.txt';
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                Download .txt
              </button>
            </div>
            {!mission && <p className="mt-3 text-xs text-slate-500">Calculating the EVA figures...</p>}
          </div>
        </div>
      )}

      {about && <UeberUns onClose={() => setAbout(false)} />}

      {ego && route && <Egoansicht wegpunkte={route.waypoints} profil={ego.profil} farbe={farbe} startTempo={ego.tempo} onClose={() => setEgo(null)} />}
    </div>
  );
}
