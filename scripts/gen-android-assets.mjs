// Regenerates Android launcher icons + splash screens from the game's own SVG art.
// Usage: node scripts/gen-android-assets.mjs   (requires Playwright/Chromium)
import { createRequire } from 'module';
import { readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RES = 'android/app/src/main/res';

const CUP = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M14 24h32l-3 24a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" fill="#8a9a5b"/><path d="M46 29c8 0 8 12 0 12" stroke="#8a9a5b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M30 41c-7-5-7-10-2-10 1 0 2 1 2 2 0-1 1-2 2-2 5 0 5 5-2 10z" fill="#f6ead8"/><path d="M24 18c0-5 5-5 5-10M34 18c0-5 5-5 5-10" stroke="#c89a6a" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(w, h, html, file, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;${transparent ? 'background:transparent' : ''}">${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent });
}

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = `${RES}/mipmap-${d}`;
  const s = Math.round(48 * k);
  const legacy = `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.22}px;background:#f6ead8;display:grid;place-items:center">${CUP.replace('<svg', `<svg width="${s * 0.8}" height="${s * 0.8}"`)}</div>`;
  await render(s, s, legacy, `${dir}/ic_launcher.png`, true);
  const round = `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#f6ead8;display:grid;place-items:center">${CUP.replace('<svg', `<svg width="${s * 0.72}" height="${s * 0.72}"`)}</div>`;
  await render(s, s, round, `${dir}/ic_launcher_round.png`, true);
  const f = Math.round(108 * k);
  const fg = `<div style="width:${f}px;height:${f}px;display:grid;place-items:center">${CUP.replace('<svg', `<svg width="${f * 0.56}" height="${f * 0.56}"`)}</div>`;
  await render(f, f, fg, `${dir}/ic_launcher_foreground.png`, true);
}

// splash screens: keep the existing file sizes, repaint them
const splashDirs = readdirSync(RES).filter((d) => d.startsWith('drawable'));
for (const d of splashDirs) {
  const file = `${RES}/${d}/splash.png`;
  if (!existsSync(file)) continue;
  const dims = execSync(`python3 -c "import struct;f=open('${file}','rb');f.read(16);print(*struct.unpack('>II',f.read(8)))"`).toString().trim().split(' ').map(Number);
  const [w, h] = dims;
  const m = Math.min(w, h);
  const html = `<div style="width:${w}px;height:${h}px;background:radial-gradient(circle at 50% 45%,#fffaf0,#f6ead8);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;color:#8a6446">${CUP.replace('<svg', `<svg width="${m * 0.28}" height="${m * 0.28}"`)}<div style="font-size:${m * 0.07}px;font-weight:bold;letter-spacing:2px;margin-top:${m * 0.03}px">MY LITTLE CAFE</div></div>`;
  await render(w, h, html, file);
}
await browser.close();
console.log('android assets generated');
