import { events } from '../core/events';
import { todayKey, uid, type GameState, type AlbumEntry } from '../core/state';
import {
  ACHIEVEMENTS, ATTENDANCE_CYCLE, CAFE_LEVEL_GEMS, activeEvent, DAILY_QUESTS, MAX_LEVEL, MONTHLY_MILESTONES, PLAYER_LEVEL_GEMS, STORY_QUESTS,
  cafeExpReq, playerExpReq, type Counter, type Reward,
} from '../data/progression';
import { THEME_BY_ID } from '../data/furniture';
import { clamp } from '../core/util';

/** All currency / EXP / quest / attendance rules live here so UI and gameplay share one source of truth. */
export class Progress {
  snapshot: () => string | undefined = () => undefined;
  constructor(public s: GameState) {}

  // ---------- currency ----------
  addGold(n: number) {
    this.s.gold = Math.max(0, Math.floor(this.s.gold + n));
    events.emit('currency', undefined);
  }
  spend(currency: 'gold' | 'gems', n: number): boolean {
    if (n <= 0) return true;
    if (this.s[currency] < n) return false;
    this.s[currency] -= n;
    events.emit('currency', undefined);
    return true;
  }
  addGems(n: number) {
    this.s.gems += n;
    events.emit('currency', undefined);
  }
  grant(r: Reward) {
    if (r.gold) this.addGold(r.gold);
    if (r.gems) this.addGems(r.gems);
    if (r.exp) this.addPlayerExp(r.exp);
  }

  // ---------- levels ----------
  addPlayerExp(n: number) {
    const s = this.s;
    s.playerExp += Math.round(n);
    while (s.playerLevel < MAX_LEVEL && s.playerExp >= playerExpReq(s.playerLevel)) {
      s.playerExp -= playerExpReq(s.playerLevel);
      s.playerLevel++;
      s.gems += PLAYER_LEVEL_GEMS;
      events.emit('levelUp', { kind: 'player', level: s.playerLevel });
    }
    events.emit('exp', undefined);
  }
  addCafeExp(n: number) {
    const s = this.s;
    s.cafeExp += Math.round(n);
    while (s.cafeLevel < MAX_LEVEL && s.cafeExp >= cafeExpReq(s.cafeLevel)) {
      s.cafeExp -= cafeExpReq(s.cafeLevel);
      s.cafeLevel++;
      s.gems += CAFE_LEVEL_GEMS;
      events.emit('levelUp', { kind: 'cafe', level: s.cafeLevel });
      if (s.cafeLevel === 2) this.addMemory('카페 Lv.2', '작은 카페가 조금씩 알려지기 시작했어요.');
    }
    events.emit('exp', undefined);
  }

  /** Reputation 0..5: 80% from customer satisfaction trend, 20% from atmosphere. */
  updateReputation(ambiance: number) {
    const s = this.s;
    const theme = THEME_BY_ID[s.theme]?.ambiance ?? 0;
    const sat = (s.satisfactionAvg / 100) * 4;
    const amb = Math.min(1, (ambiance + theme) / 50);
    s.reputation = clamp(Math.round((sat + amb) * 10) / 10, 0, 5);
  }
  recordSatisfaction(sat: number) {
    this.s.satisfactionAvg = this.s.satisfactionAvg * 0.9 + sat * 0.1;
  }

  // ---------- daily ----------
  ensureDaily() {
    const t = todayKey();
    if (this.s.daily.date !== t) {
      this.s.daily = { date: t, progress: {}, claimed: [] };
      events.emit('questsChanged', undefined);
    }
  }
  count(c: Counter, n = 1) {
    this.ensureDaily();
    for (const q of DAILY_QUESTS) if (q.counter === c) this.s.daily.progress[q.id] = (this.s.daily.progress[q.id] ?? 0) + n;
    const ev = this.ensureEvent();
    if (ev) for (const q of ev.quests) if (q.counter === c) this.s.event.progress[q.id] = (this.s.event.progress[q.id] ?? 0) + n;
    events.emit('questsChanged', undefined);
  }

