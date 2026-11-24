import * as THREE from 'three';
import { Character, type Look } from './character';
import { createFurniture, createFood } from './props';
import { FURNITURE_BY_ID } from '../data/furniture';

/** Renders 3D models into small PNG thumbnails for menus (cached). */
class Thumbnailer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  private cache = new Map<string, string>();
  private size = 160;

  private ensure() {
    if (this.renderer) return this.renderer;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.size;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.size, this.size, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight(0xfff3df, 0xb39a7c, 1.6));
    const d = new THREE.DirectionalLight(0xffe3bd, 1.6);
    d.position.set(-3, 6, 5);
    this.scene.add(d);
    return this.renderer;
  }

  private shoot(key: string, obj: THREE.Object3D, pad = 1.15): string {
    const hit = this.cache.get(key);
    if (hit) return hit;
    try {
      const r = this.ensure();
      this.scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      const sz = box.getSize(new THREE.Vector3());
      const dir = new THREE.Vector3(1, 0.9, 1.25).normalize();
      this.camera.position.copy(c).addScaledVector(dir, 20);
      this.camera.lookAt(c);
      const half = (Math.max(sz.x, sz.y, sz.z) * pad) / 1.6;
      this.camera.left = -half;
      this.camera.right = half;
      this.camera.top = half;
      this.camera.bottom = -half;
      this.camera.updateProjectionMatrix();
      r.render(this.scene, this.camera);
      const url = r.domElement.toDataURL('image/png');
      this.scene.remove(obj);
      this.cache.set(key, url);
      return url;
    } catch {
      return '';
    }
  }

  character(look: Look, key?: string): string {
    const k = key ?? 'ch:' + JSON.stringify(look);
    if (this.cache.has(k)) return this.cache.get(k)!;
    const ch = new Character(look);
    ch.update(0.016, false);
    ch.root.rotation.y = -0.25;
    return this.shoot(k, ch.root, 1.05);
  }

  furniture(id: string): string {
    const k = 'f:' + id;
    if (this.cache.has(k)) return this.cache.get(k)!;
    const def = FURNITURE_BY_ID[id];
    return this.shoot(k, createFurniture(def.mesh, def.w, def.d));
  }

  food(id: string): string {
    const k = 'food:' + id;
    if (this.cache.has(k)) return this.cache.get(k)!;
    const g = createFood(id);
    g.scale.setScalar(5);
    return this.shoot(k, g);
  }
}

export const thumbs = new Thumbnailer();
