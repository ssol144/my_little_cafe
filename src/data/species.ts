// Species registry. Adding a new animal = adding one entry here (plus optional shop price).
// Any species can take any job: nothing in the game keys behaviour off species.

export type EarType = 'none' | 'round' | 'long' | 'pointy' | 'floppy' | 'tiny' | 'fluffy';
export type SnoutType = 'none' | 'small' | 'long' | 'flat' | 'beak' | 'wide';
export type TailType = 'none' | 'stub' | 'long' | 'bushy' | 'ringed' | 'flat' | 'puff';
export type Extra = 'spines' | 'mask' | 'cheeks' | 'whiskers' | 'eyepatch' | 'hair' | 'fluff' | 'flippers' | 'leaf';

export interface SpeciesDef {
  id: string;
  name: string;
  body: number;
  belly?: number;
  accent?: number; // ears inner / muzzle / tail ring
  nose?: number;
  ears: EarType;
  snout: SnoutType;
  tail: TailType;
  extras?: Extra[];
  headScale?: number;
  bodyWidth?: number;
  /** gem price; undefined = available from the start */
  gemPrice?: number;
  blurb: string;
}

export const SPECIES: SpeciesDef[] = [
  { id: 'human', name: '사람', body: 0xf3cfb3, accent: 0xf0b8a0, nose: 0xe59f86, ears: 'none', snout: 'none', tail: 'none', extras: ['hair'], blurb: '손재주 좋은 카페 주인' },
  { id: 'wombat', name: '웜뱃', body: 0x9a8270, belly: 0xb9a594, nose: 0x4a3a32, ears: 'tiny', snout: 'wide', tail: 'stub', bodyWidth: 1.12, blurb: '든든하고 느긋한 성격' },
  { id: 'quokka', name: '쿼카', body: 0xb08a66, belly: 0xd8bc9c, nose: 0x3e2c24, ears: 'round', snout: 'small', tail: 'stub', extras: ['cheeks'], blurb: '언제나 웃는 얼굴' },
  { id: 'capybara', name: '카피바라', body: 0xa77c55, belly: 0xb88e66, nose: 0x4b3424, ears: 'tiny', snout: 'long', tail: 'none', extras: ['leaf'], blurb: '세상 평온한 힐링 담당' },
  { id: 'rabbit', name: '토끼', body: 0xf5efe6, belly: 0xffffff, accent: 0xf4b8c0, nose: 0xe9919f, ears: 'long', snout: 'small', tail: 'puff', blurb: '부지런한 아침형' },
  { id: 'cat', name: '고양이', body: 0xeea85e, belly: 0xfbe6c8, accent: 0xf6c1b0, nose: 0xe68a8a, ears: 'pointy', snout: 'small', tail: 'long', extras: ['whiskers'], blurb: '섬세한 미식가' },
  { id: 'dog', name: '강아지', body: 0xe7c99a, belly: 0xfbf0dc, accent: 0xc79b6a, nose: 0x3b2b25, ears: 'floppy', snout: 'small', tail: 'long', blurb: '친화력 만렙' },
  { id: 'otter', name: '수달', body: 0x8a6448, belly: 0xe6d3b8, nose: 0x2f221c, ears: 'tiny', snout: 'small', tail: 'flat', extras: ['whiskers'], blurb: '조개 대신 원두를 좋아함' },
  { id: 'hedgehog', name: '고슴도치', body: 0xf1dcc0, belly: 0xfaeedd, accent: 0x7a5a44, nose: 0x2c2220, ears: 'tiny', snout: 'small', tail: 'none', extras: ['spines'], blurb: '겉은 뾰족, 속은 말랑' },
  { id: 'redpanda', name: '레서판다', body: 0xc8643a, belly: 0x3a2a24, accent: 0xfdf3e6, nose: 0x2a1e1a, ears: 'pointy', snout: 'small', tail: 'ringed', extras: ['mask'], blurb: '호기심 많은 탐험가' },
  { id: 'bear', name: '곰', body: 0x8c6239, belly: 0xc49a6c, accent: 0xc49a6c, nose: 0x2e2018, ears: 'round', snout: 'small', tail: 'stub', bodyWidth: 1.08, blurb: '꿀 라떼 마니아' },
  { id: 'fox', name: '여우', body: 0xe58a3c, belly: 0xfff6ea, accent: 0x3b2a22, nose: 0x2a1e1a, ears: 'pointy', snout: 'long', tail: 'bushy', blurb: '영리하고 재치있음' },
  { id: 'penguin', name: '펭귄', body: 0x2f3442, belly: 0xfbfbf6, accent: 0xf2a33a, nose: 0xf2a33a, ears: 'none', snout: 'beak', tail: 'none', extras: ['flippers'], blurb: '차가운 음료 담당' },
  // Premium (shop > 캐릭터). Same rig, new data only.
  { id: 'koala', name: '코알라', body: 0xa9adb3, belly: 0xe3e3e0, accent: 0xf2f0ec, nose: 0x2b2b30, ears: 'fluffy', snout: 'wide', tail: 'none', gemPrice: 60, blurb: '나른한 오후의 달인' },
  { id: 'hamster', name: '햄스터', body: 0xe9b66f, belly: 0xfff6e8, accent: 0xf6c1b0, nose: 0xe68a8a, ears: 'round', snout: 'small', tail: 'none', extras: ['cheeks'], gemPrice: 50, blurb: '볼주머니 가득 해바라기씨' },
  { id: 'alpaca', name: '알파카', body: 0xf3e6d0, belly: 0xfbf4e8, accent: 0xd9c4a5, nose: 0x5b4636, ears: 'pointy', snout: 'small', tail: 'stub', extras: ['fluff'], gemPrice: 70, blurb: '몽실몽실 털 자랑' },
  { id: 'panda', name: '판다', body: 0xf7f7f2, belly: 0xf7f7f2, accent: 0x26262a, nose: 0x26262a, ears: 'round', snout: 'small', tail: 'stub', extras: ['eyepatch'], gemPrice: 80, blurb: '대나무 라떼 개발 중' },
];

export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export const HUMAN_SKINS = [0xf3cfb3, 0xe8b894, 0xc98e66, 0x8d5a3b];
export const HAIR_COLORS = [0x3b2a22, 0x6b4a32, 0xc28a4c, 0x1f1b1a, 0xd9b27c];