  /** Active seasonal event, resetting progress when a new event (or a new year) starts. */
  ensureEvent() {
    const ev = activeEvent();
    if (!ev) return null;
    const y = new Date().getFullYear();
    if (this.s.event.id !== ev.id || this.s.event.year !== y) this.s.event = { id: ev.id, year: y, progress: {}, claimed: [] };
    return ev;
  }
  eventQuestState(qid: string) {
    const ev = this.ensureEvent();
    const q = ev?.quests.find((x) => x.id === qid);
    if (!q) return null;
    const p = Math.min(q.target, this.s.event.progress[qid] ?? 0);
    return { q, p, done: p >= q.target, claimed: this.s.event.claimed.includes(qid) };
  }
  claimEvent(qid: string) {
    const st = this.eventQuestState(qid);
    if (!st || !st.done || st.claimed) return false;
    this.s.event.claimed.push(qid);
    this.grant(st.q.reward);
    events.emit('questsChanged', undefined);
    return true;
  }
  dailyState(id: string) {
    const q = DAILY_QUESTS.find((d) => d.id === id)!;
    const p = Math.min(q.target, this.s.daily.progress[id] ?? 0);
    return { q, p, done: p >= q.target, claimed: this.s.daily.claimed.includes(id) };
  }
  claimDaily(id: string): boolean {
    this.ensureDaily();
    const st = this.dailyState(id);
    if (!st.done || st.claimed) return false;
    this.s.daily.claimed.push(id);
    this.grant(st.q.reward);
    events.emit('questsChanged', undefined);
    return true;
  }

  achievementState(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    const claimed = this.s.achievementsClaimed[id] ?? 0;
    const val = a.value(this.s);
    const tier = Math.min(claimed, a.tiers.length - 1);
    const target = a.tiers[tier];
    const complete = claimed >= a.tiers.length;
    return { a, val, claimed, target, ready: !complete && val >= target, complete, reward: a.rewards[tier] };
  }
  claimAchievement(id: string) {
    const st = this.achievementState(id);
    if (!st.ready) return false;
    this.s.achievementsClaimed[id] = st.claimed + 1;
    this.grant(st.reward);
    events.emit('questsChanged', undefined);
    return true;
  }

  storyState() {
    const i = this.s.storyIndex;
    if (i >= STORY_QUESTS.length) return null;
    const q = STORY_QUESTS[i];
    return { i, q, done: q.check(this.s) };
  }
  claimStory() {
    const st = this.storyState();
    if (!st || !st.done) return false;
    this.s.storyIndex++;
    this.grant(st.q.reward);
    events.emit('questsChanged', undefined);
    return true;
  }

  claimableCount(): number {
    this.ensureDaily();
    let n = DAILY_QUESTS.filter((q) => {
      const st = this.dailyState(q.id);
      return st.done && !st.claimed;
    }).length;
    n += ACHIEVEMENTS.filter((a) => this.achievementState(a.id).ready).length;
    if (this.storyState()?.done) n++;
    const ev = this.ensureEvent();
    if (ev) n += ev.quests.filter((q) => {
      const st = this.eventQuestState(q.id);
      return st && st.done && !st.claimed;
    }).length;
    return n;
  }

  // ---------- attendance ----------
  attendanceAvailable() {
    return this.s.attendance.lastDate !== todayKey();
  }
  /** Missing days does not reset the 7-day cycle position (no harsh penalty); only the streak counter resets. */
  checkIn(): { reward: Reward; day: number; milestone?: Reward } | null {
    const a = this.s.attendance;
    const t = todayKey();
    if (a.lastDate === t) return null;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    a.streak = a.lastDate === todayKey(y) ? a.streak + 1 : 1;
    const monthKey = t.slice(0, 7);
    if (a.monthKey !== monthKey) {
      a.monthKey = monthKey;
      a.monthDays = 0;
      a.monthClaimed = [];
    }
    const day = a.cycleDay;
    const reward = ATTENDANCE_CYCLE[day];
    this.grant(reward);
    a.cycleDay = (a.cycleDay + 1) % ATTENDANCE_CYCLE.length;
    a.lastDate = t;
    a.total++;
    a.monthDays++;
    let milestone: Reward | undefined;
    for (const m of MONTHLY_MILESTONES) {
      if (a.monthDays >= m.days && !a.monthClaimed.includes(m.days)) {
        a.monthClaimed.push(m.days);
        this.grant(m.reward);
        milestone = m.reward;
      }
    }
    return { reward, day, milestone };
  }

  // ---------- album ----------
  addMemory(title: string, desc: string, customerId?: string, onceKey?: string): AlbumEntry | null {
    if (onceKey) {
      if (this.s.flags['mem_' + onceKey]) return null;
      this.s.flags['mem_' + onceKey] = true;
    }
    const entry: AlbumEntry = { id: uid('m'), date: new Date().toISOString(), title, desc, customerId, image: this.snapshot() };
    this.s.album.push(entry);
    // keep storage bounded: drop images of very old entries
    const withImg = this.s.album.filter((a) => a.image);
    if (withImg.length > 60) withImg[0].image = undefined;
    events.emit('album', { title });
    return entry;
  }
}
