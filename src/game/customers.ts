import * as THREE from 'three';
import { Agent } from './agent';
import type { Game } from './Game';
import { CUSTOMERS, CUSTOMER_BY_ID, PERSONALITY, REGULAR_AFFINITY, REGULAR_VISITS, type CustomerDef } from '../data/customers';
import { MENU, MENU_BY_ID } from '../data/menu';
import type { SeatInfo, Cell } from '../world/grid';
import { pick, rand, clamp } from '../core/util';
import { todayKey } from '../core/state';
import { audio } from '../core/audio';
import { events } from '../core/events';

export type CState = 'entering' | 'browsing' | 'thinking' | 'waiting' | 'eating' | 'leaving' | 'gone';
export type Emote = 'heart' | 'note' | 'sweat' | 'chat' | 'flash' | 'star' | 'angry' | 'zzz' | 'book' | null;

export interface Customer {
  key: string;
  def: CustomerDef;
  agent: Agent;
  state: CState;
  seat: SeatInfo | null;
  order: string | null;
  patience: number;
  patienceMax: number;
  timer: number;
  actTimer: number;
  emote: Emote;
  emoteTimer: number;
  tries: number;
  partner: Customer | null;
  served: { quality: number; by: 'player' | 'staff' } | null;
  satisfaction: number;
  coins: number; // floating text
  isSpecial: boolean;
}

let seq = 0;

export class CustomerManager {
  list: Customer[] = [];
  spawnTimer = 3;
  reserved = new Set<string>();
  specialSpawnedToday = '';

  constructor(private game: Game) {}

  get waiting() {
    return this.list.filter((c) => c.state === 'waiting');
  }

  clear() {
    for (const c of this.list) this.game.stage.scene.remove(c.agent.char.root);
    this.list = [];
    this.reserved.clear();
  }

  freeSeats(): SeatInfo[] {
    return this.game.map.seats.filter((s) => !this.reserved.has(s.key));
  }

  private unlockedMenu() {
    return MENU.filter((m) => m.unlockLevel <= this.game.state.playerLevel);
  }

