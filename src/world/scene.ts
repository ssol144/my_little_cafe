import * as THREE from 'three';
import { clamp, lerp } from '../core/util';

/** Renderer + isometric orthographic camera rig. */
export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  sun: THREE.DirectionalLight;
  target = new THREE.Vector3(5, 0, 5);
  private camTarget = new THREE.Vector3(5, 0, 5);
  zoom = 1;
  minZoom = 0.55;
  maxZoom = 1.8;
  bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dir = new THREE.Vector3(1, 1.22, 1).normalize();
  width = 1;
  height = 1;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xf3e6d0);
    this.scene.fog = new THREE.Fog(0xf3e6d0, 40, 70);

    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
    const hemi = new THREE.HemisphereLight(0xfff3df, 0xb39a7c, 1.25);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0xfff0dc, 0.25));
    this.sun = new THREE.DirectionalLight(0xffe3bd, 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.resize();
  }

  setShadows(on: boolean) {
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  setBounds(minX: number, maxX: number, minZ: number, maxZ: number) {
    this.bounds = { minX, maxX, minZ, maxZ };
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ) + 4;
    const s = this.sun.shadow.camera;
    s.left = -span;
    s.right = span;
    s.top = span;
    s.bottom = -span;
    s.near = 0.5;
    s.far = 80;
    s.updateProjectionMatrix();
    this.sun.position.set(cx - 9, 22, cz + 6);
    this.sun.target.position.set(cx, 0, cz);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.updateProjection();
  }

  /** View height in world units: portrait screens get a tighter view so characters stay readable. */
  viewHeight() {
    const aspect = this.width / this.height;
    const base = aspect < 0.8 ? 15 : aspect < 1.3 ? 12 : 10;
    return base / this.zoom;
  }

  private updateProjection() {
    const vh = this.viewHeight();
    const aspect = this.width / this.height;
    this.camera.left = (-vh * aspect) / 2;
    this.camera.right = (vh * aspect) / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
  }

  setZoom(z: number) {
    this.zoom = clamp(z, this.minZoom, this.maxZoom);
    this.updateProjection();
  }

  /** Smoothly follow a point, clamped to the cafe bounds. */
  follow(p: THREE.Vector3, dt: number, snap = false) {
    const b = this.bounds;
    this.camTarget.set(clamp(p.x, b.minX + 1, b.maxX - 1), 0, clamp(p.z, b.minZ + 1, b.maxZ - 1));
    const k = snap ? 1 : 1 - Math.exp(-dt * 4);
    this.target.x = lerp(this.target.x, this.camTarget.x, k);
    this.target.z = lerp(this.target.z, this.camTarget.z, k);
    this.applyCamera();
  }

  pan(dxPx: number, dyPx: number) {
    const vh = this.viewHeight();
    const perPx = vh / this.height;
    // screen right = (1,0,-1)/√2, screen up (on ground) = (-1,0,-1)/√2 scaled by ground foreshortening
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const up = new THREE.Vector3(-1, 0, -1).normalize();
    const fore = 1 / this.dir.y; // ground foreshortening
    this.target.addScaledVector(right, -dxPx * perPx);
    this.target.addScaledVector(up, dyPx * perPx * fore);
    const b = this.bounds;
    this.target.x = clamp(this.target.x, b.minX, b.maxX);
    this.target.z = clamp(this.target.z, b.minZ, b.maxZ);
    this.applyCamera();
  }

  applyCamera() {
    this.camera.position.copy(this.target).addScaledVector(this.dir, 40);
    this.camera.lookAt(this.target);
  }

  screenToFloor(clientX: number, clientY: number): THREE.Vector3 | null {
    const ndc = this.ndc(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, hit) ? hit : null;
  }

  raycast(clientX: number, clientY: number, objects: THREE.Object3D[]) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  private ndc(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  project(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Small JPEG snapshot for the memory album. */
  snapshot(width = 360): string | undefined {
    try {
      this.render();
      const src = this.renderer.domElement;
      const h = Math.round((width * src.height) / src.width);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.min(h, Math.round(width * 1.1));
      const ctx = c.getContext('2d')!;
      const sy = (src.height - (c.height * src.width) / width) / 2;
      ctx.drawImage(src, 0, Math.max(0, sy), src.width, (c.height * src.width) / width, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch {
      return undefined;
    }
  }
}
