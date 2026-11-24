import * as THREE from 'three';
import { G, M, mat } from './materials';
import { shade } from './character';

// ---------------- Food ----------------
export function createFood(menuId: string): THREE.Group {
  const g = new THREE.Group();
  const plate = () => g.add(M(G.cyl(18), mat(0xffffff, { rough: 0.3 }), [0, 0.005, 0], [0.11, 0.012, 0.11]));
  const cup = (coffee: number, foam = false, heart = false) => {
    g.add(M(G.cyl(16), mat(0xffffff, { rough: 0.3 }), [0, 0.005, 0], [0.1, 0.01, 0.1]));
    g.add(M(G.cyl(16, 1.15), mat(0xfbf7ef, { rough: 0.3 }), [0, 0.055, 0], [0.06, 0.09, 0.06]));
    g.add(M(G.torus(Math.PI * 2, 0.3), mat(0xfbf7ef, { rough: 0.3 }), [0.072, 0.055, 0], [0.025, 0.025, 0.025]));
    g.add(M(G.cyl(16), mat(coffee, { rough: 0.25 }), [0, 0.098, 0], [0.064, 0.004, 0.064]));
    if (foam) g.add(M(G.sphere(14), mat(0xfaf2e4), [0, 0.1, 0], [0.058, 0.018, 0.058]));
    if (heart) {
      g.add(M(G.sphere(8), mat(0xffffff), [-0.012, 0.102, 0.005], [0.018, 0.003, 0.018]));
      g.add(M(G.sphere(8), mat(0xffffff), [0.012, 0.102, 0.005], [0.018, 0.003, 0.018]));
      g.add(M(G.cone(8), mat(0xffffff), [0, 0.102, -0.014], [0.026, 0.004, 0.022], [0, 0, 0]));
    }
  };
  switch (menuId) {
    case 'americano': cup(0x3a2014); break;
    case 'cappuccino': cup(0xb98a5e, true); break;
    case 'latte': cup(0xc9a27a, false, true); break;
    case 'einspanner': {
      g.add(M(G.cyl(16), mat(0xe8f0f2, { rough: 0.05, opacity: 0.55 }), [0, 0.08, 0], [0.055, 0.16, 0.055]));
      g.add(M(G.cyl(16), mat(0x3a2014), [0, 0.06, 0], [0.05, 0.11, 0.05]));
      g.add(M(G.sphere(14), mat(0xfbf6ea), [0, 0.15, 0], [0.055, 0.04, 0.055]));
      break;
    }
    case 'croissant': {
      plate();
      const c = mat(0xd9973e, { rough: 0.6 });
      const arc = M(G.torus(Math.PI * 1.1, 0.42), c, [0, 0.04, 0.02], [0.07, 0.07, 0.07], [Math.PI / 2, 0, Math.PI * 0.95]);
      g.add(arc);
      for (const s of [-1, 1]) g.add(M(G.sphere(10), mat(0xc6822f), [s * 0.065, 0.035, 0.03], [0.025, 0.022, 0.03]));
      break;
    }
    case 'muffin': {
      plate();
      g.add(M(G.cyl(16, 1.2), mat(0xe9d7b6), [0, 0.04, 0], [0.05, 0.07, 0.05]));
      g.add(M(G.sphere(16), mat(0xc98b4e, { rough: 0.7 }), [0, 0.085, 0], [0.068, 0.045, 0.068]));
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        g.add(M(G.sphere(6), mat(0x4a4e8c), [Math.cos(a) * 0.035, 0.115, Math.sin(a) * 0.035], 0.011));
      }
      break;
    }
    case 'cinnamon': {
      plate();
      g.add(M(G.cyl(18), mat(0xb87436, { rough: 0.7 }), [0, 0.035, 0], [0.07, 0.05, 0.07]));
      g.add(M(G.torus(Math.PI * 2, 0.18), mat(0x8a4f22), [0, 0.06, 0], [0.04, 0.04, 0.04], [Math.PI / 2, 0, 0]));
      g.add(M(G.sphere(14), mat(0xfdf8ee, { rough: 0.3 }), [0, 0.065, 0], [0.06, 0.012, 0.06]));
      break;
    }
    default:
      g.add(M(G.sphere(10), mat(0xcccccc), [0, 0.05, 0], 0.05));
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
  return g;
}

