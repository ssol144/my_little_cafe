import * as THREE from 'three';

const matCache = new Map<string, THREE.Material>();
export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.rough ?? 0.82}|${opts.metal ?? 0}|${opts.emissive ?? 0}|${opts.emissiveIntensity ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.82,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent || (opts.opacity !== undefined && opts.opacity < 1),
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
export const G = {
  sphere: (seg = 18) => cached(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(8, Math.floor(seg * 0.7)))),
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  rbox: (r = 0.12) => cached(`rbox${r}`, () => roundedBox(1, 1, 1, r)),
  cyl: (seg = 18, top = 1) => cached(`c${seg}_${top}`, () => new THREE.CylinderGeometry(top, 1, 1, seg)),
  cone: (seg = 12) => cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg)),
  capsule: () => cached('cap', () => new THREE.CapsuleGeometry(1, 1, 6, 12)),
  torus: (arc = Math.PI * 2, tube = 0.25) => cached(`t${arc.toFixed(3)}_${tube}`, () => new THREE.TorusGeometry(1, tube, 10, 24, arc)),
};

/** Rounded box via extruded rounded rect (unit-sized, centred). */
function roundedBox(w: number, h: number, d: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - rr * 2, bevelEnabled: true, bevelThickness: rr, bevelSize: 0, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -(d - rr * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Convenience: create a mesh with scale/position in one line. */
export function M(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1,
  rot: [number, number, number] = [0, 0, 0],
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

export function disposeTree(obj: THREE.Object3D) {
  // Geometries & materials are shared via caches; only dispose unique textures/materials flagged as owned.
  obj.traverse((o) => {
    const anyO = o as any;
    if (anyO.userData?.ownedGeo && anyO.geometry) anyO.geometry.dispose();
    if (anyO.userData?.ownedMat && anyO.material) {
      const m = anyO.material as THREE.Material & { map?: THREE.Texture };
      m.map?.dispose();
      m.dispose();
    }
  });
}
