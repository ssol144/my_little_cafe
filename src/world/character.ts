import * as THREE from 'three';
import { SPECIES_BY_ID, HUMAN_SKINS, HAIR_COLORS, type SpeciesDef } from '../data/species';
import { OUTFIT_BY_ID } from '../data/outfits';
import { G, M, mat } from './materials';

export interface Look {
  species: string;
  skin?: number;
  hair?: number;
  apron?: string; // staff/player: apron. customers: shirt colour
  hat?: string;
  glasses?: string;
  accessory?: string;
  wearApron?: boolean;
}

export type Anim = 'idle' | 'walk' | 'sit' | 'eat' | 'drink' | 'read' | 'phone' | 'photo' | 'chat' | 'look' | 'cheer' | 'sad' | 'work' | 'carry';

const EYE = 0x2a1f1b;
const BLUSH = 0xf3a3a0;

/**
 * Procedural chibi character: big head, small body. Every species shares this rig so any
 * animal can do any job; species only change the parts attached to it.
 */
export class Character {
  root = new THREE.Group();
  pivot = new THREE.Group(); // bob / sit offset
  body = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  tail = new THREE.Group();
  carry = new THREE.Group();
  props: Record<string, THREE.Object3D> = {};
  eyes: THREE.Mesh[] = [];
  anim: Anim = 'idle';
  t = Math.random() * 10;
  seated = false;
  private animT = 0;

  constructor(public look: Look) {
    this.root.add(this.pivot);
    this.pivot.add(this.body);
    this.build();
  }

  private build() {
    const sp: SpeciesDef = SPECIES_BY_ID[this.look.species] ?? SPECIES_BY_ID.human;
    const isHuman = sp.id === 'human';
    const bodyCol = isHuman ? HUMAN_SKINS[this.look.skin ?? 0] ?? sp.body : sp.body;
    const bm = mat(bodyCol, { rough: 0.9 });
    const belly = mat(sp.belly ?? bodyCol, { rough: 0.9 });
    const accent = mat(sp.accent ?? sp.belly ?? bodyCol, { rough: 0.9 });
    const bw = sp.bodyWidth ?? 1;
    const hs = sp.headScale ?? 1;
    const outfitCol = OUTFIT_BY_ID[this.look.apron ?? 'apron_cream']?.color ?? 0xf4ead6;

    // ---- legs (pivot at hip) ----
    for (const [leg, x] of [[this.legL, -0.085], [this.legR, 0.085]] as const) {
      leg.position.set(x * bw, 0.18, 0);
      leg.add(M(G.capsule(), isHuman ? mat(0x5a4a3e) : bm, [0, -0.08, 0], [0.062, 0.05, 0.062]));
      leg.add(M(G.sphere(12), isHuman ? mat(0x6b4a36) : mat(sp.belly && sp.id !== 'penguin' ? bodyCol : sp.accent ?? bodyCol), [0, -0.16, 0.025], [0.07, 0.045, 0.09]));
      this.body.add(leg);
    }

    // ---- torso ----
    const torso = M(G.sphere(20), isHuman ? mat(outfitCol) : bm, [0, 0.33, 0], [0.2 * bw, 0.2, 0.17]);
    this.body.add(torso);
    if (!isHuman && sp.belly) this.body.add(M(G.sphere(16), belly, [0, 0.31, 0.07], [0.14 * bw, 0.15, 0.11]));

    // clothing: apron (front shell) or shirt band
    if (this.look.wearApron) {
      const apronGeo = new THREE.SphereGeometry(1, 20, 12, Math.PI / 2 - 1.15, 2.3, Math.PI * 0.38, Math.PI * 0.5);
      const apron = M(apronGeo, mat(outfitCol, { rough: 0.95 }), [0, 0.33, 0], [0.208 * bw, 0.208, 0.178]);
      apron.userData.ownedGeo = true;
      this.body.add(apron);
      // strap + pocket
      this.body.add(M(G.box(), mat(outfitCol), [0, 0.47, 0.13], [0.12, 0.05, 0.02], [0.5, 0, 0]));
      this.body.add(M(G.box(), mat(shade(outfitCol, 0.85)), [0, 0.28, 0.178], [0.1, 0.05, 0.01]));
    } else if (!isHuman) {
      const shirtGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.32);
      const shirt = M(shirtGeo, mat(outfitCol, { rough: 0.95 }), [0, 0.33, 0], [0.206 * bw, 0.206, 0.176]);
      shirt.userData.ownedGeo = true;
      this.body.add(shirt);
    }

