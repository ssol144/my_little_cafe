import { createDefaultState, mergeWithDefaults, SAVE_VERSION, type GameState } from './state';

/**
 * Storage is behind an adapter so a cloud backend can be added later without touching game code.
 * Only the local adapter exists today; there is no fake server.
 */
export interface StorageAdapter {
  readonly name: string;
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';
  async read(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async write(key: string, value: string) {
    localStorage.setItem(key, value);
  }
  async remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

const KEY = 'mylittlecafe.save';
const BACKUP_KEY = 'mylittlecafe.save.bak';

export class SaveManager {
  lastSavedAt = 0;
  constructor(private adapter: StorageAdapter = new LocalStorageAdapter()) {}

  async load(): Promise<{ state: GameState; fresh: boolean }> {
    const raw = (await this.adapter.read(KEY)) ?? (await this.adapter.read(BACKUP_KEY));
    if (!raw) return { state: createDefaultState(), fresh: true };
    try {
      const parsed = JSON.parse(raw);
      return { state: this.migrate(parsed), fresh: false };
    } catch (e) {
      console.warn('[save] corrupt save, trying backup', e);
      const bak = await this.adapter.read(BACKUP_KEY);
      if (bak) {
        try {
          return { state: this.migrate(JSON.parse(bak)), fresh: false };
        } catch {
          /* fallthrough */
        }
      }
      return { state: createDefaultState(), fresh: true };
    }
  }

  migrate(data: any): GameState {
    // v1 is the first schema. Future migrations: if (data.version < 2) {...}
    if (typeof data !== 'object' || !data) throw new Error('invalid save');
    if ((data.version ?? 0) > SAVE_VERSION) console.warn('[save] save is from a newer version');
    return mergeWithDefaults(data);
  }

  async save(state: GameState): Promise<boolean> {
    const json = JSON.stringify(state);
    try {
      const prev = await this.adapter.read(KEY);
      if (prev) await this.adapter.write(BACKUP_KEY, prev);
      await this.adapter.write(KEY, json);
      this.lastSavedAt = Date.now();
      return true;
    } catch (e) {
      // Quota exceeded: drop album images (largest data) and retry once.
      console.warn('[save] write failed, trimming album images', e);
      const trimmed = { ...state, album: state.album.map((a, i) => (i < state.album.length - 12 ? { ...a, image: undefined } : a)) };
      try {
        await this.adapter.remove(BACKUP_KEY);
        await this.adapter.write(KEY, JSON.stringify(trimmed));
        return true;
      } catch (e2) {
        console.error('[save] failed', e2);
        return false;
      }
    }
  }

  async reset() {
    await this.adapter.remove(KEY);
    await this.adapter.remove(BACKUP_KEY);
  }

  exportJson(state: GameState): string {
    return JSON.stringify(state);
  }

  importJson(json: string): GameState {
    return this.migrate(JSON.parse(json));
  }
}
