import type { Game, DaySummary } from '../game/Game';
import type { Customer } from '../game/customers';
import type { SaveSummary, Choice } from '../game/cloud';
import { preloadFirebase } from '../platform/firebase';
import { Sheets, Toasts, bindActs, el, $, type SheetHandle } from './dom';
import { ICON, MENU_ICONS, stars } from './icons';
import type { Hud } from './hud';
import { thumbs } from '../world/thumbs';
import { fmt, clamp, escapeHtml, pick, hex } from '../core/util';
import { events } from '../core/events';
import { audio, setVibration } from '../core/audio';
import { todayKey, uid, createDefaultState, type Outfit, type StaffMember } from '../core/state';
import { MENU, MENU_BY_ID, masteryLevel, MASTERY_THRESHOLDS, gradeOf } from '../data/menu';
import { FURNITURE, FURNITURE_BY_ID, THEMES, THEME_BY_ID, type Currency } from '../data/furniture';
import { OUTFITS, OUTFIT_BY_ID, EQUIPMENT, type OutfitSlot } from '../data/outfits';
import { SPECIES, SPECIES_BY_ID, HUMAN_SKINS, HAIR_COLORS } from '../data/species';
import { CUSTOMERS, PERSONALITY } from '../data/customers';
import { EXPANSIONS } from '../data/layout';
import {
  ACHIEVEMENTS, ATTENDANCE_CYCLE, DAILY_QUESTS, MONTHLY_MILESTONES, ROLES, STAFF_NAMES, STAFF_TRAITS, STORY_QUESTS, TIERS,
  activeEvent, cafeExpReq, playerExpReq, staffSlots, PLAYER_LEVEL_GEMS, CAFE_LEVEL_GEMS, type Reward, type StaffRole,
} from '../data/progression';

const cur = (c: Currency) => (c === 'gems' ? ICON.gem : ICON.coin);
const priceTag = (c: Currency, n: number) => `<i class="ico">${cur(c)}</i>${fmt(n)}`;
function rewardHtml(r: Reward) {
  const parts: string[] = [];
  if (r.gold) parts.push(`<span class="rw"><i class="ico">${ICON.coin}</i>${fmt(r.gold)}</span>`);
  if (r.gems) parts.push(`<span class="rw"><i class="ico">${ICON.gem}</i>${r.gems}</span>`);
  if (r.exp) parts.push(`<span class="rw exp">EXP ${r.exp}</span>`);
  return parts.join('');
}
function progressBar(p: number, max: number) {
  return `<div class="pbar"><i style="width:${clamp((p / Math.max(1, max)) * 100, 0, 100)}%"></i><span>${fmt(p)} / ${fmt(max)}</span></div>`;
}
/** Fill <img data-thumb> lazily so opening a panel never blocks a frame for long. */
function lazyThumbs(root: HTMLElement, make: (key: string) => string) {
  const imgs = [...root.querySelectorAll('img[data-thumb]')] as HTMLImageElement[];
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < imgs.length && performance.now() - t0 < 12) {
      const img = imgs[i++];
      if (!img.isConnected) continue;
      const url = make(img.dataset.thumb!);
      if (url) img.src = url;
      img.removeAttribute('data-thumb');
    }
    if (i < imgs.length) window.setTimeout(step, 16);
  };
  window.setTimeout(step, 30);
}
function thumbFor(key: string): string {
  const [kind, id, extra] = key.split('|');
  if (kind === 'f') return thumbs.furniture(id);
  if (kind === 'food') return thumbs.food(id);
  if (kind === 'sp') return thumbs.character({ species: id, apron: 'apron_cream', wearApron: true });
  if (kind === 'look') return thumbs.character(JSON.parse(decodeURIComponent(id)));
  if (kind === 'outfit') return thumbs.character({ species: extra || 'wombat', apron: id.startsWith('apron') ? id : 'apron_cream', wearApron: true, hat: id.startsWith('hat') ? id : undefined, glasses: id.startsWith('glasses') ? id : undefined, accessory: id.startsWith('acc') ? id : undefined });
  return '';
}

export class Panels {
  private levelQueue: { kind: 'player' | 'cafe'; level: number }[] = [];
  private editBar: HTMLElement | null = null;
  private editTab: 'storage' | 'theme' | 'expand' = 'storage';

  private settingsHandle: SheetHandle | null = null;

  constructor(private game: Game, public sheets: Sheets, private toasts: Toasts, private hud: Hud) {
    game.cloud.onChange = () => this.settingsHandle?.refresh();
    events.on('levelUp', (e) => {
      this.levelQueue.push(e);
      audio.play('levelup');
      window.setTimeout(() => this.flushLevelUps(), 300);
    });
  }

  // ================================================================ station
  station(id: 'oven' | 'espresso') {
    const g = this.game;
    const kind = id === 'oven' ? 'bread' : 'coffee';
    this.sheets.open({
      title: id === 'oven' ? '오븐 · 빵 만들기' : '에스프레소 머신 · 커피 만들기',
      icon: id === 'oven' ? MENU_ICONS.croissant : MENU_ICONS.americano,
      cls: 'station',
      render: (body, h) => {
        const waiting = new Map<string, number>();
        for (const c of g.customers.waiting) if (c.order) waiting.set(c.order, (waiting.get(c.order) ?? 0) + 1);
        const items = MENU.filter((m) => m.kind === kind);
        const full = g.player.hands.length >= 2;
        body.innerHTML = `${full ? '<p class="note warn">트레이가 가득 찼어요 (최대 2개). 먼저 서빙하거나 버려요.</p>' : ''}
          <div class="menu-list">${items
            .map((m) => {
              const locked = m.unlockLevel > g.state.playerLevel;
              const cnt = g.state.mastery[m.id] ?? 0;
              const ml = masteryLevel(cnt);
              const next = MASTERY_THRESHOLDS[ml] ?? null;
              const w = waiting.get(m.id) ?? 0;
              return `<button class="menu-card ${locked ? 'locked' : ''} ${w ? 'wanted' : ''}" data-act="make" data-id="${m.id}" ${locked || full ? 'disabled' : ''}>
                <i class="ico big">${MENU_ICONS[m.id]}</i>
                <div class="mc-body">
                  <b>${m.name}</b>${w ? `<em class="want">주문 ${w}</em>` : ''}
                  <small>${m.desc}</small>
                  <div class="mc-meta">${locked ? `<span class="lock-tag"><i class="ico">${ICON.lock}</i>플레이어 Lv.${m.unlockLevel}</span>` : `<span>판매 <i class="ico">${ICON.coin}</i>${m.price}</span><span>재료 −${m.cost}</span><span>${m.steps.length}단계</span><span class="mastery">숙련 Lv.${ml}${next ? ` (${cnt}/${next})` : ' MAX'}</span>`}</div>
                </div></button>`;
            })
            .join('')}</div>`;
        bindActs(body, {
          make: (b) => {
            h.close();
            g.craft(b.dataset.id!);
          },
        });
      },
    });
  }

