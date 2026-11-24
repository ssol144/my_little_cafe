type Handler<T> = (payload: T) => void;

export interface GameEvents {
  currency: void;
  exp: void;
  levelUp: { kind: 'player' | 'cafe'; level: number };
  crafted: { menuId: string; quality: number };
  served: { customerId: string; menuId: string; quality: number; satisfaction: number; gold: number };
  dayState: { open: boolean };
  questsChanged: void;
  toast: { text: string; kind?: 'info' | 'good' | 'warn' };
  hands: void;
  album: { title: string };
  stateReplaced: void;
}

export class Emitter {
  private map = new Map<string, Set<Handler<any>>>();
  on<K extends keyof GameEvents>(k: K, h: Handler<GameEvents[K]>): () => void {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(h);
    return () => this.map.get(k)!.delete(h);
  }
  emit<K extends keyof GameEvents>(k: K, payload: GameEvents[K]) {
    this.map.get(k)?.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const events = new Emitter();
