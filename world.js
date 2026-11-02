/* 무대: 밤거리와 클럽 내부. 조명은 박자(clock)에 맞춰 움직인다 */
import * as THREE from './vendor/three.min.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
const rand = (a, b) => a + Math.random() * (b - a);

export const ROOM = { xMin: -13.4, xMax: 10.6, zMin: -16.9, zMax: 4.5 };
export const FLOOR = { xMin: -9, xMax: 9, zMin: -17, zMax: -5 };
export const TABLES = [[-11.8, -13], [-11.8, -8.6], [-11.8, -4.2], [-11.2, 0], [-7.2, 0.4], [-3.8, 0.8], [4, 0.6], [7.8, 0]].map(([x, z], i) => ({ x, z, i, by: null }));
export const BAR_SPOTS = [-12.5, -10, -7.5, -5, -2.5, 0].map((z) => ({ x: 10.2, z, by: null }));

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.28, 'rgba(255,255,255,.42)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function beamTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d'), r = g.createLinearGradient(0, 0, 0, 256);
  r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.5, 'rgba(255,255,255,.26)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 8, 256);
  return new THREE.CanvasTexture(c);
}
function windowsTexture(cols, rows, lit = 0.34) {
  const c = document.createElement('canvas'); c.width = cols * 16; c.height = rows * 24;
  const g = c.getContext('2d'); g.fillStyle = '#0b0e1a'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const on = Math.random() < lit;
    g.fillStyle = on ? ['#ffd28a', '#ffe7b8', '#a7d8ff', '#ffb36b'][Math.floor(Math.random() * 4)] : '#141a2c';
    g.fillRect(x * 16 + 3, y * 24 + 4, 10, 15);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 280;
  const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 280);
  g.font = '800 190px Outfit, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff2bd6'; g.shadowBlur = 46; g.fillStyle = '#ffd6f6';
  for (let i = 0; i < 3; i++) g.fillText('PULSE', 512, 144);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene, fxState) {
  const gt = glowTexture(), bt = beamTexture(), updaters = [];
  const spriteMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: gt, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flare = (color, size, x, y, z, parent = scene, opacity = 1) => { const s = new THREE.Sprite(spriteMat(color, opacity)); s.scale.set(size, size, 1); s.position.set(x, y, z); parent.add(s); return s; };

  scene.add(new THREE.HemisphereLight(0x8fa7ff, 0x23153a, 0.82));

  /* ───── 밤거리 ───── */
  const street = new THREE.Group(); scene.add(street);
  box(160, 0.1, 6.2, std(0x34363f, { roughness: 0.82 }), 0, -0.05, 13.1, street);                 // 보도
  box(160, 0.1, 18, std(0x161821, { roughness: 0.28, metalness: 0.45 }), 0, -0.1, 25.2, street); // 젖은 도로
  box(160, 0.16, 0.24, std(0x6b7280), 0, 0, 16.2, street);                                         // 연석
  for (let i = -8; i <= 8; i++) box(2.4, 0.012, 0.16, glow(0xc9cdd8), i * 6, -0.04, 25, street);   // 차선
  box(160, 0.1, 4, std(0x34363f), 0, -0.05, 36.2, street);

  // 클럽 건물 정면: 문 자리만 뚫는다
  const facadeM = std(0x161522, { roughness: 0.9 }), W = 44;
  box(W - 1.4, 16, 0.5, facadeM, -(W / 2 + 0.7), 8, 10, street);
  box(W - 1.4, 16, 0.5, facadeM, W / 2 + 0.7, 8, 10, street);
  box(2.8, 12.7, 0.5, facadeM, 0, 9.65, 10, street);
  box(W + 22, 9, 0.5, new THREE.MeshBasicMaterial({ map: windowsTexture(66, 9, 0.16), toneMapped: false }), 0, 11.7, 10.32, street);
  // 이웃 건물과 맞은편 거리
  for (let i = 0; i < 13; i++) {
    const w = rand(9, 15), h = rand(10, 26), x = -70 + i * 11.6;
    const tex = new THREE.MeshBasicMaterial({ map: windowsTexture(Math.round(w * 1.3), Math.round(h / 1.6)), toneMapped: false });
    box(w, h, 7, tex, x, h / 2, 42 + rand(0, 3), street);
  }
  [-1, 1].forEach((s) => box(30, 18, 0.5, new THREE.MeshBasicMaterial({ map: windowsTexture(40, 11, 0.24), toneMapped: false }), s * 48, 9, 9.8, street));

  // 간판, 차양, 레드카펫
  const sign = add(new THREE.PlaneGeometry(7.2, 1.97), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, toneMapped: false, depthWrite: false }), 0, 5.35, 10.3, street);
  flare(0xff2bd6, 11, 0, 5.3, 10.5, street, 0.34);
  box(5.6, 0.14, 2.6, std(0x0d0d14, { roughness: 0.4 }), 0, 3.7, 11.45, street);
  const canopyGlow = box(5.62, 0.05, 0.05, glow(0xff2bd6), 0, 3.62, 12.74, street);
  box(2.6, 0.02, 5.4, std(0x7f1231, { roughness: 0.9 }), 0, 0.01, 12.9, street);
  const doorLight = new THREE.PointLight(0xff5ad6, 20, 14, 1.6); doorLight.position.set(0, 3.3, 12); scene.add(doorLight);
  const queueLight = new THREE.PointLight(0xffc27a, 30, 22, 1.5); queueLight.position.set(7.4, 4.4, 13); scene.add(queueLight);

  // 입구 문
  const doorM = std(0x24202e, { roughness: 0.35, metalness: 0.6 });
  const doors = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 1.4, 0, 10.2); street.add(pivot);
    box(1.38, 3.3, 0.1, doorM, -s * 0.69, 1.65, 0, pivot);
    box(0.05, 0.9, 0.08, glow(0xffd6f6), -s * 1.18, 1.3, 0.08, pivot);
    return { pivot, s };
  });
  let doorOpen = 0, doorTo = 0;

  // 차단봉과 벨벳 줄
  const poleM = std(0xd4af37, { roughness: 0.28, metalness: 0.85 }), ropeM = std(0xa3123f, { roughness: 0.7 });
  const postXs = [1.1, 4, 6.9, 9.8, 12.7, 15.6];
  postXs.forEach((x, i) => {
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10), poleM, x, 0.48, 12.45, street);
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), poleM, x, 0.03, 12.45, street);
    add(new THREE.SphereGeometry(0.06, 10, 8), poleM, x, 0.97, 12.45, street);
    if (i) {
      const a = new THREE.Vector3(postXs[i - 1], 0.9, 12.45), b = new THREE.Vector3(x, 0.9, 12.45), m = a.clone().lerp(b, 0.5); m.y = 0.58;
      add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 16, 0.024, 7), ropeM, 0, 0, 0, street);
    }
  });

  // 가로등
  [-14, 14, 32].forEach((x) => {
    add(new THREE.CylinderGeometry(0.07, 0.09, 6.2, 10), std(0x20222b), x, 3.1, 15.7, street);
    box(1.3, 0.08, 0.08, std(0x20222b), x, 6.2, 15.3, street);
    add(new THREE.SphereGeometry(0.15, 10, 8), glow(0xffd9a0), x, 6.05, 14.75, street);
    flare(0xffc98a, 3.4, x, 6.05, 14.75, street, 0.7);
  });
  // 지나가는 차
  const carM = std(0x101321, { roughness: 0.25, metalness: 0.7 }), car = new THREE.Group();
  box(4.2, 0.72, 1.8, carM, 0, 0.62, 0, car); box(2.2, 0.62, 1.6, carM, -0.18, 1.26, 0, car);
  [[2.1, 0.68, 0.62], [2.1, 0.68, -0.62]].forEach(([x, y, z]) => { add(new THREE.SphereGeometry(0.09, 8, 6), glow(0xffffff), x, y, z, car); flare(0xeaf2ff, 2.6, x + 0.2, y, z, car, 0.9); });
  [[-2.1, 0.7, 0.62], [-2.1, 0.7, -0.62]].forEach(([x, y, z]) => { add(new THREE.SphereGeometry(0.07, 8, 6), glow(0xff2a2a), x, y, z, car); flare(0xff2020, 1.2, x - 0.1, y, z, car, 0.8); });
  car.position.set(-80, 0, 21); street.add(car);
  let carV = 12, carWait = 3;

  // 별
  const stars = new Float32Array(600);
  for (let i = 0; i < 200; i++) { stars[i * 3] = rand(-110, 110); stars[i * 3 + 1] = rand(26, 80); stars[i * 3 + 2] = rand(-60, 90); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  street.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 0.35, sizeAttenuation: true, fog: false })));

  /* ───── 입구 복도 ───── */
  const inside = new THREE.Group(); scene.add(inside);
  const wallM = std(0x0d0c16, { roughness: 0.68 }), floorM = std(0x17151f, { roughness: 0.72, metalness: 0.08 });
  box(3.2, 0.1, 5.4, floorM, 0, -0.05, 7.4, inside);
  box(3.2, 0.1, 5.4, wallM, 0, 3.55, 7.4, inside);
  [-1, 1].forEach((s) => box(0.2, 3.6, 5.4, wallM, s * 1.7, 1.8, 7.4, inside));
  const stripA = [-1, 1].map((s) => box(0.05, 0.05, 5.2, glow(0x22d3ee), s * 1.58, 2.8, 7.4, inside));
  const hallLight = new THREE.PointLight(0xff4bd8, 7, 9, 1.5); hallLight.position.set(0, 2.9, 7.2); scene.add(hallLight);

  /* ───── 메인 플로어 ───── */
  box(30, 0.1, 30, floorM, 0, -0.05, -9.5, inside);
  box(30, 0.2, 30, std(0x06060b), 0, 8.1, -9.5, inside);   // 천장
  box(0.4, 8.2, 30, wallM, -14.2, 4, -9.5, inside); box(0.4, 8.2, 30, wallM, 14.2, 4, -9.5, inside); box(30, 8.2, 0.4, wallM, 0, 4, -24.5, inside);
  box(12.5, 8.2, 0.4, wallM, -8, 4, 5.1, inside); box(12.5, 8.2, 0.4, wallM, 8, 4, 5.1, inside); box(3.5, 4.6, 0.4, wallM, 0, 5.9, 5.1, inside);

  // 벽 네온
  const neonList = [];
  const strip = (w, h, d, x, y, z) => { const m = box(w, h, d, glow(0xffffff), x, y, z, inside); neonList.push(m); return m; };
  for (let y of [2.4, 4.9]) { strip(0.05, 0.06, 25, -13.96, y, -6); strip(0.05, 0.06, 25, 13.96, y, -6); }
  strip(11, 0.06, 0.05, -8.2, 3.7, 4.86); strip(11, 0.06, 0.05, 8.2, 3.7, 4.86);

  // 무대
  const stageM = std(0x09090f, { roughness: 0.3, metalness: 0.5 });
  box(24, 1.15, 7, stageM, 0, 0.575, -21, inside);
  const stageEdge = strip(24, 0.09, 0.06, 0, 1.16, -17.47);
  strip(24, 0.06, 0.06, 0, 0.12, -17.47);
  void stageEdge;
  box(0.45, 8, 0.45, stageM, -11.2, 4, -18, inside); box(0.45, 8, 0.45, stageM, 11.2, 4, -18, inside);

  // DJ 부스
  const deckM = std(0x14141d, { roughness: 0.3, metalness: 0.6 });
  box(4.8, 1.08, 1.1, deckM, 0, 1.69, -19.6, inside);
  const boothFace = box(4.8, 0.8, 0.03, glow(0xffffff), 0, 1.66, -19.03, inside); neonList.push(boothFace);
  [-1.25, 1.25].forEach((x) => {
    const p = add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 26), std(0x050507, { roughness: 0.2 }), x, 2.25, -19.6, inside);
    updaters.push((dt) => { p.rotation.y += dt * 3.5; });
    add(new THREE.BoxGeometry(0.03, 0.03, 0.24), glow(0x22d3ee), 0.12, 0.03, 0, p);
  });
  box(0.5, 0.06, 0.5, std(0x25252f), 0, 2.26, -19.6, inside);
  // 스피커
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 3; i++) {
      box(1.7, 1.45, 1.1, std(0x07070b, { roughness: 0.5 }), s * 8.5, 1.9 + i * 1.5, -19, inside);
      const cone = add(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 24), std(0x1b1b24), s * 8.5, 1.9 + i * 1.5, -18.44, inside); cone.rotation.x = Math.PI / 2;
      updaters.push((dt, t, clock) => { const k = 1 + clock.kick * 0.09; cone.scale.set(k, 1, k); });
    }
  });

  // LED 월
  const ledC = document.createElement('canvas'); ledC.width = 640; ledC.height = 240;
  const led = ledC.getContext('2d'), ledT = new THREE.CanvasTexture(ledC); ledT.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(21, 7.3), new THREE.MeshBasicMaterial({ map: ledT, toneMapped: false }), 0, 4.75, -24.2, inside);
  flare(0x8b5cf6, 26, 0, 4.8, -23, inside, 0.2);

  // LED 바닥
  const NX = 18, NZ = 12, tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 0.03, 0.96), new THREE.MeshBasicMaterial({ toneMapped: false }), NX * NZ);
  const mtx = new THREE.Matrix4();
  for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) { mtx.setPosition(FLOOR.xMin + 0.5 + ix, 0.016, FLOOR.zMin + 0.5 + iz); tiles.setMatrixAt(ix * NZ + iz, mtx); tiles.setColorAt(ix * NZ + iz, new THREE.Color(0)); }
  inside.add(tiles);

  // 트러스와 무빙 라이트 빔
  const trussM = std(0x25252f, { roughness: 0.5, metalness: 0.7 });
  [-14, -8, -2].forEach((z) => box(23, 0.2, 0.2, trussM, 0, 7.3, z, inside));
  const coneG = new THREE.ConeGeometry(0.72, 8.6, 20, 1, true); coneG.translate(0, -4.3, 0);
  const beams = [];
  for (const z of [-14, -8, -2]) for (const x of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
    if (z === -2 && Math.abs(x) > 6) continue;
    const pivot = new THREE.Group(); pivot.position.set(x, 7.15, z); inside.add(pivot);
    const mat = new THREE.MeshBasicMaterial({ map: bt, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false });
    const cone = add(coneG, mat, 0, 0, 0, pivot);
    box(0.32, 0.36, 0.32, std(0x101016), 0, 0, 0, pivot);
    const lens = flare(0xffffff, 0.9, 0, -0.22, 0, pivot, 0.85);
    beams.push({ pivot, mat, lens, x, z, seed: Math.random() * 6, cone });
  }

  // 레이저
  const laserG = new THREE.CylinderGeometry(0.012, 0.012, 34, 5); laserG.translate(0, 17, 0);
  const lasers = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const l = add(laserG, mat, (i - 6.5) * 0.7, 6.8, -22.8, inside); l.visible = false;
    lasers.push({ l, mat, i });
  }

  // 색 조명 (실제로 사람과 바닥을 비춘다)
  const washes = [[-6, -11], [6, -11], [0, -6], [-5, 0]].map(([x, z]) => { const p = new THREE.PointLight(0xffffff, 42, 24, 1.3); p.position.set(x, 5.6, z); scene.add(p); return p; });
  const kickLight = new THREE.PointLight(0xffffff, 0, 30, 1.2); kickLight.position.set(0, 6.5, -11); scene.add(kickLight);
  const stageLight = new THREE.PointLight(0xffffff, 40, 20, 1.3); stageLight.position.set(0, 5, -17); scene.add(stageLight);

  // 안개
  const hazes = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(spriteMat(0x8b5cf6, 0.05)); const size = rand(7, 12);
    s.scale.set(size, size * 0.62, 1); s.position.set(rand(-12, 12), rand(0.8, 3.2), rand(-16, 2)); inside.add(s);
    hazes.push({ s, seed: Math.random() * 6, y: s.position.y, x: s.position.x });
  }

  // 스탠딩 테이블
  const topM = std(0x20202a, { roughness: 0.48, metalness: 0.2 }), legM = std(0x303038, { roughness: 0.3, metalness: 0.8 });
  const tableRings = [];
  for (const T of TABLES) {
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 10), legM, T.x, 0.53, T.z, inside);
    add(new THREE.CylinderGeometry(0.27, 0.3, 0.04, 20), legM, T.x, 0.02, T.z, inside);
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28), topM, T.x, 1.08, T.z, inside);
    const ring = add(new THREE.TorusGeometry(0.42, 0.012, 6, 36), glow(0x22d3ee), T.x, 1.06, T.z, inside); ring.rotation.x = Math.PI / 2;
    tableRings.push(ring);
    flare(0x22d3ee, 1.4, T.x, 1.03, T.z, inside, 0.22);
  }

  // 바
  const barM = std(0x12121a, { roughness: 0.2, metalness: 0.45 });
  box(1.1, 1.12, 19, barM, 11.6, 0.56, -5.5, inside);
  const barGlow = strip(0.05, 0.05, 19, 11.03, 0.34, -5.5); void barGlow;
  box(0.24, 3.4, 19, std(0x0a0a10), 13.9, 3.1, -5.5, inside);
  const bottleColors = [0xfbbf24, 0x22d3ee, 0xf472b6, 0x34d399, 0xa78bfa, 0xfb923c];
  const bottleSpots = [];
  for (const y of [2.1, 2.95, 3.8]) {
    box(0.36, 0.04, 18, glow(0xfff1d6), 13.66, y - 0.21, -5.5, inside);
    for (let z = -14.3; z < 3.4; z += 0.46) bottleSpots.push([y, z + rand(-0.05, 0.05)]);
  }
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 10), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.86 }), bottleSpots.length);
  const bottleMtx = new THREE.Matrix4(), bottleColor = new THREE.Color();
  bottleSpots.forEach(([y, z], i) => { bottleMtx.setPosition(13.66, y, z); bottles.setMatrixAt(i, bottleMtx); bottles.setColorAt(i, bottleColor.set(bottleColors[Math.floor(Math.random() * 6)])); });
  inside.add(bottles);
  const barLight = new THREE.PointLight(0xffd69c, 22, 13, 1.4); barLight.position.set(12.4, 3.2, -5.5); scene.add(barLight);

  // 이산화탄소 분사와 컨페티
  const JET = 180, jetPos = new Float32Array(JET * 3), jetV = new Float32Array(JET * 3), jetLife = new Float32Array(JET);
  const jetG = new THREE.BufferGeometry(); jetG.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  for (let i = 0; i < JET; i++) jetPos[i * 3 + 1] = -30;
  const jets = new THREE.Points(jetG, new THREE.PointsMaterial({ map: gt, color: 0xe8f4ff, size: 1.15, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  jets.frustumCulled = false; inside.add(jets);
  const CONF = 160, confM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CONF);
  confM.frustumCulled = false;
  const confs = [], dummy = new THREE.Object3D(), colorC = new THREE.Color();
  for (let i = 0; i < CONF; i++) {
    confs.push({ x: 0, y: -20, z: 0, vy: 0, rx: Math.random() * 6, ry: Math.random() * 6, s: Math.random() * 6, on: false });
    confM.setColorAt(i, colorC.setHSL(Math.random(), 0.9, 0.62));
    dummy.position.set(0, -20, 0); dummy.updateMatrix(); confM.setMatrixAt(i, dummy.matrix);
  }
  inside.add(confM);
  const fireDrop = () => {
    let n = 0;
    for (let i = 0; i < JET && n < 150; i++) if (jetLife[i] <= 0) {
      const sx = i % 4 === 0 ? -10 : i % 4 === 1 ? 10 : i % 4 === 2 ? -4.5 : 4.5;
      jetPos[i * 3] = sx; jetPos[i * 3 + 1] = 1.2; jetPos[i * 3 + 2] = -17.6;
      jetV[i * 3] = rand(-0.55, 0.55); jetV[i * 3 + 1] = rand(7, 12.5); jetV[i * 3 + 2] = rand(-0.3, 0.9); jetLife[i] = rand(0.5, 0.9); n++;
    }
    for (const c of confs) { c.x = rand(-10, 10); c.y = rand(6.6, 10); c.z = rand(-16, -4); c.vy = rand(0.65, 1.2); c.on = true; }
  };

  /* ───── 매 프레임 ───── */
  let tick = 0, lastBar = -1, flash = 0, hueBase = 0;
  const palette = { drop: [0.86, 0.5, 0.74], groove: [0.76, 0.56, 0.6], intro: [0.65, 0.72, 0.6], break: [0.58, 0.68, 0.76], build: [0.04, 0.92, 0.84] };
  const c1 = new THREE.Color(), c2 = new THREE.Color();
  const scratch = new THREE.Color();

  function drawLed(clock, freq) {
    const W2 = ledC.width, H = ledC.height, name = clock.section.name, e = clock.energy, pal = palette[name] || palette.groove;
    const h1 = (pal[0] + hueBase) % 1, h2 = (pal[1] + hueBase) % 1, css = (h, l) => `hsl(${h * 360} 90% ${l}%)`;
    led.fillStyle = '#04030a'; led.fillRect(0, 0, W2, H);
    if (name === 'drop') {
      for (let i = 7; i >= 0; i--) {
        const k = ((clock.beat / 2 + i / 8) % 1), r = k * 370;
        led.strokeStyle = css(i % 2 ? h1 : h2, 40 + 26 * (1 - k)); led.lineWidth = 7 + 18 * k;
        led.beginPath(); led.ellipse(W2 / 2, H / 2, r * 1.28, r * 0.72, 0, 0, 7); led.stroke();
      }
    } else if (name === 'break') {
      const g = led.createLinearGradient(0, 0, W2, 0);
      g.addColorStop(0, css(h1, 18)); g.addColorStop(0.5, css(h2, 34 + Math.sin(clock.beat) * 6)); g.addColorStop(1, css(h1, 18));
      led.fillStyle = g; led.fillRect(0, 0, W2, H);
    }
    const n = 32, bw = W2 / n;
    for (let i = 0; i < n; i++) {
      const v = freq ? freq[Math.min(freq.length - 1, Math.floor(i * 1.05))] / 255 : (0.4 + 0.4 * Math.sin(i + clock.beat * 3));
      const bh = v * H * (0.3 + 0.55 * e);
      led.fillStyle = css((h1 + (i / n) * 0.2) % 1, 48);
      led.fillRect(i * bw + 2, H - bh, bw - 4, bh);
    }
    const scale = 1 + clock.kick * 0.05;
    led.save(); led.translate(W2 / 2, H / 2); led.scale(scale, scale);
    led.font = '800 92px Outfit, sans-serif'; led.textAlign = 'center'; led.textBaseline = 'middle';
    led.shadowColor = css(h2, 60); led.shadowBlur = 26; led.fillStyle = '#ffffff'; led.fillText('PULSE', 0, 2);
    led.restore(); led.shadowBlur = 0;
    ledT.needsUpdate = true;
  }

  function update(dt, t, clock, edm, playerZ) {
    tick++;
    const outdoors = playerZ > 10.2, fx = fxState.full, name = clock.section.name, e = Math.min(1.1, clock.energy), pal = palette[name] || palette.groove;
    if (clock.bar !== lastBar) { lastBar = clock.bar; if (clock.bar % 4 === 0) hueBase = (hueBase + 0.11) % 1; if (name === 'drop' && clock.section.barIn === 0 && !outdoors) fireDrop(); }
    if (clock.beatFrac < 0.12 && flash < 0.5) flash = name === 'drop' ? 1 : 0.5;
    flash *= Math.exp(-dt * 8);

    // 문, 차, 간판
    doorOpen += (doorTo - doorOpen) * (1 - Math.exp(-dt * 5));
    doors.forEach(({ pivot, s }) => { pivot.rotation.y = -s * doorOpen * 1.5; });
    sign.material.opacity = 0.9 + Math.sin(t * 37) * Math.sin(t * 3.1) * 0.08;
    canopyGlow.scale.y = 1 + clock.kick * 0.6;
    if (outdoors || playerZ > 4.4) {
      carWait -= dt;
      if (carWait < 0) { car.position.x += carV * dt * 1.2; if (Math.abs(car.position.x) > 90) { carV = -carV; car.rotation.y = carV < 0 ? Math.PI : 0; car.position.z = carV < 0 ? 28 : 21; carWait = rand(3, 9); } }
    }
    street.visible = playerZ > 3.6 || doorOpen > 0.02;
    doorLight.intensity = street.visible ? 20 : 0; queueLight.intensity = street.visible ? 30 : 0;
    updaters.forEach((f) => f(dt, t, clock));

    // 바깥에서는 안쪽을 계산하지 않는다 (복도 조명만 유지)
    stripA.forEach((m) => m.material.color.setHSL((pal[0] + hueBase) % 1, 0.9, 0.55));
    if (outdoors && doorOpen < 0.02) { inside.visible = false; for (const p of washes) p.intensity = 0; kickLight.intensity = 0; stageLight.intensity = 0; barLight.intensity = 0; return; }
    barLight.intensity = 22;
    inside.visible = true;

    const h1 = (pal[0] + hueBase) % 1, h2 = (pal[1] + hueBase) % 1, h3 = (pal[2] + hueBase) % 1;
    c1.setHSL(h1, 0.95, 0.56); c2.setHSL(h2, 0.95, 0.56);
    if (tick % 3 === 0) neonList.forEach((m, i) => m.material.color.copy(i % 2 ? c2 : c1).multiplyScalar(0.72 + clock.kick * 0.5));

    if (tick % 3 === 0) { edm.analyser?.getByteFrequencyData(edm.freq); drawLed(clock, edm.freq); }

    // 바닥 타일
    if (tick % 2 === 0) {
      const dim = fx ? 1 : 0.42, step = Math.floor(clock.beat);
      for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
        const cx = ix - NX / 2 + 0.5, cz = iz - NZ / 2 + 0.5, dist = Math.hypot(cx, cz * 1.2);
        let v;
        if (name === 'drop') { v = 0.18 + Math.max(0, Math.sin(dist * 0.9 - clock.beat * Math.PI * 2)) ** 3 * 0.86; }
        else if (name === 'build') { v = (ix + iz + step) % 2 === 0 ? 0.08 + clock.build * 0.75 : 0.03; }
        else if (name === 'break') { v = 0.05 + (0.5 + 0.5 * Math.sin(ix * 0.7 + iz * 0.5 + t * 0.7)) * 0.17; }
        else { v = ((ix + iz * 3 + step) % 5 === 0 ? 0.32 * (0.35 + clock.kick * 0.65) : 0.035) + 0.022; }
        scratch.setHSL((dist * 0.03 + h1) % 1, 0.95, 0.5).multiplyScalar(v * dim * 0.62);
        tiles.setColorAt(ix * NZ + iz, scratch);
      }
      tiles.instanceColor.needsUpdate = true;
    }

    // 무빙 라이트
    const rate = name === 'drop' ? 0.5 : name === 'break' ? 0.12 : 0.25;
    beams.forEach((b, i) => {
      const ph = clock.beat * rate * Math.PI + b.seed;
      b.pivot.rotation.x = Math.sin(ph) * (0.34 + e * 0.24) + 0.05;
      b.pivot.rotation.z = Math.cos(ph * 0.8 + i) * (0.3 + e * 0.32);
      const on = name === 'drop' ? (Math.floor(clock.beat) + i) % 2 === 0 || !fx ? 1 : 0.5 : name === 'break' ? (i % 3 === 0 ? 0.6 : 0.12) : 0.55;
      b.mat.opacity = (fx ? 0.2 : 0.1) * on * (0.45 + e * 0.8);
      b.mat.color.setHSL(i % 3 === 0 ? h3 : i % 2 ? h2 : h1, 0.95, 0.55);
      b.lens.material.color.copy(b.mat.color); b.lens.material.opacity = 0.35 + 0.65 * on;
    });

    // 레이저: 빌드 끝과 드롭에서만
    const laserOn = fx && (name === 'drop' || (name === 'build' && clock.section.barIn >= clock.section.bars - 2));
    lasers.forEach(({ l, mat, i }) => {
      l.visible = laserOn; if (!laserOn) return;
      const ph = clock.beat * Math.PI * 0.25, spread = (i - 6.5) * 0.11;
      l.rotation.x = 1.14 + Math.sin(ph + i * 0.25) * 0.14;
      l.rotation.z = -(spread + Math.sin(ph * 0.5) * 0.28);
      mat.opacity = 0.34 + flash * 0.42; mat.color.setHSL((0.36 + hueBase) % 1, 1, 0.56);
    });

    // 색 조명
    washes.forEach((p, i) => {
      p.color.setHSL(i % 2 ? h1 : h2, 0.9, 0.58);
      p.intensity = (i < 3 ? 40 + e * 56 : 26) * (i < 3 ? 0.66 + clock.kick * 0.5 : 1);
      if (i < 3) { p.position.x += Math.sin(t * 0.9 + i * 2) * dt * 1.4; p.position.z += Math.cos(t * 0.7 + i) * dt * 1.2; }
    });
    stageLight.color.setHSL(h2, 0.75, 0.7); stageLight.intensity = 32 + e * 44;
    kickLight.color.setHSL(h3, 0.3, 0.86);
    kickLight.intensity = fx ? (name === 'drop' ? 145 : 26) * flash : 0;

    hazes.forEach((h, i) => {
      h.s.material.color.setHSL(i % 2 ? h1 : h2, 0.8, 0.6);
      h.s.material.opacity = fx ? 0.055 + e * 0.05 : 0.035;
      h.s.position.x = h.x + Math.sin(t * 0.08 + h.seed) * 2.4;
    });
    tableRings.forEach((r, i) => r.material.color.setHSL((h2 + i * 0.03) % 1, 0.9, 0.6));

    // 입자
    let alive = false;
    for (let i = 0; i < JET; i++) {
      if (jetLife[i] > 0) {
        alive = true; jetLife[i] -= dt;
        jetPos[i * 3] += jetV[i * 3] * dt; jetPos[i * 3 + 1] += jetV[i * 3 + 1] * dt; jetPos[i * 3 + 2] += jetV[i * 3 + 2] * dt;
        jetV[i * 3 + 1] *= 1 - 2.4 * dt;
        if (jetLife[i] <= 0) jetPos[i * 3 + 1] = -30;
      }
    }
    if (alive) jetG.attributes.position.needsUpdate = true;
    let confOn = false;
    confs.forEach((c, i) => {
      if (!c.on) return; confOn = true;
      c.y -= c.vy * dt; c.rx += dt * 3.2; c.ry += dt * 2.2;
      dummy.position.set(c.x + Math.sin(t * 1.5 + c.s) * 0.45, c.y, c.z); dummy.rotation.set(c.rx, c.ry, 0); dummy.updateMatrix(); confM.setMatrixAt(i, dummy.matrix);
      if (c.y < 0.03) { c.on = false; dummy.position.y = -20; dummy.updateMatrix(); confM.setMatrixAt(i, dummy.matrix); }
    });
    if (confOn) confM.instanceMatrix.needsUpdate = true;
  }

  return {
    update, setDoor: (open) => { doorTo = open ? 1 : 0; },
  };
}