  // ================================================================ settlement
  settlement(sum: DaySummary) {
    const net = sum.sales + sum.tips + sum.desserts - sum.wages;
    const avg = sum.served ? sum.satSum / sum.served : 0;
    const avgStars = Math.round((avg / 100) * 5);
    this.sheets.open({
      title: `${sum.number}일차 영업 정산`,
      cls: 'dialog settle',
      icon: ICON.coin,
      render: (body, h) => {
        body.innerHTML = `
          <div class="settle-hero"><span>오늘의 순수익</span><b class="${net >= 0 ? 'plus' : 'minus'}"><i class="ico">${ICON.coin}</i>${net >= 0 ? '+' : ''}${fmt(net)}</b></div>
          <table class="settle-table">
            <tr><td>메뉴 판매</td><td>+${fmt(sum.sales)}</td></tr>
            <tr><td>팁</td><td>+${fmt(sum.tips)}</td></tr>
            ${sum.desserts ? `<tr><td>디저트 추가 판매</td><td>+${fmt(sum.desserts)}</td></tr>` : ''}
            ${sum.wages ? `<tr><td>직원 인건비</td><td class="minus">−${fmt(sum.wages)}</td></tr>` : ''}
          </table>
          <div class="settle-grid">
            <div><small>응대한 손님</small><b>${sum.served}명</b></div>
            <div><small>놓친 손님</small><b>${sum.lost}명</b></div>
            <div><small>제조한 메뉴</small><b>${sum.crafted}개</b></div>
            <div><small>평균 만족도</small><b class="st">${stars(avgStars, 5)}</b></div>
            <div><small>카페 평판</small><b>${sum.repBefore.toFixed(1)} → ${sum.repAfter.toFixed(1)}</b></div>
            <div><small>카페 EXP</small><b>+${fmt(sum.cafeExp)}</b></div>
          </div>
          ${sum.lost > 0 ? '<p class="note">손님이 오래 기다리면 돌아가요. 직원을 고용하거나 테이블 배치를 바꿔 보세요.</p>' : ''}
          <button class="btn primary big wide" data-act="ok">확인</button>`;
        bindActs(body, { ok: () => h.close() });
      },
      onClose: () => this.hud.refreshBadges(),
    });
  }

  // ================================================================ customer info
  customerInfo(c: Customer) {
    const d = c.def;
    const rec = this.game.state.customers[d.id];
    const order = c.order ? MENU_BY_ID[c.order] : null;
    this.sheets.open({
      title: d.name,
      cls: 'dialog',
      render: (body, h) => {
        body.innerHTML = `<div class="cust-head"><img data-thumb="look|${encodeURIComponent(JSON.stringify({ species: d.species, apron: d.apron, hat: d.hat, glasses: d.glasses, accessory: d.accessory }))}" alt=""/>
          <div><b>${d.name}</b> <span class="tag">${SPECIES_BY_ID[d.species]?.name}</span> <span class="tag">${PERSONALITY[d.personality].name}</span>${rec?.regular ? '<span class="tag gold">단골</span>' : ''}
          <p>${d.intro}</p><small>좋아하는 메뉴: ${MENU_BY_ID[d.favorite]?.name ?? '-'} · 방문 ${rec?.visits ?? 0}회</small></div></div>
          ${d.special && c.state === 'waiting' ? `<p class="quote">“${d.special.line}”</p>` : ''}
          ${order && c.state === 'waiting' ? `<div class="order-line"><i class="ico big">${MENU_ICONS[order.id]}</i><div><b>${order.name}</b> 주문<br/><small>${order.kind === 'coffee' ? '에스프레소 머신' : '오븐'}에서 만들 수 있어요${order.unlockLevel > this.game.state.playerLevel ? ' (아직 레시피 미해금)' : ''}</small></div></div>` : `<p class="note">${c.state === 'eating' ? '맛있게 먹는 중이에요.' : c.state === 'leaving' ? '돌아가는 중이에요.' : '자리를 찾는 중이에요.'}</p>`}
          <button class="btn wide" data-act="ok">닫기</button>`;
        lazyThumbs(body, thumbFor);
        bindActs(body, { ok: () => h.close() });
      },
    });
  }

  // ================================================================ shop
  shop(tab: 'character' | 'furniture' | 'outfit' | 'equipment' = 'furniture') {
    const g = this.game;
    let wishOnly = false;
    this.sheets.open({
      title: '상점',
      icon: ICON.shop,
      cls: 'tall',
      render: (body, h) => {
        const s = g.state;
        const total = FURNITURE.length + OUTFITS.filter((o) => o.price > 0).length + SPECIES.filter((sp) => sp.gemPrice).length + EQUIPMENT.length + THEMES.length - 1;
        const owned = FURNITURE.filter((f) => (s.owned.furniture[f.id] ?? 0) > 0).length + OUTFITS.filter((o) => o.price > 0 && s.owned.outfits.includes(o.id)).length + SPECIES.filter((sp) => sp.gemPrice && s.owned.species.includes(sp.id)).length + s.owned.equipment.length + s.owned.themes.length - 1;
        const tabs = [['furniture', '가구'], ['character', '캐릭터'], ['outfit', '의상'], ['equipment', '장비']];
        const wish = (id: string) => `<button class="wish" data-act="wish" data-id="${id}" aria-label="찜">${s.wishlist.includes(id) ? ICON.wishOn : ICON.wish}</button>`;
        const show = (id: string) => !wishOnly || s.wishlist.includes(id);
        let cards = '';
        const buyBtn = (type: string, id: string, c: Currency, price: number, lockText: string | null, ownedText: string | null) =>
          ownedText && !lockText ? `<span class="owned-tag">${ownedText}</span>` : lockText ? `<span class="lock-tag"><i class="ico">${ICON.lock}</i>${lockText}</span>` : `<button class="price ${c}" data-act="buy" data-type="${type}" data-id="${id}">${priceTag(c, price)}</button>`;
        if (tab === 'furniture') {
          cards = FURNITURE.filter((f) => show(f.id))
            .map((f) => {
              const n = s.owned.furniture[f.id] ?? 0;
              const lock = f.minCafeLevel > s.cafeLevel ? `카페 Lv.${f.minCafeLevel}` : null;
              return `<div class="card item ${lock ? 'locked' : ''}">${wish(f.id)}<img data-thumb="f|${f.id}" alt=""/><b>${f.name}</b><small>${f.desc}</small>
                ${n ? `<span class="count">보유 ${n}</span>` : ''}${buyBtn('furniture', f.id, f.currency, f.price, lock, null)}</div>`;
            })
            .join('');
          cards += `<h3 class="section">카페 테마</h3>` + THEMES.filter((t) => show(t.id))
            .map((t) => {
              const has = s.owned.themes.includes(t.id);
              return `<div class="card item">${t.id !== 'wood' ? wish(t.id) : ''}<div class="swatch" style="--w:${hex(t.wall)};--s:${hex(t.wainscot)};--f:${hex(t.floorA)};--g:${hex(t.floorB)}"></div><b>${t.name}</b><small>${t.desc}${t.ambiance ? ` · 분위기 +${t.ambiance}` : ''}</small>${buyBtn('theme', t.id, t.currency, t.price, null, has ? '보유' : null)}</div>`;
            })
            .join('');
        } else if (tab === 'character') {
          cards = SPECIES.filter((sp) => show(sp.id))
            .map((sp) => {
              const has = !sp.gemPrice || s.owned.species.includes(sp.id);
              return `<div class="card item">${sp.gemPrice ? wish(sp.id) : ''}<img data-thumb="sp|${sp.id}" alt=""/><b>${sp.name}</b><small>${sp.blurb}</small>${buyBtn('species', sp.id, 'gems', sp.gemPrice ?? 0, null, has ? (sp.gemPrice ? '보유' : '기본') : null)}</div>`;
            })
            .join('');
        } else if (tab === 'outfit') {
          cards = OUTFITS.filter((o) => o.price > 0 && show(o.id))
            .map((o) => {
              const has = s.owned.outfits.includes(o.id);
              const lock = o.minPlayerLevel > s.playerLevel ? `플레이어 Lv.${o.minPlayerLevel}` : null;
              return `<div class="card item ${lock ? 'locked' : ''}">${wish(o.id)}<img data-thumb="outfit|${o.id}|${s.outfit.species}" alt=""/><b>${o.name}</b><small>${{ apron: '앞치마', hat: '모자', glasses: '안경', accessory: '액세서리' }[o.slot]}</small>${buyBtn('outfit', o.id, o.currency, o.price, has ? null : lock, has ? '보유' : null)}</div>`;
            })
            .join('');
        } else {
          cards = EQUIPMENT.filter((e) => show(e.id))
            .map((e) => {
              const has = s.owned.equipment.includes(e.id);
              const lock = e.minCafeLevel > s.cafeLevel ? `카페 Lv.${e.minCafeLevel}` : null;
              return `<div class="card item ${lock ? 'locked' : ''}">${wish(e.id)}<i class="ico eq">${ICON.gear}</i><b>${e.name}</b><small>${e.desc}</small>${buyBtn('equipment', e.id, e.currency, e.price, has ? null : lock, has ? '설치됨' : null)}</div>`;
            })
            .join('');
        }
        body.innerHTML = `
          <div class="tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          <div class="row between shop-meta"><span>도감 수집률 <b>${Math.round((owned / total) * 100)}%</b> (${owned}/${total})</span>
            <button class="toggle ${wishOnly ? 'on' : ''}" data-act="wishonly">${ICON.wishOn} 찜만 보기</button></div>
          <p class="note">상시 판매 · 구매한 아이템은 영구 소유</p>
          <div class="grid">${cards || '<p class="empty">찜한 상품이 없어요</p>'}</div>`;
        lazyThumbs(body, thumbFor);
        bindActs(body, {
          tab: (b) => {
            tab = b.dataset.t as typeof tab;
            h.refresh();
            $('.sheet-body', h.el).scrollTop = 0;
          },
          wishonly: () => {
            wishOnly = !wishOnly;
            h.refresh();
          },
          wish: (b) => {
            const id = b.dataset.id!;
            const w = g.state.wishlist;
            if (w.includes(id)) w.splice(w.indexOf(id), 1);
            else w.push(id);
            g.markDirty();
            h.refresh();
          },
          buy: (b) => this.buy(b.dataset.type!, b.dataset.id!, h),
        });
      },
    });
  }

