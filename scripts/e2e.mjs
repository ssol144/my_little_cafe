// End-to-end smoke test: drives the real UI in headless Chromium.
// Usage: npm run build && npm run test:e2e   (or BASE_URL=http://localhost:5173 npm run test:e2e)
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
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  BASE = 'http://localhost:4173';
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(BASE);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: false });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
async function until(fn, timeout = 30000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await wait(200);
  }
  return false;
}

try {
  await page.goto(BASE + '/?debug=1'); // fresh browser context = empty save
  check('game boots', await until(() => !!window.__game, 15000));
  check('welcome dialog on first launch', await page.locator('.welcome').count() === 1);
  await page.click('.welcome [data-act="go"]');
  check('character panel opens', await until(() => !!document.querySelector('.char-preview')));
  // pick the quokka and apply
  await page.click('.sp[data-id="quokka"]');
  await page.click('[data-act="save"]');
  check('character applied', await G(() => window.__game.game.state.outfit.species === 'quokka'));
  await G(() => window.__game.sheets.closeAll());
  await wait(400);
  await page.screenshot({ path: `${OUT}/01-main.png` });

  // ---------- business day ----------
  const gold0 = await G(() => window.__game.game.state.gold);
  await page.click('.open-btn');
  check('day opens', await G(() => window.__game.game.day.open));
  await G(() => (window.__game.game.customers.spawnTimer = 0));
  check('customer arrives and orders', await until(() => window.__game.game.customers.waiting.length > 0, 40000));
  await page.screenshot({ path: `${OUT}/02-order.png` });
  const order = await G(() => window.__game.game.customers.waiting[0].order);
  const kind = await G((o) => (['americano', 'cappuccino', 'latte', 'einspanner'].includes(o) ? 'espresso' : 'oven'), order);

  // walk to the right station by tapping it on screen
  const stPos = await G((k) => {
    const g = window.__game.game;
    const p = g.env.stations[k].group.position.clone();
    p.y = 1.0;
    return g.stage.project(p);
  }, kind);
  await page.mouse.click(stPos.x, stPos.y);
  check('station tap opens menu', await until(() => !!document.querySelector('.station'), 15000));
  await page.screenshot({ path: `${OUT}/03-station.png` });
  await page.click(`.menu-card[data-id="${order}"]`);
  check('minigame opens', await until(() => window.__game.game.minigameOpen, 5000));

  // drive the minigame with real pointer input where practical
  const box = await page.locator('.mg-stage canvas').boundingBox();
  const L = (x, y) => ({ x: box.x + (x / 360) * box.width, y: box.y + (y / 400) * box.height });
  let shotTaken = false;
  for (let guard = 0; guard < 12; guard++) {
    if (!(await G(() => window.__game.game.minigameOpen))) break;
    if (await page.locator('.mg-ok').count()) break;
    const st = await G(() => {
      const s = window.__game.game.mg.step;
      return s ? { name: s.kind, done: s.done } : null;
    });
    if (!st || st.done) {
      await wait(300);
      continue;
    }
    if (!shotTaken) {
      await page.screenshot({ path: `${OUT}/04-minigame.png` });
      shotTaken = true;
    }
    if (st.name === 'Grind') {
      const c = L(180, 200);
      await page.mouse.move(c.x + 70, c.y);
      await page.mouse.down();
      for (let a = 0; a <= Math.PI * 2 * 3.3; a += 0.25) {
        const p = { x: c.x + Math.cos(a) * 70 * (box.width / 360), y: c.y + Math.sin(a) * 70 * (box.height / 400) };
        await page.mouse.move(p.x, p.y);
      }
      await page.mouse.up();
    } else if (st.name === 'Hold') {
      const p = L(180, 366);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await until(() => {
        const s = window.__game.game.mg.step;
        if (!s) return true;
        return s.v >= (s.zone[0] + s.zone[1]) / 2;
      }, 12000);
      await page.mouse.up();
    } else if (st.name === 'Knead') {
      for (let b = 0; b < 4; b++) {
        await until(() => {
          const s = window.__game.game.mg.step;
          return !s || s.done || (s.gap <= 0 && Math.abs(s.ringR - s.doughR) < 8);
        }, 5000);
        const p = L(180, 210);
        await page.mouse.click(p.x, p.y);
        await wait(60);
      }
    } else if (st.name === 'Bake') {
      await until(() => {
        const s = window.__game.game.mg.step;
        return !s || s.done || s.d >= (s.zone[0] + s.zone[1]) / 2;
      }, 12000);
      const p = L(180, 200);
      await page.mouse.click(p.x, p.y);
    } else {
      // swipe / cover / latte-art: complete via the step API (covered by type checks)
      await G(() => {
        const s = window.__game.game.mg.step;
        s.score = 85;
        s.done = true;
      });
    }
    await wait(900);
  }
  check('minigame result screen', await until(() => !!document.querySelector('.mg-ok'), 15000));
  const q = await page.locator('.mg-q b').textContent();
  await page.screenshot({ path: `${OUT}/05-result.png` });
  await page.click('.mg-ok');
  const hands = await G(() => window.__game.game.player.hands.map((h) => h.menuId));
  check('crafted item in hands', hands.length === 1 && hands[0] === order, `quality ${q}`);
  const goldAfterCraft = await G(() => window.__game.game.state.gold);
  check('ingredient cost deducted', goldAfterCraft < gold0, `${gold0} → ${goldAfterCraft}`);

  // serve by tapping the order bubble
  await page.click('.bubble .order.ready', { force: true });
  check('customer served', await until(() => window.__game.game.customers.list.some((c) => c.state === 'eating'), 20000));
  await page.screenshot({ path: `${OUT}/06-served.png` });
  await G(() => window.__game.game.customers.list.forEach((c) => c.state === 'eating' && (c.timer = 0.2)));
  check('customer pays', await until((g0) => window.__game.game.state.gold > g0, 10000, goldAfterCraft));
  const goldPaid = await G(() => window.__game.game.state.gold);
  check('stats updated', await G(() => window.__game.game.state.stats.customersServed === 1));

  // close the day early and confirm
  await page.click('.close-day');
  if (await page.locator('.dialog [data-act="yes"]').count()) await page.click('.dialog [data-act="yes"]');
  check('settlement shown', await until(() => !!document.querySelector('.settle'), 10000));
  await page.screenshot({ path: `${OUT}/07-settlement.png` });
  await page.click('.settle [data-act="ok"]');
  check('day completed', await G(() => window.__game.game.state.stats.daysCompleted === 1));

  // ---------- persistence ----------
  await G(() => window.__game.game.saveNow());
  await wait(300);
  await page.reload();
  await until(() => !!window.__game, 15000);
  await wait(800);
  const after = await G(() => ({ gold: window.__game.game.state.gold, days: window.__game.game.state.stats.daysCompleted, sp: window.__game.game.state.outfit.species }));
  check('save survives reload', after.days === 1 && after.sp === 'quokka' && after.gold >= goldPaid - 1, JSON.stringify(after));
  await G(() => window.__game.sheets.closeAll());
  await wait(300);

  // ---------- attendance ----------
  await page.click('.side-btn[data-id="attendance"]');
  await page.click('.att [data-act="check"]');
  check('attendance reward', await G(() => window.__game.game.state.attendance.total === 1));
  await G(() => window.__game.sheets.closeAll());
  await wait(300);

  // ---------- shop purchase ----------
  await G(() => (window.__game.game.state.gold = 2000));
  await page.click('.nav [data-tab="shop"]');
  await until(() => !!document.querySelector('[data-act="buy"][data-id="plant_small"]'));
  await wait(500);
  await page.screenshot({ path: `${OUT}/08-shop.png` });
  await page.click('[data-act="buy"][data-id="plant_small"]');
  await page.click('.dialog [data-act="yes"]');
  check('furniture purchased', await until(() => window.__game.game.storedCount('plant_small') === 1, 3000), 'gold 2000 → ' + (await G(() => window.__game.game.state.gold)));
  await G(() => window.__game.sheets.closeAll());
  await wait(300);

  // ---------- decorate ----------
  await page.click('.nav [data-tab="decor"]');
  check('edit mode', await G(() => window.__game.game.edit.active));
  const placed0 = await G(() => window.__game.game.state.placed.length);
  await page.click('.ecard[data-id="plant_small"]');
  check('placed from storage', await until((n) => window.__game.game.state.placed.length === n + 1, 3000, placed0));
  // rotate a table and verify the layout stays valid
  await G(() => {
    const g = window.__game.game;
    const t = g.state.placed.find((p) => p.id === 'table_wood');
    g.edit.select(t.uid);
  });
  await page.click('[data-act="rotate"]');
  await wait(300);
  await page.screenshot({ path: `${OUT}/09-decor.png` });
  check('layout still valid after edits', await G(() => window.__game.game.map.validate(window.__game.game.state.placed).ok));
  await page.click('.edit-top [data-act="done"]');
  check('left edit mode', await G(() => !window.__game.game.edit.active));

  // ---------- quests panel ----------
  await page.click('.nav [data-tab="quest"]');
  await wait(400);
  await page.screenshot({ path: `${OUT}/10-quests.png` });
  check('daily quest progress tracked', await G(() => (window.__game.game.state.daily.progress['d_day'] ?? 0) === 1));
} catch (e) {
  check('no exception', false, String(e));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
server?.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
