import { ICON } from './icons';
import { audio } from '../core/audio';

export function $(sel: string, root: ParentNode = document): HTMLElement {
  return root.querySelector(sel) as HTMLElement;
}
export function $$(sel: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll(sel)] as HTMLElement[];
}
export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
/** Delegated click handler: data-act="name" -> handlers[name](el) */
export function bindActs(root: HTMLElement, handlers: Record<string, (el: HTMLElement, e: Event) => void>) {
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t || !root.contains(t)) return;
    const h = handlers[t.dataset.act!];
    if (h) {
      audio.unlock();
      audio.play('tap');
      h(t, e);
    }
  });
}

export interface SheetHandle {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
  refresh: () => void;
}

/** Bottom sheets / dialogs with a back-stack (Android back button closes the top one). */
export class Sheets {
  stack: { el: HTMLElement; onClose?: () => void }[] = [];
  constructor(private root: HTMLElement) {}

  open(opts: { title: string; cls?: string; render: (body: HTMLElement, h: SheetHandle) => void; onClose?: () => void; icon?: string }): SheetHandle {
    const wrap = el(`<div class="sheet-wrap ${opts.cls ?? ''}">
        <div class="sheet-backdrop"></div>
        <section class="sheet" role="dialog" aria-label="${opts.title}">
          <header class="sheet-head">${opts.icon ? `<i class="ico">${opts.icon}</i>` : ''}<h2>${opts.title}</h2><button class="icon-btn sheet-x" aria-label="닫기">${ICON.close}</button></header>
          <div class="sheet-body"></div>
        </section></div>`);
    this.root.appendChild(wrap);
    const body = $('.sheet-body', wrap);
    const entry = { el: wrap, onClose: opts.onClose };
    const handle: SheetHandle = {
      el: wrap,
      body,
      close: () => this.close(entry),
      refresh: () => {
        const st = body.scrollTop;
        body.innerHTML = '';
        opts.render(body, handle);
        body.scrollTop = st;
      },
    };
    $('.sheet-x', wrap).addEventListener('click', () => {
      audio.play('tap');
      handle.close();
    });
    $('.sheet-backdrop', wrap).addEventListener('click', () => handle.close());
    this.stack.push(entry);
    opts.render(body, handle);
    requestAnimationFrame(() => wrap.classList.add('in'));
    return handle;
  }

  private close(entry: { el: HTMLElement; onClose?: () => void }) {
    const i = this.stack.indexOf(entry);
    if (i < 0) return;
    this.stack.splice(i, 1);
    entry.el.classList.remove('in');
    entry.el.classList.add('out');
    window.setTimeout(() => entry.el.parentNode?.removeChild(entry.el), 220);
    entry.onClose?.();
  }

  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top) return false;
    this.close(top);
    return true;
  }

  closeAll() {
    while (this.closeTop()) {
      /* keep closing */
    }
  }

  get count() {
    return this.stack.length;
  }

  confirm(msg: string, okLabel = '확인', cancelLabel = '취소'): Promise<boolean> {
    return new Promise((res) => {
      let done = false;
      const h = this.open({
        title: '확인',
        cls: 'dialog',
        render: (body) => {
          body.innerHTML = `<p class="dlg-msg">${msg}</p><div class="row gap end"><button class="btn ghost" data-act="no">${cancelLabel}</button><button class="btn primary" data-act="yes">${okLabel}</button></div>`;
          bindActs(body, {
            yes: () => {
              done = true;
              res(true);
              h.close();
            },
            no: () => h.close(),
          });
        },
        onClose: () => {
          if (!done) res(false);
        },
      });
    });
  }
}

export class Toasts {
  el: HTMLElement;
  constructor(root: HTMLElement) {
    this.el = el('<div class="toasts" aria-live="polite"></div>');
    root.appendChild(this.el);
  }
  show(text: string, kind: 'info' | 'good' | 'warn' = 'info') {
    const t = el(`<div class="toast ${kind}"></div>`);
    t.textContent = text;
    this.el.appendChild(t);
    while (this.el.children.length > 3) this.el.removeChild(this.el.firstElementChild!);
    window.setTimeout(() => t.classList.add('out'), 2600);
    window.setTimeout(() => t.parentNode?.removeChild(t), 3000);
  }
}