  private async buy(type: string, id: string, h: SheetHandle) {
    const g = this.game;
    const s = g.state;
    let name = '', c: Currency = 'gold', price = 0;
    if (type === 'furniture') ({ name, currency: c, price } = FURNITURE_BY_ID[id]);
    if (type === 'theme') ({ name, currency: c, price } = THEME_BY_ID[id]);
    if (type === 'outfit') ({ name, currency: c, price } = OUTFIT_BY_ID[id]);
    if (type === 'equipment') ({ name, currency: c, price } = EQUIPMENT.find((e) => e.id === id)!);
    if (type === 'species') {
      name = SPECIES_BY_ID[id].name;
      c = 'gems';
      price = SPECIES_BY_ID[id].gemPrice ?? 0;
    }
    if (s[c] < price) {
      this.toasts.show(c === 'gems' ? '보석이 부족해요. 출석·퀘스트·업적으로 모을 수 있어요.' : '골드가 부족해요.', 'warn');
      audio.play('error');
      return;
    }
    if (!(await this.sheets.confirm(`<b>${name}</b>을(를) ${priceTag(c, price)}에 구매할까요?`, '구매'))) return;
    if (!g.progress.spend(c, price)) return;
    if (type === 'furniture') s.owned.furniture[id] = (s.owned.furniture[id] ?? 0) + 1;
    if (type === 'theme') s.owned.themes.push(id);
    if (type === 'outfit') s.owned.outfits.push(id);
    if (type === 'equipment') s.owned.equipment.push(id);
    if (type === 'species') s.owned.species.push(id);
    audio.play('coin');
    this.toasts.show(type === 'furniture' ? `${name} 구매! 꾸미기 > 보관함에서 배치해요.` : type === 'theme' ? `${name} 테마 구매! 꾸미기 > 테마에서 적용해요.` : type === 'outfit' || type === 'species' ? `${name} 구매! 캐릭터 화면에서 바꿀 수 있어요.` : `${name} 설치 완료!`, 'good');
    g.markDirty();
    g.saveNow();
    h.refresh();
  }

  // ================================================================ quests
  quests() {
    const g = this.game;
    let tab: 'daily' | 'achieve' | 'story' | 'event' = 'daily';
    this.sheets.open({
      title: '퀘스트',
      icon: ICON.quest,
      cls: 'tall',
      render: (body, h) => {
        const p = g.progress;
        p.ensureDaily();
        const ev = activeEvent();
        const tabs: [string, string][] = [['daily', '일일'], ['achieve', '업적'], ['story', '스토리']];
        if (ev) tabs.push(['event', '이벤트']);
        let list = '';
        if (tab === 'daily') {
          list = DAILY_QUESTS.map((q) => {
            const st = p.dailyState(q.id);
            return `<div class="quest ${st.claimed ? 'claimed' : ''}"><div class="q-main"><b>${q.name}</b>${progressBar(st.p, q.target)}</div><div class="q-side">${rewardHtml(q.reward)}${st.claimed ? '<span class="owned-tag">완료</span>' : `<button class="btn small ${st.done ? 'primary' : ''}" data-act="claimDaily" data-id="${q.id}" ${st.done ? '' : 'disabled'}>받기</button>`}</div></div>`;
          }).join('') + '<p class="note">일일 퀘스트는 매일 자정에 초기화돼요.</p>';
        } else if (tab === 'achieve') {
          list = ACHIEVEMENTS.map((a) => {
            const st = p.achievementState(a.id);
            return `<div class="quest ${st.complete ? 'claimed' : ''}"><div class="q-main"><b>${a.name} ${st.complete ? '' : `${st.target}${a.unit}`}</b><small>단계 ${Math.min(st.claimed + 1, a.tiers.length)}/${a.tiers.length}</small>${progressBar(Math.min(st.val, st.target), st.target)}</div><div class="q-side">${st.complete ? '<span class="owned-tag">모두 달성</span>' : `${rewardHtml(st.reward)}<button class="btn small ${st.ready ? 'primary' : ''}" data-act="claimAch" data-id="${a.id}" ${st.ready ? '' : 'disabled'}>받기</button>`}</div></div>`;
          }).join('');
        } else if (tab === 'story') {
          const st = p.storyState();
          list = STORY_QUESTS.map((q, i) => {
            const done = i < g.state.storyIndex;
            const curr = i === g.state.storyIndex;
            if (i > g.state.storyIndex + 1) return '';
            return `<div class="quest story ${done ? 'claimed' : ''} ${curr ? 'current' : ''}"><div class="q-main"><b>${i + 1}. ${curr || done ? q.name : '???'}</b><small>${curr || done ? q.desc : '이전 이야기를 완료하면 공개돼요'}</small>${curr && q.progress ? `<small>${q.progress(g.state)}</small>` : ''}</div><div class="q-side">${curr || done ? rewardHtml(q.reward) : ''}${done ? '<span class="owned-tag">완료</span>' : curr ? `<button class="btn small ${st?.done ? 'primary' : ''}" data-act="claimStory" ${st?.done ? '' : 'disabled'}>받기</button>` : ''}</div></div>`;
          }).join('') + (g.state.storyIndex >= STORY_QUESTS.length ? '<p class="note">이번 시즌 스토리를 모두 완료했어요! 다음 업데이트를 기대해 주세요.</p>' : '');
        } else if (ev) {
          list = `<div class="event-head"><b>${ev.name}</b><small>${ev.desc} · ~${ev.end.replace('-', '/')}</small></div>` + ev.quests.map((q) => {
            const st = p.eventQuestState(q.id)!;
            return `<div class="quest ${st.claimed ? 'claimed' : ''}"><div class="q-main"><b>${q.name}</b>${progressBar(st.p, q.target)}</div><div class="q-side">${rewardHtml(q.reward)}${st.claimed ? '<span class="owned-tag">완료</span>' : `<button class="btn small ${st.done ? 'primary' : ''}" data-act="claimEvent" data-id="${q.id}" ${st.done ? '' : 'disabled'}>받기</button>`}</div></div>`;
          }).join('');
        }
        body.innerHTML = `<div class="tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="quests">${list}</div>`;
        const claimed = () => {
          audio.play('coin');
          h.refresh();
          this.hud.refreshBadges();
          g.saveNow();
        };
        bindActs(body, {
          tab: (b) => {
            tab = b.dataset.t as typeof tab;
            h.refresh();
          },
          claimDaily: (b) => p.claimDaily(b.dataset.id!) && claimed(),
          claimAch: (b) => p.claimAchievement(b.dataset.id!) && claimed(),
          claimStory: () => p.claimStory() && claimed(),
          claimEvent: (b) => p.claimEvent(b.dataset.id!) && claimed(),
        });
      },
    });
  }

