import * as THREE from 'three';
import type { Game } from '../game/Game';
import { ICON, MENU_ICONS, EMOTE_SVG, stars } from './icons';
import { $, el, bindActs } from './dom';
import { fmt, clamp } from '../core/util';
import { events } from '../core/events';
import { audio } from '../core/audio';
import { playerExpReq, cafeExpReq } from '../data/progression';
import { MENU_BY_ID, gradeOf } from '../data/menu';
import { SPECIES_BY_ID } from '../data/species';

export type Tab = 'cafe' | 'decor' | 'shop' | 'quest' | 'album';

/** Always-on game HUD + touch input. Panels live in panels.ts. */
export class Hud {
  root: HTMLElement;
  private bubbles = new Map<string, HTMLElement>();
  private bubbleLayer: HTMLElement;
  private floatLayer: HTMLElement;
  private joy: HTMLElement;
  private knob: HTMLElement;
  onTab: (t: Tab) => void = () => {};
  onSide: (id: string) => void = () => {};
  onPause: () => void = () => {};
  private lastHands = '';
  private keys = new Set<string>();

  constructor(private game: Game, parent: HTMLElement) {
    this.root = el(`<div class="hud">
      <div class="topbar">
        <button class="chip profile" data-act="side" data-id="character" aria-label="캐릭터">
          <span class="avatar"></span>
          <span class="col"><b class="p-lv">Lv.1</b><span class="bar"><i class="p-exp"></i></span></span>
        </button>
        <button class="chip cafe-chip" data-act="levelinfo" aria-label="카페 정보">
          <span class="col"><b class="c-lv">카페 Lv.1</b><span class="rep"></span></span>
        </button>
        <div class="spacer"></div>
        <div class="chip money"><i class="ico">${ICON.coin}</i><b class="gold">0</b></div>
        <div class="chip money"><i class="ico">${ICON.gem}</i><b class="gems">0</b></div>
      </div>
      <div class="daybar">
        <div class="clock"><span class="dot"></span><b class="clock-t">준비 중</b><span class="bar"><i class="day-p"></i></span></div>
        <button class="btn small ghost close-day hidden" data-act="closeday">영업 종료</button>
        <button class="icon-btn round pause-btn" data-act="pause" aria-label="일시정지">${ICON.pause}</button>
      </div>
      <div class="tut hidden"></div>
      <div class="side">
        <button class="side-btn" data-act="side" data-id="attendance"><i class="ico">${ICON.calendar}</i><span>출석</span><em class="badge att-badge hidden">!</em></button>
        <button class="side-btn" data-act="side" data-id="character"><i class="ico">${ICON.person}</i><span>캐릭터</span></button>
        <button class="side-btn" data-act="side" data-id="staff"><i class="ico">${ICON.staff}</i><span>직원</span></button>
        <button class="side-btn" data-act="side" data-id="settings"><i class="ico">${ICON.gear}</i><span>설정</span></button>
      </div>
      <div class="hands"></div>
      <button class="ctx-btn hidden" data-act="ctx"><i class="ico"></i><span></span></button>
      <button class="btn primary open-btn" data-act="openday"><i class="ico">${ICON.cafe}</i>영업 시작</button>
      <nav class="nav">
        <button data-act="tab" data-tab="cafe" class="on"><i class="ico">${ICON.cafe}</i><span>카페</span></button>
        <button data-act="tab" data-tab="decor"><i class="ico">${ICON.decor}</i><span>꾸미기</span></button>
        <button data-act="tab" data-tab="shop"><i class="ico">${ICON.shop}</i><span>상점</span></button>
        <button data-act="tab" data-tab="quest"><i class="ico">${ICON.quest}</i><span>퀘스트</span><em class="badge q-badge hidden">0</em></button>
        <button data-act="tab" data-tab="album"><i class="ico">${ICON.album}</i><span>앨범</span></button>
      </nav>
    </div>`);
    parent.appendChild(this.root);
    this.bubbleLayer = el('<div class="bubbles"></div>');
    this.floatLayer = el('<div class="floats"></div>');
    parent.insertBefore(this.bubbleLayer, this.root);
    parent.insertBefore(this.floatLayer, this.root);
    this.joy = el('<div class="joy hidden"><div class="knob"></div></div>');
    this.knob = $('.knob', this.joy);
    parent.appendChild(this.joy);

    bindActs(this.root, {
      tab: (b) => this.onTab(b.dataset.tab as Tab),
      side: (b) => this.onSide(b.dataset.id!),
      pause: () => this.onPause(),
      levelinfo: () => this.onSide('levelinfo'),
      openday: () => this.game.startDay(),
      closeday: () => this.game.closeEarly(),
      ctx: () => this.game.doContext(),
      drop: async (b) => {
        const i = Number(b.dataset.i);
        const h = this.game.player.hands[i];
        if (!h) return;
        if (await this.game.hooks.confirm(`${MENU_BY_ID[h.menuId].name}을(를) 버릴까요?`, '버리기')) this.game.dropHeld(i);
      },
    });

    events.on('currency', () => this.refreshTop());
    events.on('exp', () => this.refreshTop());
    events.on('levelUp', () => this.refreshTop());
    events.on('questsChanged', () => this.refreshBadges());
    events.on('dayState', () => this.refreshDay());
    events.on('hands', () => this.refreshHands());
    events.on('stateReplaced', () => {
      this.refreshTop();
      this.refreshBadges();
      this.refreshDay();
      this.refreshHands();
    });
    this.bindInput();
    this.refreshTop();
    this.refreshBadges();
    this.refreshDay();
  }