// ---------------- Furniture ----------------
const WOOD = 0xc89a6a;
const WOOD_DARK = 0x8a6446;
const WOOD_LIGHT = 0xe2c29a;

function chair(color = WOOD, seat = 0xa9784e): THREE.Group {
  const g = new THREE.Group();
  g.add(M(G.rbox(0.2), mat(seat), [0, 0.26, 0], [0.42, 0.06, 0.42]));
  for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.add(M(G.cyl(8), mat(color), [x, 0.12, z], [0.025, 0.24, 0.025]));
  g.add(M(G.rbox(0.25), mat(seat), [-0.2, 0.48, 0], [0.06, 0.38, 0.42]));
  return g;
}

function sofa(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(M(G.rbox(0.25), mat(color), [0, 0.2, 0], [0.6, 0.2, 0.7]));
  g.add(M(G.rbox(0.25), mat(shade(color, 0.92)), [-0.25, 0.42, 0], [0.16, 0.5, 0.74]));
  for (const s of [-1, 1]) g.add(M(G.rbox(0.25), mat(shade(color, 0.92)), [0, 0.32, s * 0.33], [0.6, 0.18, 0.1]));
  g.add(M(G.rbox(0.3), mat(0xfaf1e0), [-0.12, 0.42, 0.1], [0.08, 0.22, 0.22], [0, 0, 0.2]));
  return g;
}

function plant(potCol: number, leafCol: number, big: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(M(G.cyl(14, 1.25), mat(potCol), [0, 0.16, 0], [0.16, 0.32, 0.16]));
  g.add(M(G.cyl(14), mat(0x5a3e2a), [0, 0.32, 0], [0.17, 0.01, 0.17]));
  const lm = mat(leafCol, { rough: 0.7 });
  if (big) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = M(G.sphere(12), lm, [Math.cos(a) * 0.18, 0.62 + (i % 3) * 0.12, Math.sin(a) * 0.18], [0.16, 0.03, 0.11]);
      leaf.rotation.set(0.5 * Math.sin(a), -a, 0.6);
      g.add(leaf);
    }
    g.add(M(G.cyl(6), mat(0x5b7a3a), [0, 0.5, 0], [0.015, 0.36, 0.015]));
  } else {
    g.add(M(G.sphere(14), lm, [0, 0.46, 0], [0.2, 0.18, 0.2]));
    g.add(M(G.sphere(12), mat(shade(leafCol, 1.15)), [0.08, 0.55, 0.05], [0.11, 0.1, 0.11]));
  }
  return g;
}