  // ================================================================ attendance
  attendance() {
    const g = this.game;
    this.sheets.open({
      title: '출석 체크',
      icon: ICON.calendar,
      cls: 'dialog att',
      render: (body, h) => {
        const a = g.state.attendance;
        const avail = g.progress.attendanceAvailable();
        body.innerHTML = `
          <div class="att-grid">${ATTENDANCE_CYCLE.map((r, i) => {
            const done = i < a.cycleDay || (!avail && i === (a.cycleDay + 6) % 7 && a.cycleDay === 0);
            const today = avail && i === a.cycleDay;
            return `<div class="att-cell ${done ? 'done' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}"><small>${i + 1}일차</small>${rewardHtml(r)}${done ? `<i class="ico stamp">${ICON.check}</i>` : ''}</div>`;
          }).join('')}</div>
          <div class="row between"><span>연속 출석 <b>${a.streak}일</b></span><span>누적 <b>${a.total}일</b></span></div>
          <div class="month"><small>이번 달 출석 ${a.monthDays}일</small>${MONTHLY_MILESTONES.map((m) => `<span class="ms ${a.monthClaimed.includes(m.days) ? 'got' : ''}">${m.days}일 ${rewardHtml(m.reward)}</span>`).join('')}</div>
          <p class="note">하루를 놓쳐도 보상 단계는 그대로 이어져요.</p>
          <button class="btn primary big wide" data-act="check" ${avail ? '' : 'disabled'}>${avail ? '출석하고 보상 받기' : '오늘은 출석 완료! 내일 또 만나요'}</button>`;
        bindActs(body, {
          check: () => {
            const r = g.progress.checkIn();
            if (!r) return;
            audio.play('coin');
            this.toasts.show(`출석 ${r.day + 1}일차 보상을 받았어요!${r.milestone ? ' 월간 보상도 획득!' : ''}`, 'good');
            g.saveNow();
            h.refresh();
            this.hud.refreshBadges();
          },
        });
      },
    });
  }

  // ================================================================ album
  album() {
    const g = this.game;
    let tab: 'memory' | 'guests' = 'memory';
    this.sheets.open({
      title: '추억 앨범',
      icon: ICON.album,
      cls: 'tall',
      render: (body, h) => {
        const s = g.state;
        let inner = '';
        if (tab === 'memory') {
          const list = [...s.album].reverse();
          inner = list.length
            ? `<div class="mem-grid">${list.map((m) => `<button class="mem" data-act="mem" data-id="${m.id}">${m.image ? `<img src="${m.image}" alt=""/>` : `<div class="mem-ph">${ICON.heart}</div>`}<b>${escapeHtml(m.title)}</b><small>${new Date(m.date).toLocaleDateString('ko-KR')}</small></button>`).join('')}</div>`
            : '<p class="empty">아직 추억이 없어요. 첫 손님을 맞이해 보세요!</p>';
        } else {
          const met = CUSTOMERS.filter((c) => (s.customers[c.id]?.visits ?? 0) > 0 || s.flags['special_' + c.id]);
          inner = `<p class="note">만난 손님 ${met.length} / ${CUSTOMERS.length}</p><div class="guest-list">${CUSTOMERS.map((c) => {
            const r = s.customers[c.id];
            const known = met.includes(c);
            if (!known) return `<div class="guest unknown"><div class="g-ph">?</div><b>???</b><small>아직 만나지 못한 손님</small></div>`;
            const mems = s.album.filter((m) => m.customerId === c.id).length;
            return `<button class="guest" data-act="guest" data-id="${c.id}"><img data-thumb="look|${encodeURIComponent(JSON.stringify({ species: c.species, apron: c.apron, hat: c.hat, glasses: c.glasses, accessory: c.accessory }))}" alt=""/><b>${c.name}${r?.regular ? ' <span class="tag gold">단골</span>' : ''}${c.special ? ' <span class="tag">특별</span>' : ''}</b><small>${SPECIES_BY_ID[c.species]?.name} · ${PERSONALITY[c.personality].name} · 방문 ${r?.visits ?? 0}회${mems ? ` · 추억 ${mems}` : ''}</small><div class="aff"><i style="width:${r?.affinity ?? 0}%"></i></div></button>`;
          }).join('')}</div>`;
        }
        body.innerHTML = `<div class="tabs"><button data-act="tab" data-t="memory" class="${tab === 'memory' ? 'on' : ''}">추억</button><button data-act="tab" data-t="guests" class="${tab === 'guests' ? 'on' : ''}">손님</button></div>${inner}`;
        lazyThumbs(body, thumbFor);
        bindActs(body, {
          tab: (b) => {
            tab = b.dataset.t as typeof tab;
            h.refresh();
          },
          mem: (b) => {
            const m = s.album.find((x) => x.id === b.dataset.id);
            if (!m) return;
            this.sheets.open({
              title: m.title,
              cls: 'dialog',
              render: (bd, hh) => {
                bd.innerHTML = `${m.image ? `<img class="mem-big" src="${m.image}" alt=""/>` : ''}<p>${escapeHtml(m.desc)}</p><small>${new Date(m.date).toLocaleString('ko-KR')}</small><button class="btn wide" data-act="ok">닫기</button>`;
                bindActs(bd, { ok: () => hh.close() });
              },
            });
          },
          guest: (b) => {
            const c = CUSTOMERS.find((x) => x.id === b.dataset.id)!;
            const r = s.customers[c.id];
            const mems = s.album.filter((m) => m.customerId === c.id);
            this.sheets.open({
              title: c.name,
              cls: 'dialog',
              render: (bd, hh) => {
                bd.innerHTML = `<p>${c.intro}</p><div class="settle-grid"><div><small>성격</small><b>${PERSONALITY[c.personality].name}</b></div><div><small>좋아하는 메뉴</small><b>${MENU_BY_ID[c.favorite]?.name}</b></div><div><small>방문</small><b>${r?.visits ?? 0}회</b></div><div><small>친밀도</small><b>${r?.affinity ?? 0}</b></div><div><small>최고 품질</small><b>${r?.bestQuality ?? 0}점</b></div><div><small>단골</small><b>${r?.regular ? '예' : '아니오'}</b></div></div>
                  <h3 class="section">함께한 추억</h3>${mems.length ? mems.map((m) => `<div class="mem-row">${m.image ? `<img src="${m.image}" alt=""/>` : ''}<div><b>${escapeHtml(m.title)}</b><small>${new Date(m.date).toLocaleDateString('ko-KR')}</small></div></div>`).join('') : '<p class="empty">아직 함께한 추억이 없어요</p>'}
                  <button class="btn wide" data-act="ok">닫기</button>`;
                bindActs(bd, { ok: () => hh.close() });
              },
            });
          },
        });
      },
    });
  }

