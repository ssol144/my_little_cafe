import * as THREE from 'three';
import { Agent } from './agent';
import type { Game } from './Game';
import type { StaffMember } from '../core/state';
import { TIERS, type StaffRole } from '../data/progression';
import { MENU_BY_ID } from '../data/menu';
import type { Cell } from '../world/grid';
import type { Customer } from './customers';
import { clamp, rand } from '../core/util';

export interface Held {
  menuId: string;
  quality: number;
  mesh: THREE.Object3D;
}

interface Unit {
  m: StaffMember;
  agent: Agent;
  home: Cell;
  progress: number;
  target: string | null;
  task: 'idle' | 'toPickup' | 'toCustomer' | 'return';
  carrying: Held | null;
  customerKey: string | null;
}

/**
 * Staff automate part of the loop but are deliberately slower and lower quality than a skilled
 * player, so hand-crafting stays the main way to earn.
 */
export class StaffManager {
  units: Unit[] = [];
  pickup: (Held | null)[] = [null, null, null, null];

  constructor(private game: Game) {}

  hasRole(r: StaffRole) {
    return this.units.some((u) => u.m.role === r);
  }

  rebuild() {
    for (const u of this.units) this.game.stage.scene.remove(u.agent.char.root);
    this.units = [];
    const g = this.game;
    const k = g.map.kitchen;
    const roleIdx: Record<string, number> = {};
    for (const m of g.state.staff) {
      const i = (roleIdx[m.role] = (roleIdx[m.role] ?? -1) + 1);
      let home: Cell;
      switch (m.role) {
        case 'barista': home = { x: 5 + i, z: 1 }; break;
        case 'baker': home = { x: 2 + i, z: 1 }; break;
        case 'hall': home = { x: Math.min(g.map.W - 1, k.counterEnd + 2 + i), z: 2 }; break;
        default: home = { x: g.map.W - 1 - i, z: 1 };
      }
      if (!g.map.walkable(home.x, home.z, 'staff')) home = { x: k.stations[2].ax, z: k.stations[2].az };
      const agent = new Agent({ species: m.species, apron: m.apron, wearApron: true, hat: m.role === 'baker' ? 'hat_chef' : m.role === 'manager' ? 'hat_none' : 'hat_cap', accessory: m.role === 'manager' ? 'acc_bowtie' : 'acc_none', skin: m.name.length % 4, hair: m.name.length % 5 }, 'staff');
      agent.speed = TIERS[m.tier].speed;
      agent.place(home.x + 0.5, home.z + 0.5);
      agent.heading = m.role === 'barista' || m.role === 'baker' ? Math.PI : 0;
      g.stage.scene.add(agent.char.root);
      this.units.push({ m, agent, home, progress: 0, target: null, task: 'idle', carrying: null, customerKey: null });
    }
  }

  clearPickup() {
    for (const h of this.pickup) if (h) this.game.stage.scene.remove(h.mesh);
    this.pickup = [null, null, null, null];
  }

  /** How many of a menu are already on their way (pickup + hands + being made + carried). */
  private supply(menuId: string) {
    let n = this.pickup.filter((h) => h?.menuId === menuId).length;
    n += this.game.player.hands.filter((h) => h.menuId === menuId).length;
    n += this.units.filter((u) => u.target === menuId || u.carrying?.menuId === menuId).length;
    return n;
  }

  private demandList(kind: 'bread' | 'coffee'): string[] {
    const out: string[] = [];
    const counts = new Map<string, number>();
    for (const c of this.game.customers.waiting) {
      if (!c.order || MENU_BY_ID[c.order].kind !== kind) continue;
      counts.set(c.order, (counts.get(c.order) ?? 0) + 1);
    }
    for (const [id, n] of counts) if (n > this.supply(id)) out.push(id);
    return out;
  }

