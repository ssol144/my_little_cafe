import type { GameState } from '../core/state';

// ---------- Levels ----------
export const MAX_LEVEL = 30;
export function playerExpReq(level: number) {
  return Math.round(60 + 40 * Math.pow(level, 1.5));
}
export function cafeExpReq(level: number) {
  return Math.round(150 + 120 * Math.pow(level, 1.5));
}
export function staffSlots(cafeLevel: number) {
  return cafeLevel >= 8 ? 4 : cafeLevel >= 6 ? 3 : cafeLevel >= 4 ? 2 : cafeLevel >= 2 ? 1 : 0;
}
export const PLAYER_LEVEL_GEMS = 5;
export const CAFE_LEVEL_GEMS = 8;

// ---------- Quests ----------
export interface Reward {
  gold?: number;
  gems?: number;
  exp?: number;
}

export type Counter = 'bread' | 'coffee' | 'serve' | 'day' | 'perfect';

export interface DailyQuestDef {
  id: string;
  name: string;
  counter: Counter;
  target: number;
  reward: Reward;
}

export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'd_bread', name: '빵 3개 만들기', counter: 'bread', target: 3, reward: { gold: 60, exp: 15 } },
  { id: 'd_coffee', name: '커피 3잔 만들기', counter: 'coffee', target: 3, reward: { gold: 60, exp: 15 } },
  { id: 'd_serve', name: '손님 8명 응대하기', counter: 'serve', target: 8, reward: { gold: 80, gems: 2 } },
  { id: 'd_perfect', name: 'PERFECT 메뉴 2개', counter: 'perfect', target: 2, reward: { gold: 50, gems: 2 } },
  { id: 'd_day', name: '영업 1회 완료', counter: 'day', target: 1, reward: { gold: 50, gems: 3 } },
];

