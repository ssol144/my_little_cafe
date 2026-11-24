import * as THREE from 'three';
import type { Game } from './Game';
import { FURNITURE_BY_ID } from '../data/furniture';
import { rotDims } from '../world/grid';
import { uid, type PlacedItem } from '../core/state';
import { events } from '../core/events';
import { audio, haptic } from '../core/audio';

/** Grid-based furniture editing: select, drag, rotate, store, place from storage. */
export class EditController {
  active = false;
  selected: string | null = null;
  private ghost: { x: number; z: number; rot: number } | null = null;
  private valid = true;
  private footprintObj: THREE.Object3D | null = null;
  private dragOffset = { x: 0, z: 0 };
  dragging = false;
  private t = 0;
  onChange: () => void = () => {};

  constructor(private game: Game) {}

  enter() {
    if (this.game.day.open) {
      events.emit('toast', { text: '영업 중에는 꾸밀 수 없어요. 영업을 마친 뒤 꾸며요.', kind: 'warn' });
      return false;
    }
    this.active = true;
    this.game.player.agent.char.root.visible = false;
    this.game.stage.setZoom(Math.min(this.game.stage.zoom, 0.8));
    this.onChange();
    return true;
  }

  exit() {
    this.deselect();
    this.active = false;
    this.game.player.agent.char.root.visible = true;
    this.game.stage.setZoom(1);
    this.game.rebuildWorld();
    this.game.markDirty();
    this.game.saveNow();
    this.onChange();
  }

  get selectedItem(): PlacedItem | null {
    return this.game.state.placed.find((p) => p.uid === this.selected) ?? null;
  }