  // ================================================================ character
  character() {
    const g = this.game;
    const draft: Outfit = { ...g.state.outfit };
    let name = g.state.profileName;
    this.sheets.open({
      title: '캐릭터 꾸미기',
      icon: ICON.person,
      cls: 'tall',
      render: (body, h) => {
        const s = g.state;
        const owned = (slot: OutfitSlot) => OUTFITS.filter((o) => o.slot === slot && (o.price === 0 || s.owned.outfits.includes(o.id)));
        const slotRow = (slot: OutfitSlot, label: string) => `<h3 class="section">${label}</h3><div class="chips">${owned(slot).map((o) => `<button class="chip-opt ${draft[slot] === o.id ? 'on' : ''}" data-act="slot" data-slot="${slot}" data-id="${o.id}">${o.color && !o.id.endsWith('_none') ? `<span class="dot" style="background:${hex(o.color)}"></span>` : ''}${o.name}</button>`).join('')}</div>`;
        const look = { ...draft, wearApron: true };
        body.innerHTML = `
          <div class="char-top"><img class="char-preview" src="${thumbs.character(look)}" alt="미리보기"/>
            <div class="col"><label class="field">이름<input class="name-in" maxlength="10" value="${escapeHtml(name)}"/></label>
            <small>어떤 동물도 바리스타, 베이커가 될 수 있어요.</small></div></div>
          <h3 class="section">종족</h3>
          <div class="species-grid">${SPECIES.map((sp) => {
            const has = !sp.gemPrice || s.owned.species.includes(sp.id);
            return `<button class="sp ${draft.species === sp.id ? 'on' : ''} ${has ? '' : 'locked'}" data-act="species" data-id="${sp.id}"><img data-thumb="sp|${sp.id}" alt=""/><span>${sp.name}</span>${has ? '' : `<em><i class="ico">${ICON.gem}</i>${sp.gemPrice}</em>`}</button>`;
          }).join('')}</div>
          ${draft.species === 'human' ? `<h3 class="section">피부</h3><div class="chips">${HUMAN_SKINS.map((c, i) => `<button class="swatch-btn ${draft.skin === i ? 'on' : ''}" data-act="skin" data-i="${i}" style="background:${hex(c)}" aria-label="피부 ${i + 1}"></button>`).join('')}</div>
            <h3 class="section">머리색</h3><div class="chips">${HAIR_COLORS.map((c, i) => `<button class="swatch-btn ${draft.hair === i ? 'on' : ''}" data-act="hair" data-i="${i}" style="background:${hex(c)}" aria-label="머리색 ${i + 1}"></button>`).join('')}</div>` : ''}
          ${slotRow('apron', '앞치마')}${slotRow('hat', '모자')}${slotRow('glasses', '안경')}${slotRow('accessory', '액세서리')}
          <p class="note">더 많은 의상은 상점에서 구매할 수 있어요.</p>
          <div class="sticky-foot"><button class="btn ghost" data-act="shop">상점</button><button class="btn primary" data-act="save">적용하기</button></div>`;
        lazyThumbs(body, thumbFor);
        const nameIn = $('.name-in', body) as HTMLInputElement;
        nameIn.addEventListener('input', () => (name = nameIn.value));
        bindActs(body, {
          species: (b) => {
            const sp = SPECIES_BY_ID[b.dataset.id!];
            if (sp.gemPrice && !s.owned.species.includes(sp.id)) {
              this.toasts.show(`${sp.name}은(는) 상점 > 캐릭터에서 구매할 수 있어요.`, 'info');
              return;
            }
            draft.species = sp.id;
            h.refresh();
          },
          skin: (b) => {
            draft.skin = Number(b.dataset.i);
            h.refresh();
          },
          hair: (b) => {
            draft.hair = Number(b.dataset.i);
            h.refresh();
          },
          slot: (b) => {
            (draft as any)[b.dataset.slot!] = b.dataset.id!;
            h.refresh();
          },
          shop: () => {
            h.close();
            this.shop('outfit');
          },
          save: () => {
            g.state.outfit = { ...draft };
            g.state.profileName = name.trim() || '사장님';
            g.player.rebuildLook(g.state.outfit, g.stage.scene);
            g.markDirty();
            g.saveNow();
            this.hud.refreshTop();
            this.toasts.show('새로운 모습으로 변신!', 'good');
            audio.play('good');
            h.close();
          },
        });
      },
    });
  }

  // ================================================================ staff
  private ensureCandidates() {
    const s = this.game.state;
    if (s.staffCandidates.date === todayKey() && s.staffCandidates.list.length) return;
    const base = SPECIES.filter((sp) => !sp.gemPrice).map((sp) => sp.id);
    const roles: StaffRole[] = ['barista', 'baker', 'hall', 'manager'];
    const list: StaffMember[] = [];
    for (let i = 0; i < 3; i++) {
      const r = Math.random();
      list.push({
        uid: uid('s'),
        name: pick(STAFF_NAMES),
        species: pick(base),
        role: i < 3 ? roles[(i + new Date().getDate()) % 4] : pick(roles),
        tier: r < 0.55 ? 0 : r < 0.9 ? 1 : 2,
        trait: pick(STAFF_TRAITS),
        apron: pick(['apron_cream', 'apron_olive', 'apron_brown', 'apron_navy', 'apron_pink']),
      });
    }
    s.staffCandidates = { date: todayKey(), list };
  }