  setTab(t: Tab) {
    this.root.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === t));
  }

  setEditMode(on: boolean) {
    this.root.classList.toggle('editing', on);
  }

  refreshTop() {
    const s = this.game.state;
    $('.p-lv', this.root).textContent = `Lv.${s.playerLevel}`;
    ($('.p-exp', this.root) as HTMLElement).style.width = `${clamp((s.playerExp / playerExpReq(s.playerLevel)) * 100, 0, 100)}%`;
    $('.c-lv', this.root).textContent = `카페 Lv.${s.cafeLevel}`;
    $('.rep', this.root).innerHTML = `${stars(Math.round(s.reputation), 5)}<small>${s.reputation.toFixed(1)}</small>`;
    $('.gold', this.root).textContent = fmt(s.gold);
    $('.gems', this.root).textContent = fmt(s.gems);
    const av = $('.avatar', this.root);
    const sp = SPECIES_BY_ID[s.outfit.species];
    av.textContent = sp?.name.slice(0, 1) ?? '';
    av.style.background = '#' + (sp?.body ?? 0xc89a6a).toString(16).padStart(6, '0');
    void cafeExpReq;
  }

  refreshBadges() {
    const n = this.game.progress.claimableCount();
    const b = $('.q-badge', this.root);
    b.textContent = String(n);
    b.classList.toggle('hidden', n === 0);
    $('.att-badge', this.root).classList.toggle('hidden', !this.game.progress.attendanceAvailable());
  }

  refreshDay() {
    const open = this.game.day.open;
    this.root.classList.toggle('day-open', open);
    $('.close-day', this.root).classList.toggle('hidden', !open);
    this.refreshBadges();
  }

  refreshHands() {
    const hands = this.game.player.hands;
    const key = hands.map((h) => h.menuId + h.quality).join();
    if (key === this.lastHands) return;
    this.lastHands = key;
    const wrap = $('.hands', this.root);
    wrap.innerHTML = hands
      .map((h, i) => {
        const g = gradeOf(h.quality);
        return `<button class="hand-item ${g.cls}" data-act="drop" data-i="${i}" aria-label="${MENU_BY_ID[h.menuId].name}"><i class="ico">${MENU_ICONS[h.menuId]}</i><span class="mini-stars">${stars(g.stars)}</span></button>`;
      })
      .join('');
    wrap.classList.toggle('hidden', !hands.length);
  }

  // ------------------------------------------------------------- per-frame
  update() {
    const g = this.game;
    const d = g.day;
    $('.clock-t', this.root).textContent = d.closing ? '마감 중' : g.clockText();
    ($('.day-p', this.root) as HTMLElement).style.width = d.open ? `${clamp((d.elapsed / d.length) * 100, 0, 100)}%` : '0%';
    // context action
    const btn = $('.ctx-btn', this.root);
    const c = g.context;
    if (c && !g.edit.active) {
      btn.classList.remove('hidden');
      btn.dataset.kind = c.kind;
      const label = $('span', btn);
      if (label.textContent !== c.label) {
        label.textContent = c.label;
        $('.ico', btn).innerHTML = c.kind === 'serve' ? ICON.serve : c.kind === 'pickup' ? ICON.hand : ICON.craft;
      }
    } else btn.classList.add('hidden');
    this.updateTutorial();
    this.updateBubbles();
    this.updateKeys();
  }

  private updateTutorial() {
    const g = this.game;
    const t = $('.tut', this.root);
    let msg = '';
    if (!g.state.flags['tut_done'] && !g.edit.active) {
      if (!g.day.open) msg = '아래 「영업 시작」을 눌러 카페를 열어요';
      else if (!g.customers.waiting.length && !g.player.hands.length) msg = '손님이 자리에 앉으면 주문 말풍선이 떠요';
      else if (!g.player.hands.length) {
        const kind = MENU_BY_ID[g.customers.waiting[0]?.order ?? 'americano']?.kind;
        msg = kind === 'bread' ? '오븐(빨간 화덕)을 탭해서 주문한 빵을 만들어요' : '에스프레소 머신(빨간 기계)을 탭해서 커피를 만들어요';
      } else msg = '주문한 손님을 탭하면 걸어가서 서빙해요';
    }
    t.classList.toggle('hidden', !msg);
    if (t.textContent !== msg) t.textContent = msg;
  }

  private updateBubbles() {
    const g = this.game;
    const seen = new Set<string>();
    const v = new THREE.Vector3();
    for (const c of g.customers.list) {
      if (c.state === 'gone') continue;
      const showOrder = c.state === 'waiting' && c.order;
      if (!showOrder && !c.emote) continue;
      seen.add(c.key);
      let b = this.bubbles.get(c.key);
      if (!b) {
        b = el('<div class="bubble"><div class="order"><i class="ico"></i><span class="ring"></span></div><div class="emote"></div></div>');
        const key = c.key;
        b.addEventListener('click', () => {
          audio.unlock();
          g.tapCustomerKey(key);
        });
        this.bubbleLayer.appendChild(b);
        this.bubbles.set(c.key, b);
      }
      v.copy(c.agent.pos);
      v.y = c.agent.char.seated ? 1.35 : 1.25;
      const p = g.stage.project(v);
      // keep off-screen orders visible at the screen edge
      const m = 40, top = 150, bottom = g.stage.height - 110;
      const cx = clamp(p.x, m, g.stage.width - m), cy = clamp(p.y, top, bottom);
      const edge = cx !== p.x || cy !== p.y;
      b.classList.toggle('edge', edge && !!showOrder);
      if (edge && !showOrder) {
        b.style.transform = 'translate(-999px,-999px)';
      } else b.style.transform = `translate(${cx}px, ${cy}px)`;
      const order = $('.order', b);
      order.classList.toggle('hidden', !showOrder);
      if (showOrder) {
        const ic = $('.ico', order);
        if (ic.dataset.m !== c.order) {
          ic.dataset.m = c.order!;
          ic.innerHTML = MENU_ICONS[c.order!];
        }
        const pr = clamp(c.patience / c.patienceMax, 0, 1);
        const col = pr > 0.5 ? '#8a9a5b' : pr > 0.25 ? '#e9b04a' : '#e8796b';
        ($('.ring', order) as HTMLElement).style.background = `conic-gradient(${col} ${pr * 360}deg, rgba(0,0,0,0.08) 0)`;
        order.classList.toggle('special', c.isSpecial);
        order.classList.toggle('hurry', pr < 0.25);
        const has = g.player.hands.some((h) => h.menuId === c.order);
        order.classList.toggle('ready', has);
      }
      const em = $('.emote', b);
      if (c.emote) {
        if (em.dataset.e !== c.emote) {
          em.dataset.e = c.emote;
          em.innerHTML = EMOTE_SVG[c.emote] ?? '';
          em.classList.remove('pop');
          void em.offsetWidth;
          em.classList.add('pop');
        }
        em.classList.remove('hidden');
      } else {
        em.classList.add('hidden');
        em.dataset.e = '';
      }
    }
    for (const [k, b] of this.bubbles) {
      if (!seen.has(k)) {
        b.parentNode?.removeChild(b);
        this.bubbles.delete(k);
      }
    }
  }

  float(pos: THREE.Vector3, text: string, cls = '') {
    const p = this.game.stage.project(pos);
    const f = el(`<div class="floater ${cls}"></div>`);
    f.innerHTML = cls === 'coin' ? `<i class="ico">${ICON.coin}</i>${text}` : text;
    f.style.left = `${p.x}px`;
    f.style.top = `${p.y}px`;
    this.floatLayer.appendChild(f);
    window.setTimeout(() => f.parentNode?.removeChild(f), 1400);
  }

  // ------------------------------------------------------------- input
  private bindInput() {
    const canvas = this.game.stage.canvas;
    const pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
    let mode: 'none' | 'joy' | 'pan' | 'drag' | 'pinch' = 'none';
    let pinchStart = 0;
    let zoomStart = 1;
    let moved = false;
    const JOY_R = 55;

    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        zoomStart = this.game.stage.zoom;
        mode = 'pinch';
        this.endJoy();
        return;
      }
      moved = false;
      mode = 'none';
      if (this.game.edit.active && this.game.edit.dragStart(e.clientX, e.clientY)) mode = 'drag';
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.game.stage.setZoom(zoomStart * (d / Math.max(1, pinchStart)));
        return;
      }
      const total = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (total > 12) moved = true;
      if (mode === 'drag') {
        this.game.edit.dragMove(e.clientX, e.clientY);
        return;
      }
      if (this.game.edit.active) {
        if (moved) {
          mode = 'pan';
          this.game.stage.pan(dx, dy);
        }
        return;
      }
      if (this.game.minigameOpen) return;
      if (moved && mode !== 'joy') {
        mode = 'joy';
        this.joy.classList.remove('hidden');
        this.joy.style.left = `${p.sx}px`;
        this.joy.style.top = `${p.sy}px`;
      }
      if (mode === 'joy') {
        let jx = e.clientX - p.sx, jy = e.clientY - p.sy;
        const len = Math.hypot(jx, jy);
        if (len > JOY_R) {
          jx = (jx / len) * JOY_R;
          jy = (jy / len) * JOY_R;
        }
        this.knob.style.transform = `translate(${jx}px, ${jy}px)`;
        this.game.player.input.set(jx / JOY_R, -jy / JOY_R);
      }
    });

    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (!p) return;
      if (mode === 'pinch') {
        if (pts.size === 0) mode = 'none';
        return;
      }
      if (mode === 'drag') this.game.edit.dragEnd();
      else if (mode === 'joy') this.endJoy();
      else if (!moved && performance.now() - p.t < 450) this.game.tap(e.clientX, e.clientY);
      mode = 'none';
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.game.stage.setZoom(this.game.stage.zoom * (e.deltaY > 0 ? 0.92 : 1.08));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
      if ((e.key === ' ' || e.key.toLowerCase() === 'e') && !this.game.minigameOpen) {
        e.preventDefault();
        this.game.doContext();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private updateKeys() {
    if (this.game.minigameOpen || this.game.edit.active) return;
    if (!this.joy.classList.contains('hidden')) return;
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    const len = Math.hypot(x, y) || 1;
    this.game.player.input.set(x / len, y / len);
  }

  private endJoy() {
    this.joy.classList.add('hidden');
    this.knob.style.transform = '';
    this.game.player.input.set(0, 0);
  }
}
