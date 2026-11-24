// Cloud save / account tests against the Firebase emulators.
//   npx firebase emulators:start --only auth,firestore --project demo-mlc
//   VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_AUTH_DOMAIN=demo-mlc.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-mlc \
//   VITE_FIREBASE_APP_ID=1:1:web:1 VITE_FIREBASE_EMULATOR=true npx vite --port 5174
//   BASE_URL=http://localhost:5174 node scripts/e2e-cloud.mjs
import { createRequire } from 'module';
import { mkdirSync } from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5174';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-mlc/databases/(default)/documents';
const OUT = process.env.E2E_OUT || 'e2e-output';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
};
const adminGet = async (uid) => {
  const r = await fetch(`${FS}/saves/${uid}`, { headers: { Authorization: 'Bearer owner' } });
  return r.status === 200 ? r.json() : null;
};

// clean emulator state
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-mlc/databases/(default)/documents', { method: 'DELETE' });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-mlc/accounts', { method: 'DELETE' });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function device() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '/?debug=1');
  await page.waitForFunction(() => !!window.__game && !!window.__fb, null, { timeout: 20000 });
  await page.evaluate(() => window.__game.sheets.closeAll());
  await page.waitForTimeout(400);
  return page;
}
const until = async (page, fn, timeout = 15000, arg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(150);
  }
  return false;
};