  staffPanel() {
    const g = this.game;
    this.ensureCandidates();
    this.sheets.open({
      title: '직원 관리',
      icon: ICON.staff,
      cls: 'tall',
      render: (body, h) => {
        const s = g.state;
        const slots = staffSlots(s.cafeLevel);
        const lookOf = (m: StaffMember) => encodeURIComponent(JSON.stringify({ species: m.species, apron: m.apron, wearApron: true, hat: m.role === 'baker' ? 'hat_chef' : m.role === 'manager' ? 'hat_none' : 'hat_cap', accessory: m.role === 'manager' ? 'acc_bowtie' : 'acc_none', skin: m.name.length % 4, hair: m.name.length % 5 }));
        const card = (m: StaffMember, hired: boolean) => {
          const t = TIERS[m.tier];
          const cost = t.gemHire ? priceTag('gems', t.gemHire) : priceTag('gold', t.hire);
          return `<div class="staff-card tier${m.tier}"><img data-thumb="look|${lookOf(m)}" alt=""/>
            <div class="col"><b>${m.name} <span class="tag">${SPECIES_BY_ID[m.species]?.name}</span></b>
            <span><span class="tag role">${ROLES[m.role].name}</span> <span class="tag tier">${t.name}</span> <span class="tag">${m.trait}</span></span>
            <small>${ROLES[m.role].desc}</small><small>일당 ${t.wage}골드${m.role === 'barista' || m.role === 'baker' ? ` · 제조 ${t.interval}초 · 품질 ~${t.quality}` : ''}</small></div>
            ${hired ? `<button class="btn small ghost" data-act="fire" data-id="${m.uid}">해고</button>` : `<button class="price ${t.gemHire ? 'gems' : 'gold'}" data-act="hire" data-id="${m.uid}" ${s.staff.length >= slots ? 'disabled' : ''}>${cost}</button>`}</div>`;
        };
        body.innerHTML = `
          <div class="row between"><b>고용 슬롯 ${s.staff.length} / ${slots}</b><small>${slots === 0 ? '카페 Lv.2에 직원 고용이 열려요' : slots < 4 ? '카페 레벨이 오르면 슬롯이 늘어요' : ''}</small></div>
          ${g.day.open ? '<p class="note warn">영업 중에는 고용·해고를 할 수 없어요.</p>' : ''}
          <p class="note">직원은 반복 업무를 돕지만, 직접 만든 메뉴가 더 맛있고 빠르답니다.</p>
          <h3 class="section">우리 직원</h3>${s.staff.length ? s.staff.map((m) => card(m, true)).join('') : '<p class="empty">아직 직원이 없어요</p>'}
          <h3 class="section">오늘의 지원자 <small>(매일 새로 와요)</small></h3>${s.staffCandidates.list.map((m) => card(m, false)).join('') || '<p class="empty">오늘 지원자를 모두 만났어요</p>'}`;
        lazyThumbs(body, thumbFor);
        bindActs(body, {
          hire: async (b) => {
            if (g.day.open) return this.toasts.show('영업이 끝난 뒤 고용할 수 있어요.', 'warn');
            const m = s.staffCandidates.list.find((x) => x.uid === b.dataset.id);
            if (!m) return;
            if (s.staff.length >= staffSlots(s.cafeLevel)) return this.toasts.show('고용 슬롯이 부족해요.', 'warn');
            const t = TIERS[m.tier];
            const c: Currency = t.gemHire ? 'gems' : 'gold';
            const price = t.gemHire || t.hire;
            if (s[c] < price) return this.toasts.show(c === 'gems' ? '보석이 부족해요.' : '골드가 부족해요.', 'warn');
            if (!(await this.sheets.confirm(`${t.name} ${ROLES[m.role].name} <b>${m.name}</b>을(를) ${priceTag(c, price)}에 고용할까요?<br/><small>일당 ${t.wage}골드가 매일 정산돼요.</small>`, '고용'))) return;
            if (!g.progress.spend(c, price)) return;
            s.staff.push(m);
            s.staffCandidates.list = s.staffCandidates.list.filter((x) => x !== m);
            g.staff.rebuild();
            audio.play('good');
            this.toasts.show(`${m.name}이(가) 합류했어요!`, 'good');
            if (s.staff.length === 1) g.progress.addMemory('첫 직원', `${ROLES[m.role].name} ${m.name}이(가) 함께 일하게 되었어요.`, undefined, 'firststaff');
            g.saveNow();
            h.refresh();
          },
          fire: async (b) => {
            if (g.day.open) return this.toasts.show('영업이 끝난 뒤 해고할 수 있어요.', 'warn');
            const m = s.staff.find((x) => x.uid === b.dataset.id);
            if (!m || !(await this.sheets.confirm(`${m.name}을(를) 해고할까요? 고용 비용은 돌려받을 수 없어요.`, '해고'))) return;
            s.staff = s.staff.filter((x) => x !== m);
            g.staff.rebuild();
            g.saveNow();
            h.refresh();
          },
        });
      },
    });
  }

  // ================================================================ level info
  levelInfo() {
    const g = this.game;
    this.sheets.open({
      title: '성장 정보',
      icon: ICON.star,
      cls: 'dialog',
      render: (body, h) => {
        const s = g.state;
        const nextRecipes = MENU.filter((m) => m.unlockLevel === s.playerLevel + 1).map((m) => m.name);
        const nextCafe = this.cafeUnlocks(s.cafeLevel + 1);
        body.innerHTML = `
          <h3 class="section">플레이어 Lv.${s.playerLevel}</h3>${progressBar(s.playerExp, playerExpReq(s.playerLevel))}
          <small>다음 레벨 보상: 보석 ${PLAYER_LEVEL_GEMS}${nextRecipes.length ? ` · 레시피 ${nextRecipes.join(', ')}` : ''}</small>
          <h3 class="section">카페 Lv.${s.cafeLevel}</h3>${progressBar(s.cafeExp, cafeExpReq(s.cafeLevel))}
          <small>다음 레벨 보상: 보석 ${CAFE_LEVEL_GEMS}${nextCafe.length ? ' · ' + nextCafe.join(', ') : ''}</small>
          <h3 class="section">카페 평판 ${s.reputation.toFixed(1)} / 5</h3>
          <div class="settle-grid"><div><small>손님 만족도</small><b>${Math.round(s.satisfactionAvg)}점</b></div><div><small>인테리어 분위기</small><b>${g.map.ambiance + (THEME_BY_ID[s.theme]?.ambiance ?? 0)}점</b></div></div>
          <p class="note">평판이 높을수록 손님이 자주 오고 팁이 늘어나요. 만족도(80%)와 분위기(20%)로 계산돼요.</p>
          <button class="btn wide" data-act="ok">닫기</button>`;
        bindActs(body, { ok: () => h.close() });
      },
    });
  }

  private cafeUnlocks(level: number) {
    const out: string[] = [];
    if (staffSlots(level) > staffSlots(level - 1)) out.push(`직원 슬롯 ${staffSlots(level)}개`);
    for (const e of EXPANSIONS) if (e.cafeLevel === level) out.push(`확장: ${e.name}`);
    const f = FURNITURE.filter((x) => x.minCafeLevel === level).map((x) => x.name);
    if (f.length) out.push(`가구: ${f.join(', ')}`);
    const eq = EQUIPMENT.filter((x) => x.minCafeLevel === level).map((x) => x.name);
    if (eq.length) out.push(`장비: ${eq.join(', ')}`);
    return out;
  }

  private flushLevelUps() {
    if (this.sheets.stack.some((s) => s.el.classList.contains('levelup'))) return;
    const e = this.levelQueue.shift();
    if (!e) return;
    const unlocks = e.kind === 'player' ? MENU.filter((m) => m.unlockLevel === e.level).map((m) => `새 레시피: ${m.name}`).concat(OUTFITS.filter((o) => o.minPlayerLevel === e.level && o.price > 0).map((o) => `의상: ${o.name}`)) : this.cafeUnlocks(e.level);
    this.sheets.open({
      title: e.kind === 'player' ? '플레이어 레벨 업!' : '카페 레벨 업!',
      cls: 'dialog levelup',
      render: (body, h) => {
        body.innerHTML = `<div class="lv-burst"><b>Lv.${e.level}</b></div>
          <div class="unlocks"><span class="rw"><i class="ico">${ICON.gem}</i>+${e.kind === 'player' ? PLAYER_LEVEL_GEMS : CAFE_LEVEL_GEMS}</span>${unlocks.map((u) => `<span class="unlock">${u}</span>`).join('')}</div>
          <button class="btn primary big wide" data-act="ok">좋아요!</button>`;
        bindActs(body, { ok: () => h.close() });
      },
      onClose: () => window.setTimeout(() => this.flushLevelUps(), 250),
    });
  }

