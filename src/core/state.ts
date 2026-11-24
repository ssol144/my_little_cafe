import type { StaffRole } from '../data/progression';
import { STARTER_FURNITURE } from '../data/layout';

export const SAVE_VERSION = 1;

export interface Outfit {
  species: string;
  skin: number; // index (human only)
  hair: number; // index (human only)
  apron: string;
  hat: string;
  glasses: string;
  accessory: string;
}

export interface PlacedItem {
  uid: string;
  id: string;
  x: number;
  z: number;
  rot: number; // 0..3
}

export interface CustomerRec {
  visits: number;
  affinity: number; // 0..100
  lastVisit: string;
  regular: boolean;
  bestQuality: number;
  served: number;
}

export interface StaffMember {
  uid: string;
  name: string;
  species: string;
  role: StaffRole;
  tier: number;
  trait: string;
  apron: string;
}

export interface AlbumEntry {
  id: string;
  date: string;
  title: string;
  desc: string;
  image?: string;
  customerId?: string;
}

export interface GameState {
  version: number;
  createdAt: string;
  /** ms timestamp of the last local save (used to compare with the cloud copy) */
  savedAt: number;
  profileName: string;
  outfit: Outfit;
  gold: number;
  gems: number;
  playerLevel: number;
  playerExp: number;
  cafeLevel: number;
  cafeExp: number;
  reputation: number; // 0..5
  satisfactionAvg: number; // EMA 0..100
  stats: {
    customersServed: number;
    itemsCrafted: number;
    breadCrafted: number;
    coffeeCrafted: number;
    perfects: number;
    daysCompleted: number;
    totalSales: number;
    customersLost: number;
  };
  mastery: Record<string, number>;
  owned: {
    furniture: Record<string, number>; // total owned count (placed + stored)
    outfits: string[];
    species: string[];
    equipment: string[];
    themes: string[];
  };
  placed: PlacedItem[];
  theme: string;
  expansion: number;
  staff: StaffMember[];
  staffCandidates: { date: string; list: StaffMember[] };
  customers: Record<string, CustomerRec>;
  daily: { date: string; progress: Record<string, number>; claimed: string[] };
  achievementsClaimed: Record<string, number>; // id -> tiers claimed
  event: { id: string; year: number; progress: Record<string, number>; claimed: string[] };
  storyIndex: number;
  attendance: { lastDate: string; cycleDay: number; streak: number; total: number; monthKey: string; monthDays: number; monthClaimed: number[] };
  album: AlbumEntry[];
  wishlist: string[];
  flags: Record<string, boolean>;
  settings: { sfx: boolean; music: boolean; vibration: boolean; shadows: boolean; dayMinutes: number };
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let uidCounter = 0;
export function uid(prefix = 'u'): string {
  uidCounter = (uidCounter + 1) % 100000;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createDefaultState(): GameState {
  const furniture: Record<string, number> = {};
  for (const f of STARTER_FURNITURE) furniture[f.id] = (furniture[f.id] ?? 0) + 1;
  return {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    savedAt: 0,
    profileName: '사장님',
    outfit: { species: 'wombat', skin: 0, hair: 0, apron: 'apron_cream', hat: 'hat_none', glasses: 'glasses_none', accessory: 'acc_none' },
    gold: 300,
    gems: 20,
    playerLevel: 1,
    playerExp: 0,
    cafeLevel: 1,
    cafeExp: 0,
    reputation: 2.5,
    satisfactionAvg: 60,
    stats: { customersServed: 0, itemsCrafted: 0, breadCrafted: 0, coffeeCrafted: 0, perfects: 0, daysCompleted: 0, totalSales: 0, customersLost: 0 },
    mastery: {},
    owned: {
      furniture,
      outfits: ['apron_cream', 'apron_olive', 'hat_none', 'glasses_none', 'acc_none'],
      species: [],
      equipment: [],
      themes: ['wood'],
    },
    placed: STARTER_FURNITURE.map((f) => ({ uid: uid('f'), id: f.id, x: f.x, z: f.z, rot: f.rot })),
    theme: 'wood',
    expansion: 0,
    staff: [],
    staffCandidates: { date: '', list: [] },
    customers: {},
    daily: { date: '', progress: {}, claimed: [] },
    achievementsClaimed: {},
    event: { id: '', year: 0, progress: {}, claimed: [] },
    storyIndex: 0,
    attendance: { lastDate: '', cycleDay: 0, streak: 0, total: 0, monthKey: '', monthDays: 0, monthClaimed: [] },
    album: [],
    wishlist: [],
    flags: {},
    settings: { sfx: true, music: true, vibration: true, shadows: true, dayMinutes: 6 },
  };
}

/** Deep-merge a loaded save onto defaults so new fields added in later versions get sane values. */
export function mergeWithDefaults(loaded: Partial<GameState>): GameState {
  const base = createDefaultState();
  const out: any = { ...base };
  for (const k of Object.keys(loaded) as (keyof GameState)[]) {
    const v = (loaded as any)[k];
    const b = (base as any)[k];
    if (v === undefined || v === null) continue;
    if (b && typeof b === 'object' && !Array.isArray(b) && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...b, ...v };
    } else {
      out[k] = v;
    }
  }
  out.version = SAVE_VERSION;
  return out as GameState;
}
