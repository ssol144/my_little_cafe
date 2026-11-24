import * as THREE from 'three';
import type { ThemeDef } from '../data/furniture';
import { G, M, mat } from './materials';
import { shade } from './character';
import { type CafeMap, STREET_ROWS } from './grid';
import { createFood } from './props';

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}
const css = (c: number) => '#' + c.toString(16).padStart(6, '0');

function ownedMat(m: THREE.Material) {
  return m;
}
function texMesh(geo: THREE.BufferGeometry, tex: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, ...opts }));
  m.userData.ownedMat = true;
  m.userData.ownedGeo = true;
  m.receiveShadow = true;
  return m;
}

export interface StationObj {
  id: 'oven' | 'espresso' | 'pickup';
  group: THREE.Group;
  access: THREE.Vector3;
}

export class CafeEnvironment {
  group = new THREE.Group();
  stations: Record<string, StationObj> = {};
  pickupSlots: THREE.Vector3[] = [];
  ovenGlow!: THREE.MeshStandardMaterial;
  steam: THREE.Mesh[] = [];
  private t = 0;

  build(map: CafeMap, theme: ThemeDef) {
    this.group.clear();
    this.stations = {};
    this.pickupSlots = [];
    this.steam = [];
    const { W, D, T, GW } = map;

    // ---------- ground & street ----------
    const ground = M(G.box(), mat(0xe6d6bc, { rough: 1 }), [W / 2, -0.06, D / 2], [80, 0.1, 80], [0, 0, 0], false);
    ground.receiveShadow = true;
    this.group.add(ground);
    const streetZ = D + T;
    const sidewalk = texMesh(new THREE.PlaneGeometry(map.cols + 14, STREET_ROWS), canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#e9dfcf';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#d6c8b2';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, s, s);
    }, [map.cols + 14, STREET_ROWS]));
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(map.cols / 2, 0.001, streetZ + STREET_ROWS / 2);
    this.group.add(sidewalk);
    const road = M(G.box(), mat(0x9a948c, { rough: 1 }), [map.cols / 2, -0.03, streetZ + STREET_ROWS + 2], [map.cols + 30, 0.05, 4], [0, 0, 0], false);
    road.receiveShadow = true;
    this.group.add(road);
    for (let x = -8; x < map.cols + 10; x += 3) this.group.add(M(G.box(), mat(0xf4efe6), [x, 0.0, streetZ + STREET_ROWS + 2], [1.4, 0.02, 0.15], [0, 0, 0], false));
    // trees & lamps outside
    for (const x of [-2.2, map.cols + 1.6]) {
      this.tree(x, D * 0.35);
      this.tree(x + (x < 0 ? -0.8 : 0.9), D * 0.75);
    }
    this.streetLamp(-0.9, streetZ + 1);
    this.streetLamp(map.cols + 0.6, streetZ + 1);
    // A-frame sign by the door
    const sign = new THREE.Group();
    sign.add(M(G.box(), mat(0x3b2f2a), [0, 0.38, 0], [0.5, 0.7, 0.04], [-0.18, 0, 0]));
    sign.add(M(G.box(), mat(0x8a6446), [0, 0.38, 0.0], [0.56, 0.76, 0.03], [-0.18, 0, 0]));
    const signTex = canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#2f2a26';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#f6ead8';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Jua, sans-serif';
      ctx.fillText('OPEN', s / 2, 40);
      ctx.font = '16px Jua, sans-serif';
      ctx.fillText('빵 · 커피', s / 2, 72);
      ctx.fillStyle = '#e9b04a';
      ctx.fillText('♥', s / 2, 100);
    });
    const signFace = texMesh(new THREE.PlaneGeometry(0.46, 0.64), signTex);
    signFace.position.set(0, 0.39, 0.035);
    signFace.rotation.x = -0.18;
    sign.add(signFace);
    sign.position.set(map.doorX + 1.3, 0, streetZ + 0.6);
    sign.rotation.y = -0.3;
    this.group.add(sign);

    // ---------- floors ----------
    const plank = canvasTex(256, (ctx, s) => {
      if (theme.id === 'french') {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          ctx.fillStyle = css((i + j) % 2 ? theme.floorB : theme.floorA);
          ctx.fillRect((i * s) / 2, (j * s) / 2, s / 2, s / 2);
        }
        return;
      }
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const y = (r * s) / rows;
        const off = (r % 2) * (s / 2);
        for (let k = -1; k < 2; k++) {
          const base = (r + k) % 2 ? theme.floorA : theme.floorB;
          ctx.fillStyle = css(shade(base, 0.97 + ((r * 7 + k * 3) % 5) * 0.012));
          ctx.fillRect(off + k * s, y, s, s / rows);
        }
        ctx.fillStyle = 'rgba(80,50,30,0.18)';
        ctx.fillRect(0, y, s, 2);
        ctx.fillRect(off, y, 2, s / rows);
        ctx.strokeStyle = 'rgba(90,60,40,0.06)';
        for (let g = 0; g < 6; g++) {
          ctx.beginPath();
          const gy = y + 6 + g * 10;
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(s * 0.3, gy + 3, s * 0.6, gy - 3, s, gy + 1);
          ctx.stroke();
        }
      }
    }, [W / 2, (D - 3) / 2]);
    const hall = texMesh(new THREE.PlaneGeometry(W, D - 3), plank);
    hall.rotation.x = -Math.PI / 2;
    hall.position.set(W / 2, 0, 3 + (D - 3) / 2);
    this.group.add(hall);
    const tile = canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#f4efe6';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#e8dfd0';
      ctx.fillRect(0, 0, s / 2, s / 2);
      ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
      ctx.strokeStyle = 'rgba(120,100,80,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, s, s);
    }, [W, 3]);
    const kfloor = texMesh(new THREE.PlaneGeometry(W, 3), tile);
    kfloor.rotation.x = -Math.PI / 2;
    kfloor.position.set(W / 2, 0.002, 1.5);
    this.group.add(kfloor);
    // door mat
    this.group.add(M(G.box(), mat(0x8a6446, { rough: 1 }), [map.doorX + 0.5, 0.01, D - 0.45], [0.9, 0.02, 0.6], [0, 0, 0], false));

    if (T > 0) {
      const stone = canvasTex(128, (ctx, s) => {
        ctx.fillStyle = '#d9d0c1';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#cfc4b2';
        ctx.fillRect(4, 4, s / 2 - 8, s / 2 - 8);
        ctx.fillRect(s / 2 + 4, s / 2 + 4, s / 2 - 8, s / 2 - 8);
        ctx.fillStyle = '#e3dbcd';
        ctx.fillRect(s / 2 + 4, 4, s / 2 - 8, s / 2 - 8);
        ctx.fillRect(4, s / 2 + 4, s / 2 - 8, s / 2 - 8);
      }, [W, T]);
      const terr = texMesh(new THREE.PlaneGeometry(W, T), stone);
      terr.rotation.x = -Math.PI / 2;
      terr.position.set(W / 2, 0.004, D + T / 2);
      this.group.add(terr);
      if (GW > 0) {
        const grass = texMesh(new THREE.PlaneGeometry(GW, T), canvasTex(64, (ctx, s) => {
          ctx.fillStyle = '#a9bf7d';
          ctx.fillRect(0, 0, s, s);
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = i % 2 ? '#9cb470' : '#b6c98c';
            ctx.fillRect(Math.random() * s, Math.random() * s, 3, 5);
          }
        }, [GW, T]));
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(W + GW / 2, 0.004, D + T / 2);
        this.group.add(grass);
        for (let i = 0; i < GW * 2; i++) this.bush(W + 0.3 + i * 0.5, D - 0.35, i);
        for (let z = 0; z < T; z++) this.bush(W + GW + 0.3, D + z + 0.5, z + 3);
      }
      // picket fence along the outer edge (gap at door)
      for (let x = 0; x < W + GW; x++) {
        if (x === map.doorX) continue;
        this.fence(x + 0.5, D + T, false);
      }
      for (let z = 0; z < T; z++) this.fence(0, D + z + 0.5, true);
      // planters with flowers on terrace corners
      this.bush(0.4, D + T - 0.4, 1);
    }

    // ---------- walls ----------
    const wallH = 2.7;
    const wallM = mat(theme.wall, { rough: 0.95 });
    const wainM = mat(theme.wainscot, { rough: 0.8 });
    const trimM = mat(theme.trim, { rough: 0.6 });
    // back wall (z=0)
    this.group.add(M(G.box(), wallM, [W / 2, wallH / 2, -0.08], [W + 0.16, wallH, 0.16]));
    this.group.add(M(G.box(), wainM, [W / 2, 0.45, 0.0], [W, 0.9, 0.04]));
    this.group.add(M(G.box(), trimM, [W / 2, 0.92, 0.03], [W, 0.05, 0.06]));
    this.group.add(M(G.box(), trimM, [W / 2, wallH - 0.05, 0.02], [W, 0.1, 0.06]));
    // left wall (x=0)
    this.group.add(M(G.box(), wallM, [-0.08, wallH / 2, D / 2], [0.16, wallH, D + 0.16]));
    this.group.add(M(G.box(), wainM, [0.0, 0.45, D / 2], [0.04, 0.9, D]));
    this.group.add(M(G.box(), trimM, [0.03, 0.92, D / 2], [0.06, 0.05, D]));
    this.group.add(M(G.box(), trimM, [0.02, wallH - 0.05, D / 2], [0.06, 0.1, D]));
    if (map.exp.windows) {
      for (let zc = 4.5; zc < D - 1; zc += 3) this.window(zc);
    } else {
      this.frame(0.05, 1.7, D * 0.55, 'side');
    }
    // low front wall + right wall
    const lowH = 0.5;
    for (let x = 0; x < W; x++) {
      if (x === map.doorX) continue;
      this.group.add(M(G.box(), wainM, [x + 0.5, lowH / 2, D], [1.0, lowH, 0.14]));
      this.group.add(M(G.box(), trimM, [x + 0.5, lowH + 0.02, D], [1.02, 0.05, 0.2]));
    }
    for (let z = 0; z < D; z++) {
      this.group.add(M(G.box(), wainM, [W, lowH / 2, z + 0.5], [0.14, lowH, 1.0]));
      this.group.add(M(G.box(), trimM, [W, lowH + 0.02, z + 0.5], [0.2, 0.05, 1.02]));
    }
    // door frame
    for (const dx of [0, 1]) this.group.add(M(G.box(), trimM, [map.doorX + dx, 1.1, D], [0.12, 2.2, 0.16]));
    this.group.add(M(G.box(), trimM, [map.doorX + 0.5, 2.2, D], [1.12, 0.12, 0.18]));
    const bell = M(G.sphere(10), mat(0xd9b04a, { metal: 0.6, rough: 0.3 }), [map.doorX + 0.5, 2.05, D], 0.06);
    this.group.add(bell);
    // awning over the door
    const awn = new THREE.Group();
    for (let i = 0; i < 6; i++) awn.add(M(G.box(), mat(i % 2 ? 0xf4ead6 : 0x8a9a5b), [-0.6 + i * 0.24 + 0.12, 0, 0], [0.24, 0.03, 0.7]));
    awn.position.set(map.doorX + 0.5, 2.35, D + 0.3);
    awn.rotation.x = 0.35;
    this.group.add(awn);

    // ---------- back wall decor ----------
    this.chalkboard(W);
    this.clock(W - 1.6);
    for (let x = 1; x < W - 1; x += 3) this.wallShelf(x + 0.5);

    // ---------- kitchen ----------
    const k = map.kitchen;
    for (const p of k.props) this.kitchenProp(p.kind, p.x, p.z);
    for (const x of k.counter) this.counter(x, 2, x === Math.floor(k.counterEnd / 2));
    // pendant lamps over the counter
    for (let x = 1; x < k.counterEnd; x += 3) this.pendant(x + 0.5, 2.5);
    for (const s of k.stations) {
      const g = new THREE.Group();
      g.position.set(s.x + 0.5, 0, s.z + 0.5);
      if (s.id === 'oven') this.oven(g);
      if (s.id === 'espresso') this.espresso(g);
      if (s.id === 'pickup') this.pickup(g);
      this.group.add(g);
      this.stations[s.id] = { id: s.id, group: g, access: new THREE.Vector3(s.ax + 0.5, 0, s.az + 0.5) };
    }

    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    ground.castShadow = false;
    hall.castShadow = false;
    kfloor.castShadow = false;
  }

  update(dt: number, baking: boolean) {
    this.t += dt;
    if (this.ovenGlow) this.ovenGlow.emissiveIntensity = baking ? 1.2 + Math.sin(this.t * 6) * 0.25 : 0.35;
    for (const s of this.steam) {
      const ph = (this.t * 0.5 + s.userData.ph) % 1;
      s.position.y = s.userData.y + ph * 0.5;
      s.scale.setScalar(0.04 + ph * 0.08);
      (s.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - ph);
    }
  }

  // ---- helpers ----
  private tree(x: number, z: number) {
    const t = new THREE.Group();
    t.add(M(G.cyl(8), mat(0x7a5a3e), [0, 0.6, 0], [0.12, 1.2, 0.12]));
    t.add(M(G.sphere(14), mat(0x8fa86a), [0, 1.6, 0], [0.75, 0.7, 0.75]));
    t.add(M(G.sphere(12), mat(0x9fb878), [0.3, 1.9, 0.2], [0.45, 0.42, 0.45]));
    t.position.set(x, 0, z);
    this.group.add(t);
  }
  private bush(x: number, z: number, seed: number) {
    const b = new THREE.Group();
    b.add(M(G.sphere(10), mat(0x86a35e), [0, 0.2, 0], [0.26, 0.22, 0.26]));
    const cols = [0xf2a6b8, 0xf2c94c, 0xffffff];
    for (let i = 0; i < 3; i++) b.add(M(G.sphere(6), mat(cols[(seed + i) % 3]), [Math.cos(i * 2 + seed) * 0.15, 0.36, Math.sin(i * 2 + seed) * 0.15], 0.045));
    b.position.set(x, 0, z);
    this.group.add(b);
  }
  private fence(x: number, z: number, alongZ: boolean) {
    const f = new THREE.Group();
    const wm = mat(0xf8f4ec);
    for (const o of [-0.3, 0, 0.3]) f.add(M(G.box(), wm, alongZ ? [0, 0.3, o] : [o, 0.3, 0], [0.07, 0.6, 0.07]));
    f.add(M(G.box(), wm, [0, 0.42, 0], alongZ ? [0.05, 0.06, 1] : [1, 0.06, 0.05]));
    f.add(M(G.box(), wm, [0, 0.2, 0], alongZ ? [0.05, 0.06, 1] : [1, 0.06, 0.05]));
    f.position.set(x, 0, z);
    this.group.add(f);
  }
  private streetLamp(x: number, z: number) {
    const l = new THREE.Group();
    l.add(M(G.cyl(8), mat(0x3b3b3b, { metal: 0.4 }), [0, 1.2, 0], [0.05, 2.4, 0.05]));
    l.add(M(G.sphere(10), mat(0xfff1cf, { emissive: 0xffd28a, emissiveIntensity: 0.8 }), [0, 2.45, 0], 0.15));
    l.position.set(x, 0, z);
    this.group.add(l);
  }
  private window(zc: number) {
    const w = new THREE.Group();
    const frameM = mat(0xf8f4ec);
    w.add(M(G.box(), mat(0xcfe6ee, { emissive: 0xdff0f5, emissiveIntensity: 0.55, rough: 0.1 }), [0.02, 1.65, 0], [0.02, 1.2, 1.8]));
    w.add(M(G.box(), frameM, [0.04, 1.65, 0], [0.05, 1.3, 0.08]));
    w.add(M(G.box(), frameM, [0.04, 1.65, 0], [0.05, 0.06, 1.9]));
    w.add(M(G.box(), frameM, [0.04, 1.03, 0], [0.12, 0.06, 1.95]));
    w.add(M(G.box(), frameM, [0.04, 2.28, 0], [0.08, 0.06, 1.95]));
    for (const s of [-1, 1]) w.add(M(G.box(), frameM, [0.04, 1.65, s * 0.93], [0.06, 1.3, 0.06]));
    // curtains
    for (const s of [-1, 1]) w.add(M(G.box(), mat(0xf4ead6), [0.08, 1.65, s * 1.05], [0.04, 1.4, 0.22]));
    // small plant on sill
    w.add(M(G.cyl(8), mat(0xc98b5e), [0.12, 1.12, 0.5], [0.06, 0.12, 0.06]));
    w.add(M(G.sphere(8), mat(0x7f9c52), [0.12, 1.22, 0.5], 0.08));
    w.position.set(0, 0, zc);
    this.group.add(w);
  }
  private frame(x: number, y: number, z: number, _k: string) {
    const f = new THREE.Group();
    f.add(M(G.box(), mat(0x8a6446), [0, 0, 0], [0.04, 0.7, 0.9]));
    const tex = canvasTex(128, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#f6d9a8');
      g.addColorStop(1, '#b9cf9a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#7d9460';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.75);
      ctx.quadraticCurveTo(s * 0.4, s * 0.45, s, s * 0.7);
      ctx.lineTo(s, s);
      ctx.lineTo(0, s);
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(s * 0.72, s * 0.3, 12, 0, Math.PI * 2);
      ctx.fill();
    });
    const pic = texMesh(new THREE.PlaneGeometry(0.8, 0.6), tex);
    pic.rotation.y = Math.PI / 2;
    pic.position.x = 0.025;
    f.add(pic);
    f.position.set(x, y, z);
    this.group.add(f);
  }
  private chalkboard(W: number) {
    const tex = canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#2f3a32';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#f6ead8';
      ctx.textAlign = 'center';
      ctx.font = '34px Jua, sans-serif';
      ctx.fillText('MY LITTLE CAFE', s / 2, 52);
      ctx.font = '22px Jua, sans-serif';
      ctx.textAlign = 'left';
      const items = ['아메리카노', '카페 라떼', '크루아상', '시나몬 롤'];
      items.forEach((it, i) => ctx.fillText('• ' + it, 34, 100 + i * 34));
      ctx.fillStyle = '#e9b04a';
      ctx.fillText('♥', s - 50, s - 26);
    });
    const board = new THREE.Group();
    board.add(M(G.box(), mat(0x8a6446), [0, 0, 0], [1.7, 1.15, 0.05]));
    const face = texMesh(new THREE.PlaneGeometry(1.56, 1.0), tex);
    face.position.z = 0.03;
    board.add(face);
    board.position.set(Math.min(W - 3.2, 7.6), 1.85, 0.03);
    this.group.add(board);
  }
  private clock(x: number) {
    const c = new THREE.Group();
    c.add(M(G.cyl(24), mat(0x8a6446), [0, 0, 0], [0.26, 0.05, 0.26], [Math.PI / 2, 0, 0]));
    c.add(M(G.cyl(24), mat(0xfaf6ee), [0, 0, 0.03], [0.22, 0.02, 0.22], [Math.PI / 2, 0, 0]));
    c.add(M(G.box(), mat(0x3a2a22), [0, 0.06, 0.05], [0.02, 0.13, 0.01]));
    c.add(M(G.box(), mat(0x3a2a22), [0.05, 0, 0.05], [0.1, 0.02, 0.01]));
    c.position.set(x, 2.25, 0.05);
    this.group.add(c);
  }
  private wallShelf(x: number) {
    const s = new THREE.Group();
    s.add(M(G.box(), mat(0xa47a52), [0, 0, 0.12], [1.2, 0.05, 0.25]));
    const cols = [0xf4ead6, 0xc98b5e, 0x8a9a5b, 0xe9c9a0];
    for (let i = 0; i < 4; i++) {
      s.add(M(G.cyl(10), mat(cols[i], { rough: 0.4 }), [-0.42 + i * 0.28, 0.12, 0.12], [0.07, 0.2, 0.07]));
      s.add(M(G.cyl(10), mat(0x8a6446), [-0.42 + i * 0.28, 0.24, 0.12], [0.072, 0.03, 0.072]));
    }
    s.position.set(x, 1.45, 0);
    if (Math.abs(x - 7.6) < 1.3) return; // keep the chalkboard clear
    this.group.add(s);
  }
  private pendant(x: number, z: number) {
    const p = new THREE.Group();
    p.add(M(G.cyl(4), mat(0x2a2a2a), [0, 2.4, 0], [0.008, 0.9, 0.008], [0, 0, 0], false));
    p.add(M(G.cone(16), mat(0x3f4f3a), [0, 1.95, 0], [0.18, 0.18, 0.18], [0, 0, 0], false));
    p.add(M(G.sphere(10), mat(0xfff1cf, { emissive: 0xffd28a, emissiveIntensity: 1.4 }), [0, 1.86, 0], 0.07, [0, 0, 0], false));
    p.position.set(x, 0, z);
    p.traverse((o) => (o.userData.noShadow = true));
    this.group.add(p);
  }
  private cabinet(g: THREE.Group, top = 0xe9dcc6) {
    g.add(M(G.box(), mat(0xa47a52), [0, 0.45, 0], [0.98, 0.9, 0.9]));
    g.add(M(G.box(), mat(0x8a6446), [0, 0.45, 0.452], [0.9, 0.8, 0.01]));
    g.add(M(G.box(), mat(top, { rough: 0.4 }), [0, 0.92, 0.02], [1.0, 0.05, 0.96]));
    g.add(M(G.box(), mat(0xd9b04a, { metal: 0.5 }), [0, 0.75, 0.46], [0.2, 0.025, 0.02]));
  }
  private kitchenProp(kind: string, x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x + 0.5, 0, z + 0.5);
    switch (kind) {
      case 'fridge':
        g.add(M(G.rbox(0.06), mat(0xf2ece0, { rough: 0.4 }), [0, 0.95, -0.05], [0.9, 1.9, 0.8]));
        g.add(M(G.box(), mat(0xc9c2b6), [0, 1.25, 0.36], [0.86, 0.02, 0.02]));
        g.add(M(G.box(), mat(0x8a8378, { metal: 0.6 }), [0.32, 1.5, 0.37], [0.03, 0.3, 0.04]));
        g.add(M(G.box(), mat(0x8a8378, { metal: 0.6 }), [0.32, 0.8, 0.37], [0.03, 0.3, 0.04]));
        break;
      case 'bench':
        this.cabinet(g);
        if ((x * 7) % 3 === 0) {
          g.add(M(G.cyl(14, 1.3), mat(0xf6f0e4), [0, 1.02, 0], [0.18, 0.14, 0.18]));
          g.add(M(G.sphere(12), mat(0xf1dcc0), [0, 1.06, 0], [0.14, 0.06, 0.14]));
        } else if ((x * 7) % 3 === 1) {
          g.add(M(G.rbox(0.2), mat(0xf4efe6), [-0.2, 1.1, 0], [0.22, 0.3, 0.16]));
          g.add(M(G.box(), mat(0x8a6446), [0.2, 0.96, 0.05], [0.4, 0.03, 0.3]));
        } else {
          for (let i = 0; i < 3; i++) g.add(M(G.cyl(10), mat(0xfaf6ee, { rough: 0.3 }), [-0.25 + i * 0.25, 1.0, 0.1], [0.05, 0.08, 0.05]));
        }
        break;
      case 'grinder':
        this.cabinet(g);
        g.add(M(G.rbox(0.1), mat(0x3a3a40, { rough: 0.35 }), [0, 1.15, 0], [0.26, 0.4, 0.3]));
        g.add(M(G.cone(14), mat(0xe3dbcd, { rough: 0.1, opacity: 0.8 }), [0, 1.45, 0], [0.13, 0.22, 0.13], [Math.PI, 0, 0]));
        g.add(M(G.sphere(10), mat(0x4a2c1d), [0, 1.42, 0], [0.09, 0.05, 0.09]));
        break;
      case 'shelf':
        this.cabinet(g);
        g.add(M(G.box(), mat(0xa47a52), [0, 1.65, -0.25], [0.98, 0.05, 0.4]));
        for (let i = 0; i < 3; i++) g.add(M(G.cyl(10), mat([0xd9a441, 0x8a9a5b, 0xc98b5e][i], { rough: 0.4 }), [-0.3 + i * 0.3, 1.8, -0.25], [0.08, 0.25, 0.08]));
        g.add(M(G.rbox(0.2), mat(0xd9973e), [0, 1.0, 0], [0.4, 0.12, 0.2]));
        break;
      case 'sink':
        this.cabinet(g, 0xd9d2c4);
        g.add(M(G.box(), mat(0xbfc7ca, { metal: 0.5, rough: 0.3 }), [0, 0.92, 0.05], [0.6, 0.04, 0.5]));
        g.add(M(G.cyl(8), mat(0xbfc7ca, { metal: 0.7, rough: 0.2 }), [0, 1.1, -0.3], [0.025, 0.35, 0.025]));
        g.add(M(G.box(), mat(0xbfc7ca, { metal: 0.7, rough: 0.2 }), [0, 1.26, -0.18], [0.04, 0.04, 0.25]));
        break;
    }
    this.group.add(g);
  }
  private counter(x: number, z: number, register: boolean) {
    const g = new THREE.Group();
    g.position.set(x + 0.5, 0, z + 0.5);
    g.add(M(G.box(), mat(0xc89a6a), [0, 0.5, 0], [1.0, 1.0, 0.8]));
    for (let i = 0; i < 4; i++) g.add(M(G.box(), mat(0xb4885c), [-0.375 + i * 0.25, 0.5, 0.405], [0.2, 0.92, 0.02]));
    g.add(M(G.box(), mat(0xf4ead6, { rough: 0.35 }), [0, 1.02, 0], [1.02, 0.05, 0.9]));
    if (register) {
      g.add(M(G.rbox(0.1), mat(0x8a9a5b), [0, 1.16, -0.05], [0.4, 0.22, 0.3]));
      g.add(M(G.box(), mat(0x2b2f2a, { emissive: 0x9fd18b, emissiveIntensity: 0.3 }), [0, 1.3, -0.1], [0.24, 0.12, 0.03], [-0.4, 0, 0]));
    } else if (x % 2 === 0) {
      g.add(M(G.cyl(16), mat(0xfaf6ee, { rough: 0.3 }), [0, 1.08, 0], [0.22, 0.04, 0.22]));
      g.add(M(G.sphere(16), mat(0xdff1f5, { rough: 0.05, opacity: 0.4 }), [0, 1.18, 0], [0.22, 0.2, 0.22]));
      const f = createFood(x % 4 === 0 ? 'croissant' : 'muffin');
      f.position.set(0, 1.08, 0);
      g.add(f);
    }
    this.group.add(g);
  }
  private oven(g: THREE.Group) {
    g.add(M(G.rbox(0.06), mat(0xa65a3c, { rough: 0.9 }), [0, 0.75, -0.05], [0.96, 1.5, 0.86]));
    g.add(M(G.box(), mat(0x3a3530, { metal: 0.4, rough: 0.4 }), [0, 0.95, 0.38], [0.74, 0.5, 0.04]));
    this.ovenGlow = new THREE.MeshStandardMaterial({ color: 0x5a2a14, emissive: 0xff8a3a, emissiveIntensity: 0.35, roughness: 0.3 });
    const win = new THREE.Mesh(G.box(), this.ovenGlow);
    win.userData.ownedMat = true;
    win.position.set(0, 0.95, 0.405);
    win.scale.set(0.58, 0.32, 0.01);
    g.add(win);
    g.add(M(G.box(), mat(0xd9b04a, { metal: 0.6, rough: 0.3 }), [0, 1.25, 0.42], [0.5, 0.04, 0.04]));
    g.add(M(G.box(), mat(0x3a3530), [0, 0.35, 0.38], [0.74, 0.35, 0.04]));
    for (let i = 0; i < 3; i++) g.add(M(G.cyl(10), mat(0x2a2a2a), [-0.2 + i * 0.2, 1.4, 0.4], [0.04, 0.04, 0.04], [Math.PI / 2, 0, 0]));
    g.add(M(G.cyl(10), mat(0x7a5a3e), [0.3, 1.6, -0.25], [0.08, 0.25, 0.08]));
    this.addSteam(g, 0.3, 1.8, -0.25);
    // bread loaf on top
    g.add(M(G.capsule(), mat(0xd9973e), [-0.2, 1.57, 0], [0.08, 0.12, 0.08], [0, 0, Math.PI / 2]));
  }
  private espresso(g: THREE.Group) {
    this.cabinet(g);
    g.add(M(G.rbox(0.08), mat(0xc8453c, { rough: 0.35 }), [0, 1.22, -0.08], [0.7, 0.55, 0.5]));
    g.add(M(G.box(), mat(0xd9d9d9, { metal: 0.8, rough: 0.2 }), [0, 1.52, -0.08], [0.72, 0.05, 0.52]));
    for (const s of [-1, 1]) {
      g.add(M(G.cyl(10), mat(0xbfc7ca, { metal: 0.8, rough: 0.2 }), [s * 0.17, 1.05, 0.2], [0.05, 0.08, 0.05]));
      g.add(M(G.box(), mat(0x2a2a2a), [s * 0.17, 1.02, 0.32], [0.03, 0.03, 0.18]));
    }
    g.add(M(G.box(), mat(0xbfc7ca, { metal: 0.8, rough: 0.25 }), [0, 0.96, 0.18], [0.6, 0.02, 0.3]));
    for (const s of [-1, 1]) g.add(M(G.cyl(10, 1.15), mat(0xfaf6ee), [s * 0.17, 1.0, 0.2], [0.045, 0.07, 0.045]));
    g.add(M(G.cyl(8), mat(0xd9d9d9, { metal: 0.8, rough: 0.2 }), [0.4, 1.15, 0.15], [0.015, 0.3, 0.015], [0.3, 0, 0]));
    g.add(M(G.sphere(10), mat(0xf4f4f4, { rough: 0.3 }), [0, 1.46, 0.18], [0.04, 0.04, 0.02]));
    this.addSteam(g, 0.4, 1.4, 0.2);
  }
  private pickup(g: THREE.Group) {
    g.add(M(G.box(), mat(0x8a9a5b), [0, 0.5, 0], [1.0, 1.0, 0.8]));
    g.add(M(G.box(), mat(0xf4ead6, { rough: 0.35 }), [0, 1.02, 0], [1.02, 0.05, 0.9]));
    g.add(M(G.box(), mat(0x8a6446), [0, 1.06, 0], [0.86, 0.03, 0.7]));
    const tex = canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#f4ead6';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#5b4636';
      ctx.font = '30px Jua, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PICK UP', s / 2, s / 2 + 10);
    });
    const label = texMesh(new THREE.PlaneGeometry(0.7, 0.25), tex);
    label.position.set(0, 0.75, 0.41);
    g.add(label);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Vector3(-0.3 + (i % 2) * 0.6 + 0.0, 1.08, -0.18 + Math.floor(i / 2) * 0.36);
      this.pickupSlots.push(p.add(g.position));
    }
  }
  private addSteam(g: THREE.Group, x: number, y: number, z: number) {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(G.sphere(8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
      s.userData = { ph: i / 3, y, ownedMat: true, noShadow: true };
      s.position.set(x, y, z);
      s.castShadow = false;
      g.add(s);
      this.steam.push(s);
    }
  }
}
void ownedMat;
