// Cafe space expansions. Each stage defines the playable grid. 2F / Rooftop are on the roadmap (see README)
// and intentionally not exposed in the UI until implemented.

export interface ExpansionDef {
  id: string;
  name: string;
  cafeLevel: number;
  price: number;
  W: number; // interior width (x)
  D: number; // interior depth (z), front wall sits at z = D
  windows: boolean;
  terrace: number; // outdoor rows in front of the cafe
  garden: number; // extra outdoor columns to the right of the terrace
  desc: string;
}

export const EXPANSIONS: ExpansionDef[] = [
  { id: 'basic', name: '기본 카페', cafeLevel: 1, price: 0, W: 10, D: 9, windows: false, terrace: 0, garden: 0, desc: '작지만 따뜻한 첫 가게' },
  { id: 'hall', name: '넓은 홀', cafeLevel: 3, price: 1500, W: 13, D: 10, windows: false, terrace: 0, garden: 0, desc: '홀이 넓어져 테이블을 더 놓을 수 있어요' },
  { id: 'window', name: '창가 좌석', cafeLevel: 4, price: 2200, W: 13, D: 10, windows: true, terrace: 0, garden: 0, desc: '큰 창 설치 · 창가 좌석 만족도 +6' },
  { id: 'terrace', name: '야외 테라스', cafeLevel: 6, price: 3500, W: 13, D: 10, windows: true, terrace: 3, garden: 0, desc: '햇살 좋은 야외 좌석 공간' },
  { id: 'garden', name: '정원', cafeLevel: 8, price: 5000, W: 13, D: 10, windows: true, terrace: 3, garden: 4, desc: '꽃과 분수가 있는 정원' },
];

export const WINDOW_SEAT_BONUS = 6;

export interface StationLayout {
  id: 'oven' | 'espresso' | 'pickup';
  x: number;
  z: number;
  /** cell where the player stands to use it */
  ax: number;
  az: number;
}

export function kitchenLayout(W: number) {
  const counterEnd = W - 4; // inclusive, pickup sits here
  const stations: StationLayout[] = [
    { id: 'oven', x: 1, z: 0, ax: 1, az: 1 },
    { id: 'espresso', x: 4, z: 0, ax: 4, az: 1 },
    { id: 'pickup', x: counterEnd, z: 2, ax: counterEnd + 1, az: 2 },
  ];
  // Decorative fixed kitchen props (blocked cells)
  const props: { kind: string; x: number; z: number }[] = [
    { kind: 'fridge', x: 0, z: 0 },
    { kind: 'bench', x: 2, z: 0 },
    { kind: 'bench', x: 3, z: 0 },
    { kind: 'grinder', x: 5, z: 0 },
    { kind: 'shelf', x: 6, z: 0 },
    { kind: 'sink', x: W - 2, z: 0 },
  ];
  for (let x = 7; x < W - 2; x++) props.push({ kind: 'bench', x, z: 0 });
  props.push({ kind: 'shelf', x: W - 1, z: 0 });
  const counter: number[] = [];
  for (let x = 0; x < counterEnd; x++) counter.push(x);
  return { stations, props, counter, counterEnd, doorX: W - 2 };
}

/** Starting furniture for a new save (placed on the stage-0 map). */
export const STARTER_FURNITURE: { id: string; x: number; z: number; rot: number }[] = [
  { id: 'table_wood', x: 1, z: 4, rot: 0 },
  { id: 'table_wood', x: 5, z: 5, rot: 0 },
  { id: 'table_wood', x: 1, z: 7, rot: 0 },
  { id: 'plant_monstera', x: 0, z: 3, rot: 0 },
  { id: 'plant_small', x: 9, z: 7, rot: 0 },
  { id: 'lamp_floor', x: 5, z: 8, rot: 0 },
];