  private pickFurniture(cx: number, cy: number): string | null {
    const meshes = [...this.game.furnitureMeshes.values()];
    const hit = this.game.stage.raycast(cx, cy, meshes)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.uid) o = o.parent;
    return (o?.userData.uid as string) ?? null;
  }

  tap(cx: number, cy: number) {
    const id = this.pickFurniture(cx, cy);
    if (id) {
      this.select(id);
      return;
    }
    // tap on floor while something is selected: move it there
    if (this.selected) {
      const item = this.selectedItem!;
      const p = this.game.stage.screenToFloor(cx, cy);
      if (!p) return;
      const def = FURNITURE_BY_ID[item.id];
      const rd = rotDims(def, item.rot);
      const x = Math.round(p.x - rd.w / 2), z = Math.round(p.z - rd.d / 2);
      this.tryMove(x, z, item.rot, true);
    }
  }

  select(id: string | null) {
    this.deselect();
    if (!id) return;
    this.selected = id;
    const it = this.selectedItem!;
    this.ghost = { x: it.x, z: it.z, rot: it.rot };
    this.valid = true;
    this.showFootprint();
    audio.play('pop');
    this.onChange();
  }

  deselect() {
    if (this.footprintObj) this.game.stage.scene.remove(this.footprintObj);
    this.footprintObj = null;
    if (this.selected) {
      const mesh = this.game.furnitureMeshes.get(this.selected);
      const it = this.selectedItem;
      if (mesh && it) {
        this.game.positionFurniture(mesh, it.id, it.x, it.z, it.rot);
        mesh.position.y = 0;
      }
    }
    this.selected = null;
    this.ghost = null;
    this.onChange();
  }

  private showFootprint() {
    if (this.footprintObj) this.game.stage.scene.remove(this.footprintObj);
    const it = this.selectedItem;
    if (!it || !this.ghost) return;
    this.footprintObj = this.game.footprintMesh(it.id, this.ghost.x, this.ghost.z, this.ghost.rot, this.valid);
    this.game.stage.scene.add(this.footprintObj);
    const mesh = this.game.furnitureMeshes.get(it.uid);
    if (mesh) this.game.positionFurniture(mesh, it.id, this.ghost.x, this.ghost.z, this.ghost.rot);
  }

  /** Validate a candidate position. commit=true writes it to the save if valid. */
  tryMove(x: number, z: number, rot: number, commit: boolean): boolean {
    const it = this.selectedItem;
    if (!it) return false;
    const items = this.game.state.placed.map((p) => (p.uid === it.uid ? { ...p, x, z, rot } : p));
    const v = this.game.map.validate(items);
    this.ghost = { x, z, rot };
    this.valid = v.ok;
    if (commit) {
      if (v.ok) {
        it.x = x;
        it.z = z;
        it.rot = rot;
        this.game.map.applyFurniture(this.game.state.placed);
        audio.play('pop');
        haptic(10);
      } else {
        events.emit('toast', { text: v.reason ?? '놓을 수 없어요', kind: 'warn' });
        audio.play('error');
        this.ghost = { x: it.x, z: it.z, rot: it.rot };
        this.valid = true;
      }
    }
    this.showFootprint();
    this.onChange();
    return v.ok;
  }

  rotate() {
    const it = this.selectedItem;
    if (!it) return;
    const def = FURNITURE_BY_ID[it.id];
    const nr = (it.rot + 1) % 4;
    // keep the item centred roughly where it was
    const a = rotDims(def, it.rot), b = rotDims(def, nr);
    const x = Math.round(it.x + (a.w - b.w) / 2), z = Math.round(it.z + (a.d - b.d) / 2);
    for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1]]) {
      const items = this.game.state.placed.map((p) => (p.uid === it.uid ? { ...p, x: x + dx, z: z + dz, rot: nr } : p));
      if (this.game.map.validate(items).ok) {
        this.tryMove(x + dx, z + dz, nr, true);
        return;
      }
    }
    events.emit('toast', { text: '여기서는 회전할 공간이 부족해요', kind: 'warn' });
    audio.play('error');
  }

  store() {
    const it = this.selectedItem;
    if (!it) return;
    const def = FURNITURE_BY_ID[it.id];
    if (def.seats && this.game.state.placed.filter((p) => FURNITURE_BY_ID[p.id]?.seats).length <= 1) {
      events.emit('toast', { text: '테이블은 최소 1개 필요해요', kind: 'warn' });
      audio.play('error');
      return;
    }
    if (this.footprintObj) this.game.stage.scene.remove(this.footprintObj);
    this.footprintObj = null;
    this.selected = null;
    this.ghost = null;
    this.game.state.placed = this.game.state.placed.filter((p) => p.uid !== it.uid);
    this.game.map.applyFurniture(this.game.state.placed);
    this.game.rebuildFurniture();
    audio.play('whoosh');
    this.game.markDirty();
    this.onChange();
  }

  placeFromStorage(id: string): boolean {
    const def = FURNITURE_BY_ID[id];
    if (!def || this.game.storedCount(id) <= 0) return false;
    const newUid = uid('f');
    const spot = this.game.map.findFreeSpot(def, this.game.state.placed, newUid);
    if (!spot) {
      events.emit('toast', { text: def.outdoorOnly ? '야외 공간(테라스)이 필요해요' : '놓을 빈 공간이 없어요. 다른 가구를 보관해 보세요', kind: 'warn' });
      audio.play('error');
      return false;
    }
    this.game.state.placed.push({ uid: newUid, id, x: spot.x, z: spot.z, rot: spot.rot });
    this.game.map.applyFurniture(this.game.state.placed);
    this.game.rebuildFurniture();
    this.select(newUid);
    this.game.markDirty();
    return true;
  }

  // ---- drag ----
  dragStart(cx: number, cy: number): boolean {
    if (!this.selected) return false;
    const id = this.pickFurniture(cx, cy);
    if (id !== this.selected) return false;
    const p = this.game.stage.screenToFloor(cx, cy);
    const it = this.selectedItem!;
    if (!p) return false;
    this.dragOffset = { x: p.x - it.x, z: p.z - it.z };
    this.dragging = true;
    return true;
  }
  dragMove(cx: number, cy: number) {
    if (!this.dragging) return;
    const p = this.game.stage.screenToFloor(cx, cy);
    const it = this.selectedItem;
    if (!p || !it || !this.ghost) return;
    const x = Math.round(p.x - this.dragOffset.x), z = Math.round(p.z - this.dragOffset.z);
    if (x !== this.ghost.x || z !== this.ghost.z) this.tryMove(x, z, it.rot, false);
  }
  dragEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.ghost) this.tryMove(this.ghost.x, this.ghost.z, this.ghost.rot, true);
  }

  update(dt: number) {
    this.t += dt;
    if (this.selected) {
      const mesh = this.game.furnitureMeshes.get(this.selected);
      if (mesh) mesh.position.y = 0.08 + Math.sin(this.t * 6) * 0.04;
    }
  }
}
