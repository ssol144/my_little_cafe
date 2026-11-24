import { EXPANSIONS, kitchenLayout, WINDOW_SEAT_BONUS, type ExpansionDef } from '../data/layout';
import { FURNITURE_BY_ID, type FurnitureDef } from '../data/furniture';
import type { PlacedItem } from '../core/state';

export const enum Area {
  Void = 0,
  Kitchen = 1,
  Hall = 2,
  Outdoor = 3,
  Street = 4,
}
export type Who = 'player' | 'customer' | 'staff';
export const STREET_ROWS = 3;

export interface SeatInfo {
  key: string; // uid:idx
  uid: string;
  furnitureId: string;
  x: number;
  z: number;
  fx: number;
  fz: number;
  satisfaction: number;
  stay: number;
  tip: number;
  window: boolean;
}

export interface Cell {
  x: number;
  z: number;
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function rotDims(def: FurnitureDef, rot: number) {
  return rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
}
export function rotVec(x: number, z: number, rot: number) {
  const a = (rot * Math.PI) / 2;
  const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return { x: x * c + z * s, z: -x * s + z * c };
}
/** World cells covered by a furniture item, keyed by local cell. */
export function footprint(def: FurnitureDef, px: number, pz: number, rot: number) {
  const rd = rotDims(def, rot);
  const out: { i: number; j: number; x: number; z: number }[] = [];
  for (let i = 0; i < def.w; i++)
    for (let j = 0; j < def.d; j++) {
      const v = rotVec(i + 0.5 - def.w / 2, j + 0.5 - def.d / 2, rot);
      out.push({ i, j, x: Math.round(px + v.x + rd.w / 2 - 0.5), z: Math.round(pz + v.z + rd.d / 2 - 0.5) });
    }
  return out;
}

export class CafeMap {
  exp: ExpansionDef;
  W: number;
  D: number;
  T: number;
  GW: number;
  cols: number;
  rows: number;
  area: Uint8Array;
  fixed: Uint8Array; // kitchen props/counter
  blocked: Uint8Array; // fixed + furniture
  floorOnly: Uint8Array; // rugs
  owner: (string | null)[];
  seats: SeatInfo[] = [];
  kitchen: ReturnType<typeof kitchenLayout>;
  doorX: number;
  spawn: Cell;
  ambiance = 0;
  dessertChance = 0;
  readSpots: Cell[] = [];
  lookSpots: Cell[] = [];

  constructor(stage: number) {
    this.exp = EXPANSIONS[Math.min(stage, EXPANSIONS.length - 1)];
    const e = this.exp;
    this.W = e.W;
    this.D = e.D;
    this.T = e.terrace;
    this.GW = e.garden;
    this.cols = e.W + e.garden;
    this.rows = e.D + e.terrace + STREET_ROWS;
    const n = this.cols * this.rows;
    this.area = new Uint8Array(n);
    this.fixed = new Uint8Array(n);
    this.blocked = new Uint8Array(n);
    this.floorOnly = new Uint8Array(n);
    this.owner = new Array(n).fill(null);
    this.kitchen = kitchenLayout(e.W);
    this.doorX = this.kitchen.doorX;
    for (let z = 0; z < this.rows; z++)
      for (let x = 0; x < this.cols; x++) {
        let a = Area.Void;
        if (z >= this.D + this.T) a = Area.Street;
        else if (x < this.W && z <= 2) a = Area.Kitchen;
        else if (x < this.W && z < this.D) a = Area.Hall;
        else if (z >= this.D && z < this.D + this.T && (x < this.W || x < this.W + this.GW)) a = Area.Outdoor;
        this.area[this.idx(x, z)] = a;
      }
    const k = this.kitchen;
    for (const p of k.props) this.fixed[this.idx(p.x, p.z)] = 1;
    for (const s of k.stations) this.fixed[this.idx(s.x, s.z)] = 1;
    for (const x of k.counter) this.fixed[this.idx(x, 2)] = 1;
    this.spawn = { x: this.doorX, z: this.rows - 1 };
    this.blocked.set(this.fixed);
  }

  idx(x: number, z: number) {
    return z * this.cols + x;
  }
  inBounds(x: number, z: number) {
    return x >= 0 && z >= 0 && x < this.cols && z < this.rows;
  }
  areaAt(x: number, z: number): Area {
    return this.inBounds(x, z) ? (this.area[this.idx(x, z)] as Area) : Area.Void;
  }

  /** Lines between rows that can only be crossed through the door column. */
  private fenceLines(): number[] {
    const lines = [this.D];
    if (this.T > 0) lines.push(this.D + this.T);
    return lines;
  }