    // ---- arms (pivot at shoulder) ----
    const flipper = sp.extras?.includes('flippers');
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.19 * bw, 0.42, 0);
      arm.rotation.z = s * 0.25;
      const armMat = isHuman ? mat(outfitCol) : bm;
      if (flipper) arm.add(M(G.sphere(12), armMat, [0, -0.1, 0], [0.03, 0.12, 0.07]));
      else {
        arm.add(M(G.capsule(), armMat, [0, -0.08, 0], [0.052, 0.07, 0.052]));
        arm.add(M(G.sphere(10), isHuman ? mat(bodyCol) : sp.id === 'penguin' ? bm : mat(sp.accent && sp.id === 'redpanda' ? 0x3a2a24 : bodyCol), [0, -0.15, 0], 0.055));
      }
      this.body.add(arm);
    }

    // carry tray slot (in front, above hands)
    this.carry.position.set(0, 0.46, 0.27);
    this.body.add(this.carry);

    // ---- tail ----
    this.tail.position.set(0, 0.24, -0.16);
    this.body.add(this.tail);
    this.buildTail(sp, bm, accent, belly);

    // ---- head ----
    this.head.position.set(0, 0.67, 0);
    this.head.scale.setScalar(hs);
    this.body.add(this.head);
    const headMesh = M(G.sphere(24), bm, [0, 0, 0], [0.29, 0.26, 0.26]);
    this.head.add(headMesh);
    this.buildFace(sp, bm, belly, accent, isHuman);
    this.buildEars(sp, bm, accent);
    this.buildExtras(sp, bm, accent, belly);
    this.buildOutfit();
    this.buildProps();

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
  }

  private buildFace(sp: SpeciesDef, _bm: THREE.Material, belly: THREE.Material, accent: THREE.Material, isHuman: boolean) {
    const eyeMat = mat(EYE, { rough: 0.3 });
    const white = mat(0xffffff, { rough: 0.2 });
    for (const s of [-1, 1]) {
      if (sp.extras?.includes('eyepatch')) this.head.add(M(G.sphere(12), accent, [s * 0.1, 0.0, 0.215], [0.07, 0.085, 0.04], [0, 0, s * 0.5]));
      if (sp.extras?.includes('mask')) this.head.add(M(G.sphere(12), accent, [s * 0.11, -0.03, 0.215], [0.08, 0.06, 0.04]));
      const eye = M(G.sphere(12), eyeMat, [s * 0.1, 0.01, 0.235], [0.038, 0.046, 0.03]);
      this.eyes.push(eye);
      this.head.add(eye);
      this.head.add(M(G.sphere(8), white, [s * 0.1 + 0.012, 0.028, 0.262], 0.012));
      this.head.add(M(G.sphere(10), mat(BLUSH, { opacity: 0.7 }), [s * 0.17, -0.06, 0.2], [0.045, 0.026, 0.02], [0, s * 0.6, 0]));
    }
    const noseMat = mat(sp.nose ?? 0x3a2a22, { rough: 0.4 });
    switch (sp.snout) {
      case 'none':
        if (isHuman) this.head.add(M(G.sphere(8), mat(0xc77b6a), [0, -0.075, 0.255], [0.025, 0.012, 0.01]));
        break;
      case 'small':
        this.head.add(M(G.sphere(14), belly, [0, -0.06, 0.225], [0.075, 0.055, 0.05]));
        this.head.add(M(G.sphere(10), noseMat, [0, -0.04, 0.27], [0.026, 0.019, 0.016]));
        break;
      case 'long':
        this.head.add(M(G.sphere(14), sp.id === 'capybara' ? mat(shade(sp.body, 0.92)) : belly, [0, -0.06, 0.24], [0.1, 0.075, 0.09]));
        this.head.add(M(G.sphere(10), noseMat, [0, -0.03, 0.325], [0.03, 0.02, 0.018]));
        break;
      case 'wide':
        this.head.add(M(G.sphere(14), mat(sp.nose ?? 0x3a2a22, { rough: 0.5 }), [0, -0.05, 0.25], [0.075, 0.05, 0.04]));
        break;
      case 'flat':
        this.head.add(M(G.sphere(14), belly, [0, -0.06, 0.24], [0.1, 0.06, 0.06]));
        break;
      case 'beak':
        this.head.add(M(G.cone(10), mat(sp.nose ?? 0xf2a33a), [0, -0.05, 0.28], [0.045, 0.09, 0.035], [Math.PI / 2, 0, 0]));
        // white face patch
        this.head.add(M(G.sphere(16), mat(0xfbfbf6), [0, -0.03, 0.12], [0.22, 0.17, 0.16]));
        break;
    }
    if (sp.extras?.includes('cheeks')) for (const s of [-1, 1]) this.head.add(M(G.sphere(12), belly, [s * 0.16, -0.09, 0.15], [0.08, 0.06, 0.07]));
    if (sp.extras?.includes('whiskers'))
      for (const s of [-1, 1]) for (const k of [0, 1]) this.head.add(M(G.box(), mat(0x6b5a50), [s * 0.2, -0.05 - k * 0.025, 0.22], [0.1, 0.004, 0.004], [0, s * 0.3, s * (k ? -0.12 : 0.12)], false));
  }

  private buildEars(sp: SpeciesDef, bm: THREE.Material, accent: THREE.Material) {
    for (const s of [-1, 1]) {
      switch (sp.ears) {
        case 'round':
          this.head.add(M(G.sphere(14), bm, [s * 0.19, 0.2, -0.02], [0.08, 0.08, 0.045]));
          this.head.add(M(G.sphere(12), accent, [s * 0.19, 0.2, 0.012], [0.045, 0.045, 0.02]));
          break;
        case 'tiny':
          this.head.add(M(G.sphere(12), bm, [s * 0.2, 0.17, -0.03], [0.05, 0.045, 0.035]));
          break;
        case 'pointy': {
          const e = M(G.cone(10), bm, [s * 0.16, 0.25, -0.02], [0.08, 0.15, 0.05], [0, 0, -s * 0.3]);
          this.head.add(e);
          this.head.add(M(G.cone(10), accent, [s * 0.16, 0.24, 0.008], [0.045, 0.1, 0.02], [0, 0, -s * 0.3]));
          break;
        }
        case 'long':
          this.head.add(M(G.capsule(), bm, [s * 0.09, 0.36, -0.02], [0.055, 0.13, 0.035], [0, 0, -s * 0.12]));
          this.head.add(M(G.capsule(), accent, [s * 0.09, 0.36, 0.006], [0.032, 0.11, 0.02], [0, 0, -s * 0.12]));
          break;
        case 'floppy':
          this.head.add(M(G.sphere(12), accent, [s * 0.27, -0.02, 0], [0.06, 0.14, 0.09], [0, 0, s * 0.2]));
          break;
        case 'fluffy':
          this.head.add(M(G.sphere(14), bm, [s * 0.26, 0.15, -0.02], [0.12, 0.11, 0.06]));
          this.head.add(M(G.sphere(12), accent, [s * 0.26, 0.15, 0.02], [0.08, 0.075, 0.03]));
          break;
        case 'none':
          break;
      }
    }
  }

  private buildTail(sp: SpeciesDef, bm: THREE.Material, accent: THREE.Material, belly: THREE.Material) {
    const t = this.tail;
    switch (sp.tail) {
      case 'stub': t.add(M(G.sphere(10), bm, [0, 0, -0.02], 0.05)); break;
      case 'puff': t.add(M(G.sphere(12), mat(0xffffff), [0, 0, -0.03], 0.07)); break;
      case 'long': t.add(M(G.capsule(), bm, [0, 0.12, -0.07], [0.035, 0.12, 0.035], [-0.5, 0, 0])); break;
      case 'bushy':
        t.add(M(G.sphere(14), bm, [0, 0.1, -0.1], [0.09, 0.17, 0.09], [-0.7, 0, 0]));
        t.add(M(G.sphere(12), belly, [0, 0.24, -0.2], [0.06, 0.07, 0.06]));
        break;
      case 'ringed':
        for (let i = 0; i < 4; i++) t.add(M(G.sphere(12), i % 2 ? accent : bm, [0, 0.03 + i * 0.07, -0.06 - i * 0.04], [0.075, 0.05, 0.075], [-0.6, 0, 0]));
        break;
      case 'flat': t.add(M(G.capsule(), bm, [0, -0.08, -0.12], [0.06, 0.1, 0.025], [1.1, 0, 0])); break;
      case 'none': break;
    }
  }

  private buildExtras(sp: SpeciesDef, bm: THREE.Material, accent: THREE.Material, belly: THREE.Material) {
    const ex = sp.extras ?? [];
    if (ex.includes('spines')) {
      const sm = mat(sp.accent ?? 0x7a5a44);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 * 2.3;
        const yy = 0.05 + (i % 6) * 0.04;
        const r = 0.27 - Math.abs(yy - 0.12) * 0.4;
        const theta = Math.PI * 0.55 + (a % (Math.PI * 0.9));
        const x = Math.cos(theta) * r, z = Math.sin(theta) * r * 0.95;
        const m = M(G.cone(6), sm, [x, yy, z], [0.04, 0.12, 0.04]);
        m.lookAt(new THREE.Vector3(x * 3, yy + 0.1, z * 3));
        m.rotateX(Math.PI / 2);
        this.head.add(m);
      }
      // back spines on body
      for (let i = 0; i < 10; i++) {
        const theta = Math.PI * 1.15 + (i / 9) * Math.PI * 0.7;
        const y = 0.28 + (i % 3) * 0.06;
        const x = Math.cos(theta) * 0.19, z = Math.sin(theta) * 0.16;
        const m = M(G.cone(6), sm, [x, y, z], [0.04, 0.1, 0.04]);
        m.lookAt(new THREE.Vector3(x * 4, y, z * 4));
        m.rotateX(Math.PI / 2);
        this.body.add(m);
      }
    }
    if (ex.includes('hair')) {
      const hc = mat(HAIR_COLORS[this.look.hair ?? 0] ?? HAIR_COLORS[0], { rough: 0.7 });
      this.head.add(M(G.sphere(22), hc, [0, 0.05, -0.03], [0.305, 0.27, 0.28]));
      this.head.add(M(G.sphere(14), hc, [0.06, 0.16, 0.18], [0.16, 0.08, 0.09], [0.3, 0, -0.3]));
      this.head.add(M(G.sphere(14), hc, [-0.1, 0.15, 0.17], [0.13, 0.08, 0.08], [0.3, 0, 0.4]));
      // ears
      for (const s of [-1, 1]) this.head.add(M(G.sphere(8), mat(HUMAN_SKINS[this.look.skin ?? 0]), [s * 0.285, -0.02, 0], [0.04, 0.05, 0.03]));
    }
    if (ex.includes('fluff')) for (let i = 0; i < 5; i++) this.head.add(M(G.sphere(12), belly, [(i - 2) * 0.07, 0.22 + (i % 2) * 0.03, 0.05], 0.08));
    if (ex.includes('leaf')) {
      this.head.add(M(G.sphere(10), mat(0x7c9a4a), [0.05, 0.27, 0], [0.07, 0.02, 0.035], [0, 0.4, 0.3]));
      this.head.add(M(G.cyl(6), mat(0x5b4a2a), [0.0, 0.26, 0], [0.006, 0.05, 0.006]));
    }
    void bm;
    void accent;
  }

  private buildOutfit() {
    const hat = OUTFIT_BY_ID[this.look.hat ?? 'hat_none'];
    if (hat && hat.id !== 'hat_none') {
      const hm = mat(hat.color, { rough: 0.85 });
      const g = new THREE.Group();
      g.position.set(0, 0.2, 0);
      switch (hat.id) {
        case 'hat_beret':
          g.add(M(G.sphere(18), hm, [0.03, 0.05, -0.02], [0.24, 0.07, 0.22], [0, 0, -0.2]));
          g.add(M(G.cyl(6), hm, [0.03, 0.12, -0.02], [0.012, 0.03, 0.012]));
          break;
        case 'hat_chef':
          g.add(M(G.cyl(18), hm, [0, 0.06, 0], [0.18, 0.1, 0.18]));
          g.add(M(G.sphere(16), hm, [0, 0.16, 0], [0.22, 0.12, 0.2]));
          break;
        case 'hat_cap':
          g.add(M(G.sphere(18), hm, [0, 0.02, 0], [0.25, 0.14, 0.24]));
          g.add(M(G.cyl(18), hm, [0, -0.01, 0.17], [0.15, 0.015, 0.12]));
          break;
        case 'hat_flower': {
          g.add(M(G.torus(Math.PI * 2, 0.12), mat(0x7c9a4a), [0, 0.0, 0], [0.22, 0.22, 0.22], [Math.PI / 2, 0, 0]));
          const cols = [0xf2a6b8, 0xfbe7a1, 0xffffff, 0xc9a6e8];
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.add(M(G.sphere(8), mat(cols[i % 4]), [Math.cos(a) * 0.22, 0.02, Math.sin(a) * 0.22], 0.04));
          }
          break;
        }
        case 'hat_crown':
          g.add(M(G.cyl(14), mat(hat.color, { metal: 0.6, rough: 0.35 }), [0, 0.06, 0], [0.12, 0.08, 0.12]));
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            g.add(M(G.cone(6), mat(hat.color, { metal: 0.6, rough: 0.35 }), [Math.cos(a) * 0.1, 0.13, Math.sin(a) * 0.1], [0.03, 0.07, 0.03]));
          }
          g.add(M(G.sphere(8), mat(0xd04a5a, { rough: 0.2 }), [0, 0.07, 0.12], 0.025));
          break;
      }
      this.head.add(g);
    }
    const gl = OUTFIT_BY_ID[this.look.glasses ?? 'glasses_none'];
    if (gl && gl.id !== 'glasses_none') {
      const gm = mat(gl.color, { metal: gl.id === 'glasses_gold' ? 0.7 : 0, rough: 0.4 });
      for (const s of [-1, 1]) {
        if (gl.id === 'glasses_sun') this.head.add(M(G.cyl(16), mat(0x1c1c22, { rough: 0.15 }), [s * 0.1, 0.01, 0.262], [0.06, 0.01, 0.05], [Math.PI / 2, 0, 0]));
        else this.head.add(M(G.torus(Math.PI * 2, 0.14), gm, [s * 0.1, 0.01, 0.262], [0.058, 0.058, 0.058]));
      }
      this.head.add(M(G.box(), gm, [0, 0.02, 0.27], [0.06, 0.012, 0.01]));
    }
    const acc = OUTFIT_BY_ID[this.look.accessory ?? 'acc_none'];
    if (acc && acc.id !== 'acc_none') {
      const am = mat(acc.color, { rough: 0.9 });
      switch (acc.id) {
        case 'acc_scarf':
          this.body.add(M(G.torus(Math.PI * 2, 0.35), am, [0, 0.5, 0], [0.16, 0.16, 0.2], [Math.PI / 2, 0, 0]));
          this.body.add(M(G.box(), am, [0.07, 0.4, 0.15], [0.06, 0.14, 0.03], [0.2, 0, 0.15]));
          break;
        case 'acc_bowtie':
          for (const s of [-1, 1]) this.body.add(M(G.cone(4), am, [s * 0.04, 0.5, 0.17], [0.035, 0.06, 0.02], [0, 0, (s * Math.PI) / 2]));
          this.body.add(M(G.sphere(8), am, [0, 0.5, 0.18], 0.02));
          break;
        case 'acc_bell':
          this.body.add(M(G.torus(Math.PI * 2, 0.2), mat(0xc8453c), [0, 0.5, 0], [0.15, 0.15, 0.17], [Math.PI / 2, 0, 0]));
          this.body.add(M(G.sphere(12), mat(acc.color, { metal: 0.6, rough: 0.3 }), [0, 0.45, 0.17], 0.04));
          break;
      }
    }
  }

  private buildProps() {
    const book = new THREE.Group();
    book.add(M(G.box(), mat(0x8b3a3a), [0, 0, 0], [0.16, 0.11, 0.025]));
    book.add(M(G.box(), mat(0xfaf3e3), [0, 0, 0.014], [0.15, 0.1, 0.01]));
    book.position.set(0, 0.42, 0.24);
    book.rotation.x = -0.6;
    const phone = M(G.box(), mat(0x2c2f3a, { rough: 0.3 }), [0.04, 0.44, 0.22], [0.05, 0.09, 0.012], [-0.7, 0, 0]);
    const cam = new THREE.Group();
    cam.add(M(G.box(), mat(0x3a3a40), [0, 0, 0], [0.13, 0.08, 0.06]));
    cam.add(M(G.cyl(12), mat(0x222226, { rough: 0.2 }), [0, 0, 0.04], [0.03, 0.04, 0.03], [Math.PI / 2, 0, 0]));
    cam.position.set(0, 0.62, 0.26);
    const cup = new THREE.Group();
    cup.add(M(G.cyl(12), mat(0xfaf6ee), [0, 0, 0], [0.04, 0.07, 0.04]));
    cup.add(M(G.cyl(12), mat(0x7a4a2e), [0, 0.034, 0], [0.034, 0.005, 0.034]));
    cup.position.set(0, -0.17, 0.03);
    this.armR.add(cup);
    for (const [k, o] of Object.entries({ book, phone, cam, cup })) {
      o.visible = false;
      this.props[k] = o;
      if (k !== 'cup') this.body.add(o);
    }
  }

  setAnim(a: Anim) {
    if (this.anim === a) return;
    this.anim = a;
    this.animT = 0;
    this.props.book.visible = a === 'read';
    this.props.phone.visible = a === 'phone';
    this.props.cam.visible = a === 'photo';
    this.props.cup.visible = a === 'drink';
  }

  /** Swap expression: 'happy' squints eyes, 'normal' restores. */
  setExpression(e: 'normal' | 'happy' | 'sad') {
    for (const eye of this.eyes) {
      eye.scale.y = e === 'happy' ? 0.012 : e === 'sad' ? 0.03 : 0.046;
      eye.scale.x = e === 'happy' ? 0.05 : 0.038;
    }
  }

  update(dt: number, moving: boolean) {
    this.t += dt;
    this.animT += dt;
    const t = this.t;
    const a = moving ? 'walk' : this.anim;
    // reset
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, -0.25);
    this.armR.rotation.set(0, 0, 0.25);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.tail.rotation.set(0, Math.sin(t * 3) * 0.25, 0);
    this.pivot.position.y = this.seated ? 0.2 : 0;
    const breathe = 1 + Math.sin(t * 2.2) * 0.012;
    this.body.scale.set(1, breathe, 1);

    if (this.seated) {
      this.legL.rotation.x = -1.35;
      this.legR.rotation.x = -1.35;
    }
    const holding = this.carry.children.length > 0;

    switch (a) {
      case 'walk': {
        const s = Math.sin(t * 11);
        this.legL.rotation.x = s * 0.6;
        this.legR.rotation.x = -s * 0.6;
        this.body.position.y = Math.abs(Math.cos(t * 11)) * 0.035;
        this.body.rotation.z = s * 0.04;
        if (holding) {
          this.armL.rotation.x = -1.2;
          this.armR.rotation.x = -1.2;
        } else {
          this.armL.rotation.x = -s * 0.5;
          this.armR.rotation.x = s * 0.5;
        }
        this.tail.rotation.y = Math.sin(t * 11) * 0.4;
        break;
      }
      case 'idle':
      case 'carry':
        this.head.rotation.z = Math.sin(t * 0.8) * 0.05;
        if (holding) {
          this.armL.rotation.x = -1.2;
          this.armR.rotation.x = -1.2;
        }
        break;
      case 'sit':
        this.head.rotation.y = Math.sin(t * 0.5) * 0.2;
        break;
      case 'drink': {
        const ph = (this.animT % 3.2) / 3.2;
        const up = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
        this.armR.rotation.x = -0.9 - up * 1.0;
        this.armR.rotation.z = 0.25 - up * 0.5;
        this.head.rotation.x = -up * 0.25;
        break;
      }
      case 'eat': {
        const ph = (this.animT % 1.6) / 1.6;
        const up = Math.max(0, Math.sin(ph * Math.PI * 2));
        this.armR.rotation.x = -1.0 - up * 0.9;
        this.armR.rotation.z = 0.25 - up * 0.4;
        this.head.rotation.x = 0.1 + Math.sin(t * 12) * 0.03 * up;
        break;
      }
      case 'read':
        this.armL.rotation.set(-1.1, 0, 0.35);
        this.armR.rotation.set(-1.1, 0, -0.35);
        this.head.rotation.x = 0.3;
        this.head.rotation.y = Math.sin(t * 0.6) * 0.12;
        break;
      case 'phone':
        this.armR.rotation.set(-1.25, 0, -0.2);
        this.head.rotation.x = 0.35;
        break;
      case 'photo':
        this.armL.rotation.set(-1.9, 0, 0.45);
        this.armR.rotation.set(-1.9, 0, -0.45);
        this.head.rotation.x = -0.1;
        break;
      case 'chat':
        this.head.rotation.z = Math.sin(t * 4) * 0.1;
        this.head.rotation.y = 0.25;
        this.armR.rotation.x = -0.6 + Math.sin(t * 5) * 0.4;
        break;
      case 'look':
        this.head.rotation.y = Math.sin(t * 0.9) * 0.6;
        break;
      case 'cheer': {
        const j = Math.abs(Math.sin(this.animT * 9));
        this.body.position.y = j * 0.1;
        this.armL.rotation.set(0, 0, -2.4);
        this.armR.rotation.set(0, 0, 2.4);
        break;
      }
      case 'sad':
        this.head.rotation.x = 0.4;
        this.armL.rotation.z = -0.1;
        this.armR.rotation.z = 0.1;
        break;
      case 'work': {
        const s = Math.sin(t * 7);
        this.armL.rotation.x = -1.0 + s * 0.35;
        this.armR.rotation.x = -1.0 - s * 0.35;
        this.head.rotation.x = 0.25;
        break;
      }
    }
  }
}

export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.floor(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.floor(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.floor((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
