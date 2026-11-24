import type { Game } from './Game';
import type { GameState } from '../core/state';
import { SAVE_VERSION } from '../core/state';
import { events } from '../core/events';
import {
  firebaseConfigured, onUserChanged, signInWithGoogle, signInEmulatorGoogle, signOutUser, readCloudSave, writeCloudSave, deleteAccount,
  type CloudUser, type CloudSave,
} from '../platform/firebase';

export type CloudStatus = 'off' | 'signedOut' | 'syncing' | 'synced' | 'error';
export interface SaveSummary {
  playerLevel: number;
  cafeLevel: number;
  gold: number;
  days: number;
  at: number;
}
export type Choice = 'cloud' | 'local';

const MAX_BYTES = 900_000; // Firestore documents are capped at 1 MiB
const MIN_INTERVAL = 90_000; // throttle background uploads (free tier: 20k writes/day)

function deviceId(): string {
  try {
    let id = localStorage.getItem('mylittlecafe.device');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('mylittlecafe.device', id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export function summarize(s: GameState): SaveSummary {
  return { playerLevel: s.playerLevel, cafeLevel: s.cafeLevel, gold: s.gold, days: s.stats.daysCompleted, at: s.savedAt };
}

/**
 * Guest-first cloud saves: the game always saves locally; linking a Google account adds a
 * Firestore copy so progress survives reinstalling or switching devices.
 */
export class CloudSync {
  readonly enabled = firebaseConfigured;
  user: CloudUser | null = null;
  status: CloudStatus = firebaseConfigured ? 'signedOut' : 'off';
  lastSync = 0;
  error = '';
  onChange: () => void = () => {};
  /** UI hook: let the player pick which save to keep when both exist and differ. */
  ask: (local: SaveSummary, cloud: SaveSummary) => Promise<Choice> = async () => 'local';
  private device = deviceId();
  private pending = false;
  private timer: number | null = null;
  private busy = false;
  private checkedThisSession = false;

  constructor(private game: Game) {}

  async init() {
    if (!this.enabled) return;
    try {
      await onUserChanged((u) => {
        const was = this.user?.uid;
        this.user = u;
        this.status = u ? (this.status === 'signedOut' ? 'synced' : this.status) : 'signedOut';
        this.onChange();
        // returning player who is already signed in: reconcile once per launch
        if (u && u.uid !== was && !this.checkedThisSession) {
          this.checkedThisSession = true;
          this.reconcile(false);
        }
      });
    } catch (e) {
      this.fail(e);
    }
  }

  private set(status: CloudStatus, error = '') {
    this.status = status;
    this.error = error;
    this.onChange();
  }
  private fail(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[cloud]', msg);
    this.set('error', msg);
  }

  async link(): Promise<boolean> {
    try {
      this.set('syncing');
      this.checkedThisSession = true;
      this.user = await signInWithGoogle();
      await this.reconcile(true);
      events.emit('toast', { text: 'Google 계정이 연동됐어요. 이제 클라우드에 저장돼요.', kind: 'good' });
      return true;
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request' || /cancel/i.test(String(e?.message))) {
        this.set(this.user ? 'synced' : 'signedOut');
        return false;
      }
      this.fail(e);
      events.emit('toast', { text: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.', kind: 'warn' });
      return false;
    }
  }

  /** Decide between local and cloud after login / on launch. */
  async reconcile(interactive: boolean) {
    if (!this.user || this.busy) return;
    this.busy = true;
    try {
      this.set('syncing');
      const cloud = await readCloudSave(this.user.uid);
      const local = this.game.state;
      if (!cloud) {
        await this.uploadNow();
        return;
      }
      const sameDevice = cloud.device === this.device;
      const cloudNewer = cloud.clientUpdatedAt > local.savedAt + 2000;
      if (!cloudNewer) {
        await this.uploadNow();
        return;
      }
      const localEmpty = local.stats.itemsCrafted === 0 && local.stats.daysCompleted === 0 && local.stats.customersServed === 0;
      if (localEmpty || (sameDevice && !interactive)) {
        // brand-new install, or our own newer upload from this device -> restore without asking
        await this.applyCloud(cloud);
        return;
      }
      const choice = await this.ask(summarize(local), { ...cloud.summary, at: cloud.clientUpdatedAt });
      if (choice === 'cloud') await this.applyCloud(cloud);
      else await this.uploadNow();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private async applyCloud(cloud: CloudSave) {
    const incoming = this.game.saver.importJson(cloud.data);
    // album images are not uploaded; keep any we still have locally
    const localImgs = new Map(this.game.state.album.filter((a) => a.image).map((a) => [a.id, a.image]));
    for (const a of incoming.album) if (!a.image && localImgs.has(a.id)) a.image = localImgs.get(a.id);
    incoming.savedAt = cloud.clientUpdatedAt;
    this.game.setState(incoming);
    await this.game.saver.save(incoming);
    this.lastSync = Date.now();
    this.set('synced');
    events.emit('toast', { text: '클라우드 저장 데이터를 불러왔어요.', kind: 'good' });
  }

  private payload(): CloudSave {
    const s = this.game.state;
    const stripped: GameState = { ...s, album: s.album.map((a) => ({ ...a, image: undefined })) };
    return {
      data: JSON.stringify(stripped),
      clientUpdatedAt: s.savedAt,
      device: this.device,
      version: SAVE_VERSION,
      summary: { playerLevel: s.playerLevel, cafeLevel: s.cafeLevel, gold: s.gold, days: s.stats.daysCompleted },
    };
  }

  async uploadNow(): Promise<boolean> {
    if (!this.user) return false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = false;
    try {
      this.set('syncing');
      const p = this.payload();
      if (p.data.length > MAX_BYTES) throw new Error('저장 데이터가 너무 커요');
      await writeCloudSave(this.user.uid, p);
      this.lastSync = Date.now();
      this.set('synced');
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  /** Called after every local save; uploads at most once per MIN_INTERVAL. */
  schedule() {
    if (!this.user || this.busy) return;
    this.pending = true;
    if (this.timer !== null) return;
    const wait = Math.max(0, MIN_INTERVAL - (Date.now() - this.lastSync));
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.pending) this.uploadNow();
    }, wait);
  }

  /** Upload right away if anything changed (day settlement, app going to background). */
  flush() {
    if (this.user && this.pending && !this.busy) this.uploadNow();
  }

  async signOut() {
    await this.uploadNow();
    await signOutUser();
    this.user = null;
    this.checkedThisSession = false;
    this.set('signedOut');
  }

  /** Returns 'reauth' when Firebase needs a fresh login before deleting. */
  async deleteAccount(): Promise<'ok' | 'reauth' | 'error'> {
    try {
      await deleteAccount();
      this.user = null;
      this.set('signedOut');
      return 'ok';
    } catch (e: any) {
      if (e?.code === 'auth/requires-recent-login') return 'reauth';
      this.fail(e);
      return 'error';
    }
  }

  /** Test-only: same as link() but with a fake Google identity on the Auth emulator. */
  async linkEmulator(sub: string, email: string) {
    this.checkedThisSession = true;
    this.user = await signInEmulatorGoogle(sub, email);
    await this.reconcile(true);
  }

  async reauthenticate(): Promise<boolean> {
    try {
      this.user = await signInWithGoogle();
      return true;
    } catch {
      return false;
    }
  }
}