/** Build a furniture mesh in local space: footprint w×d cells centred on the origin. */
export function createFurniture(meshId: string, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const add = (o: THREE.Object3D, x = 0, z = 0, ry = 0) => {
    o.position.x += x;
    o.position.z += z;
    o.rotation.y += ry;
    g.add(o);
  };
  const cellX = (i: number) => i + 0.5 - w / 2;
  const cellZ = (j: number) => j + 0.5 - d / 2;

  switch (meshId) {
    case 'table_wood':
    case 'table_cafe':
    case 'table_sofa':
    case 'table_garden': {
      const t = new THREE.Group();
      if (meshId === 'table_cafe') {
        t.add(M(G.cyl(24), mat(0xf2ece0, { rough: 0.4 }), [0, 0.5, 0], [0.38, 0.04, 0.38]));
        t.add(M(G.cyl(10), mat(0x3a3530, { metal: 0.4, rough: 0.4 }), [0, 0.25, 0], [0.03, 0.5, 0.03]));
        t.add(M(G.cyl(16), mat(0x3a3530, { metal: 0.4, rough: 0.4 }), [0, 0.02, 0], [0.2, 0.03, 0.2]));
      } else if (meshId === 'table_garden') {
        t.add(M(G.cyl(24), mat(0xffffff, { rough: 0.5 }), [0, 0.5, 0], [0.4, 0.04, 0.4]));
        t.add(M(G.cyl(10), mat(0xe8e1d4), [0, 0.95, 0], [0.025, 1.9, 0.025]));
        const um = mat(0x8a9a5b, { rough: 0.9 });
        t.add(M(G.cone(12), um, [0, 1.75, 0], [0.95, 0.35, 0.95]));
        t.add(M(G.cone(12), mat(0xfaf1e0), [0, 1.76, 0], [0.6, 0.25, 0.6]));
      } else {
        t.add(M(G.rbox(0.08), mat(meshId === 'table_sofa' ? WOOD_DARK : WOOD, { rough: 0.6 }), [0, 0.5, 0], [0.74, 0.06, 0.74]));
        for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) t.add(M(G.cyl(8), mat(WOOD_DARK), [x, 0.24, z], [0.035, 0.48, 0.035]));
      }
      // little vase
      t.add(M(G.cyl(10), mat(0xf6f0e4, { rough: 0.3 }), [0.12, 0.57, -0.1], [0.035, 0.09, 0.035]));
      t.add(M(G.sphere(8), mat(meshId === 'table_garden' ? 0xf2c94c : 0xf2a6b8), [0.12, 0.65, -0.1], 0.04));
      add(t, cellX(1), cellZ(0));
      const seatA = meshId === 'table_sofa' ? sofa(0x8a9a5b) : chair(meshId === 'table_garden' ? 0xf4efe6 : WOOD, meshId === 'table_garden' ? 0xf4efe6 : 0xa9784e);
      const seatB = meshId === 'table_sofa' ? sofa(0x8a9a5b) : chair(meshId === 'table_garden' ? 0xf4efe6 : WOOD, meshId === 'table_garden' ? 0xf4efe6 : 0xa9784e);
      add(seatA, cellX(0), cellZ(0), 0);
      add(seatB, cellX(2), cellZ(0), Math.PI);
      break;
    }
    case 'table_four': {
      const t = new THREE.Group();
      t.add(M(G.rbox(0.08), mat(WOOD, { rough: 0.6 }), [0, 0.5, 0], [0.8, 0.06, 1.7]));
      for (const [x, z] of [[-0.32, -0.7], [0.32, -0.7], [-0.32, 0.7], [0.32, 0.7]]) t.add(M(G.cyl(8), mat(WOOD_DARK), [x, 0.24, z], [0.035, 0.48, 0.035]));
      t.add(M(G.cyl(10), mat(0xf6f0e4), [0, 0.57, 0], [0.04, 0.1, 0.04]));
      t.add(M(G.sphere(8), mat(0xf2c94c), [0, 0.66, 0], 0.05));
      add(t, cellX(1), 0);
      for (const j of [0, 1]) {
        add(chair(), cellX(0), cellZ(j), 0);
        add(chair(), cellX(2), cellZ(j), Math.PI);
      }
      break;
    }
    case 'plant_small': add(plant(0xe0c9a6, 0x7f9c52, false)); break;
    case 'plant_monstera': add(plant(0xf4efe6, 0x5f8a45, true)); break;
    case 'flower_stand': {
      const s = new THREE.Group();
      s.add(M(G.rbox(0.05), mat(WOOD_LIGHT), [0, 0.3, 0], [0.7, 0.04, 0.5]));
      s.add(M(G.rbox(0.05), mat(WOOD_LIGHT), [0, 0.65, 0], [0.7, 0.04, 0.5]));
      for (const x of [-0.32, 0.32]) for (const z of [-0.22, 0.22]) s.add(M(G.cyl(6), mat(WOOD_DARK), [x, 0.35, z], [0.02, 0.7, 0.02]));
      const cols = [0xf2a6b8, 0xf2c94c, 0xffffff, 0xd98a6a, 0xc9a6e8];
      for (let i = 0; i < 6; i++) {
        const y = i < 3 ? 0.32 : 0.67;
        const x = ((i % 3) - 1) * 0.22;
        s.add(M(G.cyl(10), mat(0xc98b5e), [x, y + 0.07, 0], [0.06, 0.12, 0.06]));
        s.add(M(G.sphere(10), mat(0x6f8f48), [x, y + 0.16, 0], [0.08, 0.05, 0.08]));
        s.add(M(G.sphere(8), mat(cols[i % cols.length]), [x, y + 0.2, 0], 0.05));
      }
      add(s);
      break;
    }
    case 'lamp_floor': {
      const l = new THREE.Group();
      l.add(M(G.cyl(14), mat(0x4a3a2e), [0, 0.02, 0], [0.16, 0.04, 0.16]));
      l.add(M(G.cyl(8), mat(0x4a3a2e, { metal: 0.3 }), [0, 0.65, 0], [0.018, 1.3, 0.018]));
      l.add(M(G.cyl(16, 0.6), mat(0xfbe7c0, { emissive: 0xffd28a, emissiveIntensity: 0.9 }), [0, 1.35, 0], [0.22, 0.26, 0.22], [0, 0, 0], false));
      const light = new THREE.PointLight(0xffc98a, 1.4, 3.2, 1.6);
      light.position.set(0, 1.2, 0);
      l.add(light);
      add(l);
      break;
    }
    case 'bookshelf': {
      const b = new THREE.Group();
      b.add(M(G.box(), mat(WOOD_DARK), [0, 0.75, -0.3], [1.8, 1.5, 0.06]));
      for (const x of [-0.88, 0.88]) b.add(M(G.box(), mat(WOOD_DARK), [x, 0.75, -0.1], [0.05, 1.5, 0.45]));
      const cols = [0x8b3a3a, 0x34475c, 0x8a9a5b, 0xd9a441, 0xf4ead6, 0x6b4a32];
      for (let s = 0; s < 3; s++) {
        const y = 0.05 + s * 0.48;
        b.add(M(G.box(), mat(WOOD), [0, y, -0.1], [1.75, 0.04, 0.45]));
        let x = -0.8;
        let k = s * 3;
        while (x < 0.78) {
          const bw = 0.06 + ((k * 7) % 5) * 0.012;
          const bh = 0.26 + ((k * 3) % 4) * 0.03;
          b.add(M(G.box(), mat(cols[k % cols.length]), [x + bw / 2, y + 0.02 + bh / 2, -0.12], [bw, bh, 0.26]));
          x += bw + 0.012;
          k++;
          if (k % 7 === 0) x += 0.18;
        }
      }
      b.add(M(G.box(), mat(WOOD), [0, 1.5, -0.1], [1.82, 0.05, 0.47]));
      add(b);
      break;
    }
    case 'display_case': {
      const c = new THREE.Group();
      c.add(M(G.rbox(0.05), mat(WOOD), [0, 0.35, 0], [1.8, 0.7, 0.7]));
      c.add(M(G.box(), mat(0xdff1f5, { rough: 0.05, opacity: 0.35 }), [0, 0.95, 0], [1.75, 0.5, 0.65], [0, 0, 0], false));
      c.add(M(G.box(), mat(WOOD_DARK), [0, 1.21, 0], [1.8, 0.03, 0.7]));
      const foods = ['croissant', 'muffin', 'cinnamon', 'muffin', 'croissant'];
      foods.forEach((f, i) => {
        const fm = createFood(f);
        fm.position.set(-0.7 + i * 0.35, 0.71, 0);
        fm.scale.setScalar(1.3);
        c.add(fm);
      });
      add(c);
      break;
    }
    case 'rug_round': {
      const r = M(G.cyl(32), mat(0xcf9e7a, { rough: 1 }), [0, 0.012, 0], [0.95, 0.012, 0.95], [0, 0, 0], false);
      r.receiveShadow = true;
      add(r);
      const r2 = M(G.cyl(32), mat(0xf1dcc0, { rough: 1 }), [0, 0.016, 0], [0.75, 0.012, 0.75], [0, 0, 0], false);
      r2.receiveShadow = true;
      add(r2);
      const r3 = M(G.cyl(32), mat(0x8a9a5b, { rough: 1 }), [0, 0.02, 0], [0.45, 0.012, 0.45], [0, 0, 0], false);
      r3.receiveShadow = true;
      add(r3);
      break;
    }
    case 'bench_flower': {
      const b = new THREE.Group();
      b.add(M(G.rbox(0.06), mat(0xf4efe6), [0, 0.32, 0.05], [1.7, 0.06, 0.45]));
      b.add(M(G.rbox(0.06), mat(0xf4efe6), [0, 0.62, -0.18], [1.7, 0.45, 0.05]));
      for (const x of [-0.75, 0.75]) b.add(M(G.box(), mat(0x6b6560), [x, 0.16, 0.05], [0.05, 0.32, 0.4]));
      for (let i = 0; i < 5; i++) b.add(M(G.sphere(8), mat([0xf2a6b8, 0xf2c94c, 0xffffff][i % 3]), [-0.7 + i * 0.35, 0.88, -0.2], 0.06));
      add(b);
      break;
    }
    case 'gramophone': {
      const gm = new THREE.Group();
      gm.add(M(G.rbox(0.05), mat(WOOD_DARK), [0, 0.35, 0], [0.5, 0.7, 0.5]));
      gm.add(M(G.cyl(16), mat(0x1f1b1a), [0, 0.72, 0], [0.18, 0.01, 0.18]));
      gm.add(M(G.cyl(8), mat(0xc9a24a, { metal: 0.7, rough: 0.3 }), [0.12, 0.85, 0], [0.02, 0.26, 0.02]));
      gm.add(M(G.cone(18), mat(0xc9a24a, { metal: 0.7, rough: 0.3 }), [0.05, 1.1, 0.12], [0.2, 0.35, 0.2], [-1.2, 0, 0.3]));
      add(gm);
      break;
    }
    case 'piano': {
      const p = new THREE.Group();
      p.add(M(G.rbox(0.05), mat(0x3a2a22, { rough: 0.3 }), [0, 0.6, -0.12], [1.7, 1.2, 0.5]));
      p.add(M(G.box(), mat(0xfaf8f2, { rough: 0.3 }), [0, 0.76, 0.18], [1.5, 0.05, 0.2]));
      for (let i = 0; i < 10; i++) p.add(M(G.box(), mat(0x1c1a18), [-0.65 + i * 0.145, 0.8, 0.13], [0.05, 0.03, 0.1]));
      p.add(M(G.rbox(0.05), mat(0x3a2a22), [0, 0.25, 0.35], [0.7, 0.06, 0.3]));
      add(p);
      break;
    }
    case 'fountain': {
      const f = new THREE.Group();
      f.add(M(G.cyl(28), mat(0xd9d2c4), [0, 0.18, 0], [0.9, 0.36, 0.9]));
      f.add(M(G.cyl(28), mat(0x8fc6d6, { rough: 0.1 }), [0, 0.36, 0], [0.8, 0.02, 0.8]));
      f.add(M(G.cyl(14), mat(0xd9d2c4), [0, 0.6, 0], [0.12, 0.6, 0.12]));
      f.add(M(G.cyl(20), mat(0xd9d2c4), [0, 0.92, 0], [0.38, 0.08, 0.38]));
      f.add(M(G.sphere(12), mat(0xbfe3ee, { rough: 0.05, opacity: 0.7 }), [0, 1.08, 0], [0.12, 0.16, 0.12]));
      add(f);
      break;
    }
    case 'xmas_tree': {
      const x = new THREE.Group();
      x.add(M(G.cyl(12), mat(0x8b3a3a), [0, 0.12, 0], [0.16, 0.24, 0.16]));
      for (let i = 0; i < 3; i++) x.add(M(G.cone(14), mat(0x3f6b45), [0, 0.5 + i * 0.32, 0], [0.42 - i * 0.1, 0.5, 0.42 - i * 0.1]));
      x.add(M(G.sphere(8), mat(0xf2c94c, { emissive: 0xf2c94c, emissiveIntensity: 0.6 }), [0, 1.42, 0], 0.07));
      for (let i = 0; i < 10; i++) {
        const a = i * 2.1;
        const h = 0.45 + (i % 5) * 0.17;
        const r = 0.36 - (h - 0.45) * 0.38;
        x.add(M(G.sphere(6), mat([0xc8453c, 0xf2c94c, 0xffffff][i % 3], { emissive: 0xffd28a, emissiveIntensity: 0.2 }), [Math.cos(a) * r, h, Math.sin(a) * r], 0.035));
      }
      add(x);
      break;
    }
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
