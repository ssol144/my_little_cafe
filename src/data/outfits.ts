import type { Currency } from './furniture';

export type OutfitSlot = 'apron' | 'hat' | 'glasses' | 'accessory';
export interface OutfitDef {
  id: string;
  slot: OutfitSlot;
  name: string;
  price: number;
  currency: Currency;
  color: number;
  minPlayerLevel: number;
}

export const OUTFITS: OutfitDef[] = [
  { id: 'apron_cream', slot: 'apron', name: '크림 앞치마', price: 0, currency: 'gold', color: 0xf4ead6, minPlayerLevel: 1 },
  { id: 'apron_olive', slot: 'apron', name: '올리브 앞치마', price: 0, currency: 'gold', color: 0x8a9a5b, minPlayerLevel: 1 },
  { id: 'apron_brown', slot: 'apron', name: '브라운 앞치마', price: 150, currency: 'gold', color: 0x8b5e3c, minPlayerLevel: 1 },
  { id: 'apron_navy', slot: 'apron', name: '네이비 앞치마', price: 200, currency: 'gold', color: 0x34475c, minPlayerLevel: 2 },
  { id: 'apron_pink', slot: 'apron', name: '벚꽃 앞치마', price: 250, currency: 'gold', color: 0xf0b9c0, minPlayerLevel: 3 },
  { id: 'apron_check', slot: 'apron', name: '레드 체크 앞치마', price: 20, currency: 'gems', color: 0xb8453c, minPlayerLevel: 1 },
  { id: 'hat_none', slot: 'hat', name: '없음', price: 0, currency: 'gold', color: 0, minPlayerLevel: 1 },
  { id: 'hat_beret', slot: 'hat', name: '베레모', price: 180, currency: 'gold', color: 0x8b3a3a, minPlayerLevel: 1 },
  { id: 'hat_chef', slot: 'hat', name: '셰프 모자', price: 220, currency: 'gold', color: 0xffffff, minPlayerLevel: 2 },
  { id: 'hat_cap', slot: 'hat', name: '카페 캡', price: 160, currency: 'gold', color: 0x6b7a4a, minPlayerLevel: 1 },
  { id: 'hat_flower', slot: 'hat', name: '꽃 화관', price: 25, currency: 'gems', color: 0xf2a6b8, minPlayerLevel: 1 },
  { id: 'hat_crown', slot: 'hat', name: '작은 왕관', price: 50, currency: 'gems', color: 0xf2c94c, minPlayerLevel: 5 },
  { id: 'glasses_none', slot: 'glasses', name: '없음', price: 0, currency: 'gold', color: 0, minPlayerLevel: 1 },
  { id: 'glasses_round', slot: 'glasses', name: '동그란 안경', price: 120, currency: 'gold', color: 0x3a2a22, minPlayerLevel: 1 },
  { id: 'glasses_gold', slot: 'glasses', name: '골드 안경', price: 260, currency: 'gold', color: 0xc9a24a, minPlayerLevel: 3 },
  { id: 'glasses_sun', slot: 'glasses', name: '선글라스', price: 15, currency: 'gems', color: 0x222222, minPlayerLevel: 1 },
  { id: 'acc_none', slot: 'accessory', name: '없음', price: 0, currency: 'gold', color: 0, minPlayerLevel: 1 },
  { id: 'acc_scarf', slot: 'accessory', name: '머플러', price: 140, currency: 'gold', color: 0xc8553d, minPlayerLevel: 1 },
  { id: 'acc_bowtie', slot: 'accessory', name: '나비넥타이', price: 120, currency: 'gold', color: 0x34475c, minPlayerLevel: 2 },
  { id: 'acc_bell', slot: 'accessory', name: '방울 리본', price: 20, currency: 'gems', color: 0xe9c46a, minPlayerLevel: 1 },
];
export const OUTFIT_BY_ID: Record<string, OutfitDef> = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export interface EquipmentDef {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  minCafeLevel: number;
  affects: string[]; // step ids made easier
  desc: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'grinder_pro', name: '전동 그라인더', price: 450, currency: 'gold', minCafeLevel: 2, affects: ['grind'], desc: '분쇄 회전 수 -35%' },
  { id: 'oven_pro', name: '컨벡션 오븐', price: 600, currency: 'gold', minCafeLevel: 3, affects: ['bake'], desc: '굽기 황금 구간 1.5배' },
  { id: 'espresso_pro', name: '듀얼 보일러 머신', price: 900, currency: 'gold', minCafeLevel: 4, affects: ['extract', 'steam'], desc: '추출·스티밍 정답 구간 1.5배' },
  { id: 'mixer_pro', name: '스탠드 믹서', price: 700, currency: 'gold', minCafeLevel: 5, affects: ['knead', 'topping', 'cream'], desc: '반죽 판정·토핑 범위 확대' },
  { id: 'pitcher_gold', name: '골드 스팀 피처', price: 40, currency: 'gems', minCafeLevel: 3, affects: ['latteart'], desc: '라떼아트 판정 범위 확대' },
];
export const EQUIPMENT_BY_ID: Record<string, EquipmentDef> = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));
