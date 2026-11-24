import '@fontsource/jua/400.css';
import './styles.css';
import { Game } from './game/Game';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';
import { Sheets, Toasts } from './ui/dom';
import { events } from './core/events';
import { audio } from './core/audio';
import { bindBackButton } from './platform/native';

async function boot() {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const ui = document.getElementById('ui')!;
  const loading = document.getElementById('loading')!;

  // Make sure the font is ready before canvas textures (chalkboard, signs) are drawn.
  try {
    await Promise.race([document.fonts.load('20px Jua'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }

  const game = new Game(canvas, ui);
  const sheets = new Sheets(ui);
  const toasts = new Toasts(ui);
  await game.init();
  const hud = new Hud(game, ui);
  const panels = new Panels(game, sheets, toasts, hud);

  game.hooks = {
    openStation: (id) => panels.station(id),
    showSettlement: (sum) => panels.settlement(sum),
    customerInfo: (c) => panels.customerInfo(c),
    float: (p, t, c) => hud.float(p, t, c),
    confirm: (m, ok) => sheets.confirm(m, ok),
  };
  events.on('toast', (t) => toasts.show(t.text, t.kind));
  events.on('album', (a) => toasts.show(`추억 앨범에 「${a.title}」이(가) 기록됐어요`, 'good'));

  hud.onTab = (t) => {
    if (game.minigameOpen) return;
    if (t !== 'decor' && panels.editing) panels.closeEdit();
    sheets.closeAll();
    hud.setTab(t);
    if (t === 'decor') {
      if (!panels.openEdit(ui)) hud.setTab('cafe');
      return;
    }
    if (t === 'shop') panels.shop();
    if (t === 'quest') panels.quests();
    if (t === 'album') panels.album();
    if (t !== 'cafe') {
      const top = sheets.stack[sheets.stack.length - 1];
      const prev = top?.onClose;
      if (top) top.onClose = () => {
        prev?.();
        if (!panels.editing) hud.setTab('cafe');
      };
    }
  };
  hud.onSide = (id) => {
    if (game.minigameOpen) return;
    if (id === 'attendance') panels.attendance();
    if (id === 'character') panels.character();
    if (id === 'staff') panels.staffPanel();
    if (id === 'settings') panels.settings();
    if (id === 'levelinfo') panels.levelInfo();
  };
  hud.onPause = () => panels.pause();

  const back = (): boolean => {
    if (game.minigameOpen) {
      game.mg.close(null);
      return true;
    }
    if (sheets.closeTop()) return true;
    if (panels.editing) {
      panels.closeEdit();
      return true;
    }
    if (game.day.open && !game.paused) {
      panels.pause();
      return true;
    }
    return false;
  };
  bindBackButton(back, () => sheets.confirm('게임을 종료할까요? 진행 상황은 자동 저장돼요.', '종료'), () => {
    game.saveNow();
    if (game.day.open && !game.paused) panels.pause();
  });

  // UI frame loop (separate from the 3D loop so DOM work never blocks simulation)
  const uiLoop = () => {
    hud.update();
    requestAnimationFrame(uiLoop);
  };
  requestAnimationFrame(uiLoop);

  // Debug hooks for automated tests: only with ?debug=1 or VITE_ENABLE_DEBUG=true. Never shown to players.
  if (new URLSearchParams(location.search).has('debug') || import.meta.env.VITE_ENABLE_DEBUG === 'true') {
    (window as any).__game = { game, panels, sheets, hud };
  }

  loading.classList.add('done');
  window.setTimeout(() => loading.parentNode?.removeChild(loading), 600);
  app.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  // First launch: welcome + character, then daily attendance.
  if (game.fresh) {
    sheets.open({
      title: 'MY LITTLE CAFE에 오신 걸 환영해요!',
      cls: 'dialog welcome',
      render: (body, h) => {
        body.innerHTML = `<p class="dlg-msg">작은 베이커리 카페의 사장님이 되었어요.<br/>빵과 커피를 직접 만들고, 손님에게 서빙해 보세요.</p>
          <ul class="howto"><li><b>이동</b> 화면을 끌면 조이스틱, 바닥을 탭하면 그곳으로 걸어가요</li><li><b>제조</b> 오븐·커피 머신을 탭해 직접 만들어요</li><li><b>서빙</b> 주문한 손님을 탭하면 메뉴를 건네요</li></ul>
          <button class="btn primary big wide" data-act="go">내 캐릭터 정하기</button>`;
        body.querySelector('[data-act="go"]')!.addEventListener('click', () => {
          audio.unlock();
          h.close();
          panels.character();
        });
      },
    });
  } else if (game.progress.attendanceAvailable()) {
    window.setTimeout(() => panels.attendance(), 500);
  }
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div class="load-card"><b>게임을 시작하지 못했어요</b><p>${String(e?.message ?? e)}</p><p>WebGL을 지원하는 최신 브라우저에서 실행해 주세요.</p></div>`;
});
