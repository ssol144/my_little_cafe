export type Currency = 'gold' | 'gems';
export type FurnitureKind = 'table' | 'decor' | 'rug' | 'display' | 'plant' | 'light';

export interface SeatDef {
  /** local cell */
  i: number;
  j: number;
  /** facing direction in local space (toward the table) */
  fx: number;
  fz: number;
}

export interface FurnitureDef {
  id: string;
  name: string;
  kind: FurnitureKind;
  w: number;
  d: number;
  price: number;
  currency: Currency;
  minCafeLevel: number;
  /** atmosphere points -> reputation */
  ambiance: number;
  seats?: SeatDef[];
  /** cells (local) that are walkable (e.g. rugs). Default: all blocked. */
  walkable?: boolean;
  satisfaction?: number; // flat satisfaction bonus for customers seated here
  stayBonus?: number; // multiplier on eating time
  tipBonus?: number; // +ratio tips for customers seated here
  dessertChance?: number; // display case: chance a paying customer buys an extra dessert
  read?: boolean; // bookshelf: nearby customers may read
  outdoorOnly?: boolean;
  theme?: string;
  mesh: string;
  desc: string;
}

const pair: SeatDef[] = [
  { i: 0, j: 0, fx: 1, fz: 0 },
  { i: 2, j: 0, fx: -1, fz: 0 },
];

export const FURNITURE: FurnitureDef[] = [
  { id: 'table_wood', name: '원목 2인 테이블', kind: 'table', w: 3, d: 1, price: 120, currency: 'gold', minCafeLevel: 1, ambiance: 1, seats: pair, mesh: 'table_wood', desc: '좌석 2개 · 기본 테이블' },
  { id: 'table_cafe', name: '라운드 카페 테이블', kind: 'table', w: 3, d: 1, price: 220, currency: 'gold', minCafeLevel: 2, ambiance: 3, seats: pair, satisfaction: 3, mesh: 'table_cafe', desc: '좌석 2개 · 만족도 +3' },
  { id: 'table_sofa', name: '소파 테이블', kind: 'table', w: 3, d: 1, price: 420, currency: 'gold', minCafeLevel: 3, ambiance: 4, seats: pair, satisfaction: 5, stayBonus: 1.5, tipBonus: 0.15, mesh: 'table_sofa', desc: '좌석 2개 · 체류시간↑ 팁 +15%' },
  { id: 'table_four', name: '4인 패밀리 테이블', kind: 'table', w: 3, d: 2, price: 480, currency: 'gold', minCafeLevel: 4, ambiance: 3, mesh: 'table_four', desc: '좌석 4개 · 단체 손님',
    seats: [ { i: 0, j: 0, fx: 1, fz: 0 }, { i: 0, j: 1, fx: 1, fz: 0 }, { i: 2, j: 0, fx: -1, fz: 0 }, { i: 2, j: 1, fx: -1, fz: 0 } ] },
  { id: 'table_garden', name: '파라솔 테이블', kind: 'table', w: 3, d: 1, price: 380, currency: 'gold', minCafeLevel: 6, ambiance: 4, seats: pair, satisfaction: 6, outdoorOnly: true, mesh: 'table_garden', desc: '야외 전용 · 만족도 +6' },
  { id: 'plant_small', name: '작은 화분', kind: 'plant', w: 1, d: 1, price: 40, currency: 'gold', minCafeLevel: 1, ambiance: 2, mesh: 'plant_small', desc: '분위기 +2' },
  { id: 'plant_monstera', name: '몬스테라', kind: 'plant', w: 1, d: 1, price: 90, currency: 'gold', minCafeLevel: 1, ambiance: 4, mesh: 'plant_monstera', desc: '분위기 +4' },
  { id: 'flower_stand', name: '꽃 선반', kind: 'plant', w: 1, d: 1, price: 130, currency: 'gold', minCafeLevel: 2, ambiance: 5, mesh: 'flower_stand', desc: '분위기 +5' },
  { id: 'lamp_floor', name: '스탠드 조명', kind: 'light', w: 1, d: 1, price: 110, currency: 'gold', minCafeLevel: 1, ambiance: 5, mesh: 'lamp_floor', desc: '분위기 +5 · 따뜻한 불빛' },
  { id: 'bookshelf', name: '책장', kind: 'decor', w: 2, d: 1, price: 180, currency: 'gold', minCafeLevel: 2, ambiance: 5, read: true, mesh: 'bookshelf', desc: '분위기 +5 · 손님이 책을 읽어요' },
  { id: 'display_case', name: '디저트 진열대', kind: 'display', w: 2, d: 1, price: 320, currency: 'gold', minCafeLevel: 2, ambiance: 3, dessertChance: 0.3, mesh: 'display_case', desc: '30% 확률 디저트 추가 판매' },
  { id: 'rug_round', name: '러그', kind: 'rug', w: 2, d: 2, price: 70, currency: 'gold', minCafeLevel: 1, ambiance: 3, walkable: true, mesh: 'rug_round', desc: '분위기 +3 · 위로 걸을 수 있음' },
  { id: 'bench_flower', name: '플라워 벤치', kind: 'decor', w: 2, d: 1, price: 260, currency: 'gold', minCafeLevel: 6, ambiance: 6, outdoorOnly: true, mesh: 'bench_flower', desc: '야외 전용 · 분위기 +6' },
  { id: 'gramophone', name: '축음기', kind: 'decor', w: 1, d: 1, price: 25, currency: 'gems', minCafeLevel: 1, ambiance: 8, mesh: 'gramophone', desc: '희귀 · 분위기 +8' },
  { id: 'piano', name: '업라이트 피아노', kind: 'decor', w: 2, d: 1, price: 45, currency: 'gems', minCafeLevel: 3, ambiance: 12, mesh: 'piano', desc: '희귀 · 분위기 +12' },
  { id: 'fountain', name: '미니 분수', kind: 'decor', w: 2, d: 2, price: 60, currency: 'gems', minCafeLevel: 6, ambiance: 15, outdoorOnly: true, mesh: 'fountain', desc: '희귀 · 야외 전용 · 분위기 +15' },
  { id: 'xmas_tree', name: '크리스마스 트리', kind: 'decor', w: 1, d: 1, price: 30, currency: 'gems', minCafeLevel: 1, ambiance: 9, theme: 'xmas', mesh: 'xmas_tree', desc: '시즌 한정 · 분위기 +9' },
];

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

