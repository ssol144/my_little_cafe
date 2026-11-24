import type { StepId } from '../data/menu';
import { audio, haptic } from '../core/audio';
import { clamp, lerp, pick } from '../core/util';

export const LW = 360; // logical canvas size
export const LH = 400;

export interface StepOptions {
  menuId: string;
  pro: boolean; // equipment upgrade owned for this step
}

export abstract class MiniStep {
  /** stable identifier (class names are minified in production builds) */
  abstract readonly kind: string;
  done = false;
  score = 0;
  t = 0;
  feedback: { text: string; cls: string; t: number } | null = null;
  constructor(public opt: StepOptions) {}
  abstract draw(g: CanvasRenderingContext2D): void;
  update(dt: number) {
    this.t += dt;
    if (this.feedback) this.feedback.t -= dt;
  }
  down(_x: number, _y: number) {}
  move(_x: number, _y: number) {}
  up(_x: number, _y: number) {}
  protected fb(text: string, cls: string) {
    this.feedback = { text, cls, t: 0.7 };
  }
  protected finish(score: number) {
    if (this.done) return;
    this.score = clamp(Math.round(score), 0, 100);
    this.done = true;
  }
}

// ---------------- drawing helpers ----------------
const C = {
  bg: '#fbf4e8',
  wood: '#c89a6a',
  woodDark: '#8a6446',
  dough: '#f3e3c6',
  doughShade: '#e6cfa8',
  golden: '#d9973e',
  burnt: '#4a2a14',
  coffee: '#4a2c1d',
  crema: '#c98b4e',
  milk: '#fbf6ec',
  olive: '#8a9a5b',
  red: '#d9574a',
  ink: '#5b4636',
};
function mixColor(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}
function board(g: CanvasRenderingContext2D) {
  g.fillStyle = C.bg;
  g.fillRect(0, 0, LW, LH);
  g.fillStyle = '#e7d3b5';
  g.beginPath();
  g.roundRect(20, 60, LW - 40, LH - 110, 28);
  g.fill();
  g.fillStyle = '#efdfc5';
  g.beginPath();
  g.roundRect(30, 70, LW - 60, LH - 130, 22);
  g.fill();
}
function dough(g: CanvasRenderingContext2D, x: number, y: number, r: number, squish = 0, color = C.dough) {
  g.save();
  g.translate(x, y);
  g.scale(1 + squish * 0.18, 1 - squish * 0.15);
  g.fillStyle = 'rgba(90,60,30,0.15)';
  g.beginPath();
  g.ellipse(0, r * 0.55, r * 1.05, r * 0.35, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.35, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20, color = C.ink, align: CanvasTextAlign = 'center') {
  g.fillStyle = color;
  g.font = `${size}px Jua, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}
function holdButton(g: CanvasRenderingContext2D, pressed: boolean, text: string) {
  const x = LW / 2, y = LH - 34;
  g.fillStyle = pressed ? '#6f7d48' : C.olive;
  g.beginPath();
  g.roundRect(x - 90, y - 22 + (pressed ? 3 : 0), 180, 44, 22);
  g.fill();
  label(g, text, x, y + (pressed ? 3 : 0), 20, '#fff');
}
function scoreHit(err: number, tol: number) {
  // err 0 -> 100, err tol -> 75, then falls off
  if (err <= tol) return 100 - (err / tol) * 25;
  return Math.max(0, 75 - ((err - tol) / tol) * 45);
}

// ---------------- KNEAD: rhythm taps ----------------
class Knead extends MiniStep {
  readonly kind = 'Knead';
  beats = 4;
  beat = 0;
  ringR = 180;
  gap = 0.5;
  scores: number[] = [];
  squish = 0;
  doughR = 62;
  speed = 120;
  update(dt: number) {
    super.update(dt);
    this.squish = Math.max(0, this.squish - dt * 4);
    if (this.done) return;
    if (this.gap > 0) {
      this.gap -= dt;
      return;
    }
    this.ringR -= this.speed * dt * (1 + this.beat * 0.12);
    if (this.ringR < this.doughR - 26) this.register(null);
  }
  private register(err: number | null) {
    const tol = this.opt.pro ? 13 : 9;
    let s = 0;
    if (err !== null) s = err <= tol ? 100 : err <= tol * 2.2 ? 78 : err <= tol * 3.5 ? 50 : 15;
    this.scores.push(s);
    if (s >= 95) { this.fb('PERFECT', 'perfect'); audio.play('perfect'); }
    else if (s >= 70) { this.fb('GREAT', 'great'); audio.play('good'); }
    else if (s >= 40) { this.fb('GOOD', 'good'); audio.play('tap'); }
    else { this.fb('MISS', 'miss'); audio.play('miss'); }
    this.squish = 1;
    haptic(12);
    this.beat++;
    this.ringR = 180;
    this.gap = 0.32;
    if (this.beat >= this.beats) this.finish(this.scores.reduce((a, b) => a + b, 0) / this.scores.length);
  }
  down() {
    if (this.done || this.gap > 0) return;
    this.register(Math.abs(this.ringR - this.doughR));
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    const cx = LW / 2, cy = 210;
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 14; i++) g.fillRect(60 + ((i * 53) % 240), 100 + ((i * 37) % 200), 3, 3); // flour
    dough(g, cx, cy, this.doughR, this.squish);
    g.strokeStyle = 'rgba(138,154,91,0.35)';
    g.lineWidth = 3;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.arc(cx, cy, this.doughR, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    if (!this.done && this.gap <= 0) {
      g.strokeStyle = C.olive;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, Math.max(4, this.ringR), 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < this.beats; i++) {
      g.fillStyle = i < this.beat ? C.olive : '#d9c7aa';
      g.beginPath();
      g.arc(LW / 2 - 36 + i * 24, 360, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// ---------------- SHAPE: swipe directions ----------------
type Dir = 'up' | 'down' | 'left' | 'right';
class Shape extends MiniStep {
  readonly kind = 'Shape';
  seq: Dir[] = [];
  idx = 0;
  mistakes = 0;
  start: { x: number; y: number } | null = null;
  shake = 0;
  constructor(opt: StepOptions) {
    super(opt);
    const dirs: Dir[] = ['up', 'down', 'left', 'right'];
    this.seq = opt.menuId === 'croissant' ? ['down', pick(dirs), 'down'] : [pick(dirs), pick(dirs), pick(dirs), pick(dirs)];
  }
  update(dt: number) {
    super.update(dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (!this.done && this.t > 9) this.end();
  }
  private end() {
    const timePen = Math.max(0, this.t - 3.5) * 6;
    this.finish(100 - this.mistakes * 22 - timePen - (this.seq.length - this.idx) * 30);
  }
  down(x: number, y: number) {
    this.start = { x, y };
  }
  up(x: number, y: number) {
    if (!this.start || this.done) return;
    const dx = x - this.start.x, dy = y - this.start.y;
    this.start = null;
    if (Math.hypot(dx, dy) < 30) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (d === this.seq[this.idx]) {
      this.idx++;
      audio.play('whoosh');
      haptic(10);
      this.fb('좋아요!', 'great');
      if (this.idx >= this.seq.length) this.end();
    } else {
      this.mistakes++;
      this.shake = 1;
      audio.play('miss');
      this.fb('반대 방향!', 'miss');
    }
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    const cx = LW / 2 + Math.sin(this.t * 60) * this.shake * 6, cy = 205;
    const p = this.idx / this.seq.length;
    // dough morphs from ball to target shape
    g.save();
    g.translate(cx, cy);
    if (this.opt.menuId === 'croissant') {
      // triangle rolling into a crescent
      g.fillStyle = C.dough;
      g.beginPath();
      if (p < 1) {
        const h = 130 * (1 - p * 0.6);
        g.moveTo(-70, -h / 2);
        g.lineTo(70, -h / 2);
        g.lineTo(0, h / 2 + 10);
        g.closePath();
        g.fill();
        g.strokeStyle = C.doughShade;
        g.lineWidth = 3;
        for (let i = 1; i <= this.idx; i++) {
          g.beginPath();
          g.moveTo(-60 + i * 8, -h / 2 + i * 14);
          g.lineTo(60 - i * 8, -h / 2 + i * 14);
          g.stroke();
        }
      } else {
        g.lineWidth = 46;
        g.lineCap = 'round';
        g.strokeStyle = C.dough;
        g.beginPath();
        g.arc(0, 40, 70, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
    } else {
      // log -> spiral roll
      g.fillStyle = C.dough;
      g.beginPath();
      g.roundRect(-90 + p * 40, -40 - p * 10, 180 - p * 80, 80 + p * 20, 40);
      g.fill();
      g.strokeStyle = '#b87436';
      g.lineWidth = 4;
      g.beginPath();
      for (let a = 0; a < Math.PI * 2 * (1 + p * 2); a += 0.2) {
        const r = 4 + a * 5;
        g.lineTo(Math.cos(a) * r * (0.6 + p * 0.4), Math.sin(a) * r * 0.6);
      }
      g.stroke();
    }
    g.restore();
    if (!this.done) {
      const d = this.seq[this.idx];
      const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[d];
      g.save();
      g.translate(LW / 2, 205);
      g.rotate(ang);
      const bob = Math.sin(this.t * 8) * 8;
      g.fillStyle = 'rgba(138,154,91,0.92)';
      g.beginPath();
      g.moveTo(40 + bob, -22);
      g.lineTo(90 + bob, 0);
      g.lineTo(40 + bob, 22);
      g.closePath();
      g.fill();
      g.fillRect(-60 + bob, -9, 104, 18);
      g.restore();
    }
    this.seq.forEach((d, i) => {
      const arrows: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };
      g.fillStyle = i < this.idx ? C.olive : i === this.idx ? '#fff' : '#e3d2b6';
      g.beginPath();
      g.roundRect(LW / 2 - this.seq.length * 22 + i * 44, 340, 38, 38, 10);
      g.fill();
      label(g, arrows[d], LW / 2 - this.seq.length * 22 + i * 44 + 19, 360, 22, i < this.idx ? '#fff' : C.ink);
    });
  }
}

// ---------------- BAKE: take it out at golden ----------------
class Bake extends MiniStep {
  readonly kind = 'Bake';
  d = 0;
  rate = 16;
  zone: [number, number];
  constructor(opt: StepOptions) {
    super(opt);
    this.zone = opt.pro ? [56, 84] : [61, 79];
  }
  update(dt: number) {
    super.update(dt);
    if (this.done) return;
    this.rate += dt * 5;
    this.d += this.rate * dt;
    if (this.d >= 100) {
      this.fb('탔어요…', 'miss');
      audio.play('miss');
      this.finish(5);
    }
  }
  down() {
    if (this.done) return;
    const [a, b] = this.zone;
    const mid = (a + b) / 2, half = (b - a) / 2;
    const s = scoreHit(Math.abs(this.d - mid), half);
    this.fb(s >= 95 ? 'PERFECT' : s >= 75 ? 'GREAT' : this.d < a ? '덜 익었어요' : '조금 탔어요', s >= 75 ? 'perfect' : 'good');
    audio.play(s >= 90 ? 'perfect' : s >= 70 ? 'good' : 'tap');
    haptic(18);
    this.finish(s);
  }
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = C.bg;
    g.fillRect(0, 0, LW, LH);
    // oven body
    g.fillStyle = '#a65a3c';
    g.beginPath();
    g.roundRect(40, 60, LW - 80, 250, 24);
    g.fill();
    g.fillStyle = '#3a3530';
    g.beginPath();
    g.roundRect(65, 90, LW - 130, 170, 16);
    g.fill();
    const glow = 0.35 + 0.25 * Math.sin(this.t * 10);
    const grd = g.createRadialGradient(LW / 2, 190, 10, LW / 2, 190, 140);
    grd.addColorStop(0, `rgba(255,170,80,${0.55 + glow * 0.3})`);
    grd.addColorStop(1, 'rgba(120,40,10,0.2)');
    g.fillStyle = grd;
    g.beginPath();
    g.roundRect(75, 100, LW - 150, 150, 12);
    g.fill();
    // bread colour by doneness
    const dd = this.d / 100;
    const col = dd < 0.7 ? mixColor(C.dough, C.golden, dd / 0.7) : mixColor(C.golden, C.burnt, (dd - 0.7) / 0.3);
    const rise = 1 + Math.min(1, dd * 1.5) * 0.2;
    if (this.opt.menuId === 'croissant') {
      g.save();
      g.translate(LW / 2, 200);
      g.scale(rise, rise);
      g.lineWidth = 36;
      g.lineCap = 'round';
      g.strokeStyle = col;
      g.beginPath();
      g.arc(0, 40, 60, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      g.restore();
    } else {
      g.fillStyle = '#f4ead6';
      g.fillRect(LW / 2 - 40, 200, 80, 34);
      dough(g, LW / 2, 196, 46 * rise, 0, col);
    }
    // gauge
    const gx = 50, gw = LW - 100, gy = 335;
    g.fillStyle = '#e3d2b6';
    g.beginPath();
    g.roundRect(gx, gy, gw, 20, 10);
    g.fill();
    g.fillStyle = 'rgba(217,151,62,0.9)';
    g.fillRect(gx + (this.zone[0] / 100) * gw, gy, ((this.zone[1] - this.zone[0]) / 100) * gw, 20);
    g.fillStyle = C.ink;
    g.fillRect(gx + (Math.min(100, this.d) / 100) * gw - 2, gy - 6, 4, 32);
    label(g, '탭해서 꺼내기!', LW / 2, 380, 18);
  }
}

// ---------------- TOPPING / CREAM: cover the surface ----------------
class Cover extends MiniStep {
  readonly kind = 'Cover';
  cells: boolean[] = new Array(144).fill(false);
  strokes: { x: number; y: number }[][] = [];
  drawing = false;
  cx = LW / 2;
  cy = 200;
  r = 105;
  brush: number;
  limit = 7;
  dots: { x: number; y: number; c: string }[] = [];
  constructor(opt: StepOptions, public cream: boolean) {
    super(opt);
    this.brush = opt.pro ? 30 : 23;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * this.r * 0.85;
      this.dots.push({ x: this.cx + Math.cos(a) * rr, y: this.cy + Math.sin(a) * rr * 0.9, c: opt.menuId === 'muffin' ? '#4a4e8c' : '#8a4f22' });
    }
  }
  private coverage() {
    let inside = 0, hit = 0;
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++) {
        const x = this.cx - this.r + (i + 0.5) * ((this.r * 2) / 12), y = this.cy - this.r + (j + 0.5) * ((this.r * 2) / 12);
        if (Math.hypot(x - this.cx, y - this.cy) > this.r * 0.92) continue;
        inside++;
        if (this.cells[i * 12 + j]) hit++;
      }
    return hit / inside;
  }
  update(dt: number) {
    super.update(dt);
    if (this.done) return;
    const cov = this.coverage();
    if (cov >= 0.93 || this.t >= this.limit) this.finish(Math.min(100, (cov / 0.9) * 100) - (this.t > 5 ? (this.t - 5) * 3 : 0));
    if (this.done) {
      audio.play(this.score >= 90 ? 'perfect' : 'good');
      this.fb(this.score >= 90 ? 'PERFECT' : this.score >= 70 ? 'GREAT' : 'GOOD', 'perfect');
    }
  }
  private paint(x: number, y: number) {
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++) {
        const cx = this.cx - this.r + (i + 0.5) * ((this.r * 2) / 12), cy = this.cy - this.r + (j + 0.5) * ((this.r * 2) / 12);
        if (Math.hypot(cx - x, cy - y) < this.brush + 6) this.cells[i * 12 + j] = true;
      }
  }
  down(x: number, y: number) {
    if (this.done) return;
    this.drawing = true;
    this.strokes.push([{ x, y }]);
    this.paint(x, y);
  }
  move(x: number, y: number) {
    if (!this.drawing || this.done) return;
    this.strokes[this.strokes.length - 1].push({ x, y });
    this.paint(x, y);
    if (Math.random() < 0.15) audio.play('tap');
  }
  up() {
    this.drawing = false;
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    g.save();
    if (this.cream) {
      g.fillStyle = '#f4f2ee';
      g.beginPath();
      g.arc(this.cx, this.cy, this.r + 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.coffee;
      g.beginPath();
      g.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = 'rgba(90,60,30,0.15)';
      g.beginPath();
      g.ellipse(this.cx, this.cy + 14, this.r + 6, this.r * 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = this.opt.menuId === 'cinnamon' ? '#b87436' : '#c98b4e';
      g.beginPath();
      g.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
      g.fill();
      if (this.opt.menuId === 'cinnamon') {
        g.strokeStyle = '#8a4f22';
        g.lineWidth = 6;
        g.beginPath();
        for (let a = 0; a < Math.PI * 7; a += 0.15) g.lineTo(this.cx + Math.cos(a) * a * 4.6, this.cy + Math.sin(a) * a * 4.6);
        g.stroke();
      }
      for (const d of this.dots) {
        g.fillStyle = d.c;
        g.beginPath();
        g.arc(d.x, d.y, 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.beginPath();
    g.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = this.cream ? '#fbf6ea' : 'rgba(253,248,238,0.95)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = this.brush * 2;
    for (const s of this.strokes) {
      g.beginPath();
      s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y);
      g.stroke();
    }
    g.restore();
    const cov = this.coverage();
    g.fillStyle = '#e3d2b6';
    g.beginPath();
    g.roundRect(60, 345, LW - 120, 14, 7);
    g.fill();
    g.fillStyle = C.olive;
    g.beginPath();
    g.roundRect(60, 345, (LW - 120) * Math.min(1, cov / 0.93), 14, 7);
    g.fill();
    label(g, `${Math.max(0, Math.ceil(this.limit - this.t))}초`, LW / 2, 378, 16);
  }
}

// ---------------- GRIND: circular drag ----------------
class Grind extends MiniStep {
  readonly kind = 'Grind';
  angle = 0;
  total = 0;
  need: number;
  last: number | null = null;
  cx = LW / 2;
  cy = 200;
  constructor(opt: StepOptions) {
    super(opt);
    this.need = Math.PI * 2 * (opt.pro ? 2 : 3);
  }
  update(dt: number) {
    super.update(dt);
    if (!this.done && this.t > 12) this.finish(30 * (this.total / this.need));
  }
  down(x: number, y: number) {
    this.last = Math.atan2(y - this.cy, x - this.cx);
  }
  move(x: number, y: number) {
    if (this.last === null || this.done) return;
    if (Math.hypot(x - this.cx, y - this.cy) < 25) return;
    const a = Math.atan2(y - this.cy, x - this.cx);
    let d = a - this.last;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.last = a;
    this.angle += d;
    this.total += Math.abs(d);
    if (Math.random() < Math.abs(d) * 2) audio.play('tap');
    if (this.total >= this.need) {
      const s = this.t <= 3.2 ? 100 : Math.max(45, 100 - (this.t - 3.2) * 9);
      this.fb(s >= 95 ? 'PERFECT' : s >= 75 ? 'GREAT' : 'GOOD', 'perfect');
      audio.play(s >= 90 ? 'perfect' : 'good');
      haptic(20);
      this.finish(s);
    }
  }
  up() {
    this.last = null;
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    const p = Math.min(1, this.total / this.need);
    // grounds bowl
    g.fillStyle = '#d9c7aa';
    g.beginPath();
    g.ellipse(this.cx, 330, 80, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a3624';
    g.beginPath();
    g.ellipse(this.cx, 326, 70 * p, 14 * p + 1, 0, 0, Math.PI * 2);
    g.fill();
    // grinder
    g.fillStyle = '#8a6446';
    g.beginPath();
    g.arc(this.cx, this.cy, 95, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e6d6bc';
    g.beginPath();
    g.arc(this.cx, this.cy, 78, 0, Math.PI * 2);
    g.fill();
    // beans
    const beans = Math.round(16 * (1 - p));
    for (let i = 0; i < beans; i++) {
      const a = i * 2.4 + this.angle * 0.3, r = 20 + (i % 4) * 13;
      g.save();
      g.translate(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r);
      g.rotate(a);
      g.fillStyle = C.coffee;
      g.beginPath();
      g.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2a170e';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(6, 0);
      g.stroke();
      g.restore();
    }
    // handle
    g.save();
    g.translate(this.cx, this.cy);
    g.rotate(this.angle);
    g.fillStyle = '#3a3530';
    g.fillRect(-4, -4, 110, 8);
    g.fillStyle = '#a65a3c';
    g.beginPath();
    g.arc(110, 0, 16, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = '#3a3530';
    g.beginPath();
    g.arc(this.cx, this.cy, 10, 0, Math.PI * 2);
    g.fill();
    // progress ring
    g.strokeStyle = C.olive;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(this.cx, this.cy, 104, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    g.stroke();
    if (this.t < 2.5 && p < 0.05) label(g, '↻ 빙글빙글', this.cx, 80, 18);
  }
}

// ---------------- EXTRACT / STEAM: hold & release ----------------
class Hold extends MiniStep {
  readonly kind = 'Hold';
  v = 0;
  pressed = false;
  started = false;
  zone: [number, number];
  constructor(opt: StepOptions, public mode: 'extract' | 'steam') {
    super(opt);
    const w = opt.pro ? 1.5 : 1;
    if (mode === 'extract') this.zone = [0.7 - 0.055 * w, 0.7 + 0.055 * w];
    else this.zone = [64 - 4 * w, 64 + 4 * w];
  }
  update(dt: number) {
    super.update(dt);
    if (this.done) return;
    if (this.pressed) {
      if (this.mode === 'extract') this.v += dt * (0.24 + this.v * 0.12);
      else this.v = Math.max(this.v, 20) + dt * (12 + (this.v - 20) * 0.22);
      if (Math.random() < dt * 6) audio.play(this.mode === 'extract' ? 'pour' : 'whoosh');
      const max = this.mode === 'extract' ? 1 : 82;
      if (this.v >= max) {
        this.fb(this.mode === 'extract' ? '넘쳤어요!' : '너무 뜨거워요!', 'miss');
        audio.play('miss');
        this.finish(8);
      }
    }
    if (!this.started && this.t > 15) this.finish(0);
  }
  down() {
    if (this.done || this.started) return;
    this.pressed = true;
    this.started = true;
    if (this.mode === 'steam') this.v = 20;
  }
  up() {
    if (!this.pressed || this.done) return;
    this.pressed = false;
    const [a, b] = this.zone;
    const s = scoreHit(Math.abs(this.v - (a + b) / 2), (b - a) / 2);
    this.fb(s >= 95 ? 'PERFECT' : s >= 75 ? 'GREAT' : this.v < a ? '조금 부족해요' : '조금 많아요', s >= 75 ? 'perfect' : 'good');
    audio.play(s >= 90 ? 'perfect' : s >= 70 ? 'good' : 'tap');
    haptic(18);
    this.finish(s);
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    if (this.mode === 'extract') {
      // machine head
      g.fillStyle = '#c8453c';
      g.beginPath();
      g.roundRect(90, 70, 180, 60, 14);
      g.fill();
      g.fillStyle = '#3a3530';
      g.fillRect(150, 128, 60, 18);
      // cup
      const cx = LW / 2, top = 190, h = 130, w = 120;
      g.fillStyle = '#fbf7ef';
      g.beginPath();
      g.moveTo(cx - w / 2, top);
      g.lineTo(cx + w / 2, top);
      g.lineTo(cx + w / 2 - 14, top + h);
      g.lineTo(cx - w / 2 + 14, top + h);
      g.closePath();
      g.fill();
      g.strokeStyle = '#fbf7ef';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(cx + w / 2 + 6, top + 50, 22, -1.2, 1.2);
      g.stroke();
      const lv = Math.min(1, this.v);
      const ly = top + h - lv * (h - 10);
      g.save();
      g.beginPath();
      g.moveTo(cx - w / 2, top);
      g.lineTo(cx + w / 2, top);
      g.lineTo(cx + w / 2 - 14, top + h);
      g.lineTo(cx - w / 2 + 14, top + h);
      g.closePath();
      g.clip();
      g.fillStyle = C.coffee;
      g.fillRect(cx - w, ly, w * 2, h);
      g.fillStyle = C.crema;
      g.fillRect(cx - w, ly, w * 2, 6);
      g.restore();
      if (this.pressed) {
        g.fillStyle = C.coffee;
        g.fillRect(cx - 4, 146, 8, ly - 146);
      }
      // target line
      const ty1 = top + h - this.zone[1] * (h - 10), ty0 = top + h - this.zone[0] * (h - 10);
      g.fillStyle = 'rgba(138,154,91,0.28)';
      g.fillRect(cx - w / 2 - 20, ty1, w + 40, ty0 - ty1);
      g.strokeStyle = C.olive;
      g.setLineDash([8, 6]);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - w / 2 - 20, (ty0 + ty1) / 2);
      g.lineTo(cx + w / 2 + 20, (ty0 + ty1) / 2);
      g.stroke();
      g.setLineDash([]);
    } else {
      // pitcher + foam
      const px = LW / 2 - 40, py = 120;
      g.fillStyle = '#d8dde0';
      g.beginPath();
      g.moveTo(px - 50, py);
      g.lineTo(px + 50, py);
      g.lineTo(px + 60, py + 190);
      g.lineTo(px - 60, py + 190);
      g.closePath();
      g.fill();
      const foam = Math.min(1, Math.max(0, (this.v - 20) / 50));
      g.fillStyle = C.milk;
      const my = py + 120 - foam * 70;
      g.fillRect(px - 54, my, 108, py + 186 - my);
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(px - 40 + i * 16, my, 10 + foam * 4, Math.PI, 0);
        g.fill();
      }
      if (this.pressed) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(px + Math.sin(this.t * 9 + i) * 20, my - 10 - ((this.t * 60 + i * 20) % 60), 6, 0, Math.PI * 2);
          g.fill();
        }
      }
      // thermometer arc
      const tx = LW / 2 + 95, ty = 210, R = 58;
      const toA = (deg: number) => Math.PI * 0.8 + ((deg - 20) / 62) * Math.PI * 1.4;
      g.lineWidth = 14;
      g.strokeStyle = '#e3d2b6';
      g.beginPath();
      g.arc(tx, ty, R, toA(20), toA(82));
      g.stroke();
      g.strokeStyle = C.olive;
      g.beginPath();
      g.arc(tx, ty, R, toA(this.zone[0]), toA(this.zone[1]));
      g.stroke();
      g.strokeStyle = C.red;
      g.beginPath();
      g.arc(tx, ty, R, toA(74), toA(82));
      g.stroke();
      const a = toA(Math.max(20, this.v || 20));
      g.strokeStyle = C.ink;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx + Math.cos(a) * (R - 6), ty + Math.sin(a) * (R - 6));
      g.stroke();
      label(g, `${Math.round(this.v || 20)}°C`, tx, ty + 30, 18);
    }
    holdButton(g, this.pressed, this.started && !this.pressed ? '완료' : '꾹 누르기');
  }
}

// ---------------- LATTE ART: trace the heart ----------------
class LatteArt extends MiniStep {
  readonly kind = 'LatteArt';
  path: { x: number; y: number; hit: boolean }[] = [];
  trace: { x: number; y: number }[] = [];
  drawing = false;
  tol: number;
  cx = LW / 2;
  cy = 205;
  far = 0;
  constructor(opt: StepOptions) {
    super(opt);
    this.tol = opt.pro ? 30 : 22;
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      this.path.push({ x: this.cx + x * 5.2, y: this.cy + y * 5.2 + 8, hit: false });
    }
  }
  update(dt: number) {
    super.update(dt);
    if (!this.done && this.t > 12) this.end();
  }
  private end() {
    const hitFrac = this.path.filter((p) => p.hit).length / this.path.length;
    const sloppy = this.trace.length ? this.far / this.trace.length : 0;
    const s = Math.min(100, hitFrac * 112) - sloppy * 35;
    this.fb(s >= 90 ? 'PERFECT' : s >= 70 ? 'GREAT' : 'GOOD', 'perfect');
    audio.play(s >= 90 ? 'perfect' : 'good');
    this.finish(s);
  }
  down(x: number, y: number) {
    if (this.done) return;
    this.drawing = true;
    this.add(x, y);
  }
  move(x: number, y: number) {
    if (this.drawing && !this.done) this.add(x, y);
  }
  up() {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.path.filter((p) => p.hit).length / this.path.length > 0.85 || this.trace.length > 40) this.end();
  }
  private add(x: number, y: number) {
    this.trace.push({ x, y });
    let minD = Infinity;
    for (const p of this.path) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < this.tol) p.hit = true;
      minD = Math.min(minD, d);
    }
    if (minD > this.tol * 1.8) this.far++;
  }
  draw(g: CanvasRenderingContext2D) {
    board(g);
    g.fillStyle = '#f4f2ee';
    g.beginPath();
    g.arc(this.cx, this.cy, 135, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b98a5e';
    g.beginPath();
    g.arc(this.cx, this.cy, 118, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,80,50,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(this.cx, this.cy, 118, 0, Math.PI * 2);
    g.stroke();
    // guide
    g.setLineDash([6, 8]);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 3;
    g.beginPath();
    this.path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.setLineDash([]);
    // poured milk
    g.strokeStyle = C.milk;
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    this.trace.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    const hit = this.path.filter((p) => p.hit).length / this.path.length;
    g.fillStyle = '#e3d2b6';
    g.beginPath();
    g.roundRect(60, 360, LW - 120, 12, 6);
    g.fill();
    g.fillStyle = C.olive;
    g.beginPath();
    g.roundRect(60, 360, (LW - 120) * hit, 12, 6);
    g.fill();
  }
}

export function createStep(id: StepId, opt: StepOptions): MiniStep {
  switch (id) {
    case 'knead': return new Knead(opt);
    case 'shape': return new Shape(opt);
    case 'bake': return new Bake(opt);
    case 'topping': return new Cover(opt, false);
    case 'cream': return new Cover(opt, true);
    case 'grind': return new Grind(opt);
    case 'extract': return new Hold(opt, 'extract');
    case 'steam': return new Hold(opt, 'steam');
    case 'latteart': return new LatteArt(opt);
  }
}
