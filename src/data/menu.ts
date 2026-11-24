export type StepId = 'knead' | 'shape' | 'bake' | 'topping' | 'grind' | 'extract' | 'steam' | 'latteart' | 'cream';
export type MenuKind = 'bread' | 'coffee';

export interface MenuDef {
  id: string;
  name: string;
  kind: MenuKind;
  price: number; // sale price (gold)
  cost: number; // ingredient cost paid when crafting starts
  steps: StepId[];
  unlockLevel: number; // player level
  exp: number; // player EXP for crafting
  color: number; // dominant colour for 3D item
  desc: string;
}

export const MENU: MenuDef[] = [
  { id: 'americano', name: '아메리카노', kind: 'coffee', price: 30, cost: 8, steps: ['grind', 'extract'], unlockLevel: 1, exp: 8, color: 0x4a2c1d, desc: '갓 내린 에스프레소에 뜨거운 물' },
  { id: 'croissant', name: '버터 크루아상', kind: 'bread', price: 35, cost: 10, steps: ['knead', 'shape', 'bake'], unlockLevel: 1, exp: 10, color: 0xd9973e, desc: '겹겹이 바삭한 버터 향' },
  { id: 'muffin', name: '블루베리 머핀', kind: 'bread', price: 38, cost: 11, steps: ['knead', 'bake', 'topping'], unlockLevel: 2, exp: 11, color: 0xc98b4e, desc: '새콤달콤 블루베리 듬뿍' },
  { id: 'cappuccino', name: '카푸치노', kind: 'coffee', price: 42, cost: 11, steps: ['grind', 'extract', 'steam'], unlockLevel: 3, exp: 12, color: 0xc89f74, desc: '폭신한 우유 거품' },
  { id: 'latte', name: '카페 라떼', kind: 'coffee', price: 48, cost: 12, steps: ['grind', 'extract', 'steam', 'latteart'], unlockLevel: 4, exp: 15, color: 0xd8b48c, desc: '하트 라떼아트가 포인트' },
  { id: 'cinnamon', name: '시나몬 롤', kind: 'bread', price: 52, cost: 14, steps: ['knead', 'shape', 'bake', 'topping'], unlockLevel: 5, exp: 16, color: 0xb87436, desc: '아이싱을 듬뿍 올린 롤' },
  { id: 'einspanner', name: '아인슈페너', kind: 'coffee', price: 55, cost: 15, steps: ['grind', 'extract', 'cream'], unlockLevel: 6, exp: 16, color: 0xf3ead8, desc: '진한 커피 위 달콤한 크림' },
];

export const MENU_BY_ID: Record<string, MenuDef> = Object.fromEntries(MENU.map((m) => [m.id, m]));

export const STEP_INFO: Record<StepId, { title: string; hint: string }> = {
  knead: { title: '반죽 치대기', hint: '원이 반죽 테두리에 닿을 때 탭!' },
  shape: { title: '모양 만들기', hint: '화살표 방향으로 스와이프!' },
  bake: { title: '오븐에 굽기', hint: '노릇노릇 황금색일 때 꺼내기!' },
  topping: { title: '토핑 올리기', hint: '빵 위를 문질러 골고루 덮어요' },
  grind: { title: '원두 분쇄', hint: '핸들을 빙글빙글 돌려요' },
  extract: { title: '에스프레소 추출', hint: '꾹 눌러 추출, 선에서 손을 떼요' },
  steam: { title: '우유 스티밍', hint: '꾹 눌러 데우고 초록 구간에서 떼요' },
  latteart: { title: '라떼아트', hint: '점선을 따라 그려요' },
  cream: { title: '크림 올리기', hint: '컵 위를 문질러 크림을 올려요' },
};

/** Mastery level from craft count (1..5). At level 3+, the first step can be auto-completed. */
export const MASTERY_THRESHOLDS = [0, 5, 15, 35, 70];
export function masteryLevel(count: number): number {
  let lv = 1;
  for (let i = 1; i < MASTERY_THRESHOLDS.length; i++) if (count >= MASTERY_THRESHOLDS[i]) lv = i + 1;
  return lv;
}
export const AUTO_STEP_MASTERY = 3;
export const AUTO_STEP_SCORE = 82;

export function gradeOf(q: number): { label: string; stars: number; cls: string } {
  if (q >= 90) return { label: 'PERFECT', stars: 3, cls: 'perfect' };
  if (q >= 70) return { label: 'GREAT', stars: 2, cls: 'great' };
  if (q >= 45) return { label: 'GOOD', stars: 1, cls: 'good' };
  return { label: 'SO-SO', stars: 0, cls: 'soso' };
}
