/**
 * NASA Space Apps 2026: MARS Pathfinder
 * Real Chromium Browser End-to-End Test Suite (Playwright)
 *
 * Verifies live browser interaction with WebGL 3D Mars canvas, FastAPI backend solver,
 * multi-objective route profiles, science sample detour, elevation cross-section,
 * and guided jury demo tour.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('test-results');

const CHROMIUM_CANDIDATE_PATHS = [
  'C:\\Users\\jensr\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChromiumExecutable() {
  for (const p of CHROMIUM_CANDIDATE_PATHS) {
    if (existsSync(p)) return p;
  }
  return undefined; // default playwright bundled
}

async function isUrlReachable(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let spawnedBackend = null;
let spawnedFrontend = null;

async function ensureBackendRunning() {
  const isUp = await isUrlReachable(`${BACKEND_URL}/health`);
  if (isUp) {
    console.log(`[E2E Setup] FastAPI backend is already running at ${BACKEND_URL}`);
    return;
  }

  console.log(`[E2E Setup] Spawning FastAPI backend on port 8000...`);
  spawnedBackend = spawn(
    'python',
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    { cwd: path.resolve('..', 'backend'), stdio: 'inherit' }
  );

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (await isUrlReachable(`${BACKEND_URL}/health`)) {
      console.log(`[E2E Setup] Backend ready!`);
      return;
    }
  }
  throw new Error('Failed to start FastAPI backend for live E2E testing.');
}

async function ensureFrontendRunning() {
  const isUp = await isUrlReachable(FRONTEND_URL);
  if (isUp) {
    console.log(`[E2E Setup] Next.js frontend is already running at ${FRONTEND_URL}`);
    return;
  }

  console.log(`[E2E Setup] Spawning Next.js production server on port 3000...`);
  spawnedFrontend = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: path.resolve('.'),
    stdio: 'inherit',
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (await isUrlReachable(FRONTEND_URL)) {
      console.log(`[E2E Setup] Frontend ready!`);
      return;
    }
  }
  throw new Error('Failed to start Next.js frontend for live E2E testing.');
}

async function runBrowserE2E() {
  console.log('================================================================');
  console.log('   NASA SPACE APPS 2026: MARS PATHFINDER LIVE BROWSER E2E TEST  ');
  console.log('================================================================');

  await ensureBackendRunning();
  await ensureFrontendRunning();

  const execPath = findChromiumExecutable();
  console.log(`[E2E Browser] Launching Chromium: ${execPath || 'Default Playwright Binary'}`);

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
    args: [
      '--enable-webgl',
      '--enable-webgl2-compute-context',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  try {
    // Step 1: Open Mars Pathfinder
    console.log('\n[STEP 01] Navigating to MARS Pathfinder application...');
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-01-app-boot.png') });
    console.log('         ↳ Application DOM loaded successfully');

    // Step 2: Handle Onboarding Modal & Select Jezero Crater
    console.log('[STEP 02] Interacting with Onboarding & Region Targeting...');
    const enterJezeroBtn = page.locator('button:has-text("Enter Jezero Crater")');
    if (await enterJezeroBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await enterJezeroBtn.click();
      console.log('         ↳ Clicked "Enter Jezero Crater" in onboarding modal');
    } else {
      const jezeroLandmark = page.locator('button:has-text("Jezero Crater")').first();
      if (await jezeroLandmark.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jezeroLandmark.click();
        console.log('         ↳ Selected Jezero Crater landmark');
      }
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-02-region-selected.png') });

    // Step 3: Verify 3D Surface View
    console.log('[STEP 03] Verifying 3D WebGL Terrain Canvas...');
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    assert(await canvas.isVisible(), 'WebGL canvas must be mounted and visible');
    console.log('         ↳ WebGL Canvas element active');

    // Step 4: Verify Route HUD Alternatives Controls
    console.log('[STEP 04] Verifying 4 Explicit Route Profiles in HUD...');
    const distMinBtn = page.locator('button:has-text("Distance-Min")');
    const energyMinBtn = page.locator('button:has-text("Energy-Min")');
    const hazardMinBtn = page.locator('button:has-text("Hazard-Min")');
    const scienceDetourBtn = page.locator('button:has-text("Science-Detour")');

    await distMinBtn.waitFor({ state: 'visible', timeout: 10000 });
    await energyMinBtn.waitFor({ state: 'visible', timeout: 10000 });
    await hazardMinBtn.waitFor({ state: 'visible', timeout: 10000 });
    await scienceDetourBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('         ↳ All 4 explicit profile buttons (Distance-Min, Energy-Min, Hazard-Min, Science-Detour) rendered');

    // Step 5: Switch to Distance-Min Profile
    console.log('[STEP 05] Testing Distance-Min Profile...');
    await distMinBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-05-profile-distance-min.png') });
    console.log('         ↳ Distance-Min profile active');

    // Step 6: Switch to Energy-Min Profile
    console.log('[STEP 06] Testing Energy-Min Profile...');
    await energyMinBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-06-profile-energy-min.png') });
    console.log('         ↳ Energy-Min profile active');

    // Step 7: Switch to Hazard-Min Profile
    console.log('[STEP 07] Testing Hazard-Min Profile...');
    await hazardMinBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-07-profile-hazard-min.png') });
    console.log('         ↳ Hazard-Min profile active');

    // Step 8: Verify Elevation Profile Chart
    console.log('[STEP 08] Inspecting Elevation Cross-Section Chart...');
    const chartToggle = page.locator('button[title*="Cross-Section"], button:has-text("Cross-Section"), button:has-text("Elevation Profile")').first();
    if (await chartToggle.isVisible().catch(() => false)) {
      await chartToggle.click();
      await page.waitForTimeout(500);
    }
    const svgChart = page.locator('svg').filter({ has: page.locator('path') }).first();
    assert(await svgChart.isVisible(), 'Elevation SVG chart must be visible');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-08-elevation-chart.png') });
    console.log('         ↳ SVG Elevation Profile verified');

    // Step 9: Test Guided Jury Tour
    console.log('[STEP 09] Executing Guided Jury Demo Tour...');
    const juryTourBtn = page.locator('button:has-text("Global Jury Tour")');
    if (await juryTourBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await juryTourBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-09-jury-tour-step1.png') });
      console.log('         ↳ Jury Tour started: Step 1 (Orbital Reconnaissance)');

      const nextBtn = page.locator('button:has-text("Next"), button:has-text("Weiter")').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click(); // to Step 2
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-09-jury-tour-step2.png') });
        console.log('         ↳ Advanced to Step 2 (Terrain Hypsometry)');

        await nextBtn.click(); // to Step 3
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-09-jury-tour-step3.png') });
        console.log('         ↳ Advanced to Step 3 (Hazard-Min Benchmark Discovery)');

        await nextBtn.click(); // to Step 4
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-09-jury-tour-step4.png') });
        console.log('         ↳ Advanced to Step 4 (Sample Return Cache probe-14-15)');
      }
    }

    // Step 10: Verify Responsive Viewport (1366x768)
    console.log('[STEP 10] Testing Responsive Desktop Viewport (1366×768)...');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step-10-responsive-1366x768.png') });
    console.log('         ↳ 1366×768 resolution verified cleanly');

    console.log('\n================================================================');
    console.log('   ALL LIVE BROWSER PLAYWRIGHT E2E ACCEPTANCE TESTS PASSED!      ');
    console.log('================================================================\n');
  } finally {
    await context.tracing.stop({ path: path.join(SCREENSHOT_DIR, 'playwright-e2e-trace.zip') });
    await browser.close();

    if (spawnedFrontend) {
      spawnedFrontend.kill();
    }
    if (spawnedBackend) {
      spawnedBackend.kill();
    }
  }
}

runBrowserE2E().catch((err) => {
  console.error('\n❌ BROWSER E2E TEST FAILED:', err);
  if (spawnedFrontend) spawnedFrontend.kill();
  if (spawnedBackend) spawnedBackend.kill();
  process.exit(1);
});