  canStep(ax: number, az: number, bx: number, bz: number): boolean {
    for (const line of this.fenceLines()) {
      const crosses = (az < line) !== (bz < line);
      if (crosses && !(ax === this.doorX && bx === this.doorX)) return false;
    }
    return true;
  }

  allowedArea(a: Area, who: Who) {
    if (a === Area.Void) return false;
    if (who === 'customer') return a === Area.Hall || a === Area.Outdoor || a === Area.Street;
    if (who === 'player') return a === Area.Kitchen || a === Area.Hall || a === Area.Outdoor;
    return a !== Area.Street ? true : true;
  }

  walkable(x: number, z: number, who: Who) {
    if (!this.inBounds(x, z)) return false;
    const i = this.idx(x, z);
    return this.allowedArea(this.area[i] as Area, who) && !this.blocked[i];
  }

  findPath(sx: number, sz: number, tx: number, tz: number, who: Who): Cell[] | null {
    if (!this.inBounds(tx, tz)) return null;
    const n = this.cols * this.rows;
    const start = this.idx(sx, sz), goal = this.idx(tx, tz);
    if (start === goal) return [{ x: tx, z: tz }];
    const g = new Float32Array(n).fill(Infinity);
    const f = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open: number[] = [start];
    g[start] = 0;
    const h = (i: number) => {
      const dx = Math.abs((i % this.cols) - tx), dz = Math.abs(Math.floor(i / this.cols) - tz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    f[start] = h(start);
    const ok = (x: number, z: number) => (this.idx(x, z) === goal && this.inBounds(x, z)) || this.walkable(x, z, who);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open.splice(bi, 1);
      if (cur === goal) break;
      closed[cur] = 1;
      const cx = cur % this.cols, cz = Math.floor(cur / this.cols);
      for (const [dx, dz] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (closed[ni] || !ok(nx, nz) || !this.canStep(cx, cz, nx, nz)) continue;
        if (dx && dz) {
          // no corner cutting
          if (!this.walkable(cx + dx, cz, who) || !this.walkable(cx, cz + dz, who)) continue;
          if (!this.canStep(cx, cz, cx + dx, cz) || !this.canStep(cx, cz, cx, cz + dz)) continue;
        }
        const cost = g[cur] + (dx && dz ? 1.414 : 1) + (this.floorOnly[ni] ? 0 : 0);
        if (cost < g[ni]) {
          g[ni] = cost;
          f[ni] = cost + h(ni);
          came[ni] = cur;
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    if (came[goal] === -1) return null;
    const path: Cell[] = [];
    let c = goal;
    while (c !== start && c !== -1) {
      path.push({ x: c % this.cols, z: Math.floor(c / this.cols) });
      c = came[c];
    }
    return path.reverse();
  }

  /** Recompute blocked cells & seats from placed furniture. Items that don't fit are returned. */
  applyFurniture(items: PlacedItem[]): PlacedItem[] {
    this.blocked.set(this.fixed);
    this.floorOnly.fill(0);
    this.owner.fill(null);
    this.seats = [];
    this.ambiance = 0;
    this.dessertChance = 0;
    this.readSpots = [];
    this.lookSpots = [];
    const rejected: PlacedItem[] = [];
    for (const it of items) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def || !this.fits(def, it.x, it.z, it.rot, it.uid)) {
        rejected.push(it);
        continue;
      }
      this.occupy(def, it);
    }
    return rejected;
  }

  private occupy(def: FurnitureDef, it: PlacedItem) {
    const fp = footprint(def, it.x, it.z, it.rot);
    for (const c of fp) {
      const i = this.idx(c.x, c.z);
      if (def.walkable) this.floorOnly[i] = 1;
      else {
        this.blocked[i] = 1;
        this.owner[i] = it.uid;
      }
    }
    this.ambiance += def.ambiance;
    if (def.dessertChance) this.dessertChance = Math.min(0.6, this.dessertChance + def.dessertChance);
    if (def.read || def.ambiance >= 5) {
      // a free neighbouring cell to stand and look/read at
      for (const c of fp) for (const [dx, dz] of DIRS.slice(0, 4)) {
        const nx = c.x + dx, nz = c.z + dz;
        if (this.areaAt(nx, nz) === Area.Hall || this.areaAt(nx, nz) === Area.Outdoor) (def.read ? this.readSpots : this.lookSpots).push({ x: nx, z: nz });
      }
    }
    (def.seats ?? []).forEach((s, idx) => {
      const cell = fp.find((c) => c.i === s.i && c.j === s.j)!;
      const f = rotVec(s.fx, s.fz, it.rot);
      const window = this.exp.windows && cell.x <= 1 && this.areaAt(cell.x, cell.z) === Area.Hall;
      this.seats.push({
        key: `${it.uid}:${idx}`,
        uid: it.uid,
        furnitureId: def.id,
        x: cell.x,
        z: cell.z,
        fx: f.x,
        fz: f.z,
        satisfaction: (def.satisfaction ?? 0) + (window ? WINDOW_SEAT_BONUS : 0),
        stay: def.stayBonus ?? 1,
        tip: def.tipBonus ?? 0,
        window,
      });
    });
  }

  /** Cell-level fit check (area + overlap), ignoring the item with `ignoreUid`. */
  fits(def: FurnitureDef, x: number, z: number, rot: number, ignoreUid?: string): boolean {
    for (const c of footprint(def, x, z, rot)) {
      const a = this.areaAt(c.x, c.z);
      if (a !== Area.Hall && a !== Area.Outdoor) return false;
      if (def.outdoorOnly && a !== Area.Outdoor) return false;
      const i = this.idx(c.x, c.z);
      if (def.walkable) {
        if (this.floorOnly[i]) return false;
        if (this.fixed[i]) return false;
      } else {
        if (this.blocked[i] && this.owner[i] !== ignoreUid) return false;
      }
      // keep the doorway clear
      if (c.x === this.doorX && (c.z === this.D - 1 || (c.z >= this.D && c.z < this.D + this.T)) && !def.walkable) return false;
    }
    return true;
  }

  /** Full validation for edit mode: fit + every seat/station reachable. */
  validate(items: PlacedItem[]): { ok: boolean; reason?: string } {
    const test = new CafeMap(EXPANSIONS.indexOf(this.exp));
    const rejected = test.applyFurniture(items);
    if (rejected.length) return { ok: false, reason: '다른 물건과 겹치거나 놓을 수 없는 곳이에요' };
    const reachC = test.reach(test.spawn, 'customer');
    const p = test.kitchen.stations[0];
    const reachP = test.reach({ x: p.ax, z: p.az }, 'player');
    for (const s of test.seats) {
      const nb = DIRS.slice(0, 4).map(([dx, dz]) => ({ x: s.x + dx, z: s.z + dz }));
      if (!nb.some((c) => test.inBounds(c.x, c.z) && reachC[test.idx(c.x, c.z)] && test.canStep(c.x, c.z, s.x, s.z))) return { ok: false, reason: '손님이 갈 수 없는 좌석이 생겨요' };
      if (!nb.some((c) => test.inBounds(c.x, c.z) && reachP[test.idx(c.x, c.z)] && test.canStep(c.x, c.z, s.x, s.z))) return { ok: false, reason: '서빙할 수 없는 좌석이 생겨요' };
    }
    for (const st of test.kitchen.stations) if (!reachP[test.idx(st.ax, st.az)]) return { ok: false, reason: '주방 동선이 막혀요' };
    // hall must be reachable from the kitchen
    const doorIn = test.idx(test.doorX, test.D - 1);
    if (!reachP[doorIn]) return { ok: false, reason: '통로가 막혀요' };
    return { ok: true };
  }

  reach(from: Cell, who: Who): Uint8Array {
    const seen = new Uint8Array(this.cols * this.rows);
    const q: Cell[] = [from];
    seen[this.idx(from.x, from.z)] = 1;
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dz] of DIRS.slice(0, 4)) {
        const nx = c.x + dx, nz = c.z + dz;
        if (!this.walkable(nx, nz, who) || !this.canStep(c.x, c.z, nx, nz)) continue;
        const i = this.idx(nx, nz);
        if (seen[i]) continue;
        seen[i] = 1;
        q.push({ x: nx, z: nz });
      }
    }
    return seen;
  }

  /** Find the first free spot for an item (used when taking items out of storage). */
  findFreeSpot(def: FurnitureDef, items: PlacedItem[], uidForNew: string): { x: number; z: number; rot: number } | null {
    for (const rot of [0, 1]) {
      for (let z = 3; z < this.D + this.T; z++)
        for (let x = 0; x < this.cols; x++) {
          if (!this.fits(def, x, z, rot)) continue;
          const v = this.validate([...items, { uid: uidForNew, id: def.id, x, z, rot }]);
          if (v.ok) return { x, z, rot };
        }
    }
    return null;
  }
}
