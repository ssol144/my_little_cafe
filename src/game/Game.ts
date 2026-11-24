import * as THREE from 'three';
import { Stage } from '../world/scene';
import { CafeEnvironment } from '../world/cafe';
import { CafeMap } from '../world/grid';
import { createFood, createFurniture } from '../world/props';
import { G, mat } from '../world/materials';
import { footprint, rotDims } from '../world/grid';
import { SaveManager } from '../core/save';
import { type GameState } from '../core/state';
import { events } from '../core/events';
import { audio, haptic, setVibration } from '../core/audio';
import { Progress } from './progress';
import { Player, HAND_CAPACITY } from './player';
import { CustomerManager, type Customer } from './customers';
import { StaffManager } from './staff';
import { EditController } from './edit';
import { CloudSync } from './cloud';
import { MinigameHost } from '../minigames/host';
import { MENU_BY_ID, masteryLevel, gradeOf, type StepId } from '../data/menu';
import { FURNITURE_BY_ID, THEME_BY_ID } from '../data/furniture';
import { EQUIPMENT_BY_ID } from '../data/outfits';

export interface DaySummary {
  number: number;
  sales: number;
  tips: number;
  desserts: number;
  served: number;
  lost: number;
  satSum: number;
  crafted: number;
  wages: number;
  cafeExp: number;
  repBefore: number;
  repAfter: number;
}

export interface UIHooks {
  openStation(id: 'oven' | 'espresso'): void;
  showSettlement(sum: DaySummary): void;
  customerInfo(c: Customer): void;
  float(pos: THREE.Vector3, text: string, cls?: string): void;
  confirm(msg: string, ok?: string): Promise<boolean>;
}

export type ContextAction =
  | { kind: 'serve'; label: string; customer: Customer }
  | { kind: 'craft'; label: string; station: 'oven' | 'espresso' }
  | { kind: 'pickup'; label: string }
  | null;