  // ================================================================ settings
  settings() {
    const g = this.game;
    this.settingsHandle = this.sheets.open({
      title: '설정',
      icon: ICON.gear,
      cls: 'tall',
      onClose: () => (this.settingsHandle = null),
      render: (body, h) => {
        const st = g.state.settings;
        const tg = (k: keyof typeof st, label: string) => `<label class="toggle-row"><span>${label}</span><button class="switch ${st[k] ? 'on' : ''}" data-act="toggle" data-k="${k}" role="switch" aria-checked="${!!st[k]}"><i></i></button></label>`;
        body.innerHTML = `
          ${tg('sfx', '효과음')}${tg('music', '배경 음악')}${tg('vibration', '진동')}${tg('shadows', '그림자 (끄면 저사양 기기에서 더 부드러워요)')}
          <div class="toggle-row"><span>하루 영업 시간</span><div class="seg">${[5, 6, 8, 10].map((m) => `<button class="${st.dayMinutes === m ? 'on' : ''}" data-act="day" data-m="${m}">${m}분</button>`).join('')}</div></div>
          ${this.accountHtml()}
          <h3 class="section">데이터</h3>
          <p class="note">플레이 데이터는 이 기기에 자동 저장돼요.${g.cloud.enabled ? ' Google 계정을 연동하면 클라우드에도 저장돼요.' : ' 기기를 바꿀 때는 백업 파일을 내보내 가져오세요.'}</p>
          <div class="row gap wrap"><button class="btn" data-act="export">백업 내보내기</button><button class="btn" data-act="import">백업 가져오기</button><button class="btn ghost danger" data-act="reset">데이터 초기화</button></div>
          <input type="file" accept="application/json,.json" class="hidden import-in"/>
          <h3 class="section">정보</h3>
          <p class="small">MY LITTLE CAFE v${import.meta.env.VITE_APP_VERSION ?? '0.1.0'}<br/>3D 엔진: three.js (MIT) · 앱: Capacitor (MIT) · 폰트: BM JUA (SIL OFL 1.1)<br/>모든 캐릭터·가구·사운드는 게임 코드로 직접 생성됩니다.</p>`;
        const fileIn = $('.import-in', body) as HTMLInputElement;
        fileIn.addEventListener('change', async () => {
          const f = fileIn.files?.[0];
          if (!f) return;
          try {
            const st2 = g.saver.importJson(await f.text());
            if (!(await this.sheets.confirm('현재 데이터를 백업 파일로 덮어쓸까요?', '가져오기'))) return;
            g.setState(st2);
            await g.saveNow();
            this.toasts.show('백업을 불러왔어요.', 'good');
            h.close();
          } catch {
            this.toasts.show('올바른 백업 파일이 아니에요.', 'warn');
          }
        });
        bindActs(body, {
          toggle: (b) => {
            const k = b.dataset.k as 'sfx' | 'music' | 'vibration' | 'shadows';
            st[k] = !st[k];
            if (k === 'sfx') audio.sfxOn = st.sfx;
            if (k === 'music') audio.setMusic(st.music);
            if (k === 'vibration') setVibration(st.vibration);
            if (k === 'shadows') g.stage.setShadows(st.shadows);
            g.markDirty();
            h.refresh();
          },
          day: (b) => {
            st.dayMinutes = Number(b.dataset.m);
            g.markDirty();
            h.refresh();
          },
          export: () => {
            const blob = new Blob([g.saver.exportJson(g.state)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `my-little-cafe-backup-${todayKey()}.json`;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          },
          import: () => fileIn.click(),
          link: async () => {
            await g.cloud.link();
          },
          syncnow: async () => {
            await g.saveNow();
            if (await g.cloud.uploadNow()) this.toasts.show('클라우드에 저장했어요.', 'good');
            else this.toasts.show('클라우드 저장에 실패했어요. 네트워크를 확인해 주세요.', 'warn');
          },
          signout: async () => {
            if (!(await this.sheets.confirm('로그아웃할까요? 이 기기의 데이터는 그대로 남고, 클라우드 저장은 멈춰요.', '로그아웃'))) return;
            await g.cloud.signOut();
            this.toasts.show('로그아웃했어요.', 'info');
          },
          delacct: async () => {
            if (!(await this.sheets.confirm('계정을 삭제할까요?<br/><small>클라우드 저장 데이터와 로그인 정보가 영구 삭제돼요. 이 기기의 게임 데이터는 남아요.</small>', '계정 삭제'))) return;
            if (!(await this.sheets.confirm('정말 삭제할까요? 되돌릴 수 없어요.', '영구 삭제'))) return;
            let r = await g.cloud.deleteAccount();
            if (r === 'reauth') {
              this.toasts.show('보안을 위해 한 번 더 로그인해 주세요.', 'info');
              if (await g.cloud.reauthenticate()) r = await g.cloud.deleteAccount();
            }
            this.toasts.show(r === 'ok' ? '계정과 클라우드 데이터를 삭제했어요.' : '계정을 삭제하지 못했어요. 다시 시도해 주세요.', r === 'ok' ? 'good' : 'warn');
          },
          reset: async () => {
            if (!(await this.sheets.confirm(`이 기기의 모든 플레이 데이터를 지울까요? 되돌릴 수 없어요.${g.cloud.user ? '<br/><small>계정은 로그아웃되고, 클라우드 저장 데이터는 지워지지 않아요.</small>' : ''}`, '초기화'))) return;
            if (!(await this.sheets.confirm('정말로 처음부터 다시 시작할까요?', '처음부터'))) return;
            // never let a wiped local save overwrite the cloud copy
            if (g.cloud.user) await g.cloud.signOut();
            await g.saver.reset();
            g.setState(createDefaultState());
            await g.saveNow();
            this.sheets.closeAll();
            this.toasts.show('새로운 카페를 시작해요!', 'good');
          },
        });
      },
    });
  }

  private accountHtml(): string {
    const c = this.game.cloud;
    if (!c.enabled) return '';
    if (!c.user) preloadFirebase();
    const statusText: Record<string, string> = {
      signedOut: '연동 안 됨',
      syncing: '동기화 중…',
      synced: c.lastSync ? `저장됨 ${new Date(c.lastSync).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '연동됨',
      error: '동기화 오류',
      off: '',
    };
    if (!c.user)
      return `<h3 class="section">계정</h3>
        <div class="account"><p>지금은 <b>게스트</b>로 플레이 중이에요. Google 계정을 연동하면 앱을 지우거나 기기를 바꿔도 이어서 할 수 있어요.</p>
        <button class="btn primary wide google-btn" data-act="link" ${c.status === 'syncing' ? 'disabled' : ''}><span class="g-logo">G</span>Google 계정 연동</button>
        ${c.status === 'error' ? `<p class="note warn">${escapeHtml(c.error)}</p>` : ''}</div>`;
    return `<h3 class="section">계정</h3>
      <div class="account"><div class="row between"><span><b>${escapeHtml(c.user.name ?? 'Google 계정')}</b><br/><small>${escapeHtml(c.user.email ?? '')}</small></span><span class="sync ${c.status}">${statusText[c.status]}</span></div>
      ${c.status === 'error' ? `<p class="note warn">${escapeHtml(c.error)}</p>` : ''}
      <div class="row gap wrap"><button class="btn small" data-act="syncnow" ${c.status === 'syncing' ? 'disabled' : ''}>지금 클라우드에 저장</button><button class="btn small ghost" data-act="signout">로그아웃</button><button class="btn small ghost danger" data-act="delacct">계정 삭제</button></div></div>`;
  }

  /** Ask which save to keep when the cloud copy and this device differ. */
  chooseSave(local: SaveSummary, cloud: SaveSummary): Promise<Choice> {
    const fmtAt = (t: number) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
    const card = (k: Choice, title: string, s: SaveSummary) => `<button class="save-pick" data-act="pick" data-k="${k}"><b>${title}</b><span>플레이어 Lv.${s.playerLevel} · 카페 Lv.${s.cafeLevel}</span><span><i class="ico">${ICON.coin}</i>${fmt(s.gold)} · ${s.days}일차</span><small>마지막 저장 ${fmtAt(s.at)}</small></button>`;
    return new Promise((res) => {
      let done = false;
      const h = this.sheets.open({
        title: '어떤 데이터로 할까요?',
        cls: 'dialog',
        render: (body) => {
          body.innerHTML = `<p class="dlg-msg">클라우드와 이 기기의 플레이 데이터가 달라요. 계속할 데이터를 골라 주세요.<br/><small>선택하지 않은 쪽은 덮어써져요.</small></p>
            <div class="save-picks">${card('cloud', '클라우드', cloud)}${card('local', '이 기기', local)}</div>`;
          bindActs(body, {
            pick: (b) => {
              done = true;
              res(b.dataset.k as Choice);
              h.close();
            },
          });
        },
        onClose: () => {
          if (!done) res('local');
        },
      });
    });
  }

  // ================================================================ pause
  pause() {
    const g = this.game;
    g.paused = true;
    audio.suspend();
    this.sheets.open({
      title: '일시정지',
      cls: 'dialog',
      icon: ICON.pause,
      render: (body, h) => {
        body.innerHTML = `<p class="dlg-msg">잠시 쉬어가요. 손님들도 기다려 줄 거예요.</p><button class="btn primary big wide" data-act="resume">계속하기</button><button class="btn wide" data-act="settings">설정</button>`;
        bindActs(body, {
          resume: () => h.close(),
          settings: () => this.settings(),
        });
      },
      onClose: () => {
        g.paused = false;
        audio.resume();
      },
    });
  }

  // ================================================================ edit mode toolbar
  openEdit(root: HTMLElement) {
    const g = this.game;
    if (!g.edit.enter()) return false;
    this.hud.setEditMode(true);
    this.editBar = el(`<div class="editbar">
      <div class="edit-top"><b>꾸미기 모드</b><small>가구를 탭해 선택 · 끌어서 이동</small><button class="btn primary small" data-act="done">완료</button></div>
      <div class="edit-sel hidden"><span class="sel-name"></span><button class="icon-btn" data-act="rotate" aria-label="회전">${ICON.rotate}</button><button class="icon-btn" data-act="store" aria-label="보관">${ICON.box}</button><button class="icon-btn" data-act="desel" aria-label="선택 해제">${ICON.check}</button></div>
      <div class="edit-drawer"><div class="tabs"></div><div class="edit-list"></div></div></div>`);
    root.appendChild(this.editBar);
    bindActs(this.editBar, {
      done: () => this.closeEdit(),
      rotate: () => g.edit.rotate(),
      store: () => g.edit.store(),
      desel: () => g.edit.deselect(),
      etab: (b) => {
        this.editTab = b.dataset.t as typeof this.editTab;
        this.renderEdit();
      },
      place: (b) => g.edit.placeFromStorage(b.dataset.id!),
      theme: async (b) => {
        const t = THEME_BY_ID[b.dataset.id!];
        if (!g.state.owned.themes.includes(t.id)) {
          this.toasts.show('상점 > 가구 > 카페 테마에서 구매할 수 있어요.', 'info');
          return;
        }
        g.state.theme = t.id;
        g.rebuildWorld();
        g.markDirty();
        audio.play('good');
        this.renderEdit();
      },
      expand: async (b) => {
        const i = Number(b.dataset.i);
        const e = EXPANSIONS[i];
        if (i !== g.state.expansion + 1 || g.state.cafeLevel < e.cafeLevel) return;
        if (g.state.gold < e.price) return this.toasts.show('골드가 부족해요.', 'warn');
        if (!(await this.sheets.confirm(`<b>${e.name}</b> 공사를 ${priceTag('gold', e.price)}에 진행할까요?<br/><small>${e.desc}</small>`, '확장하기'))) return;
        if (!g.progress.spend('gold', e.price)) return;
        g.state.expansion = i;
        g.edit.deselect();
        g.rebuildWorld();
        audio.play('levelup');
        this.toasts.show(`${e.name} 완성!`, 'good');
        g.progress.addMemory(`카페 확장: ${e.name}`, e.desc, undefined, 'exp_' + e.id);
        g.saveNow();
        this.renderEdit();
      },
    });
    g.edit.onChange = () => this.renderEdit();
    this.renderEdit();
    return true;
  }

  closeEdit() {
    if (!this.editBar) return;
    this.game.edit.exit();
    this.editBar.parentNode?.removeChild(this.editBar);
    this.editBar = null;
    this.hud.setEditMode(false);
    this.hud.setTab('cafe');
  }

  get editing() {
    return !!this.editBar;
  }

  private renderEdit() {
    const bar = this.editBar;
    if (!bar) return;
    const g = this.game;
    const s = g.state;
    const sel = g.edit.selectedItem;
    $('.edit-sel', bar).classList.toggle('hidden', !sel);
    if (sel) $('.sel-name', bar).textContent = FURNITURE_BY_ID[sel.id]?.name ?? '';
    $('.tabs', bar).innerHTML = (
      [['storage', '보관함'], ['theme', '테마'], ['expand', '확장']] as const
    ).map(([k, n]) => `<button data-act="etab" data-t="${k}" class="${this.editTab === k ? 'on' : ''}">${n}</button>`).join('');
    const list = $('.edit-list', bar);
    if (this.editTab === 'storage') {
      const items = FURNITURE.filter((f) => g.storedCount(f.id) > 0);
      list.innerHTML = items.length
        ? items.map((f) => `<button class="ecard" data-act="place" data-id="${f.id}"><img data-thumb="f|${f.id}" alt=""/><b>${f.name}</b><em>×${g.storedCount(f.id)}</em></button>`).join('')
        : `<p class="empty">보관 중인 가구가 없어요. 상점에서 구매하거나 배치된 가구를 보관할 수 있어요.</p>`;
      lazyThumbs(list, thumbFor);
    } else if (this.editTab === 'theme') {
      list.innerHTML = THEMES.map((t) => `<button class="ecard ${s.theme === t.id ? 'on' : ''} ${s.owned.themes.includes(t.id) ? '' : 'locked'}" data-act="theme" data-id="${t.id}"><div class="swatch" style="--w:${hex(t.wall)};--s:${hex(t.wainscot)};--f:${hex(t.floorA)};--g:${hex(t.floorB)}"></div><b>${t.name}</b>${s.owned.themes.includes(t.id) ? '' : `<em><i class="ico">${ICON.lock}</i></em>`}</button>`).join('');
    } else {
      list.innerHTML = EXPANSIONS.map((e, i) => {
        const done = i <= s.expansion;
        const next = i === s.expansion + 1;
        const lv = s.cafeLevel >= e.cafeLevel;
        return `<button class="ecard wide ${done ? 'on' : ''} ${next && lv ? '' : done ? '' : 'locked'}" data-act="expand" data-i="${i}"><i class="ico">${ICON.expand}</i><b>${e.name}</b><small>${e.desc}</small><em>${done ? '완료' : next ? (lv ? priceTag('gold', e.price) : `카페 Lv.${e.cafeLevel}`) : `카페 Lv.${e.cafeLevel}`}</em></button>`;
      }).join('');
    }
  }
}

void gradeOf;
