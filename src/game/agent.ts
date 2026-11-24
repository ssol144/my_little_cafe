import * as THREE from 'three';
import { Character, type Look } from '../world/character';
import type { CafeMap, Cell, Who } from '../world/grid';
import { angleLerp } from '../core/util';

export class Agent {
  char: Character;
  pos = new THREE.Vector3();
  path: THREE.Vector3[] = [];
  speed = 2.0;
  heading = 0;
  moving = false;
  onArrive: (() => void) | null = null;

  constructor(look: Look, public who: Who) {
    this.char = new Character(look);
  }

  get cell(): Cell {
    return { x: Math.floor(this.pos.x), z: Math.floor(this.pos.z) };
  }

  place(x: number, z: number) {
    this.pos.set(x, 0, z);
    this.char.root.position.copy(this.pos);
  }

  walkTo(map: CafeMap, target: Cell, onArrive?: () => void): boolean {
    const c = this.cell;
    const p = map.findPath(c.x, c.z, target.x, target.z, this.who);
    if (!p) return false;
    this.path = p.map((q) => new THREE.Vector3(q.x + 0.5, 0, q.z + 0.5));
    this.onArrive = onArrive ?? null;
    this.char.seated = false;
    return true;
  }

  stop() {
    this.path = [];
    this.onArrive = null;
  }

  face(dx: number, dz: number, instant = false) {
    const h = Math.atan2(dx, dz);
    this.heading = instant ? h : angleLerp(this.heading, h, 0.5);
    this.char.root.rotation.y = this.heading;
  }

  update(dt: number) {
    this.moving = false;
    if (this.path.length) {
      const tgt = this.path[0];
      const d = new THREE.Vector3().subVectors(tgt, this.pos);
      d.y = 0;
      const dist = d.length();
      const step = this.speed * dt;
      if (dist <= step) {
        this.pos.copy(tgt);
        this.path.shift();
        if (!this.path.length) {
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        d.multiplyScalar(1 / dist);
        this.pos.addScaledVector(d, step);
        this.heading = angleLerp(this.heading, Math.atan2(d.x, d.z), Math.min(1, dt * 12));
        this.moving = true;
      }
    }
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.heading;
    this.char.update(dt, this.moving);
  }
}