export class Game {
  stage: Stage;
  env = new CafeEnvironment();
  map!: CafeMap;
  state!: GameState;
  progress!: Progress;
  saver = new SaveManager();
  player!: Player;
  customers: CustomerManager;
  staff: StaffManager;
  edit: EditController;
  cloud: CloudSync;
  mg: MinigameHost;
  hooks!: UIHooks;
  furnitureGroup = new THREE.Group();
  furnitureMeshes = new Map<string, THREE.Group>();
  tableFood = new Map<string, THREE.Object3D>();
  marker: THREE.Mesh;
  ctxRing: THREE.Mesh;
  context: ContextAction = null;
  paused = false;
  fresh = false;
  day = this.newDay(1);
  private dirty = false;
  private saveTimer = 0;
  private last = 0;
  private baking = 0;
  fps = 60;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.stage = new Stage(canvas);
    this.stage.scene.add(this.env.group);
    this.stage.scene.add(this.furnitureGroup);
    this.customers = new CustomerManager(this);
    this.staff = new StaffManager(this);
    this.edit = new EditController(this);
    this.cloud = new CloudSync(this);
    this.mg = new MinigameHost(uiRoot);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24), new THREE.MeshBasicMaterial({ color: 0x8a9a5b, transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.02;
    this.marker.visible = false;
    this.stage.scene.add(this.marker);
    this.ctxRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.48, 32), new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ctxRing.rotation.x = -Math.PI / 2;
    this.ctxRing.position.y = 0.025;
    this.ctxRing.visible = false;
    this.stage.scene.add(this.ctxRing);
  }

  newDay(n: number) {
    return { open: false, closing: false, elapsed: 0, length: 360, number: n, summary: null as DaySummary | null };
  }

  get minigameOpen() {
    return this.mg.open;
  }

  async init() {
    const { state, fresh } = await this.saver.load();
    this.fresh = fresh;
    this.setState(state);
    events.on('levelUp', () => this.markDirty());
    events.on('currency', () => this.markDirty());
    events.on('questsChanged', () => this.markDirty());
    events.on('album', () => this.markDirty());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveNow().then(() => this.cloud.flush());
        audio.suspend();
        if (this.day.open) this.paused = true;
      } else audio.resume();
    });
    window.addEventListener('pagehide', () => this.saveNow().then(() => this.cloud.flush()));
    window.addEventListener('resize', () => this.stage.resize());
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.cloud.init();
  }

  setState(state: GameState) {
    this.state = state;
    this.progress = new Progress(state);
    this.progress.snapshot = () => this.stage.snapshot();
    this.progress.ensureDaily();
    audio.sfxOn = state.settings.sfx;
    audio.musicOn = state.settings.music;
    setVibration(state.settings.vibration);
    this.stage.setShadows(state.settings.shadows);
    if (this.player) this.stage.scene.remove(this.player.agent.char.root);
    this.player = new Player(state.outfit);
    this.stage.scene.add(this.player.agent.char.root);
    this.day = this.newDay(state.stats.daysCompleted + 1);
    this.customers.clear();
    this.staff.clearPickup();
    this.rebuildWorld();
    const st = this.map.kitchen.stations[1];
    this.player.agent.place(st.ax + 0.5, st.az + 1.5);
    this.player.agent.heading = 0;
    this.stage.follow(this.player.agent.pos, 0, true);
    events.emit('stateReplaced', undefined);
  }

  rebuildWorld() {
    const s = this.state;
    this.map = new CafeMap(s.expansion);
    const rejected = this.map.applyFurniture(s.placed);
    if (rejected.length) {
      // anything that no longer fits goes back to storage instead of being lost
      s.placed = s.placed.filter((p) => !rejected.includes(p));
      this.map.applyFurniture(s.placed);
    }
    this.env.build(this.map, THEME_BY_ID[s.theme] ?? THEME_BY_ID.wood);
    this.rebuildFurniture();
    this.staff.rebuild();
    this.stage.setBounds(0, this.map.cols, 0, this.map.D + this.map.T + 1);
    this.progress.updateReputation(this.map.ambiance);
    // keep the player on a valid cell
    const c = this.player.agent.cell;
    if (!this.map.walkable(c.x, c.z, 'player')) {
      const st = this.map.kitchen.stations[1];
      this.player.agent.place(st.ax + 0.5, st.az + 0.5);
    }
  }

  rebuildFurniture() {
    this.furnitureGroup.clear();
    this.furnitureMeshes.clear();
    let lights = 0;
    for (const it of this.state.placed) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def) continue;
      const g = createFurniture(def.mesh, def.w, def.d);
      this.positionFurniture(g, def.id, it.x, it.z, it.rot);
      g.userData.uid = it.uid;
      g.traverse((o) => {
        if ((o as THREE.PointLight).isPointLight) {
          lights++;
          if (lights > 3) o.visible = false; // cap dynamic lights for mobile GPUs
        }
      });
      this.furnitureGroup.add(g);
      this.furnitureMeshes.set(it.uid, g);
    }
  }

  positionFurniture(g: THREE.Object3D, id: string, x: number, z: number, rot: number) {
    const def = FURNITURE_BY_ID[id];
    const rd = rotDims(def, rot);
    g.position.set(x + rd.w / 2, 0, z + rd.d / 2);
    g.rotation.y = (rot * Math.PI) / 2;
  }

  makeFood(menuId: string) {
    return createFood(menuId);
  }

  markDirty() {
    this.dirty = true;
  }
  async saveNow() {
    this.dirty = false;
    this.state.savedAt = Date.now();
    await this.saver.save(this.state);
    this.cloud.schedule();
  }

  // ------------------------------------------------------------------ loop
  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    if (!this.paused) this.update(dt);
    this.stage.render();
    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    const d = this.day;
    if (d.open) {
      d.elapsed += dt;
      if (!d.closing && d.elapsed >= d.length) {
        d.closing = true;
        events.emit('toast', { text: '마감 시간이에요! 남은 손님만 응대하면 영업이 끝나요.', kind: 'info' });
      }
      if (d.closing && this.customers.list.every((c) => c.state === 'leaving' || c.state === 'gone')) this.finishDay();
    }
    if (!this.minigameOpen) {
      if (!this.edit.active) this.player.update(dt, this.map);
    } else this.player.agent.char.update(dt, false);
    this.customers.update(dt);
    this.staff.update(dt);
    this.baking = Math.max(0, this.baking - dt);
    this.env.update(dt, this.baking > 0);
    if (!this.edit.active) this.stage.follow(this.player.agent.pos, dt);
    this.edit.update(dt);
    this.updateContext();
    this.marker.visible = this.player.agent.path.length > 0;
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(performance.now() / 150) * 0.3;
    this.saveTimer += dt;
    if (this.saveTimer > 12 && this.dirty) {
      this.saveTimer = 0;
      this.saveNow();
    }
  }

  // ------------------------------------------------------------------ day cycle
  startDay() {
    if (this.day.open || this.edit.active) return;
    this.day = this.newDay(this.state.stats.daysCompleted + 1);
    this.day.length = this.state.settings.dayMinutes * 60;
    this.day.open = true;
    this.day.summary = { number: this.day.number, sales: 0, tips: 0, desserts: 0, served: 0, lost: 0, satSum: 0, crafted: 0, wages: 0, cafeExp: 0, repBefore: this.state.reputation, repAfter: 0 };
    this.customers.spawnTimer = 2.5;
    this.paused = false;
    audio.play('bell');
    events.emit('dayState', { open: true });
  }

  async closeEarly() {
    if (!this.day.open) return;
    const inside = this.customers.list.filter((c) => c.state !== 'leaving' && c.state !== 'gone').length;
    if (inside > 0) {
      const ok = await this.hooks.confirm(`아직 손님 ${inside}명이 있어요. 지금 영업을 종료하면 계산하지 않고 떠나요. 종료할까요?`, '영업 종료');
      if (!ok) return;
      this.customers.sendEveryoneHome();
    }
    this.finishDay();
  }

  finishDay() {
    const d = this.day;
    if (!d.open || !d.summary) return;
    d.open = false;
    d.closing = false;
    this.customers.sendEveryoneHome();
    const s = this.state;
    const sum = d.summary;
    const wages = Math.min(s.gold, this.staff.dailyWages());
    if (wages) this.progress.spend('gold', wages);
    sum.wages = wages;
    const bonus = 30 + sum.served * 3;
    this.progress.addCafeExp(bonus);
    sum.cafeExp += bonus;
    s.stats.daysCompleted++;
    this.progress.count('day');
    this.progress.updateReputation(this.map.ambiance);
    sum.repAfter = s.reputation;
    if (s.stats.daysCompleted === 1) this.progress.addMemory('첫 영업 날', `첫 영업에서 손님 ${sum.served}명을 맞이했어요.`, undefined, 'firstday');
    const season = new Date().getMonth();
    if (season === 11) this.progress.addMemory('크리스마스 시즌 영업', '반짝이는 연말, 카페에도 따뜻한 손님들이 가득했어요.', undefined, 'xmas' + new Date().getFullYear());
    // leftovers are not kept overnight
    while (this.player.hands.length) this.player.removeHeld(0);
    this.staff.clearPickup();
    for (const f of this.tableFood.values()) this.stage.scene.remove(f);
    this.tableFood.clear();
    events.emit('hands', undefined);
    events.emit('dayState', { open: false });
    this.saveNow().then(() => this.cloud.flush());
    this.hooks.showSettlement(sum);
  }

  clockText() {
    const d = this.day;
    if (!d.open) return '준비 중';
    const mins = Math.min(600, Math.floor((d.elapsed / d.length) * 600));
    const h = 10 + Math.floor(mins / 60), m = Math.floor(mins % 60 / 10) * 10;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------------ crafting
  proSteps(): Set<StepId> {
    const set = new Set<StepId>();
    for (const id of this.state.owned.equipment) for (const st of EQUIPMENT_BY_ID[id]?.affects ?? []) set.add(st as StepId);
    return set;
  }

  async craft(menuId: string): Promise<boolean> {
    const m = MENU_BY_ID[menuId];
    const s = this.state;
    if (!m || m.unlockLevel > s.playerLevel) return false;
    if (this.player.hands.length >= HAND_CAPACITY) {
      events.emit('toast', { text: '트레이가 가득 찼어요. 먼저 서빙하거나 내려놓아요.', kind: 'warn' });
      audio.play('error');
      return false;
    }
    if (!this.progress.spend('gold', m.cost)) {
      events.emit('toast', { text: `재료비 ${m.cost}골드가 부족해요.`, kind: 'warn' });
      audio.play('error');
      return false;
    }
    if (m.kind === 'bread') this.baking = 999;
    this.player.agent.char.setAnim('work');
    const q = await this.mg.start(menuId, { proSteps: this.proSteps(), mastery: masteryLevel(s.mastery[menuId] ?? 0) });
    this.baking = 0;
    if (q === null) {
      this.progress.addGold(m.cost); // nothing was used: refund ingredients
      return false;
    }
    const mesh = this.makeFood(menuId);
    this.player.addHeld({ menuId, quality: q, mesh });
    const before = masteryLevel(s.mastery[menuId] ?? 0);
    s.mastery[menuId] = (s.mastery[menuId] ?? 0) + 1;
    const after = masteryLevel(s.mastery[menuId]);
    s.stats.itemsCrafted++;
    if (m.kind === 'bread') s.stats.breadCrafted++;
    else s.stats.coffeeCrafted++;
    this.progress.count(m.kind);
    if (this.day.summary) this.day.summary.crafted++;
    if (q >= 90) {
      s.stats.perfects++;
      this.progress.count('perfect');
      if (s.stats.perfects === 1) this.progress.addMemory('첫 PERFECT', `${m.name}을(를) 완벽하게 만들었어요!`, undefined, 'firstperfect');
    }
    this.progress.addPlayerExp(m.exp * (0.6 + q / 250));
    if (after > before) {
      events.emit('toast', { text: `${m.name} 숙련도 Lv.${after}!${after === 3 ? ' 첫 단계를 자동 처리할 수 있어요.' : ''}`, kind: 'good' });
      if (after === 4) this.progress.addMemory(`시그니처 메뉴: ${m.name}`, `${m.name}이(가) 우리 카페의 시그니처 메뉴가 되었어요.`, undefined, 'sig_' + menuId);
    }
    events.emit('crafted', { menuId, quality: q });
    events.emit('hands', undefined);
    this.markDirty();
    return true;
  }

  dropHeld(i: number) {
    const h = this.player.removeHeld(i);
    if (h) {
      events.emit('hands', undefined);
      audio.play('pop');
    }
  }

  // ------------------------------------------------------------------ serving
  serveCustomer(c: Customer, menuId: string, quality: number, by: 'player' | 'staff') {
    const sat = this.customers.serve(c, menuId, quality, by);
    if (sat < 0) return false;
    const s = this.state;
    s.stats.customersServed++;
    this.progress.count('serve');
    this.progress.recordSatisfaction(sat);
    if (by === 'player') this.progress.addPlayerExp(3);
    const exp = 5 + Math.round(sat / 10);
    this.progress.addCafeExp(exp);
    if (this.day.summary) {
      this.day.summary.served++;
      this.day.summary.satSum += sat;
      this.day.summary.cafeExp += exp;
    }
    audio.play('serve');
    haptic(20);
    const g = gradeOf(quality);
    this.hooks.float(c.agent.pos.clone().setY(1.5), sat >= 85 ? '최고예요!' : sat >= 65 ? '맛있어요!' : '고마워요', g.cls);
    if (!s.flags['tut_done'] && by === 'player') {
      s.flags['tut_done'] = true;
      events.emit('toast', { text: '첫 서빙 성공! 손님이 다 먹으면 계산해요.', kind: 'good' });
    }
    this.markDirty();
    return true;
  }

  playerServe(c: Customer) {
    const idx = this.bestHeldFor(c.order!);
    if (idx < 0) return false;
    const h = this.player.hands[idx];
    if (!this.serveCustomer(c, h.menuId, h.quality, 'player')) return false;
    this.player.removeHeld(idx);
    this.player.agent.face(c.agent.pos.x - this.player.agent.pos.x, c.agent.pos.z - this.player.agent.pos.z, true);
    events.emit('hands', undefined);
    return true;
  }

  private bestHeldFor(menuId: string) {
    let best = -1;
    this.player.hands.forEach((h, i) => {
      if (h.menuId === menuId && (best < 0 || h.quality > this.player.hands[best].quality)) best = i;
    });
    return best;
  }

  takePickup() {
    let took = 0;
    for (let i = 0; i < this.staff.pickup.length; i++) {
      if (this.player.hands.length >= HAND_CAPACITY) break;
      if (!this.staff.pickup[i]) continue;
      const h = this.staff.takeFromPickup(i)!;
      h.mesh.position.set(0, 0, 0);
      this.player.addHeld(h);
      took++;
    }
    if (took) {
      audio.play('pop');
      events.emit('hands', undefined);
    }
  }

  // ------------------------------------------------------------------ customer callbacks
  onOrderPlaced(_c: Customer) {
    events.emit('questsChanged', undefined);
  }
  onCustomerLost(c: Customer) {
    this.state.stats.customersLost++;
    this.progress.recordSatisfaction(10);
    if (this.day.summary) this.day.summary.lost++;
    events.emit('toast', { text: `${c.def.name}이(가) 기다리다 지쳐 돌아갔어요…`, kind: 'warn' });
  }
  onCustomerPaid(c: Customer, price: number, tip: number, dessert: number) {
    const total = price + tip + dessert;
    this.progress.addGold(total);
    this.state.stats.totalSales += total;
    if (this.day.summary) {
      this.day.summary.sales += price;
      this.day.summary.tips += tip;
      this.day.summary.desserts += dessert;
    }
    audio.play('coin');
    this.hooks.float(c.agent.pos.clone().setY(1.4), `+${total}`, 'coin');
    if (dessert) window.setTimeout(() => this.hooks.float(c.agent.pos.clone().setY(1.7), '디저트 추가 판매!', 'good'), 400);
  }
  onCustomerPhoto(c: Customer) {
    if (Math.random() < 0.25) {
      this.progress.addCafeExp(4);
      this.hooks.float(c.agent.pos.clone().setY(1.7), 'SNS 업로드 ♥', 'good');
      if (!this.state.flags['mem_firstphoto']) this.progress.addMemory('SNS에 올라간 우리 카페', `${c.def.name}이(가) 카페 사진을 찍어 올렸어요.`, c.def.id, 'firstphoto');
    }
  }

  // ------------------------------------------------------------------ interaction
  private updateContext() {
    const p = this.player.agent.pos;
    let ctx: ContextAction = null;
    let ringPos: THREE.Vector3 | null = null;
    if (!this.edit.active && !this.minigameOpen) {
      const held = this.player.hands.map((h) => h.menuId);
      const c = held.length ? this.customers.nearestWaitingWithOrder(p, held, 1.75) : null;
      if (c) {
        ctx = { kind: 'serve', label: '서빙', customer: c };
        ringPos = c.agent.pos;
      } else {
        for (const id of ['oven', 'espresso'] as const) {
          const st = this.env.stations[id];
          if (st && st.access.distanceTo(p) < 0.85) {
            ctx = { kind: 'craft', label: id === 'oven' ? '빵 굽기' : '커피 만들기', station: id };
            ringPos = st.access;
          }
        }
        const pk = this.env.stations.pickup;
        if (!ctx && pk && pk.access.distanceTo(p) < 0.95 && this.staff.pickup.some(Boolean) && this.player.hands.length < HAND_CAPACITY) {
          ctx = { kind: 'pickup', label: '픽업' };
          ringPos = pk.access;
        }
      }
    }
    this.context = ctx;
    this.ctxRing.visible = !!ringPos;
    if (ringPos) {
      this.ctxRing.position.set(ringPos.x, 0.025, ringPos.z);
      const s = 1 + Math.sin(performance.now() / 180) * 0.08;
      this.ctxRing.scale.set(s, s, s);
    }
  }

  doContext() {
    const c = this.context;
    if (!c) return;
    audio.unlock();
    if (c.kind === 'serve') this.playerServe(c.customer);
    else if (c.kind === 'craft') {
      this.faceStation(c.station);
      this.hooks.openStation(c.station);
    } else if (c.kind === 'pickup') this.takePickup();
  }

  private faceStation(id: string) {
    const st = this.env.stations[id];
    if (!st) return;
    const gp = st.group.position;
    this.player.agent.face(gp.x - this.player.agent.pos.x, gp.z - this.player.agent.pos.z, true);
  }

  /** Tap in play mode: interact with what was tapped, or walk there. */
  tap(clientX: number, clientY: number) {
    audio.unlock();
    if (this.edit.active) {
      this.edit.tap(clientX, clientY);
      return;
    }
    // customers
    const roots = this.customers.list.filter((c) => c.state !== 'gone' && c.state !== 'leaving').map((c) => c.agent.char.root);
    const hitC = this.stage.raycast(clientX, clientY, roots)[0];
    if (hitC) {
      let o: THREE.Object3D | null = hitC.object;
      while (o && !roots.includes(o as THREE.Group)) o = o.parent;
      const c = this.customers.list.find((x) => x.agent.char.root === o);
      if (c) {
        this.tapCustomer(c);
        return;
      }
    }
    // stations
    const stIds = ['oven', 'espresso', 'pickup'] as const;
    const groups = stIds.map((id) => this.env.stations[id]?.group).filter(Boolean) as THREE.Group[];
    const hitS = this.stage.raycast(clientX, clientY, groups)[0];
    if (hitS) {
      let o: THREE.Object3D | null = hitS.object;
      while (o && !groups.includes(o as THREE.Group)) o = o.parent;
      const id = stIds.find((k) => this.env.stations[k]?.group === o);
      if (id) {
        const st = this.env.stations[id];
        const arrive = () => {
          this.faceStation(id);
          if (id === 'pickup') this.takePickup();
          else this.hooks.openStation(id);
        };
        if (st.access.distanceTo(this.player.agent.pos) < 0.85) arrive();
        else this.walkPlayer(Math.floor(st.access.x), Math.floor(st.access.z), arrive);
        return;
      }
    }
    const p = this.stage.screenToFloor(clientX, clientY);
    if (p) {
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (this.map.walkable(x, z, 'player')) this.walkPlayer(x, z);
    }
  }

  tapCustomerKey(key: string) {
    const c = this.customers.byKey(key);
    if (c) this.tapCustomer(c);
  }

  private tapCustomer(c: Customer) {
    if (c.state === 'waiting' && c.order && this.bestHeldFor(c.order) >= 0) {
      if (c.agent.pos.distanceTo(this.player.agent.pos) < 1.75) {
        this.playerServe(c);
        return;
      }
      const cell = this.customers.serveCell(c, 'player');
      if (cell) this.walkPlayer(cell.x, cell.z, () => {
        if (c.state === 'waiting') this.playerServe(c);
      });
      return;
    }
    this.hooks.customerInfo(c);
  }

  walkPlayer(x: number, z: number, onArrive?: () => void) {
    const ok = this.player.agent.walkTo(this.map, { x, z }, onArrive);
    if (ok) {
      this.marker.position.set(x + 0.5, 0.02, z + 0.5);
      audio.play('tap');
    }
    return ok;
  }

  // ------------------------------------------------------------------ misc helpers used by UI
  storedCount(id: string) {
    const placed = this.state.placed.filter((p) => p.id === id).length;
    return Math.max(0, (this.state.owned.furniture[id] ?? 0) - placed);
  }

  footprintMesh(id: string, x: number, z: number, rot: number, ok: boolean) {
    const def = FURNITURE_BY_ID[id];
    const g = new THREE.Group();
    for (const c of footprint(def, x, z, rot)) {
      const m = new THREE.Mesh(G.box(), mat(ok ? 0x8fd16a : 0xe8796b, { opacity: 0.45 }));
      m.scale.set(0.94, 0.02, 0.94);
      m.position.set(c.x + 0.5, 0.03, c.z + 0.5);
      g.add(m);
    }
    return g;
  }
}