  update(dt: number) {
    const g = this.game;
    for (const u of this.units) {
      u.agent.update(dt);
      const tier = TIERS[u.m.tier];
      if (u.m.role === 'barista' || u.m.role === 'baker') {
        if (!g.day.open) {
          u.agent.char.setAnim('idle');
          u.target = null;
          u.progress = 0;
          continue;
        }
        if (!u.target) {
          const d = this.demandList(u.m.role === 'barista' ? 'coffee' : 'bread');
          if (d.length) {
            u.target = d[0];
            u.progress = 0;
          }
        }
        if (u.target) {
          u.agent.char.setAnim('work');
          u.progress += dt * (u.m.trait === '손이 빠름' ? 1.18 : 1);
          if (u.progress >= tier.interval) {
            const slot = this.pickup.findIndex((h) => !h);
            if (slot >= 0) {
              const bonus = u.m.trait === '꼼꼼함' ? 5 : 0;
              this.putOnPickup(slot, u.target, clamp(Math.round(tier.quality + bonus + rand(-7, 7)), 30, 95));
              u.target = null;
              u.progress = 0;
            }
          }
        } else u.agent.char.setAnim('idle');
      } else if (u.m.role === 'hall') {
        this.updateHall(u);
      } else {
        u.agent.char.setAnim(g.day.open ? 'look' : 'idle');
      }
    }
  }

  putOnPickup(slot: number, menuId: string, quality: number) {
    const mesh = this.game.makeFood(menuId);
    mesh.position.copy(this.game.env.pickupSlots[slot]);
    this.game.stage.scene.add(mesh);
    this.pickup[slot] = { menuId, quality, mesh };
  }

  takeFromPickup(slot: number): Held | null {
    const h = this.pickup[slot];
    if (!h) return null;
    this.pickup[slot] = null;
    this.game.stage.scene.remove(h.mesh);
    return h;
  }

  private updateHall(u: Unit) {
    const g = this.game;
    const pickupCell = { x: g.map.kitchen.stations[2].ax, z: g.map.kitchen.stations[2].az };
    switch (u.task) {
      case 'idle': {
        u.agent.char.setAnim('idle');
        if (!g.day.open) return;
        const taken = new Set(this.units.map((x) => x.customerKey).filter(Boolean));
        for (let i = 0; i < this.pickup.length; i++) {
          const h = this.pickup[i];
          if (!h) continue;
          const cust = g.customers.waiting.find((c) => c.order === h.menuId && !taken.has(c.key));
          if (!cust) continue;
          u.customerKey = cust.key;
          u.task = 'toPickup';
          const ok = u.agent.walkTo(g.map, pickupCell, () => {
            const item = this.pickup[i];
            const target = g.customers.byKey(u.customerKey!);
            if (!item || !target || target.state !== 'waiting') {
              this.returnHome(u);
              return;
            }
            u.carrying = this.takeFromPickup(i);
            u.carrying!.mesh.position.set(0, 0, 0);
            u.agent.char.carry.add(u.carrying!.mesh);
            this.deliver(u, target);
          });
          if (!ok) {
            u.task = 'idle';
            u.customerKey = null;
          }
          return;
        }
        break;
      }
      default:
        break;
    }
  }

  private deliver(u: Unit, c: Customer) {
    const g = this.game;
    u.task = 'toCustomer';
    const cell = g.customers.serveCell(c, 'player');
    if (!cell || !u.agent.walkTo(g.map, cell, () => {
      const target = g.customers.byKey(u.customerKey!);
      if (target && u.carrying && target.state === 'waiting' && target.order === u.carrying.menuId) {
        u.agent.face(target.agent.pos.x - u.agent.pos.x, target.agent.pos.z - u.agent.pos.z, true);
        g.serveCustomer(target, u.carrying.menuId, u.carrying.quality, 'staff');
        u.agent.char.carry.remove(u.carrying.mesh);
        u.carrying = null;
      }
      this.returnHome(u);
    })) this.returnHome(u);
  }

  private returnHome(u: Unit) {
    const g = this.game;
    // unserved item goes back on the pickup counter
    if (u.carrying) {
      u.agent.char.carry.remove(u.carrying.mesh);
      const slot = this.pickup.findIndex((h) => !h);
      if (slot >= 0) this.putOnPickup(slot, u.carrying.menuId, u.carrying.quality);
      u.carrying = null;
    }
    u.customerKey = null;
    u.task = 'return';
    if (!u.agent.walkTo(g.map, u.home, () => {
      u.task = 'idle';
      u.agent.face(0, 1, true);
    })) u.task = 'idle';
  }

  dailyWages(): number {
    return this.units.reduce((a, u) => a + TIERS[u.m.tier].wage, 0);
  }
}