export interface ThemeDef {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  ambiance: number;
  wall: number;
  wainscot: number;
  floorA: number;
  floorB: number;
  trim: number;
  desc: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'wood', name: '우드 감성', price: 0, currency: 'gold', ambiance: 0, wall: 0xf4e9d6, wainscot: 0xc9a27a, floorA: 0xd9b48a, floorB: 0xcfa87d, trim: 0x8a6446, desc: '따뜻한 원목 기본 테마' },
  { id: 'french', name: '프렌치 베이커리', price: 600, currency: 'gold', ambiance: 4, wall: 0xf6efe2, wainscot: 0x3f5a6e, floorA: 0xe8dcc8, floorB: 0x7a6a5c, trim: 0x2f4656, desc: '체크 바닥과 네이비 웨인스코팅' },
  { id: 'flower', name: '플라워 가든', price: 800, currency: 'gold', ambiance: 5, wall: 0xfbe9e4, wainscot: 0x9bb07a, floorA: 0xe9cfae, floorB: 0xdfc29e, trim: 0x7d9460, desc: '파스텔 핑크 벽과 올리브 몰딩' },
  { id: 'vintage', name: '빈티지', price: 900, currency: 'gold', ambiance: 5, wall: 0xe6dcc0, wainscot: 0x5f6f4a, floorA: 0xa57a52, floorB: 0x96693f, trim: 0x4a3a28, desc: '짙은 원목과 그린 패널' },
  { id: 'modern', name: '모던 미니멀', price: 900, currency: 'gold', ambiance: 5, wall: 0xf3f2ee, wainscot: 0xbdb8ad, floorA: 0xe3dcd0, floorB: 0xd8d0c2, trim: 0x8b8578, desc: '차분한 화이트 & 그레이' },
  { id: 'xmas', name: '크리스마스', price: 40, currency: 'gems', ambiance: 8, wall: 0xf7efe3, wainscot: 0xa8423a, floorA: 0xd9b48a, floorB: 0x5d7d52, trim: 0x2f5a3c, desc: '시즌 한정 · 레드 & 그린' },
];
export const THEME_BY_ID: Record<string, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