export interface AchievementDef {
  id: string;
  name: string;
  unit: string;
  value: (s: GameState) => number;
  tiers: number[];
  rewards: Reward[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_customers', name: '누적 손님', unit: '명', value: (s) => s.stats.customersServed, tiers: [10, 50, 200, 1000], rewards: [{ gems: 5 }, { gems: 10 }, { gems: 20 }, { gems: 40 }] },
  { id: 'a_crafted', name: '메뉴 제조', unit: '개', value: (s) => s.stats.itemsCrafted, tiers: [20, 100, 500, 2000], rewards: [{ gems: 5 }, { gems: 10 }, { gems: 20 }, { gems: 40 }] },
  { id: 'a_perfect', name: 'PERFECT 제조', unit: '개', value: (s) => s.stats.perfects, tiers: [10, 50, 200], rewards: [{ gems: 5 }, { gems: 15 }, { gems: 30 }] },
  { id: 'a_regulars', name: '단골 손님', unit: '명', value: (s) => Object.values(s.customers).filter((c) => c.regular).length, tiers: [1, 3, 8], rewards: [{ gems: 5 }, { gems: 15 }, { gems: 30 }] },
  { id: 'a_rep', name: '카페 평판', unit: '★', value: (s) => Math.floor(s.reputation), tiers: [3, 4, 5], rewards: [{ gems: 10 }, { gems: 20 }, { gems: 40 }] },
  { id: 'a_days', name: '영업 일수', unit: '일', value: (s) => s.stats.daysCompleted, tiers: [3, 10, 30, 100], rewards: [{ gems: 5 }, { gems: 10 }, { gems: 20 }, { gems: 40 }] },
];

export interface StoryQuestDef {
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => string;
  reward: Reward;
}

export const STORY_QUESTS: StoryQuestDef[] = [
  { name: '첫 영업', desc: '카페를 열고 하루 영업을 마쳐요', check: (s) => s.stats.daysCompleted >= 1, reward: { gold: 150, gems: 5 } },
  { name: '첫 손님들', desc: '손님 5명에게 메뉴를 서빙해요', check: (s) => s.stats.customersServed >= 5, progress: (s) => `${Math.min(5, s.stats.customersServed)}/5`, reward: { gold: 120 } },
  { name: '새 레시피', desc: '플레이어 Lv.2를 달성해 머핀 레시피를 배워요', check: (s) => s.playerLevel >= 2, reward: { gold: 100, gems: 5 } },
  { name: '첫 단골', desc: '같은 손님이 자주 찾아오면 단골이 돼요', check: (s) => Object.values(s.customers).some((c) => c.regular), reward: { gold: 200, gems: 10 } },
  { name: '특별 손님의 부탁', desc: '여행작가 페피에게 크루아상(GREAT 이상)을 대접해요', check: (s) => !!s.flags['special_pepi'], reward: { gold: 100, gems: 5 } },
  { name: '카페 확장', desc: '꾸미기 > 확장에서 넓은 홀을 열어요', check: (s) => s.expansion >= 1, reward: { gold: 300, gems: 10 } },
  { name: '함께 일해요', desc: '직원을 1명 고용해요', check: (s) => s.staff.length >= 1, reward: { gold: 200, gems: 5 } },
  { name: '할머니의 시나몬 롤', desc: '봄이 할머니에게 시나몬 롤(GREAT 이상)을 대접해요', check: (s) => !!s.flags['special_bom'], reward: { gold: 200, gems: 10 } },
  { name: '소문난 카페', desc: '카페 평판 ★4를 달성해요', check: (s) => s.reputation >= 4, reward: { gold: 500, gems: 15 } },
  { name: '음악가의 라떼', desc: '음악가 루카에게 라떼(GREAT 이상)를 대접해요', check: (s) => !!s.flags['special_luka'], reward: { gold: 500, gems: 20 } },
];

// ---------- Limited-time events (recur yearly by month-day window) ----------
export interface EventDef {
  id: string;
  name: string;
  desc: string;
  start: string; // MM-DD
  end: string; // MM-DD inclusive
  quests: { id: string; name: string; counter: Counter; target: number; reward: Reward }[];
}
export const EVENTS: EventDef[] = [
  {
    id: 'winter', name: '따뜻한 겨울 준비', desc: '추운 날, 따뜻한 빵과 커피로 손님을 맞이해요', start: '11-15', end: '12-31',
    quests: [
      { id: 'w_coffee', name: '따뜻한 커피 15잔', counter: 'coffee', target: 15, reward: { gems: 10 } },
      { id: 'w_bread', name: '갓 구운 빵 15개', counter: 'bread', target: 15, reward: { gems: 10 } },
      { id: 'w_serve', name: '겨울 손님 40명 응대', counter: 'serve', target: 40, reward: { gems: 25 } },
    ],
  },
  {
    id: 'spring', name: '벚꽃 카페 페스타', desc: '봄 손님 맞이 이벤트', start: '03-20', end: '04-30',
    quests: [
      { id: 's_perfect', name: 'PERFECT 메뉴 10개', counter: 'perfect', target: 10, reward: { gems: 15 } },
      { id: 's_serve', name: '봄 손님 40명 응대', counter: 'serve', target: 40, reward: { gems: 25 } },
    ],
  },
  {
    id: 'summer', name: '여름 테라스 축제', desc: '시원한 여름밤 카페 축제', start: '07-15', end: '08-31',
    quests: [
      { id: 'su_coffee', name: '커피 20잔', counter: 'coffee', target: 20, reward: { gems: 15 } },
      { id: 'su_day', name: '영업 5회', counter: 'day', target: 5, reward: { gems: 20 } },
    ],
  },
];
export function activeEvent(d = new Date()): EventDef | null {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return EVENTS.find((e) => md >= e.start && md <= e.end) ?? null;
}

// ---------- Attendance ----------
export const ATTENDANCE_CYCLE: Reward[] = [
  { gold: 100 },
  { gold: 150 },
  { gems: 5 },
  { gold: 250 },
  { gems: 8 },
  { gold: 400 },
  { gems: 25 },
];
export const MONTHLY_MILESTONES: { days: number; reward: Reward }[] = [
  { days: 5, reward: { gems: 10 } },
  { days: 10, reward: { gold: 1000 } },
  { days: 15, reward: { gems: 20 } },
  { days: 20, reward: { gems: 30 } },
];

// ---------- Staff ----------
export type StaffRole = 'barista' | 'baker' | 'hall' | 'manager';
export const ROLES: Record<StaffRole, { name: string; desc: string }> = {
  barista: { name: '바리스타', desc: '대기 중인 커피 주문을 만들어 픽업대에 올려요' },
  baker: { name: '베이커', desc: '대기 중인 빵 주문을 구워 픽업대에 올려요' },
  hall: { name: '홀 직원', desc: '픽업대의 메뉴를 손님에게 서빙해요' },
  manager: { name: '매니저', desc: '손님 인내심 +20%, 팁 +10%' },
};
export const TIERS = [
  { name: '신입', interval: 32, quality: 58, hire: 250, gemHire: 0, wage: 20, speed: 1.6 },
  { name: '숙련', interval: 24, quality: 70, hire: 700, gemHire: 0, wage: 40, speed: 2.0 },
  { name: '전문가', interval: 17, quality: 82, hire: 0, gemHire: 40, wage: 70, speed: 2.4 },
];
export const STAFF_TRAITS = ['꼼꼼함', '손이 빠름', '친절함', '긍정적', '아이디어 뱅크', '느긋함'];
export const STAFF_NAMES = ['하루', '다온', '이안', '라온', '시우', '도담', '새봄', '가람', '보미', '누리', '단비', '마루', '아토', '초코', '모카', '라떼', '쿠키', '버터'];