try {
  // ---------- device A: guest progress, then link via the real Google popup flow ----------
  const A = await device();
  await A.evaluate(async () => {
    const g = window.__game.game;
    g.state.gold = 777;
    g.state.playerLevel = 3;
    g.progress.addMemory('테스트 추억', '스냅샷 포함', undefined);
    await g.saveNow();
  });
  await A.click('.side-btn[data-id="settings"]');
  check('settings shows Google link button for guests', await A.locator('[data-act="link"]').count() === 1);
  await A.screenshot({ path: `${OUT}/c-guest.png` });

  // The web popup needs apis.google.com (blocked in CI sandboxes), so link through the emulator's
  // Google identity API instead; the same reconcile/upload path runs as with the popup.
  A.evaluate(() => window.__game.game.cloud.linkEmulator('google-sub-tester', 'cafe.tester@example.com'));
  const linked = await until(A, () => window.__game.game.cloud.user && window.__game.game.cloud.status === 'synced', 20000);
  const uid = await A.evaluate(() => window.__game.game.cloud.user?.uid);
  check('Google sign-in (emulator identity) links the account', linked, uid);
  await A.waitForTimeout(400);
  await A.screenshot({ path: `${OUT}/c-linked.png` });

  const doc = await adminGet(uid);
  const gold = doc && Number(doc.fields.summary.mapValue.fields.gold.integerValue);
  check('guest progress uploaded on first link', gold === 777, `cloud gold=${gold}`);
  const data = doc ? JSON.parse(doc.fields.data.stringValue) : null;
  check('album images stripped from cloud copy', data && data.album.length > 0 && data.album.every((a) => !a.image));

  // throttling: many local saves -> no immediate extra uploads
  const t0 = await A.evaluate(() => window.__game.game.cloud.lastSync);
  await A.evaluate(async () => {
    for (let i = 0; i < 5; i++) await window.__game.game.saveNow();
  });
  await A.waitForTimeout(1500);
  check('uploads are throttled', (await A.evaluate(() => window.__game.game.cloud.lastSync)) === t0);
  // day settlement flushes immediately
  await A.evaluate(() => {
    const g = window.__game.game;
    g.state.gold = 999;
    g.startDay();
    g.finishDay();
  });
  check('settlement flushes to cloud', await (async () => {
    for (let i = 0; i < 40; i++) {
      const d = await adminGet(uid);
      if (d && d.fields.summary.mapValue.fields.gold.integerValue === '999') return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  })());
  await A.evaluate(() => window.__game.sheets.closeAll());

  // ---------- device B: fresh install, same Google account ----------
  const B = await device();
  check('new device starts as fresh guest', (await B.evaluate(() => window.__game.game.state.gold)) === 300);
  // same Google identity as device A: look up the provider id the emulator assigned
  const q = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-mlc/accounts:query', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{}' })).json();
  const rawId = q.userInfo.find((u) => u.localId === uid).providerUserInfo[0].rawId;
  // B already has some progress of its own -> the player must choose
  await B.evaluate(() => (window.__game.game.state.stats.itemsCrafted = 2));
  B.evaluate((s) => window.__game.game.cloud.linkEmulator(s, 'cafe.tester@example.com'), rawId); // resolves after the chooser
  check('conflict chooser appears on second device', await until(B, () => !!document.querySelector('.save-pick'), 15000));
  await B.screenshot({ path: `${OUT}/c-choose.png` });
  await B.click('.save-pick[data-k="cloud"]');
  check('choosing cloud restores progress on new device', await until(B, () => window.__game.game.state.gold === 999 && window.__game.game.state.playerLevel === 3, 10000));

  // ---------- device C: brand-new install restores automatically ----------
  const C = await device();
  await C.evaluate((s) => window.__game.game.cloud.linkEmulator(s, 'cafe.tester@example.com'), rawId);
  check('fresh install restores cloud save without asking', (await C.evaluate(() => window.__game.game.state.gold)) === 999 && (await C.locator('.save-pick').count()) === 0);
  await C.context().close();

  // ---------- security rules ----------
  const other = await B.evaluate(() => window.__fb.emulatorRawWrite('saves/someone-else', { data: 'x', clientUpdatedAt: 1, device: 'd', version: 1, summary: {} }));
  check('cannot write another player\'s save', other === 'permission-denied', other);
  const uidB = await B.evaluate(() => window.__game.game.cloud.user.uid);
  const extra = await B.evaluate((u) => window.__fb.emulatorRawWrite('saves/' + u, { data: 'x', clientUpdatedAt: 1, device: 'd', version: 1, summary: {}, admin: true }), uidB);
  check('unexpected fields rejected', extra === 'permission-denied', extra);
  const big = await B.evaluate((u) => window.__fb.emulatorRawWrite('saves/' + u, { data: 'x'.repeat(950000), clientUpdatedAt: 1, device: 'd', version: 1, summary: {} }), uidB);
  check('oversized save rejected', big === 'permission-denied', big);
  const misc = await B.evaluate(() => window.__fb.emulatorRawWrite('admin/config', { x: 1 }));
  check('other collections closed', misc === 'permission-denied', misc);

  // ---------- reset while signed in keeps cloud copy ----------
  await A.evaluate(() => window.__game.sheets.closeAll());
  await A.click('.side-btn[data-id="settings"]');
  await A.click('[data-act="reset"]');
  await A.click('.dialog [data-act="yes"]');
  await A.waitForTimeout(300);
  await A.click('.dialog [data-act="yes"]');
  await A.waitForTimeout(1500);
  const afterReset = await adminGet(uid);
  check('local reset signs out and keeps cloud save', !!afterReset && afterReset.fields.summary.mapValue.fields.gold.integerValue === '999' && (await A.evaluate(() => !window.__game.game.cloud.user)));

  // ---------- account deletion from settings UI (device B) ----------
  await B.evaluate(() => window.__game.sheets.closeAll());
  await B.click('.side-btn[data-id="settings"]');
  await B.screenshot({ path: `${OUT}/c-account.png` });
  await B.click('[data-act="delacct"]');
  await B.click('.dialog [data-act="yes"]');
  await B.waitForTimeout(300);
  await B.click('.dialog [data-act="yes"]');
  const gone = await until(B, () => !window.__game.game.cloud.user, 10000);
  check('account deletion signs out', gone);
  check('cloud save deleted', (await adminGet(uidB)) === null);
  check('local progress kept after account deletion', (await B.evaluate(() => window.__game.game.state.gold)) === 999);
  const accts = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-mlc/accounts:query', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{}' })).json();
  check('auth user deleted', !(accts.userInfo ?? []).some((u) => u.localId === uidB), `remaining=${(accts.userInfo ?? []).length}`);
} catch (e) {
  check('no exception', false, String(e).slice(0, 500));
}
check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
