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
function signTexture(theme) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 280;
  const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 280);
  g.font = `800 ${theme.signSize}px Outfit, Pretendard, "Malgun Gothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = theme.signGlow; g.shadowBlur = 46; g.fillStyle = theme.signFill;
  for (let i = 0; i < 3; i++) g.fillText(theme.sign, 512, 144);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 뒷벽: 입구 양쪽을 무대 분위기에 맞게 꾸민다. 벽에 붙는 것만 두어 동선은 그대로다 */
const canvasOf = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
const litPlane = (map, glowing = 0.5) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glowing });
const neonText = (text, font, color = '#ffffff', shadow = '#ffffff') => new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false, toneMapped: false,
  map: canvasOf(1024, 256, (g, W, H) => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.shadowColor = shadow; g.shadowBlur = 30;
    for (let i = 0; i < 3; i++) g.fillText(text, W / 2, H / 2 + 6);
  }),
});

function buildBackWall(inside, theme, neonList, updaters, flare) {
  const W = 12.15, H = 8.2;
  const sides = [7.925, -7.925].map((x) => { const g = new THREE.Group(); g.position.set(x, 0, 4.885); g.rotation.y = Math.PI; inside.add(g); return g; });
  const label = (g, mat, w, h, x, y, z = 0.02) => add(new THREE.PlaneGeometry(w, h), mat, x, y, z, g);

  // 입구 틀
  const trim = std(theme.band ? 0x3a2212 : 0x15151f, { roughness: 0.45, metalness: theme.band ? 0.1 : 0.6 });
  [-1, 1].forEach((s) => box(0.2, 3.72, 0.16, trim, s * 1.85, 1.86, 4.84, inside));
  box(3.9, 0.2, 0.16, trim, 0, 3.72, 4.84, inside);
  const exit = label(inside, neonText(theme.band ? '나가는 곳' : 'EXIT', theme.band ? '800 130px Pretendard, "Malgun Gothic", sans-serif' : '800 170px Outfit, sans-serif', theme.band ? '#ffe9b8' : '#b6ffd8', theme.band ? '#ff9d2e' : '#22ff88'), 2.4, 0.6, 0, 4.25, 4.87);
  exit.rotation.y = Math.PI;

  if (theme.band) {
    // 벽지: 70년대 둥근 무늬 (재즈 바는 붉은 벽돌)
    const paper = theme.jazz ? canvasOf(1536, 1024, (g, cw, ch) => {
      g.fillStyle = '#2a1712'; g.fillRect(0, 0, cw, ch);
      const bw = 96, bh = 40;
      for (let y = 0, r = 0; y < ch; y += bh, r++) for (let x = (r % 2) * -bw / 2; x < cw; x += bw) {
        const k = (x * 13 + y * 7) % 5;
        g.fillStyle = ['#5a2a1c', '#4e2418', '#63301f', '#552819', '#47201a'][k]; g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      }
      const shade = g.createLinearGradient(0, 0, 0, ch); shade.addColorStop(0, 'rgba(6,4,8,.9)'); shade.addColorStop(0.35, 'rgba(6,4,8,.45)'); shade.addColorStop(1, 'rgba(6,4,8,.25)');
      g.fillStyle = shade; g.fillRect(0, 0, cw, ch);
    }) : canvasOf(1536, 1024, (g, cw, ch) => {
      g.fillStyle = '#4a2413'; g.fillRect(0, 0, cw, ch);
      const s = 96;
      for (let y = 0; y < ch + s; y += s) for (let x = 0; x < cw + s; x += s) {
        const ox = (y / s) % 2 ? s / 2 : 0;
        g.strokeStyle = '#6b3a1b'; g.lineWidth = 10; g.beginPath(); g.arc(x + ox, y, 34, 0, 7); g.stroke();
        g.strokeStyle = '#8a5222'; g.lineWidth = 4; g.beginPath(); g.arc(x + ox, y, 18, 0, 7); g.stroke();
        g.fillStyle = '#a8662a'; g.beginPath(); g.arc(x + ox, y, 5, 0, 7); g.fill();
      }
      const shade = g.createLinearGradient(0, 0, 0, ch); shade.addColorStop(0, 'rgba(15,6,3,.82)'); shade.addColorStop(0.3, 'rgba(15,6,3,.28)'); shade.addColorStop(1, 'rgba(15,6,3,.1)');
      g.fillStyle = shade; g.fillRect(0, 0, cw, ch);
    });
    const planks = canvasOf(1024, 128, (g, cw, ch) => {
      for (let x = 0; x < cw; x += 64) { g.fillStyle = ['#5c3216', '#663818', '#532c13'][(x / 64) % 3]; g.fillRect(x, 0, 62, ch); g.fillStyle = '#2a1508'; g.fillRect(x + 62, 0, 2, ch); }
    });
    const rail = std(0x2e180b, { roughness: 0.5 }), brass = glow(0xffc77a);
    const posterArt = (title, sub, bg, fg) => litPlane(canvasOf(360, 512, (g, cw, ch) => {
      g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
      g.fillStyle = fg; g.globalAlpha = 0.28; g.beginPath(); g.arc(cw / 2, 190, 118, 0, 7); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(16, 16, cw - 32, ch - 32);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 52px Pretendard, "Malgun Gothic", sans-serif'; g.fillText(title, cw / 2, 345);
      g.font = '600 26px Pretendard, "Malgun Gothic", sans-serif'; g.fillText(sub, cw / 2, 415);
    }), 0.8);
    const record = (label) => litPlane(canvasOf(256, 256, (g) => {
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#111013'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill();
      g.strokeStyle = '#2b2a30'; g.lineWidth = 2; for (let r = 46; r < 110; r += 7) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }
      g.fillStyle = label; g.beginPath(); g.arc(128, 128, 38, 0, 7); g.fill();
      g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(128, 128, 5, 0, 7); g.fill();
    }), 0.8);
    const framed = (g, mat, w, h, x, y) => { box(w + 0.16, h + 0.16, 0.07, rail, x, y, 0.04, g); label(g, mat, w, h, x, y, 0.08); };
    const sconce = (g, x, y) => {
      box(0.09, 0.28, 0.06, rail, x, y, 0.03, g);
      add(new THREE.SphereGeometry(0.09, 12, 10), brass, x, y + 0.1, 0.14, g);
      const w0 = new THREE.Vector3(); g.localToWorld(w0.set(x, y + 0.1, 0.16));
      flare(0xffb35c, 2.4, w0.x, w0.y, w0.z, inside, 0.42);
    };
    sides.forEach((g, i) => {
      label(g, litPlane(paper, 0.5), W, H, 0, H / 2);
      box(W, 1.3, 0.07, litPlane(planks, 0.42), 0, 0.65, 0.04, g);
      box(W, 0.07, 0.12, rail, 0, 1.33, 0.06, g);
      box(W, 0.12, 0.1, rail, 0, 0.06, 0.06, g);
      if (theme.jazz) {
        if (i === 0) {
          framed(g, posterArt('블루 아워', '금요일 밤 아홉 시', '#0f1e3d', '#f5d58a'), 1.25, 1.78, -1.75, 2.75);
          framed(g, posterArt('스윙 나이트', '피아노 · 첼로 · 드럼', '#3b0d16', '#f5e6c8'), 1.25, 1.78, 0.05, 2.75);
          framed(g, posterArt('보사노바', '비 오는 날의 노래', '#14352f', '#f5d58a'), 1.25, 1.78, 1.85, 2.75);
          framed(g, record('#1d4ed8'), 0.8, 0.8, 3.65, 3.2); framed(g, record('#b45309'), 0.8, 0.8, 3.65, 2.2);
          [-2.85, -0.85, 0.95, 2.85].forEach((x) => sconce(g, x, 2.55));
        } else {
          [-3.9, -3, -2.1].forEach((x, k) => framed(g, record(['#1e3a8a', '#b45309', '#7f1d1d'][k]), 0.76, 0.76, x, 2.25));
          [-3, 2.9].forEach((x) => sconce(g, x, 4.7));
          framed(g, posterArt('첼로 리사이틀', '낮게, 깊게', '#1c1917', '#e7c77d'), 1.25, 1.78, 3.9, 2.75);
          framed(g, posterArt('재즈 보컬', '오늘의 스탠더드', '#172554', '#fde8c8'), 1.25, 1.78, 2.25, 2.75);
          framed(g, posterArt('위스키 테이스팅', '싱글 몰트 세 잔', '#422006', '#fde68a'), 1.25, 1.78, 0.6, 2.75);
          box(5.7, 1.3, 0.05, rail, -3, 4.1, 0.03, g);
          label(g, neonText('재즈 & 위스키', '800 118px Pretendard, "Malgun Gothic", sans-serif', '#dbe7ff', '#4f8cff'), 5.4, 1.35, -3, 4.1, 0.08);
        }
        return;
      }
      if (i === 0) {   // 바 쪽
        framed(g, posterArt('통기타의 밤', '금요일 저녁 일곱 시', '#7f1d1d', '#fde8c8'), 1.25, 1.78, -1.75, 2.75);
        framed(g, posterArt('고고 파티', '오늘은 밤새도록', '#1e3a5f', '#ffd28a'), 1.25, 1.78, 0.05, 2.75);
        framed(g, posterArt('청춘 콘서트', '그때 그 노래를 다시', '#b45309', '#fff3d6'), 1.25, 1.78, 1.85, 2.75);
        framed(g, record('#d97706'), 0.8, 0.8, 3.65, 3.2); framed(g, record('#9f1239'), 0.8, 0.8, 3.65, 2.2);
        [-2.85, -0.85, 0.95, 2.85].forEach((x) => sconce(g, x, 2.55));
      } else {         // 반대쪽
        [-3.9, -3, -2.1].forEach((x, k) => framed(g, record(['#0f766e', '#d97706', '#9f1239'][k]), 0.76, 0.76, x, 2.25));
        [-3, 2.9].forEach((x) => sconce(g, x, 4.7));
        framed(g, posterArt('음악 감상실', '신청곡 받습니다', '#3f6212', '#f5f0e1'), 1.25, 1.78, 3.9, 2.75);
        framed(g, posterArt('포크 대행진', '기타 하나, 노래 하나', '#7c2d12', '#fde8c8'), 1.25, 1.78, 2.25, 2.75);
        framed(g, posterArt('밤의 디스코', '거울 공 아래에서', '#581c87', '#fde68a'), 1.25, 1.78, 0.6, 2.75);
        box(5.7, 1.3, 0.05, rail, -3, 4.1, 0.03, g);
        label(g, neonText('추억의 음악다방', '800 118px Pretendard, "Malgun Gothic", sans-serif', '#ffe9b8', '#ff9d2e'), 5.4, 1.35, -3, 4.1, 0.08);
      }
    });
    return;
  }

  // 클럽: 흡음 패널, 네온 문구, 박자에 맞춰 뛰는 빛기둥
  const panel = canvasOf(1536, 1024, (g, cw, ch) => {
    g.fillStyle = '#0a0a14'; g.fillRect(0, 0, cw, ch);
    const s = 96;
    for (let y = -s; y < ch + s; y += s / 2) for (let x = -s; x < cw + s; x += s) {
      const ox = ((y / (s / 2)) & 1) ? s / 2 : 0, cx = x + ox, l = 18 + ((cx * 7 + y * 13) % 11);
      g.fillStyle = `hsl(250 26% ${l}%)`;
      g.beginPath(); g.moveTo(cx, y - s / 2 + 3); g.lineTo(cx + s / 2 - 3, y); g.lineTo(cx, y + s / 2 - 3); g.lineTo(cx - s / 2 + 3, y); g.fill();
      g.fillStyle = 'rgba(0,0,0,.34)';
      g.beginPath(); g.moveTo(cx, y + s / 2 - 3); g.lineTo(cx + s / 2 - 3, y); g.lineTo(cx, y); g.lineTo(cx - s / 2 + 3, y); g.fill();
    }
    const shade = g.createLinearGradient(0, 0, 0, ch); shade.addColorStop(0, 'rgba(0,0,0,.72)'); shade.addColorStop(0.35, 'rgba(0,0,0,.12)'); shade.addColorStop(1, 'rgba(0,0,0,.4)');
    g.fillStyle = shade; g.fillRect(0, 0, cw, ch);
  });
  const pillar = std(0x101019, { roughness: 0.35, metalness: 0.6 });
  sides.forEach((g, i) => {
    label(g, litPlane(panel, 0.38), W, H, 0, H / 2);
    box(W, 0.3, 0.1, pillar, 0, 0.15, 0.05, g);
    [-5.9, -2.7, 0.1, 2.9, 5.7].forEach((x) => {
      box(0.34, H, 0.14, pillar, x, H / 2, 0.07, g);
      const m = box(0.05, 5.4, 0.03, glow(0xffffff), x, 2.9, 0.15, g); neonList.push(m);
    });
    const sx = i ? -1.4 : 1.5, sw = i ? 8.2 : 6.4;
    box(sw + 0.3, 1.5, 0.06, std(0x050509, { roughness: 0.4, metalness: 0.5 }), sx, 3.85, 0.19, g);
    const sign = label(g, neonText(i ? 'DANCE ALL NIGHT' : 'FEEL THE BASS', '800 100px Outfit, sans-serif'), sw, sw / 4, sx, 3.85, 0.23); neonList.push(sign);
  });
  // 빛기둥
  const barX = [];
  for (const s of [1, -1]) for (const b of s > 0 ? [2.2, 5, 7.8] : [2.2, 5, 7.8, 10.6]) for (const o of [0.5, 1.1, 1.7, 2.3]) barX.push(s * (b + o));
  const COUNT = barX.length, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 1, 0.03).translate(0, 0.5, 0), glow(0xffffff), COUNT), d = new THREE.Object3D();
  bars.frustumCulled = false; inside.add(bars); neonList.push(bars);
  updaters.push((dt, t, clock) => {
    if (!inside.visible) return;
    for (let i = 0; i < COUNT; i++) {
      const v = 0.5 + 0.5 * Math.sin(i * 0.9 + clock.beat * Math.PI);
      d.position.set(barX[i], 0.32, 4.84); d.scale.set(1, 0.18 + v * (0.5 + clock.energy * 1.1) + clock.kick * 0.35, 1); d.updateMatrix(); bars.setMatrixAt(i, d.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;
  });
}

export function buildWorld(scene, fxState, theme) {
  const gt = glowTexture(), bt = beamTexture(), updaters = [];
  const spriteMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: gt, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flare = (color, size, x, y, z, parent = scene, opacity = 1) => { const s = new THREE.Sprite(spriteMat(color, opacity)); s.scale.set(size, size, 1); s.position.set(x, y, z); parent.add(s); return s; };

  scene.add(new THREE.HemisphereLight(...theme.hemi));

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
  const sign = add(new THREE.PlaneGeometry(7.2, 1.97), new THREE.MeshBasicMaterial({ map: signTexture(theme), transparent: true, toneMapped: false, depthWrite: false }), 0, 5.35, 10.3, street);
  flare(theme.accent, 11, 0, 5.3, 10.5, street, 0.34);
  box(5.6, 0.14, 2.6, std(0x0d0d14, { roughness: 0.4 }), 0, 3.7, 11.45, street);
  const canopyGlow = box(5.62, 0.05, 0.05, glow(theme.accent), 0, 3.62, 12.74, street);
  box(2.6, 0.02, 5.4, std(0x7f1231, { roughness: 0.9 }), 0, 0.01, 12.9, street);
  const doorLight = new THREE.PointLight(theme.accent, 20, 14, 1.6); doorLight.position.set(0, 3.3, 12); scene.add(doorLight);
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
  const wallM = std(theme.wall, { roughness: 0.68 }), floorM = std(theme.floor, { roughness: 0.72, metalness: 0.08 });
  box(3.2, 0.1, 5.4, floorM, 0, -0.05, 7.4, inside);
  box(3.2, 0.1, 5.4, wallM, 0, 3.55, 7.4, inside);
  [-1, 1].forEach((s) => box(0.2, 3.6, 5.4, wallM, s * 1.7, 1.8, 7.4, inside));
  const stripA = [-1, 1].map((s) => box(0.05, 0.05, 5.2, glow(0x22d3ee), s * 1.58, 2.8, 7.4, inside));
  const hallLight = new THREE.PointLight(theme.accent, 7, 9, 1.5); hallLight.position.set(0, 2.9, 7.2); scene.add(hallLight);

  /* ───── 메인 플로어 ───── */
  box(30, 0.1, 30, floorM, 0, -0.05, -9.5, inside);
  box(30, 0.2, 30, std(0x06060b), 0, 8.1, -9.5, inside);   // 천장
  box(0.4, 8.2, 30, wallM, -14.2, 4, -9.5, inside); box(0.4, 8.2, 30, wallM, 14.2, 4, -9.5, inside); box(30, 8.2, 0.4, wallM, 0, 4, -24.5, inside);
  box(12.5, 8.2, 0.4, wallM, -8, 4, 5.1, inside); box(12.5, 8.2, 0.4, wallM, 8, 4, 5.1, inside); box(3.5, 4.6, 0.4, wallM, 0, 5.9, 5.1, inside);

  // 벽 네온
  const neonList = [];
  const strip = (w, h, d, x, y, z) => { const m = box(w, h, d, glow(0xffffff), x, y, z, inside); neonList.push(m); return m; };
  for (let y of [2.4, 4.9]) { strip(0.05, 0.06, 25, -13.96, y, -6); strip(0.05, 0.06, 25, 13.96, y, -6); }
  strip(12.15, 0.06, 0.05, -7.9, 5.9, 4.82); strip(12.15, 0.06, 0.05, 7.9, 5.9, 4.82);
  buildBackWall(inside, theme, neonList, updaters, flare);

  // 무대
  const stageM = std(0x09090f, { roughness: 0.3, metalness: 0.5 });
  box(24, 1.15, 7, stageM, 0, 0.575, -21, inside);
  const stageEdge = strip(24, 0.09, 0.06, 0, 1.16, -17.47);
  strip(24, 0.06, 0.06, 0, 0.12, -17.47);
  void stageEdge;
  box(0.45, 8, 0.45, stageM, -11.2, 4, -18, inside); box(0.45, 8, 0.45, stageM, 11.2, 4, -18, inside);

  if (!theme.band) {
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
  // 밴드 무대: 드럼, 앰프, 건반
  } else {
    const shell = std(0x9f1239, { roughness: 0.3, metalness: 0.3 }), skin2 = std(0xf1ece0, { roughness: 0.5 }), chrome = std(0xd6d3d1, { roughness: 0.2, metalness: 0.9 }), brass = std(0xc9a227, { roughness: 0.3, metalness: 0.8 });
    box(4.4, 0.34, 3, std(0x2a1a12), 0, 1.32, -22, inside);   // 드럼 단
    const kit = new THREE.Group(); kit.position.set(0, 1.49, -21.05); inside.add(kit);
    const bd = add(new THREE.CylinderGeometry(0.34, 0.34, 0.34, 22), shell, 0, 0.34, 0, kit); bd.rotation.x = Math.PI / 2;
    const bdf = add(new THREE.CircleGeometry(0.31, 22), skin2, 0, 0.34, 0.175, kit); void bdf;
    [[-0.55, 0.52, 0.04, 0.19], [0.55, 0.52, 0.04, 0.19], [-0.22, 0.86, 0.1, 0.15], [0.22, 0.86, 0.1, 0.15]].forEach(([x, y, z, r]) => {
      add(new THREE.CylinderGeometry(r, r, 0.17, 18), shell, x, y, z, kit);
      add(new THREE.CylinderGeometry(r - 0.005, r - 0.005, 0.005, 18), skin2, x, y + 0.088, z, kit);
    });
    [[-0.95, 1.2], [0.95, 1.28], [-0.82, 0.88]].forEach(([x, y]) => {
      add(new THREE.CylinderGeometry(0.012, 0.012, y, 6), chrome, x, y / 2, 0.1, kit);
      const c = add(new THREE.CylinderGeometry(0.26, 0.26, 0.012, 22), brass, x, y, 0.1, kit); c.rotation.z = x < 0 ? 0.14 : -0.14;
      updaters.push((dt, t, clock) => { c.rotation.x = Math.sin(clock.beat * Math.PI * 2) * 0.05; });
    });
    // 드럼 의자
    add(new THREE.CylinderGeometry(0.19, 0.17, 0.06, 18), std(0x1c1410, { roughness: 0.6 }), 0, 1.49 + 0.47, -21.6, inside);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 8), chrome, 0, 1.49 + 0.22, -21.6, inside);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), chrome, 0, 1.5, -21.6, inside);
    if (theme.jazz) {
      // 무대 러그
      const rug = canvasOf(512, 256, (g, cw, ch) => {
        g.fillStyle = '#5b1219'; g.fillRect(0, 0, cw, ch);
        g.strokeStyle = '#c9a227'; g.lineWidth = 10; g.strokeRect(14, 14, cw - 28, ch - 28);
        g.strokeStyle = '#1e3a5f'; g.lineWidth = 6; g.strokeRect(34, 34, cw - 68, ch - 68);
        g.fillStyle = '#c9a227'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cw / 2, ch / 2, 150 - k * 28, 70 - k * 13, 0, 0, 7); g.globalAlpha = 0.18 + k * 0.08; g.fill(); }
        g.globalAlpha = 1;
      });
      const rugM = new THREE.MeshStandardMaterial({ map: rug, roughness: 0.95 });
      const rugP = add(new THREE.PlaneGeometry(13, 3.4), rugM, 0, 1.153, -19.7, inside); rugP.rotation.x = -Math.PI / 2;
      // 그랜드 피아노: 연주자는 x=-6.05에 앉아 +x(오른쪽)를 본다. 뚜껑은 객석 쪽으로 열린다
      const black = std(0x07070a, { roughness: 0.15, metalness: 0.3 }), ivory = std(0xf4efe2, { roughness: 0.4 }), ebony = std(0x111111, { roughness: 0.3 });
      const piano = new THREE.Group(); piano.position.set(-4.55, 1.15, -19.85); inside.add(piano);
      const shape = new THREE.Shape();
      shape.moveTo(-1.0, -0.72); shape.lineTo(-1.0, 0.72); shape.lineTo(0.2, 0.72);
      shape.bezierCurveTo(0.7, 0.72, 0.6, 0.1, 1.05, -0.05); shape.bezierCurveTo(1.25, -0.15, 1.15, -0.72, 0.8, -0.72); shape.lineTo(-1.0, -0.72);
      const caseG = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }); caseG.rotateX(Math.PI / 2);
      const body = add(caseG, black, 0, 0.98, 0, piano); void body;
      const lidG = new THREE.ShapeGeometry(shape); lidG.rotateX(-Math.PI / 2);
      const lid = new THREE.Group(); lid.position.set(0, 0.99, -0.72); piano.add(lid);
      const lidM = add(lidG, black, 0, 0, 0.72, lid); lidM.material = std(0x07070a, { roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide });
      lid.rotation.x = -0.62;
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6), std(0x222222), 0.25, 1.2, 0.05, piano).rotation.x = -0.55;
      [[-0.85, -0.55], [-0.85, 0.55], [0.75, -0.4]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.05, 0.04, 0.68, 10), black, x, 0.34, z, piano));
      box(0.2, 0.1, 1.5, black, -1.08, 0.66, 0, piano);              // 건반 받침
      box(0.16, 0.025, 1.36, ivory, -1.1, 0.725, 0, piano);           // 흰 건반
      for (let k = 0; k < 22; k++) { if ([2, 6, 9, 13, 16, 20].includes(k)) continue; box(0.09, 0.03, 0.03, ebony, -1.07, 0.75, -0.64 + k * 0.061, piano); }
      box(0.05, 0.16, 1.36, black, -1.0, 0.82, 0, piano);              // 보면대 앞판
      // 피아노 의자
      box(0.36, 0.06, 0.62, std(0x111111, { roughness: 0.6 }), -6.05, 1.15 + 0.46, -19.85, inside);
      [[-0.14, -0.26], [-0.14, 0.26], [0.14, -0.26], [0.14, 0.26]].forEach(([dx, dz]) => box(0.04, 0.44, 0.04, black, -6.05 + dx, 1.15 + 0.22, -19.85 + dz, inside));
      // 첼로 의자 (첼로는 연주자 쪽 app.js에서 붙인다)
      box(0.42, 0.05, 0.4, std(0x3a2414, { roughness: 0.5 }), 3.6, 1.15 + 0.46, -19.75, inside);
      [[-0.17, -0.16], [-0.17, 0.16], [0.17, -0.16], [0.17, 0.16]].forEach(([dx, dz]) => box(0.035, 0.44, 0.035, std(0x2a1a10), 3.6 + dx, 1.15 + 0.22, -19.75 + dz, inside));
      box(0.42, 0.42, 0.04, std(0x3a2414, { roughness: 0.5 }), 3.6, 1.15 + 0.7, -19.95, inside);
      // 무대 옆 스탠드 조명
      [[-10, -18.6], [10, -18.6]].forEach(([x, z]) => {
        add(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), std(0xc9a227, { roughness: 0.3, metalness: 0.8 }), x, 1.15 + 0.8, z, inside);
        add(new THREE.CylinderGeometry(0.16, 0.24, 0.26, 16, 1, true), glow(0xffcf8a), x, 1.15 + 1.7, z, inside);
        flare(0xffb35c, 2.2, x, 1.15 + 1.66, z, inside, 0.5);
      });
    } else {
      // 앰프
      [[-5.2, -21.6], [5.2, -21.6], [-2.8, -21.8], [2.8, -21.8]].forEach(([x, z]) => {
        box(1.2, 1.1, 0.5, std(0x1c1410, { roughness: 0.7 }), x, 1.7, z, inside);
        box(1.02, 0.78, 0.02, std(0x3a2f26, { roughness: 0.95 }), x, 1.74, z + 0.26, inside);
      });
      // 건반
      box(1.4, 0.07, 0.42, std(0x16120f), -5.7, 2.18, -19.25, inside);
      box(1.3, 0.015, 0.16, std(0xf8f4e8), -5.7, 2.222, -19.38, inside);   // 건반은 연주자 쪽
      [-0.5, 0.5].forEach((d) => add(new THREE.CylinderGeometry(0.02, 0.02, 1.03, 6), chrome, -5.7 + d, 1.665, -19.25, inside));
    }
    // 마이크 스탠드
    const micX = theme.jazz ? 0 : 0.32, micZ = theme.jazz ? -18.0 : -18.05;
    add(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 6), chrome, micX, 1.88, micZ, inside);
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 14), chrome, micX, 1.16, micZ, inside);
    if (theme.jazz) {   // 빈티지 마이크 머리
      const head = add(new THREE.CapsuleGeometry(0.045, 0.07, 6, 12), chrome, micX, 2.64, micZ, inside); head.rotation.x = 0.5;
      add(new THREE.TorusGeometry(0.055, 0.008, 6, 16), chrome, micX, 2.62, micZ, inside).rotation.y = Math.PI / 2;
    }
    // 무대 조명 줄
    for (let x = -10; x <= 10; x += 2) { add(new THREE.SphereGeometry(0.1, 10, 8), glow(0xffd28a), x, 7.72, -17.6, inside); flare(0xffb35c, 1.2, x, 7.72, -17.4, inside, 0.6); }
    if (!theme.jazz) {
    // 미러볼
    const ballC = document.createElement('canvas'); ballC.width = 256; ballC.height = 128;
    const bg = ballC.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) { const v = 90 + Math.random() * 165 | 0; bg.fillStyle = `rgb(${v},${v},${v})`; bg.fillRect(x * 8, y * 8, 7, 7); }
    const ballT = new THREE.CanvasTexture(ballC); ballT.magFilter = THREE.NearestFilter; ballT.colorSpace = THREE.SRGBColorSpace;
    const ball = add(new THREE.SphereGeometry(0.62, 28, 18), new THREE.MeshBasicMaterial({ map: ballT, toneMapped: false }), 0, 6.1, -10.5, inside);
    add(new THREE.CylinderGeometry(0.012, 0.012, 2, 6), chrome, 0, 7.1, -10.5, inside);
    flare(0xfff1d6, 2.6, 0, 6.1, -10.5, inside, 0.45);
    const DOTS = 150, dotDir = [], dotPos = new Float32Array(DOTS * 3);
    for (let i = 0; i < DOTS; i++) { const y = Math.random() * 1.4 - 1, r = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y))), a = Math.random() * 6.283; dotDir.push([Math.sin(a) * r, Math.max(-1, Math.min(1, y)), Math.cos(a) * r]); }
    const dotG = new THREE.BufferGeometry(); dotG.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
    const dots = new THREE.Points(dotG, new THREE.PointsMaterial({ map: gt, color: 0xfff0d0, size: 0.34, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    dots.frustumCulled = false; inside.add(dots);
    let ballA = 0;
    updaters.push((dt) => {
      ballA += dt * 0.32; ball.rotation.y = ballA;
      const c = Math.cos(ballA), s = Math.sin(ballA);
      for (let i = 0; i < DOTS; i++) {
        const [dx, dy, dz] = dotDir[i], x = dx * c + dz * s, z = -dx * s + dz * c;
        // 빛이 벽과 바닥에 닿는 자리
        let tHit = 1e9;
        if (x > 0.001) tHit = Math.min(tHit, 13.9 / x); if (x < -0.001) tHit = Math.min(tHit, -13.9 / x);
        if (z > 0.001) tHit = Math.min(tHit, 15.2 / z); if (z < -0.001) tHit = Math.min(tHit, -6.9 / z);
        if (dy < -0.001) tHit = Math.min(tHit, -6.05 / dy); if (dy > 0.001) tHit = Math.min(tHit, 1.9 / dy);
        dotPos[i * 3] = x * tHit; dotPos[i * 3 + 1] = 6.1 + dy * tHit; dotPos[i * 3 + 2] = -10.5 + z * tHit;
      }
      dotG.attributes.position.needsUpdate = true;
    });
    }
  }
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
  flare(theme.jazz ? 0x3b6cff : theme.band ? 0xff7a2e : 0x8b5cf6, 26, 0, 4.8, -23, inside, theme.band ? 0.1 : 0.2);

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
    // 테이블 번호: 탁자 위 번호판 (어느 쪽에서 봐도 읽힌다)
    const nc = document.createElement('canvas'); nc.width = nc.height = 128;
    const ng = nc.getContext('2d');
    ng.fillStyle = theme.band ? '#3a2212' : '#0f0f1a'; ng.beginPath(); ng.arc(64, 64, 58, 0, 7); ng.fill();
    ng.lineWidth = 7; ng.strokeStyle = theme.band ? '#ffc77a' : '#22d3ee'; ng.stroke();
    ng.fillStyle = '#ffffff'; ng.font = '800 70px Outfit, Pretendard, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle'; ng.fillText(String(T.i + 1), 64, 68);
    const nt = new THREE.CanvasTexture(nc); nt.colorSpace = THREE.SRGBColorSpace;
    const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: nt, transparent: true, toneMapped: false }));
    num.scale.set(0.24, 0.24, 1); num.position.set(T.x, 1.3, T.z); inside.add(num);
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), legM, T.x, 1.15, T.z, inside);
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
  let tick = 0, lastBar = -1, flash = 0, hueBase = 0, hueAll = 0;
  const palette = theme.palette;
  const c1 = new THREE.Color(), c2 = new THREE.Color();
  const scratch = new THREE.Color();

  /* 7080 무대 뒤: 붉은 막과 전구 간판 */
  function drawMarquee(clock) {
    const W2 = ledC.width, H = ledC.height;
    for (let x = 0; x < W2; x += 16) { led.fillStyle = (x / 16) % 2 ? '#4d0d12' : '#6b1218'; led.fillRect(x, 0, 16, H); }
    const shade = led.createLinearGradient(0, 0, 0, H); shade.addColorStop(0, 'rgba(10,3,3,.55)'); shade.addColorStop(0.55, 'rgba(10,3,3,0)'); shade.addColorStop(1, 'rgba(10,3,3,.65)');
    led.fillStyle = shade; led.fillRect(0, 0, W2, H);
    led.fillStyle = '#1a0d08'; led.fillRect(150, 44, 340, 152);
    const rate = clock.section.name === 'drop' ? 2 : 1, chase = Math.floor(clock.beat * 2 * rate);
    const bulb = (x, y, i) => { const on = (i + chase) % 3 === 0; led.fillStyle = on ? '#ffe9a8' : '#6e4a20'; led.beginPath(); led.arc(x, y, on ? 5.5 : 4, 0, 7); led.fill(); };
    let n = 0;
    for (let x = 158; x <= 482; x += 18) { bulb(x, 52, n++); }
    for (let y = 70; y <= 170; y += 18) { bulb(482, y, n++); }
    for (let x = 482; x >= 158; x -= 18) { bulb(x, 188, n++); }
    for (let y = 170; y >= 70; y -= 18) { bulb(158, y, n++); }
    led.textAlign = 'center'; led.textBaseline = 'middle';
    led.shadowColor = '#ff9d2e'; led.shadowBlur = 18; led.fillStyle = '#ffe9b8';
    led.font = '900 76px Pretendard, "Malgun Gothic", sans-serif'; led.fillText('현수의 7080', W2 / 2, 110);
    led.font = '700 22px Pretendard, "Malgun Gothic", sans-serif'; led.fillText('그때 그 노래', W2 / 2, 164);
    led.shadowBlur = 0;
    ledT.needsUpdate = true;
  }

  /* 재즈 바 무대 뒤: 남색 벨벳 막과 금빛 간판, 작은 전구가 천천히 반짝인다 */
  function drawJazz(clock) {
    const W2 = ledC.width, H = ledC.height;
    for (let x = 0; x < W2; x += 20) { const k = 0.5 + 0.5 * Math.sin(x * 0.31); led.fillStyle = `rgb(${12 + k * 10 | 0},${18 + k * 14 | 0},${48 + k * 30 | 0})`; led.fillRect(x, 0, 20, H); }
    const shade = led.createLinearGradient(0, 0, 0, H); shade.addColorStop(0, 'rgba(2,2,8,.6)'); shade.addColorStop(0.5, 'rgba(2,2,8,0)'); shade.addColorStop(1, 'rgba(2,2,8,.7)');
    led.fillStyle = shade; led.fillRect(0, 0, W2, H);
    for (let i = 0; i < 46; i++) {
      const x = (i * 97) % W2, y = 10 + ((i * 53) % 40), tw = 0.5 + 0.5 * Math.sin(clock.beat * 0.8 + i * 1.7);
      led.fillStyle = `rgba(255,214,150,${0.25 + tw * 0.6})`; led.beginPath(); led.arc(x, y, 1.6 + tw * 1.4, 0, 7); led.fill();
    }
    led.fillStyle = 'rgba(8,8,16,.82)'; led.fillRect(140, 58, 360, 132);
    led.strokeStyle = '#c9a227'; led.lineWidth = 3; led.strokeRect(148, 66, 344, 116); led.strokeRect(154, 72, 332, 104);
    led.textAlign = 'center'; led.textBaseline = 'middle';
    led.shadowColor = '#4f8cff'; led.shadowBlur = 20; led.fillStyle = '#e8eeff';
    led.font = '900 50px Pretendard, "Malgun Gothic", sans-serif'; led.fillText('현수의 JAZZ BAR', W2 / 2, 112);
    led.shadowColor = '#c9a227'; led.shadowBlur = 10; led.fillStyle = '#f5d58a';
    led.font = 'italic 600 21px Outfit, Pretendard, sans-serif'; led.fillText('Live Jazz · Whisky · Cocktails', W2 / 2, 152);
    led.shadowBlur = 0;
    ledT.needsUpdate = true;
  }

  function drawLed(clock, freq) {
    if (theme.jazz) { drawJazz(clock); return; }
    if (theme.band) { drawMarquee(clock); return; }
    const W2 = ledC.width, H = ledC.height, name = clock.section.name, e = clock.energy, pal = palette[name] || palette.groove;
    const h1 = (pal[0] + hueAll) % 1, h2 = (pal[1] + hueAll) % 1, css = (h, l) => `hsl(${h * 360} 90% ${l}%)`;
    led.fillStyle = '#04030a'; led.fillRect(0, 0, W2, H);
    const ledMode = clock.track?.led;
    if (name === 'drop' && ledMode === 'rays') {
      led.save(); led.translate(W2 / 2, H / 2); led.rotate(clock.beat * 0.2);
      for (let i = 0; i < 12; i++) { led.rotate(Math.PI / 6); led.fillStyle = css(i % 2 ? h1 : h2, i % 2 ? 44 : 26); led.beginPath(); led.moveTo(0, 0); led.lineTo(460, -62); led.lineTo(460, 62); led.fill(); }
      led.restore();
    } else if (name === 'drop' && ledMode === 'grid') {
      const seed = Math.floor(clock.beat * 2);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
        if (((x * 7 + y * 13 + seed * 5) % 4) === 0) { led.fillStyle = css((x + y) % 2 ? h1 : h2, 50); led.fillRect(x * 40 + 2, y * 40 + 2, 36, 36); }
      }
    } else if (name === 'drop' && ledMode === 'wave') {
      for (let k = 0; k < 5; k++) {
        led.strokeStyle = css(k % 2 ? h1 : h2, 58); led.lineWidth = 12; led.beginPath();
        for (let x = 0; x <= W2; x += 16) { const y = H / 2 + (k - 2) * 38 + Math.sin(x * 0.018 + clock.beat * 1.6 + k) * 26; if (x) led.lineTo(x, y); else led.moveTo(x, y); }
        led.stroke();
      }
    } else if (name === 'drop' && ledMode === 'scan') {
      const pos = ((clock.beat % 2) / 2) * W2;
      for (let i = 0; i < 6; i++) { led.fillStyle = css(i % 2 ? h1 : h2, 54 - i * 6); led.fillRect((pos + i * 110) % W2, 0, 56, H); }
    } else if (name === 'drop') {
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
    led.font = '900 112px Pretendard, "Malgun Gothic", sans-serif'; led.textAlign = 'center'; led.textBaseline = 'middle';
    led.shadowColor = css(h2, 60); led.shadowBlur = 30; led.fillStyle = '#ffffff'; led.fillText('DJ. 현수', 0, 10);
    led.font = '800 24px Outfit, sans-serif'; led.shadowBlur = 12; led.fillText('CLUB PULSE', 0, -82);
    led.restore(); led.shadowBlur = 0;
    ledT.needsUpdate = true;
  }

  function update(dt, t, clock, edm, playerZ) {
    tick++;
    hueAll = (hueBase + (clock.track?.hue || 0)) % 1;
    const outdoors = playerZ > 10.2, fx = fxState.full, name = clock.section.name, e = Math.min(1.1, clock.energy), pal = palette[name] || palette.groove;
    if (clock.bar !== lastBar) { lastBar = clock.bar; if (clock.bar % 4 === 0 && !theme.band) hueBase = (hueBase + 0.11) % 1; if (name === 'drop' && clock.section.barIn === 0 && !outdoors && !theme.band) fireDrop(); }
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
    stripA.forEach((m) => m.material.color.setHSL((pal[0] + hueAll) % 1, 0.9, 0.55));
    if (outdoors && doorOpen < 0.02) { inside.visible = false; for (const p of washes) p.intensity = 0; kickLight.intensity = 0; stageLight.intensity = 0; barLight.intensity = 0; return; }
    barLight.intensity = 22;
    inside.visible = true;

    const h1 = (pal[0] + hueAll) % 1, h2 = (pal[1] + hueAll) % 1, h3 = (pal[2] + hueAll) % 1;
    c1.setHSL(h1, 0.95, 0.56); c2.setHSL(h2, 0.95, 0.56);
    if (tick % 3 === 0) neonList.forEach((m, i) => m.material.color.copy(i % 2 ? c2 : c1).multiplyScalar(0.72 + clock.kick * 0.5));

    if (tick % 3 === 0) { edm.analyser?.getByteFrequencyData(edm.freq); drawLed(clock, edm.freq); }

    // 바닥 타일
    if (tick % 2 === 0) {
      const dim = fx ? 1 : 0.42, step = Math.floor(clock.beat);
      for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
        const cx = ix - NX / 2 + 0.5, cz = iz - NZ / 2 + 0.5, dist = Math.hypot(cx, cz * 1.2);
        let v;
        if (theme.jazz) {   // 재즈 바: 무대 앞만 은은하게, 천천히 숨 쉬듯
          v = 0.03 + Math.max(0, 1 - Math.hypot(cx, iz + 1) / 7) * (0.1 + 0.03 * Math.sin(t * 0.6));
        } else if (theme.band) {   // 체크 무늬 디스코 플로어: 박자마다 칸이 번갈아 켜진다
          const on = (ix + iz + step) % 2 === 0;
          v = name === 'drop' ? (on ? 0.62 : 0.07) : name === 'break' ? 0.05 + (0.5 + 0.5 * Math.sin(ix * 0.7 + t)) * 0.16 : on ? 0.3 * (0.45 + clock.kick * 0.55) : 0.05;
        } else if (name === 'drop' && clock.track?.led === 'wave') {
          v = 0.1 + (0.5 + 0.5 * Math.sin(ix * 0.6 + iz * 0.3 - clock.beat * Math.PI)) * 0.62;
        } else if (name === 'drop' && clock.track?.led === 'scan') {
          v = 0.05 + Math.max(0, 1 - Math.abs(((iz + clock.beat * 3) % NZ) - 2) * 0.5) * 0.9;
        } else if (name === 'drop' && clock.track?.led === 'grid') {
          v = (ix * 7 + iz * 13 + Math.floor(clock.beat * 2) * 5) % 4 === 0 ? 0.85 : 0.06;
        } else if (name === 'drop') { v = 0.18 + Math.max(0, Math.sin(dist * 0.9 - clock.beat * Math.PI * 2)) ** 3 * 0.86; }
        else if (name === 'build') { v = (ix + iz + step) % 2 === 0 ? 0.08 + clock.build * 0.75 : 0.03; }
        else if (name === 'break') { v = 0.05 + (0.5 + 0.5 * Math.sin(ix * 0.7 + iz * 0.5 + t * 0.7)) * 0.17; }
        else { v = ((ix + iz * 3 + step) % 5 === 0 ? 0.32 * (0.35 + clock.kick * 0.65) : 0.035) + 0.022; }
        if (theme.jazz) scratch.setHSL(0.075, 0.7, 0.5).multiplyScalar(v * dim * 0.62);
        else scratch.setHSL((dist * (theme.band ? 0.005 : 0.03) + ((ix + iz) % 2 && theme.band ? h2 : h1)) % 1, 0.95, 0.5).multiplyScalar(v * dim * 0.62);
        tiles.setColorAt(ix * NZ + iz, scratch);
      }
      tiles.instanceColor.needsUpdate = true;
    }

    // 무빙 라이트
    const rate = theme.jazz ? 0.05 : name === 'drop' ? 0.5 : name === 'break' ? 0.12 : 0.25;
    beams.forEach((b, i) => {
      const ph = clock.beat * rate * Math.PI + b.seed;
      b.pivot.rotation.x = Math.sin(ph) * (0.34 + e * 0.24) + 0.05;
      b.pivot.rotation.z = Math.cos(ph * 0.8 + i) * (0.3 + e * 0.32);
      const on = name === 'drop' ? (Math.floor(clock.beat) + i) % 2 === 0 || !fx ? 1 : 0.5 : name === 'break' ? (i % 3 === 0 ? 0.6 : 0.12) : 0.55;
      b.mat.opacity = (fx ? 0.2 : 0.1) * on * (0.45 + e * 0.8) * (theme.jazz ? 0.22 : 1);
      b.mat.color.setHSL(i % 3 === 0 ? h3 : i % 2 ? h2 : h1, 0.95, 0.55);
      b.lens.material.color.copy(b.mat.color); b.lens.material.opacity = 0.35 + 0.65 * on;
    });

    // 레이저: 빌드 끝과 드롭에서만
    const laserOn = fx && !theme.band && (name === 'drop' || (name === 'build' && clock.section.barIn >= clock.section.bars - 2));
    lasers.forEach(({ l, mat, i }) => {
      l.visible = laserOn; if (!laserOn) return;
      const ph = clock.beat * Math.PI * 0.25, spread = (i - 6.5) * 0.11;
      l.rotation.x = 1.14 + Math.sin(ph + i * 0.25) * 0.14;
      l.rotation.z = -(spread + Math.sin(ph * 0.5) * 0.28);
      mat.opacity = 0.34 + flash * 0.42; mat.color.setHSL((0.36 + hueAll) % 1, 1, 0.56);
    });

    // 색 조명
    washes.forEach((p, i) => {
      p.color.setHSL(i % 2 ? h1 : h2, 0.9, 0.58);
      p.intensity = (i < 3 ? 40 + e * 56 : 26) * (i < 3 ? 0.66 + clock.kick * 0.5 : 1) * (theme.jazz ? 0.5 : 1);
      if (i < 3) { p.position.x += Math.sin(t * 0.9 + i * 2) * dt * 1.4; p.position.z += Math.cos(t * 0.7 + i) * dt * 1.2; }
    });
    if (theme.jazz) { stageLight.color.set(0xffc98a); stageLight.intensity = 58 + e * 14; } else if (theme.band) { stageLight.color.set(0xffd7a0); stageLight.intensity = 62 + e * 26; } else { stageLight.color.setHSL(h2, 0.75, 0.7); stageLight.intensity = 32 + e * 44; }
    kickLight.color.setHSL(h3, 0.3, 0.86);
    kickLight.intensity = fx && !theme.band ? (name === 'drop' ? 145 : 26) * flash : 0;

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
