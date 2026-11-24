import { MENU_BY_ID, STEP_INFO, AUTO_STEP_MASTERY, AUTO_STEP_SCORE, gradeOf, type MenuDef, type StepId } from '../data/menu';
import { createStep, LW, LH, type MiniStep } from './steps';
import { MENU_ICONS, stars } from '../ui/icons';
import { audio } from '../core/audio';

export interface CraftOptions {
  proSteps: Set<StepId>;
  mastery: number;
}

/** Full-screen crafting overlay. Resolves with quality (0..100) or null if cancelled. */
export class MinigameHost {
  el: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private step: MiniStep | null = null;
  private raf = 0;
  private last = 0;
  private resolve: ((q: number | null) => void) | null = null;
  private scores: number[] = [];
  private menu!: MenuDef;
  private opts!: CraftOptions;
  private idx = 0;
  private between = 0;
  open = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'mg hidden';
    root.appendChild(this.el);
  }

  start(menuId: string, opts: CraftOptions): Promise<number | null> {
    this.menu = MENU_BY_ID[menuId];
    this.opts = opts;
    this.scores = [];
    this.idx = 0;
    this.open = true;
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="mg-card">
        <div class="mg-head">
          <i class="ico mg-icon">${MENU_ICONS[menuId]}</i>
          <div class="mg-title"><b>${this.menu.name}</b><div class="mg-dots"></div></div>
          <button class="btn ghost small mg-cancel">그만두기</button>
        </div>
        <div class="mg-step"><b class="mg-step-title"></b><span class="mg-hint"></span></div>
        <div class="mg-stage"><canvas width="${LW * 2}" height="${LH * 2}"></canvas><div class="mg-fb"></div></div>
        <div class="mg-foot"><button class="btn small mg-auto hidden">숙련자 자동 처리 (${AUTO_STEP_SCORE}점)</button></div>
      </div>`;
    this.canvas = this.el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(2, 2);
    const map = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * LW, y: ((e.clientY - r.top) / r.height) * LH };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      const p = map(e);
      if (this.between <= 0) this.step?.down(p.x, p.y);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = map(e);
      if (this.between <= 0) this.step?.move(p.x, p.y);
    });
    const up = (e: PointerEvent) => {
      const p = map(e);
      if (this.between <= 0) this.step?.up(p.x, p.y);
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.el.querySelector('.mg-cancel')!.addEventListener('click', () => this.close(null));
    this.el.querySelector('.mg-auto')!.addEventListener('click', () => {
      if (!this.step || this.idx !== 0) return;
      this.step.score = AUTO_STEP_SCORE;
      this.step.done = true;
      this.step.feedback = { text: '숙련 처리!', cls: 'great', t: 0.7 };
      audio.play('good');
    });
    this.beginStep();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    return new Promise((res) => (this.resolve = res));
  }

  private beginStep() {
    const id = this.menu.steps[this.idx];
    this.step = createStep(id, { menuId: this.menu.id, pro: this.opts.proSteps.has(id) });
    this.el.querySelector('.mg-step-title')!.textContent = `${this.idx + 1}. ${STEP_INFO[id].title}`;
    this.el.querySelector('.mg-hint')!.textContent = STEP_INFO[id].hint;
    const dots = this.el.querySelector('.mg-dots')!;
    dots.innerHTML = this.menu.steps.map((_, i) => `<span class="${i < this.idx ? 'done' : i === this.idx ? 'cur' : ''}"></span>`).join('');
    const auto = this.el.querySelector('.mg-auto')!;
    auto.classList.toggle('hidden', !(this.idx === 0 && this.opts.mastery >= AUTO_STEP_MASTERY));
  }

  private loop = (now: number) => {
    if (!this.open) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const s = this.step;
    if (s) {
      s.update(dt);
      s.draw(this.ctx);
      const fbEl = this.el.querySelector('.mg-fb') as HTMLElement | null;
      if (fbEl) {
        if (s.feedback && s.feedback.t > 0) {
          if (fbEl.dataset.text !== s.feedback.text + s.feedback.cls) {
            fbEl.dataset.text = s.feedback.text + s.feedback.cls;
            fbEl.textContent = s.feedback.text;
            fbEl.className = 'mg-fb show ' + s.feedback.cls;
          }
        } else if (fbEl.classList.contains('show')) {
          fbEl.className = 'mg-fb';
          fbEl.dataset.text = '';
        }
      }
      if (s.done) {
        if (this.between <= 0) this.between = 0.75;
        this.between -= dt;
        if (this.between <= 0) {
          this.scores.push(s.score);
          this.idx++;
          if (this.idx >= this.menu.steps.length) {
            this.showResult();
            return;
          }
          this.beginStep();
        }
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private showResult() {
    this.step = null;
    const q = Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length);
    const gr = gradeOf(q);
    audio.play(gr.stars >= 3 ? 'perfect' : 'good');
    const card = this.el.querySelector('.mg-card')!;
    card.innerHTML = `
      <div class="mg-result">
        <div class="burst ${gr.cls}"></div>
        <i class="ico mg-result-icon">${MENU_ICONS[this.menu.id]}</i>
        <div class="grade ${gr.cls}">${gr.label}</div>
        <div class="stars">${stars(gr.stars)}</div>
        <div class="mg-q">품질 <b>${q}</b>점</div>
        <div class="mg-breakdown">${this.menu.steps.map((id, i) => `<span>${STEP_INFO[id].title} <b>${this.scores[i]}</b></span>`).join('')}</div>
        <button class="btn primary big mg-ok">트레이에 담기</button>
      </div>`;
    card.querySelector('.mg-ok')!.addEventListener('click', () => this.close(q));
  }

  close(q: number | null) {
    this.open = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    const r = this.resolve;
    this.resolve = null;
    r?.(q);
  }
}
