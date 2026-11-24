export type Personality = 'chatty' | 'quiet' | 'gourmet' | 'busy' | 'relaxed' | 'artsy';

export const PERSONALITY: Record<Personality, { name: string; patience: number; tip: number; stay: number; acts: string[] }> = {
  chatty: { name: '수다쟁이', patience: 1.0, tip: 1.0, stay: 1.2, acts: ['chat', 'phone', 'drink'] },
  quiet: { name: '조용함', patience: 1.25, tip: 0.9, stay: 1.1, acts: ['read', 'drink', 'look'] },
  gourmet: { name: '미식가', patience: 1.0, tip: 1.35, stay: 1.0, acts: ['eat', 'photo', 'drink'] },
  busy: { name: '바쁨', patience: 0.75, tip: 1.1, stay: 0.7, acts: ['phone', 'drink'] },
  relaxed: { name: '느긋함', patience: 1.4, tip: 1.0, stay: 1.4, acts: ['look', 'read', 'drink', 'eat'] },
  artsy: { name: '감성파', patience: 1.1, tip: 1.1, stay: 1.2, acts: ['photo', 'look', 'read'] },
};

export interface CustomerDef {
  id: string;
  name: string;
  species: string;
  personality: Personality;
  favorite: string; // menu id
  hat?: string;
  glasses?: string;
  accessory?: string;
  apron?: string; // used as shirt colour for customers
  special?: SpecialDef;
  intro: string;
}

export interface SpecialDef {
  storyStep: number; // appears while story quest index == storyStep
  request: string; // menu id
  minQuality: number;
  line: string;
  thanks: string;
  rewardGems: number;
  rewardGold: number;
}

export const CUSTOMERS: CustomerDef[] = [
  { id: 'momo', name: '모모', species: 'wombat', personality: 'relaxed', favorite: 'croissant', accessory: 'acc_scarf', apron: 'apron_olive', intro: '아침 산책 후 꼭 들르는 웜뱃' },
  { id: 'kiki', name: '키키', species: 'quokka', personality: 'chatty', favorite: 'americano', hat: 'hat_cap', apron: 'apron_pink', intro: '동네 소식통 쿼카' },
  { id: 'bori', name: '보리', species: 'capybara', personality: 'relaxed', favorite: 'latte', apron: 'apron_brown', intro: '온천을 사랑하는 카피바라' },
  { id: 'tori', name: '토리', species: 'rabbit', personality: 'busy', favorite: 'americano', glasses: 'glasses_round', apron: 'apron_navy', intro: '출근길 테이크아웃 단골 후보' },
  { id: 'nabi', name: '나비', species: 'cat', personality: 'gourmet', favorite: 'muffin', accessory: 'acc_bowtie', apron: 'apron_cream', intro: '맛에 까다로운 고양이' },
  { id: 'coco', name: '코코', species: 'dog', personality: 'chatty', favorite: 'cappuccino', accessory: 'acc_scarf', apron: 'apron_check', intro: '꼬리가 쉴 틈 없는 강아지' },
  { id: 'dal', name: '달이', species: 'otter', personality: 'artsy', favorite: 'latte', hat: 'hat_beret', apron: 'apron_olive', intro: '그림 그리는 수달' },
  { id: 'gom', name: '밤송이', species: 'hedgehog', personality: 'quiet', favorite: 'muffin', glasses: 'glasses_round', apron: 'apron_brown', intro: '책벌레 고슴도치' },
  { id: 'rumi', name: '루미', species: 'redpanda', personality: 'artsy', favorite: 'cinnamon', hat: 'hat_flower', apron: 'apron_cream', intro: '사진이 취미인 레서판다' },
  { id: 'teddy', name: '테디', species: 'bear', personality: 'gourmet', favorite: 'cinnamon', apron: 'apron_navy', intro: '빵 굽는 냄새를 따라온 곰' },
  { id: 'yuna', name: '유나', species: 'fox', personality: 'busy', favorite: 'einspanner', glasses: 'glasses_gold', apron: 'apron_check', intro: '프리랜서 디자이너 여우' },
  { id: 'pingu', name: '핑', species: 'penguin', personality: 'quiet', favorite: 'americano', accessory: 'acc_bowtie', apron: 'apron_navy', intro: '말수 적은 신사 펭귄' },
  { id: 'jiho', name: '지호', species: 'human', personality: 'chatty', favorite: 'latte', hat: 'hat_cap', apron: 'apron_olive', intro: '근처 대학의 건축학도' },
  { id: 'sora', name: '소라', species: 'human', personality: 'quiet', favorite: 'croissant', glasses: 'glasses_round', apron: 'apron_pink', intro: '창가 자리를 좋아하는 작가' },
  { id: 'duri', name: '두리', species: 'wombat', personality: 'gourmet', favorite: 'einspanner', hat: 'hat_beret', apron: 'apron_brown', intro: '디저트 블로거 웜뱃' },
  { id: 'bbo', name: '뽀야', species: 'rabbit', personality: 'artsy', favorite: 'cappuccino', hat: 'hat_flower', apron: 'apron_cream', intro: '꽃집 사장님 토끼' },
  // Story / special guests
  { id: 'pepi', name: '여행작가 페피', species: 'penguin', personality: 'artsy', favorite: 'croissant', hat: 'hat_beret', accessory: 'acc_scarf', apron: 'apron_brown', intro: '세계 카페를 여행하는 펭귄 작가',
    special: { storyStep: 4, request: 'croissant', minQuality: 70, line: '여행기에 실을 최고의 크루아상을 부탁해요!', thanks: '이 맛, 꼭 책에 쓸게요!', rewardGems: 20, rewardGold: 300 } },
  { id: 'bom', name: '봄이 할머니', species: 'rabbit', personality: 'relaxed', favorite: 'cinnamon', glasses: 'glasses_gold', accessory: 'acc_scarf', apron: 'apron_pink', intro: '옛 빵집을 운영했던 토끼 할머니',
    special: { storyStep: 7, request: 'cinnamon', minQuality: 75, line: '옛날 우리 가게 시나몬 롤 맛이 그리워요…', thanks: '그때 그 맛이네… 고마워요, 사장님.', rewardGems: 30, rewardGold: 500 } },
  { id: 'luka', name: '음악가 루카', species: 'fox', personality: 'artsy', favorite: 'latte', hat: 'hat_beret', accessory: 'acc_bowtie', apron: 'apron_navy', intro: '거리 공연을 하는 여우 음악가',
    special: { storyStep: 9, request: 'latte', minQuality: 80, line: '공연 전에 하트 라떼 한 잔이면 힘이 날 것 같아요.', thanks: '오늘 공연은 이 카페에 바칠게요!', rewardGems: 40, rewardGold: 800 } },
];

export const CUSTOMER_BY_ID: Record<string, CustomerDef> = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

export const REGULAR_VISITS = 4;
export const REGULAR_AFFINITY = 30;
