import * as THREE from 'three';
import { Agent } from './agent';
import type { CafeMap } from '../world/grid';
import type { Outfit } from '../core/state';
import type { Held } from './staff';

export const HAND_CAPACITY = 2;
const RADIUS = 0.22;

export class Player {
  agent: Agent;
  hands: Held[] = [];
  input = new THREE.Vector2();
  speed = 3.1;

  constructor(outfit: Outfit) {
    this.agent = new Agent({ ...outfit, wearApron: true }, 'player');
    this.agent.speed = this.speed;
  }

  rebuildLook(outfit: Outfit, scene: THREE.Scene) {
    const pos = this.agent.pos.clone();
    const heading = this.agent.heading;
    scene.remove(this.agent.char.root);
    this.agent = new Agent({ ...outfit, wearApron: true }, 'player');
    this.agent.speed = this.speed;
    this.agent.place(pos.x, pos.z);
    this.agent.heading = heading;
    scene.add(this.agent.char.root);
    for (const h of this.hands) this.agent.char.carry.add(h.mesh);
    this.layoutHands();
  }

  layoutHands() {
    this.hands.forEach((h, i) => {
      h.mesh.position.set((i - (this.hands.length - 1) / 2) * 0.17, 0, 0);
      h.mesh.scale.setScalar(1.0);
    });
  }

  addHeld(h: Held) {
    this.hands.push(h);
    this.agent.char.carry.add(h.mesh);
    this.layoutHands();
  }

  removeHeld(i: number): Held | null {
    const h = this.hands[i];
    if (!h) return null;
    this.hands.splice(i, 1);
    this.agent.char.carry.remove(h.mesh);
    this.layoutHands();
    return h;
  }

  private canStand(map: CafeMap, x: number, z: number, fromX: number, fromZ: number) {
    for (const [ox, oz] of [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS], [0, 0]]) {
      const cx = Math.floor(x + ox), cz = Math.floor(z + oz);
      if (!map.walkable(cx, cz, 'player')) return false;
      if (!map.canStep(Math.floor(fromX + ox), Math.floor(fromZ + oz), cx, cz)) return false;
    }
    return true;
  }

  update(dt: number, map: CafeMap) {
    const a = this.agent;
    if (this.input.lengthSq() > 0.01) {
      a.stop();
      // screen-space joystick -> isometric world directions
      const right = new THREE.Vector3(1, 0, -1).normalize();
      const up = new THREE.Vector3(-1, 0, -1).normalize();
      const dir = new THREE.Vector3().addScaledVector(right, this.input.x).addScaledVector(up, this.input.y);
      const mag = Math.min(1, dir.length());
      dir.normalize();
      const step = this.speed * mag * dt;
      const nx = a.pos.x + dir.x * step, nz = a.pos.z + dir.z * step;
      if (this.canStand(map, nx, nz, a.pos.x, a.pos.z)) a.pos.set(nx, 0, nz);
      else if (this.canStand(map, nx, a.pos.z, a.pos.x, a.pos.z)) a.pos.x = nx;
      else if (this.canStand(map, a.pos.x, nz, a.pos.x, a.pos.z)) a.pos.z = nz;
      a.heading = Math.atan2(dir.x, dir.z);
      a.char.root.position.copy(a.pos);
      a.char.root.rotation.y = a.heading;
      a.char.update(dt, mag > 0.1);
      return;
    }
    a.char.setAnim(this.hands.length ? 'carry' : 'idle');
    a.update(dt);
  }
}
