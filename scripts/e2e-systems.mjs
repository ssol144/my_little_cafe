// System tests: every crafting step with real pointer input, staff automation, expansion,
// story guests and responsive layouts. Usage: BASE_URL=http://localhost:5173 node scripts/e2e-systems.mjs
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.env.E2E_OUT || 'e2e-output';
mkdirSync(OUT, { recursive: true });
let server = null;
let BASE = process.env.BASE_URL;
if (!BASE) {
  server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
  BASE = 'http://localhost:4174';
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
}
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '/?debug=1');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
  await page.evaluate(() => window.__game.sheets.closeAll());
  await page.waitForTimeout(400);
  return page;
}
async function until(page, fn, timeout = 30000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

// Plays whatever step is active using real mouse input. Returns when the result screen shows.
async function playMinigame(page) {
  const used = new Set();
  for (let guard = 0; guard < 20; guard++) {
    if (await page.locator('.mg-ok').count()) break;
    const st = await page.evaluate(() => {
      const s = window.__game.game.mg.step;
      if (!s) return null;
      return { name: s.kind, done: s.done, seq: s.seq, path: s.path?.map((p) => [p.x, p.y]), cx: s.cx, cy: s.cy, r: s.r };
    });
    if (!st || st.done) { await page.waitForTimeout(250); continue; }
    used.add(st.name);
    const box = await page.locator('.mg-stage canvas').boundingBox();
    const L = (x, y) => [box.x + (x / 360) * box.width, box.y + (y / 400) * box.height];
    const m = page.mouse;
    if (st.name === 'Knead') {
      for (let b = 0; b < 4; b++) {
        await until(page, () => { const s = window.__game.game.mg.step; return !s || s.done || (s.gap <= 0 && Math.abs(s.ringR - s.doughR) < 7); }, 5000);
        await m.click(...L(180, 210));
        await page.waitForTimeout(50);
      }
    } else if (st.name === 'Shape') {
      for (const d of st.seq) {
        const [x, y] = L(180, 205);
        const [dx, dy] = { up: [0, -90], down: [0, 90], left: [-90, 0], right: [90, 0] }[d];
        await m.move(x, y); await m.down(); await m.move(x + dx / 2, y + dy / 2); await m.move(x + dx, y + dy); await m.up();
        await page.waitForTimeout(80);
      }
    } else if (st.name === 'Bake') {
      await until(page, () => { const s = window.__game.game.mg.step; return !s || s.d >= (s.zone[0] + s.zone[1]) / 2; }, 12000);
      await m.click(...L(180, 200));
    } else if (st.name === 'Cover') {
      await m.move(...L(st.cx - st.r, st.cy - st.r)); await m.down();
      for (let row = -st.r; row <= st.r; row += 26) {
        await m.move(...L(st.cx - st.r, st.cy + row), { steps: 2 });
        await m.move(...L(st.cx + st.r, st.cy + row), { steps: 6 });
      }
      await m.up();
    } else if (st.name === 'Grind') {
      const [cx, cy] = L(180, 200);
      const rx = (70 * box.width) / 360, ry = (70 * box.height) / 400;
      await m.move(cx + rx, cy); await m.down();
      for (let a = 0; a <= Math.PI * 2 * 3.2; a += 0.3) await m.move(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      await m.up();
    } else if (st.name === 'Hold') {
      await m.move(...L(180, 366)); await m.down();
      await until(page, () => { const s = window.__game.game.mg.step; return !s || s.v >= (s.zone[0] + s.zone[1]) / 2; }, 15000);
      await m.up();
    } else if (st.name === 'LatteArt') {
      await m.move(...L(st.path[0][0], st.path[0][1])); await m.down();
      for (const [x, y] of st.path) await m.move(...L(x, y));
      await m.up();
    }
    await page.waitForTimeout(900);
  }
  const ok = await until(page, () => !!document.querySelector('.mg-ok'), 15000);
  const q = ok ? Number(await page.locator('.mg-q b').textContent()) : -1;
  if (ok) await page.click('.mg-ok');
  return { q, used: [...used] };
}

try {
  // ---------- every recipe, real input ----------
  const page = await newPage({ width: 390, height: 844 });
  await page.evaluate(() => { const s = window.__game.game.state; s.playerLevel = 6; s.gold = 5000; });
  const menus = ['americano', 'croissant', 'muffin', 'cappuccino', 'latte', 'cinnamon', 'einspanner'];
  const steps = new Set();
  for (const id of menus) {
    await page.evaluate((m) => { window.__game.game.craft(m); }, id);
    await until(page, () => window.__game.game.minigameOpen, 3000);
    if (id === 'latte') await page.screenshot({ path: `${OUT}/s-latte.png` });
    const r = await playMinigame(page);
    r.used.forEach((u) => steps.add(u));
    const held = await page.evaluate(() => window.__game.game.player.hands.length);
    check(`craft ${id} with real input`, r.q >= 45 && held === 1, `quality ${r.q}`);
    await page.evaluate(() => window.__game.game.dropHeld(0));
  }
  check('all 7 step mechanics exercised', ['Knead', 'Shape', 'Bake', 'Cover', 'Grind', 'Hold', 'LatteArt'].every((s) => steps.has(s)), [...steps].join(','));
  check('mastery recorded', await page.evaluate(() => Object.keys(window.__game.game.state.mastery).length === 7));

  // ---------- mastery auto-step ----------
  await page.evaluate(() => (window.__game.game.state.mastery.americano = 20));
  await page.evaluate(() => { window.__game.game.craft('americano'); });
  await until(page, () => window.__game.game.minigameOpen, 3000);
  check('mastery auto-step button shown', await until(page, () => !document.querySelector('.mg-auto').classList.contains('hidden'), 2000));
  await page.click('.mg-auto');
  await page.waitForTimeout(1000);
  await playMinigame(page);
  await page.evaluate(() => window.__game.game.dropHeld(0));

  // ---------- cancel refunds ingredients ----------
  const g0 = await page.evaluate(() => window.__game.game.state.gold);
  await page.evaluate(() => { window.__game.game.craft('latte'); });
  await until(page, () => window.__game.game.minigameOpen, 3000);
  await page.click('.mg-cancel');
  await page.waitForTimeout(300);
  check('cancel refunds ingredient cost', (await page.evaluate(() => window.__game.game.state.gold)) === g0);

  // ---------- staff automation ----------
  await page.evaluate(() => {
    const g = window.__game.game;
    g.state.cafeLevel = 6;
    g.state.playerLevel = 1; // americano / croissant orders only
    const mk = (role, i) => ({ uid: 'st' + i, name: '테스트' + i, species: ['otter', 'bear', 'cat'][i], role, tier: 2, trait: '손이 빠름', apron: 'apron_olive' });
    g.state.staff = [mk('barista', 0), mk('baker', 1), mk('hall', 2)];
    g.staff.rebuild();
    g.startDay();
    g.customers.spawnTimer = 0;
  });
  await page.screenshot({ path: `${OUT}/s-staff-start.png` });
  const staffServed = await until(page, () => window.__game.game.customers.list.some((c) => c.served?.by === 'staff'), 120000);
  check('staff produce & hall staff serve a customer', staffServed);
  await page.screenshot({ path: `${OUT}/s-staff.png` });

  // ---------- story guest ----------
  await page.evaluate(() => {
    const g = window.__game.game;
    g.state.storyIndex = 4;
    g.day.elapsed = 40;
    g.customers.list.forEach((c) => c.state !== 'leaving' && g.customers.leave(c, false));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => (window.__game.game.customers.spawnTimer = 0));
  check('special guest Pepi visits on story step', await until(page, () => window.__game.game.customers.list.some((c) => c.def.id === 'pepi'), 20000));
  await page.evaluate(() => window.__game.game.finishDay());
  await page.waitForTimeout(300);
  check('wages paid at settlement', await page.evaluate(() => !!document.querySelector('.settle') && /인건비/.test(document.querySelector('.settle').textContent)));
  await page.evaluate(() => window.__game.sheets.closeAll());
  await page.waitForTimeout(300);

  // ---------- expansion ----------
  await page.evaluate(() => { const s = window.__game.game.state; s.cafeLevel = 8; s.gold = 20000; });
  await page.click('.nav [data-tab="decor"]');
  await page.click('.editbar [data-t="expand"]');
  for (let i = 1; i <= 4; i++) {
    await page.click(`.ecard[data-act="expand"][data-i="${i}"]`);
    await page.click('.dialog [data-act="yes"]');
    await page.waitForTimeout(400);
  }
  const ex = await page.evaluate(() => ({ e: window.__game.game.state.expansion, W: window.__game.game.map.W, T: window.__game.game.map.T, GW: window.__game.game.map.GW, ok: window.__game.game.map.validate(window.__game.game.state.placed).ok }));
  check('expanded to garden (stage 4)', ex.e === 4 && ex.W === 13 && ex.T === 3 && ex.GW === 4 && ex.ok, JSON.stringify(ex));
  // outdoor-only furniture can now be placed
  await page.evaluate(() => { const s = window.__game.game.state; s.owned.furniture.table_garden = 1; s.owned.furniture.fountain = 1; });
  await page.click('.editbar [data-t="storage"]');
  await page.click('.ecard[data-id="table_garden"]');
  await page.click('.ecard[data-id="fountain"]');
  check('outdoor furniture placed on terrace/garden', await page.evaluate(() => ['table_garden', 'fountain'].every((id) => window.__game.game.state.placed.some((p) => p.id === id))));
  await page.click('.edit-top [data-act="done"]');
  await page.evaluate(() => window.__game.game.stage.setZoom(0.6));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/s-garden.png` });
  await page.evaluate(() => window.__game.game.stage.setZoom(1));

  // ---------- theme ----------
  await page.evaluate(() => { const g = window.__game.game; g.state.owned.themes.push('french'); g.state.theme = 'french'; g.rebuildWorld(); });
  check('theme applied', await page.evaluate(() => window.__game.game.state.theme === 'french'));

  // ---------- album has memories with images ----------
  const mem = await page.evaluate(() => window.__game.game.state.album.map((a) => ({ t: a.title, img: !!a.image })));
  check('album memories recorded with snapshot', mem.length >= 2 && mem.some((m) => m.img), mem.map((m) => m.t).join(', '));
  await page.click('.nav [data-tab="album"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/s-album.png` });

  // ---------- responsive ----------
  for (const [name, vp] of [['landscape', { width: 844, height: 390 }], ['small', { width: 360, height: 640 }], ['tablet', { width: 1024, height: 768 }]]) {
    const p = await newPage(vp);
    await p.screenshot({ path: `${OUT}/s-${name}.png` });
    const overflow = await p.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('.topbar .chip, .nav button, .open-btn, .side-btn')) {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) bad.push(el.className);
      }
      return bad;
    });
    check(`${name} layout fits viewport`, overflow.length === 0, overflow.join(','));
    await p.context().close();
  }
} catch (e) {
  check('no exception', false, String(e).slice(0, 400));
}
check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server?.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