  update(dt: number) {
    const g = this.game;
    if (g.day.open && !g.day.closing) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.trySpawn();
        const rep = g.state.reputation;
        const tables = g.map.seats.length;
        const base = clamp(17 - rep * 1.7 - tables * 0.25, 6.5, 17);
        this.spawnTimer = base * rand(0.75, 1.25) * (g.state.stats.daysCompleted === 0 ? 1.25 : 1);
      }
    }
    for (const c of this.list) this.updateOne(c, dt);
    const gone = this.list.filter((c) => c.state === 'gone');
    if (gone.length) {
      for (const c of gone) g.stage.scene.remove(c.agent.char.root);
      this.list = this.list.filter((c) => c.state !== 'gone');
    }
  }

  private pickDef(exclude: Set<string>): CustomerDef | null {
    const s = this.game.state;
    // story guest
    for (const d of CUSTOMERS) {
      if (!d.special || exclude.has(d.id)) continue;
      if (s.storyIndex === d.special.storyStep && !s.flags['special_' + d.id] && this.specialSpawnedToday !== d.id + this.game.day.number && this.game.day.elapsed > 25) {
        this.specialSpawnedToday = d.id + this.game.day.number;
        return d;
      }
    }
    const pool = CUSTOMERS.filter((d) => !d.special && !exclude.has(d.id));
    if (!pool.length) return null;
    // regulars and frequent visitors come more often
    const weights = pool.map((d) => 1 + Math.min(3, (s.customers[d.id]?.visits ?? 0) * 0.35) + (s.customers[d.id]?.regular ? 1.5 : 0));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  trySpawn(): boolean {
    const free = this.freeSeats();
    if (!free.length) return false;
    const present = new Set(this.list.map((c) => c.def.id));
    const def = this.pickDef(present);
    if (!def) return false;
    // group visit: a friend joins when a table has two free seats
    let seat = pick(free);
    let partnerSeat: SeatInfo | null = null;
    if (!def.special && Math.random() < 0.3) {
      const byTable = new Map<string, SeatInfo[]>();
      for (const s of free) byTable.set(s.uid, [...(byTable.get(s.uid) ?? []), s]);
      const pairs = [...byTable.values()].filter((v) => v.length >= 2);
      if (pairs.length) {
        const p = pick(pairs);
        seat = p[0];
        partnerSeat = p[1];
      }
    }
    const c = this.spawn(def, seat);
    if (partnerSeat) {
      present.add(def.id);
      const friend = this.pickDef(present);
      if (friend && !friend.special) {
        const f = this.spawn(friend, partnerSeat, 1.1);
        c.partner = f;
        f.partner = c;
      }
    }
    audio.play('bell');
    return true;
  }

  private spawn(def: CustomerDef, seat: SeatInfo, delay = 0): Customer {
    const g = this.game;
    const agent = new Agent({ species: def.species, apron: def.apron, hat: def.hat, glasses: def.glasses, accessory: def.accessory, skin: (def.id.length % 3), hair: def.id.length % 5 }, 'customer');
    agent.speed = def.personality === 'busy' ? 2.3 : def.personality === 'relaxed' ? 1.6 : 1.9;
    const sp = g.map.spawn;
    agent.place(sp.x + 0.5 + (delay ? 0.6 : 0), sp.z + 0.5 + delay);
    agent.heading = Math.PI;
    g.stage.scene.add(agent.char.root);
    const per = PERSONALITY[def.personality];
    const manager = g.staff.hasRole('manager') ? 1.2 : 1;
    const c: Customer = {
      key: 'c' + ++seq,
      def,
      agent,
      state: 'entering',
      seat,
      order: null,
      patience: 0,
      patienceMax: 80 * per.patience * manager * (def.special ? 1.6 : 1),
      timer: 0,
      actTimer: 0,
      emote: null,
      emoteTimer: 0,
      tries: 0,
      partner: null,
      served: null,
      satisfaction: 0,
      coins: 0,
      isSpecial: !!def.special,
    };
    this.reserved.add(seat.key);
    this.list.push(c);
    // ~20% browse the decor before sitting
    const look = [...g.map.lookSpots, ...g.map.readSpots];
    if (!def.special && look.length && Math.random() < 0.2) {
      c.state = 'browsing';
      const spot = pick(look);
      if (!agent.walkTo(g.map, spot, () => {
        c.timer = rand(2.5, 4);
        agent.char.setAnim('look');
        this.emote(c, 'star', 1.6);
      })) this.goToSeat(c);
    } else this.goToSeat(c);
    return c;
  }

  private goToSeat(c: Customer) {
    c.state = 'entering';
    const s = c.seat!;
    const ok = c.agent.walkTo(this.game.map, { x: s.x, z: s.z }, () => this.sitDown(c));
    if (!ok) this.leave(c, false);
  }

  private sitDown(c: Customer) {
    const s = c.seat!;
    c.agent.pos.set(s.x + 0.5 - s.fx * 0.05, 0, s.z + 0.5 - s.fz * 0.05);
    c.agent.face(s.fx, s.fz, true);
    c.agent.char.seated = true;
    c.agent.char.setAnim('sit');
    c.state = 'thinking';
    c.timer = rand(1.5, 3);
  }

  private chooseOrder(c: Customer): string {
    const unlocked = this.unlockedMenu();
    if (c.def.special) return c.def.special.request;
    const fav = MENU_BY_ID[c.def.favorite];
    if (fav && fav.unlockLevel <= this.game.state.playerLevel && Math.random() < 0.5) return fav.id;
    return pick(unlocked).id;
  }

  private updateOne(c: Customer, dt: number) {
    const g = this.game;
    c.agent.update(dt);
    if (c.emoteTimer > 0) {
      c.emoteTimer -= dt;
      if (c.emoteTimer <= 0) c.emote = null;
    }
    switch (c.state) {
      case 'browsing':
        if (!c.agent.path.length) {
          c.timer -= dt;
          if (c.timer <= 0) this.goToSeat(c);
        }
        break;
      case 'thinking':
        c.timer -= dt;
        if (c.timer <= 0) {
          c.order = this.chooseOrder(c);
          c.state = 'waiting';
          c.patience = c.patienceMax;
          audio.play('pop');
          g.onOrderPlaced(c);
        }
        break;
      case 'waiting': {
        const slow = g.minigameOpen ? 0.5 : 1; // softer while the player is busy crafting
        c.patience -= dt * slow;
        c.actTimer -= dt;
        if (c.actTimer <= 0) {
          c.actTimer = rand(4, 8);
          const pr = c.patience / c.patienceMax;
          if (pr < 0.3) this.emote(c, 'sweat', 2);
          else if (c.partner && c.partner.state !== 'gone') {
            c.agent.char.setAnim('chat');
            this.emote(c, 'chat', 2);
          } else c.agent.char.setAnim(pick(['sit', 'look', 'phone'] as const));
        }
        if (c.patience <= 0) {
          this.emote(c, 'angry', 2.5);
          c.agent.char.setExpression('sad');
          g.onCustomerLost(c);
          this.leave(c, false);
        }
        break;
      }
      case 'eating': {
        c.timer -= dt;
        c.actTimer -= dt;
        if (c.actTimer <= 0) {
          c.actTimer = rand(3, 5);
          const per = PERSONALITY[c.def.personality];
          const kind = MENU_BY_ID[c.order!]?.kind;
          const acts = [kind === 'coffee' ? 'drink' : 'eat', ...per.acts];
          if (c.partner && c.partner.state === 'eating') acts.push('chat', 'chat');
          const nearBook = g.map.readSpots.some((r) => Math.abs(r.x - c.seat!.x) + Math.abs(r.z - c.seat!.z) <= 3);
          if (nearBook) acts.push('read');
          const a = pick(acts) as any;
          c.agent.char.setAnim(a === 'look' ? 'look' : a);
          if (a === 'chat') this.emote(c, 'chat', 2);
          if (a === 'photo') {
            this.emote(c, 'flash', 1.2);
            g.onCustomerPhoto(c);
          }
          if (a === 'read') this.emote(c, 'book', 1.5);
          if (a === 'eat' || a === 'drink') if (Math.random() < 0.4) this.emote(c, 'note', 1.5);
        }
        if (c.timer <= 0) this.pay(c);
        break;
      }
      case 'leaving':
        if (!c.agent.path.length) c.state = 'gone';
        break;
    }
  }

  emote(c: Customer, e: Emote, t: number) {
    c.emote = e;
    c.emoteTimer = t;
  }

  /** Serve an item. Returns satisfaction (0..100) or -1 if not accepted. */
  serve(c: Customer, menuId: string, quality: number, by: 'player' | 'staff'): number {
    if (c.state !== 'waiting' || c.order !== menuId) return -1;
    const g = this.game;
    const per = PERSONALITY[c.def.personality];
    const waitFrac = clamp(c.patience / c.patienceMax, 0, 1);
    const ambBonus = Math.min(10, g.map.ambiance / 6);
    let sat = quality * 0.6 + (40 + waitFrac * 60) * 0.3 + (menuId === c.def.favorite ? 8 : 0) + c.seat!.satisfaction + ambBonus;
    sat = clamp(Math.round(sat), 5, 100);
    c.served = { quality, by };
    c.satisfaction = sat;
    c.state = 'eating';
    c.timer = rand(11, 16) * per.stay * c.seat!.stay;
    c.actTimer = 1.4;
    c.agent.char.setExpression(sat >= 70 ? 'happy' : 'normal');
    c.agent.char.setAnim(sat >= 80 ? 'cheer' : 'sit');
    this.emote(c, sat >= 70 ? 'heart' : 'note', 2.2);
    // the served item appears on the table
    const food = g.makeFood(menuId);
    food.position.set(c.seat!.x + 0.5 + c.seat!.fx * 0.75, 0.53, c.seat!.z + 0.5 + c.seat!.fz * 0.75);
    if (c.seat!.furnitureId === 'table_four') food.position.set(c.seat!.x + 0.5 + c.seat!.fx * 0.62, 0.53, c.seat!.z + 0.5);
    food.userData.customer = c.key;
    g.stage.scene.add(food);
    g.tableFood.set(c.key, food);
    if (c.def.special) {
      const sp = c.def.special;
      if (quality >= sp.minQuality) {
        g.state.flags['special_' + c.def.id] = true;
        g.progress.grant({ gems: sp.rewardGems, gold: sp.rewardGold });
        events.emit('toast', { text: `${c.def.name}: "${sp.thanks}"  +${sp.rewardGems}💎`, kind: 'good' });
        window.setTimeout(() => g.progress.addMemory(`특별 손님 ${c.def.name}`, sp.thanks, c.def.id), 600);
      } else {
        events.emit('toast', { text: `${c.def.name}: "조금 아쉬워요… 다음엔 더 맛있게 부탁해요!"`, kind: 'warn' });
      }
    }
    return sat;
  }

  private pay(c: Customer) {
    const g = this.game;
    const menu = MENU_BY_ID[c.order!];
    const per = PERSONALITY[c.def.personality];
    const tipRate = clamp(((c.satisfaction - 50) / 100) * 0.7 * per.tip, 0, 0.5) * (1 + c.seat!.tip + (g.staff.hasRole('manager') ? 0.1 : 0)) * (0.85 + g.state.reputation * 0.06);
    const price = menu.price;
    const tip = Math.round(price * tipRate);
    let dessert = 0;
    if (g.map.dessertChance > 0 && Math.random() < g.map.dessertChance) dessert = 20;
    g.onCustomerPaid(c, price, tip, dessert);
    // regular / affinity bookkeeping
    const rec = (g.state.customers[c.def.id] ??= { visits: 0, affinity: 0, lastVisit: '', regular: false, bestQuality: 0, served: 0 });
    rec.visits++;
    rec.served++;
    rec.lastVisit = todayKey();
    rec.bestQuality = Math.max(rec.bestQuality, c.served?.quality ?? 0);
    rec.affinity = clamp(rec.affinity + Math.round(c.satisfaction / 9), 0, 100);
    if (!rec.regular && rec.visits >= REGULAR_VISITS && rec.affinity >= REGULAR_AFFINITY && !c.def.special) {
      rec.regular = true;
      events.emit('toast', { text: `${c.def.name}이(가) 단골이 되었어요!`, kind: 'good' });
      const first = Object.values(g.state.customers).filter((r) => r.regular).length === 1;
      g.progress.addMemory(first ? `첫 단골, ${c.def.name}` : `단골 ${c.def.name}`, `${c.def.intro}. 이제 우리 카페의 단골이에요.`, c.def.id);
    }
    if (rec.visits === 1 && !g.state.flags['mem_firstcustomer']) g.progress.addMemory('첫 손님', `${c.def.name}이(가) 우리 카페의 첫 손님이 되었어요.`, c.def.id, 'firstcustomer');
    this.emote(c, c.satisfaction >= 70 ? 'heart' : 'note', 2);
    c.coins = price + tip + dessert;
    this.leave(c, true);
  }

  leave(c: Customer, _happy: boolean) {
    const g = this.game;
    if (c.seat) this.reserved.delete(c.seat.key);
    const food = g.tableFood.get(c.key);
    if (food) {
      g.stage.scene.remove(food);
      g.tableFood.delete(c.key);
    }
    c.state = 'leaving';
    c.agent.char.setAnim('idle');
    const sp: Cell = g.map.spawn;
    if (!c.agent.walkTo(g.map, { x: sp.x, z: sp.z })) {
      c.state = 'gone';
    }
  }

  /** At settlement time: customers still inside leave without paying. */
  sendEveryoneHome() {
    for (const c of this.list) if (c.state !== 'leaving' && c.state !== 'gone') this.leave(c, false);
  }

  nearestWaitingWithOrder(pos: THREE.Vector3, menuIds: string[], range: number): Customer | null {
    let best: Customer | null = null;
    let bd = range;
    for (const c of this.list) {
      if (c.state !== 'waiting' || !c.order || !menuIds.includes(c.order)) continue;
      const d = c.agent.pos.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** Cell next to a customer's seat that a given walker can stand on. */
  serveCell(c: Customer, who: 'player' | 'staff'): Cell | null {
    const g = this.game;
    const s = c.seat!;
    // side cells first, then behind the chair (the front is the table)
    const cand = [
      { x: s.x - s.fz, z: s.z + s.fx },
      { x: s.x + s.fz, z: s.z - s.fx },
      { x: s.x - s.fx, z: s.z - s.fz },
    ];
    if (Math.random() < 0.5) [cand[0], cand[1]] = [cand[1], cand[0]];
    for (const c2 of cand) if (g.map.walkable(c2.x, c2.z, who) && g.map.canStep(c2.x, c2.z, s.x, s.z)) return c2;
    return null;
  }

  byKey(key: string) {
    return this.list.find((c) => c.key === key) ?? null;
  }

  static defById(id: string) {
    return CUSTOMER_BY_ID[id];
  }
}
