/* 온라인 셔플댄스 교습소: 코치 시범 → 느리게 따라 하기 → 박자 테스트. 기록은 이 브라우저(localStorage)에만 저장한다 */
import * as THREE from './vendor/three.min.js';
import { makePerson, updatePerson } from './people.js?v=10';
import { Edm, TRACKS } from './edm.js?v=8';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let toastT;
const toast = (msg, sec = 2.2) => { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), sec * 1000); };

/* ───────── 수업 ─────────
   style: people.js 춤 번호 (1 바운스, 6 러닝맨, 7 찰스턴, 8 T스텝, 9 크리스크로스, 10 사이드 킥)
   cues: 8카운트 각 박에 할 동작 (코치 기준. 거울 모드에서는 화면과 같은 쪽) */
const LESSONS = [
  { id: 'bounce', name: '기본 바운스', level: '입문', style: 1, speed: 0.8,
    desc: '모든 셔플의 바탕. 박마다 무릎을 살짝 굽혔다 펴며 리듬을 몸에 넣습니다.',
    cues: ['무릎 굽혀 다운', '펴며 업', '다운', '업', '다운 · 어깨도 함께', '업', '다운', '업 · 상체는 편하게'],
    tips: ['발바닥 전체가 아니라 앞꿈치에 무게를 두세요.', '쿵쿵 찍지 말고 통통 튀듯이.', '팔은 힘 빼고 가슴 앞에서 가볍게.'] },
  { id: 'runningman', name: '러닝맨', level: '기초', style: 6, speed: 0.6,
    desc: '셔플의 대표 동작. 한 무릎을 올리는 동안 디딘 발은 뒤로 미끄러집니다.',
    cues: ['왼 무릎 올리며 오른발 뒤로 쓸기', '왼발 디디고 오른 무릎 올리기', '오른 무릎 올리며 왼발 뒤로 쓸기', '오른발 디디고 왼 무릎 올리기', '왼 무릎 업 · 오른발 뒤로', '왼발 다운 · 오른 무릎 업', '오른 무릎 업 · 왼발 뒤로', '오른발 다운 · 다시 처음'],
    tips: ['디딘 발은 들지 말고 바닥을 쓸듯 뒤로.', '올린 무릎은 허리 높이까지.', '상체를 살짝 앞으로 기울이면 균형 잡기 쉬워요.'] },
  { id: 'tstep', name: 'T스텝', level: '기초', style: 8, speed: 0.6,
    desc: '디딘 발끝을 안·밖으로 틀며 옆으로 미끄러집니다. 들린 발은 옆으로 살짝 찹니다.',
    cues: ['왼쪽으로 · 발끝 밖으로', '발끝 안으로', '발끝 밖으로', '발끝 안으로 · 끝까지', '오른쪽으로 · 발끝 밖으로', '발끝 안으로', '발끝 밖으로', '발끝 안으로 · 제자리'],
    tips: ['디딘 발 뒤꿈치를 축으로 발끝만 틉니다.', '들린 발은 무릎 높이에서 옆으로 툭툭.', '머리 높이는 그대로, 무릎으로 흡수하세요.'] },
  { id: 'charleston', name: '찰스턴', level: '중급', style: 7, speed: 0.6,
    desc: '한 발로 앞으로 차고, 디디고, 뒤로 차고, 디디기. 허리를 반대로 비틀어 줍니다.',
    cues: ['왼발 앞으로 차기', '제자리로 디디기', '왼발 뒤로 차기', '제자리로 디디기', '오른발 앞으로 차기', '제자리로', '오른발 뒤로 차기', '제자리로'],
    tips: ['차는 발과 반대 팔이 앞으로 나와요.', '디딘 발은 발끝을 안팎으로 틀면 더 셔플답습니다.', '뒤로 찰 때 무릎을 접어 발바닥이 위를 보게.'] },
  { id: 'crisscross', name: '크리스크로스', level: '중급', style: 9, speed: 0.6,
    desc: '박마다 다리를 벌렸다 엇갈립니다. 팔도 함께 교차해요.',
    cues: ['벌리기', '엇갈려 교차', '벌리기', '교차 · 반대 발이 앞', '벌리기', '교차', '벌리기', '교차 · 다시 처음'],
    tips: ['점프하지 말고 앞꿈치로 미끄러지듯.', '교차할 때마다 앞에 오는 발을 바꿔요.', '팔은 다리와 같은 박에 엇갈립니다.'] },
  { id: 'sidekick', name: '사이드 킥', level: '중급', style: 10, speed: 0.6,
    desc: '박마다 한 발씩 옆으로 차올립니다. 디딘 발로 가볍게 튀어요.',
    cues: ['왼발 옆으로 차기', '오른발 옆으로 차기', '왼발', '오른발', '왼발 · 팔 높이 유지', '오른발', '왼발', '오른발'],
    tips: ['차는 발은 무릎을 먼저 들고 바깥으로 펴요.', '상체가 반대로 기울면 균형이 맞습니다.', '팔은 가슴 높이에서 접어 두세요.'] },
  { id: 'combo', name: '콤보 32카운트', level: '수료 과제', style: 6, combo: [6, 8, 7, 9], speed: 0.8,
    desc: '러닝맨 8 → T스텝 8 → 찰스턴 8 → 크리스크로스 8. 동작 사이를 끊기지 않게 이어 붙입니다.',
    cues: null,
    tips: ['바꾸기 한 박 전에 다음 동작을 머릿속으로 미리.', '처음엔 60%로 연결만 연습하세요.', '숨은 계속 쉬고, 웃으면서!'] },
];
const LI = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
const STYLE_LESSON = { 6: 'runningman', 8: 'tstep', 7: 'charleston', 9: 'crisscross' };
const cueAt = (L, beat) => {
  const n = Math.floor(beat), c = ((n % 8) + 8) % 8;
  if (L.combo) { const sub = LI[STYLE_LESSON[L.combo[Math.floor(n / 8) % 4]]]; return `${sub.name} · ${sub.cues[c]}`; }
  return L.cues[c];
};
const styleAt = (L, beat) => (L.combo ? L.combo[Math.floor(Math.max(0, beat) / 8) % 4] : L.style);

const MUSIC = [
  { id: 'neon', name: '하우스', bpm: 124 },
  { id: 'deep', name: '테크 하우스', bpm: 124 },
  { id: 'tropical', name: '트로피컬', bpm: 118 },
];
const SPEEDS = [0.6, 0.8, 1, 1.1];

/* ───────── 저장 ───────── */
const KEY = 'shuffle-v1';
const db = Object.assign({ best: {}, music: 'neon', speed: 0.6, mirror: true, metro: true, vol: 80 }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 저장 불가 */ } };

/* ───────── 3D 연습실 ───────── */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: /[?&]test\b/.test(location.search) });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e4f5); scene.fog = new THREE.Fog(0xe9e4f5, 18, 36);
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 64 : 44; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x9b8fb5, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 8, 7); scene.add(key);
const rim = new THREE.DirectionalLight(0xc4b5fd, 0.8); rim.position.set(-5, 4, -6); scene.add(rim);

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, ...o });
const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, seg = 18, parent = scene) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const RW = 16, RD = 14, WZ = -6;

// 바닥: 밝은 원목 + 연습용 위치 표시
const floorTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d9b98f'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -64 : 0; x < w; x += 128) {
    g.fillStyle = `hsl(32, ${38 + Math.random() * 10}%, ${66 + Math.random() * 8}%)`; g.fillRect(x + 1, y + 1, 126, 30);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 4);
box(RW, 0.1, RD, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42 }), 0, -0.05, 0);
// 발 위치 표시 (코치 자리)
const markM = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.35 });
const mark = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), markM); mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.012, -1.6); scene.add(mark);

// 벽
const wallM = std(0xf5f3ff, { roughness: 0.9 });
box(RW, 5, 0.2, wallM, 0, 2.5, WZ); box(0.2, 5, RD, wallM, -RW / 2, 2.5, 0); box(0.2, 5, RD, wallM, RW / 2, 2.5, 0); box(RW, 5, 0.2, wallM, 0, 2.5, RD / 2);
box(RW, 0.3, 0.24, std(0x8b5cf6), 0, 0.15, WZ + 0.02); box(0.24, 0.3, RD, std(0x8b5cf6), -RW / 2 + 0.02, 0.15, 0); box(0.24, 0.3, RD, std(0x8b5cf6), RW / 2 - 0.02, 0.15, 0);
// 거울 벽 + 발레 바
box(10, 2.6, 0.05, std(0xdfe5ee, { roughness: 0.05, metalness: 0.9 }), 0, 1.65, WZ + 0.14);
box(10.1, 0.07, 0.08, std(0x334155), 0, 2.97, WZ + 0.16); box(10.1, 0.07, 0.08, std(0x334155), 0, 0.33, WZ + 0.16);
const bar = cyl(0.03, 0.03, 9.6, std(0xc08457, { roughness: 0.4 }), 0, 1.05, WZ + 0.45); bar.rotation.z = Math.PI / 2;
[-4.5, 0, 4.5].forEach((x) => box(0.04, 0.05, 0.3, std(0x94a3b8, { metalness: 0.7, roughness: 0.3 }), x, 1.05, WZ + 0.3));
// 네온 간판
const signTex = canvasTex(1024, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 132px Outfit, sans-serif'; g.shadowColor = '#c026d3'; g.shadowBlur = 34; g.fillStyle = '#f5d0fe'; g.fillText('SHUFFLE', w / 2, 112);
  g.font = '700 46px Pretendard, sans-serif'; g.shadowColor = '#06b6d4'; g.shadowBlur = 20; g.fillStyle = '#cffafe'; g.fillText('ONLINE DANCE ACADEMY', w / 2, 206);
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }));
sign.position.set(0, 3.95, WZ + 0.13); scene.add(sign);
// 링 라이트 + 촬영 카메라 (온라인 수업)
const ringM = new THREE.MeshBasicMaterial({ color: 0xfff7ed, toneMapped: false });
[-3.6, 3.6].forEach((x) => {
  cyl(0.02, 0.02, 1.9, std(0x1f2937), x, 0.95, 2.2);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 10, 40), ringM); r.position.set(x, 2.0, 2.2); r.rotation.y = x < 0 ? 0.5 : -0.5; scene.add(r);
  const pl = new THREE.PointLight(0xfff1e0, 6, 7); pl.position.set(x, 2.0, 2.0); scene.add(pl);
});
{
  const CX = 4.6, CZ = 2.6;
  cyl(0.02, 0.02, 1.4, std(0x1f2937), CX, 0.7, CZ);
  box(0.36, 0.24, 0.3, std(0x111827, { roughness: 0.3 }), CX, 1.5, CZ);
  const lens = cyl(0.08, 0.09, 0.16, std(0x0f172a, { roughness: 0.1, metalness: 0.6 }), CX, 1.5, CZ - 0.2); lens.rotation.x = Math.PI / 2;
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: 0xef4444, toneMapped: false })); rec.position.set(CX + 0.12, 1.6, CZ - 0.16); scene.add(rec); rec.userData.blink = true; scene.userData.rec = rec;
}
// 스피커와 화분
[-6.6, 6.6].forEach((x) => { box(0.7, 1.3, 0.6, std(0x1e1b2e, { roughness: 0.5 }), x, 0.65, WZ + 0.8); cyl(0.2, 0.2, 0.03, std(0x4c1d95), x, 0.85, WZ + 1.11, 24).rotation.x = Math.PI / 2; cyl(0.12, 0.12, 0.03, std(0x4c1d95), x, 0.35, WZ + 1.11, 24).rotation.x = Math.PI / 2; });
[[-7.2, 3], [7.2, 3]].forEach(([x, z]) => { cyl(0.28, 0.22, 0.5, std(0xf1f5f9), x, 0.25, z); const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), std(0x4d7c0f, { roughness: 0.8, flatShading: true })); leaf.position.set(x, 1.0, z); leaf.scale.y = 1.4; scene.add(leaf); });
// 뒤쪽 벽: 온라인 수강생 화면
const tiles = ['지민', '하준', '서연', '민호', '수아', '도윤', '예린', '태오'];
const screenTex = canvasTex(1280, 640, (g, w, h) => {
  g.fillStyle = '#111827'; g.fillRect(0, 0, w, h);
  const cols = 4, rows = 2, tw = w / cols, th = h / rows, bgs = ['#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca'];
  tiles.forEach((n, i) => {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    g.fillStyle = bgs[i]; g.fillRect(x + 6, y + 6, tw - 12, th - 12);
    g.fillStyle = '#f4cdb0'; g.beginPath(); g.arc(x + tw / 2, y + th / 2 - 10, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = ['#1f2937', '#4a2f22', '#111827', '#7c4a2a'][i % 4]; g.beginPath(); g.arc(x + tw / 2, y + th / 2 - 30, 64, Math.PI, 0); g.fill();
    g.fillStyle = '#1f2937'; g.fillRect(x + tw / 2 - 24, y + th / 2 - 8, 10, 10); g.fillRect(x + tw / 2 + 14, y + th / 2 - 8, 10, 10);
    g.fillStyle = 'rgba(15,23,42,.72)'; g.fillRect(x + 14, y + th - 58, 128, 40);
    g.fillStyle = '#fff'; g.font = '700 26px Pretendard, sans-serif'; g.textBaseline = 'middle'; g.fillText(n, x + 26, y + th - 38);
  });
});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
screen.position.set(0, 2.5, RD / 2 - 0.12); screen.rotation.y = Math.PI; scene.add(screen);

/* ───────── 사람 ───────── */
const coach = makePerson(scene, { style: 3, skirt: false, height: 1.02, top: std(0x7c3aed), bottom: std(0x111827, { roughness: 0.75 }), shoe: std(0xf8fafc, { roughness: 0.4 }) });
const backL = makePerson(scene, { brick: true });
const backR = makePerson(scene, { pixel: true });
const me = makePerson(scene, { pixel: true, height: 1 });
const dancers = [coach, backL, backR, me];
const place = (p, x, z, yaw) => { p.x = x; p.z = z; p.yaw = p.yawTo = yaw; p.root.position.set(x, 0, z); };
place(coach, 0, -1.6, 0); place(backL, -1.9, -2.5, 0); place(backR, 1.9, -2.5, 0); place(me, -1.5, 0.9, Math.PI);
dancers.forEach((p) => { p.groove = 1; p.danceStyle = 1; p.beatOff = 0; });
const meRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 36), new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 }));
meRing.rotation.x = -Math.PI / 2; meRing.position.set(-1.5, 0.013, 0.9); scene.add(meRing);

function applyMirror() {
  // 거울 모드: 코치와 앞줄을 좌우로 뒤집어, 화면을 보고 그대로 따라 하면 되게 한다
  [coach, backL, backR].forEach((p) => { const s = Math.abs(p.root.scale.y); p.root.scale.set(db.mirror ? -s : s, s, s); });
  $('btnMirror').textContent = db.mirror ? '거울 모드 켬' : '거울 모드 끔';
  $('btnMirror').setAttribute('aria-pressed', String(db.mirror));
}

/* ───────── 카메라: 끌어서 돌리기 + 프리셋 ───────── */
const VIEWS = [
  { name: '정면', az: 0, el: 0.16, dist: 6.4, ty: 1.05 },
  { name: '뒤에서', az: Math.PI, el: 0.3, dist: 3.8, ty: 1.0 },
  { name: '옆', az: Math.PI / 2, el: 0.12, dist: 5.6, ty: 1.0 },
  { name: '발 보기', az: 0.35, el: 0.08, dist: 3.4, ty: 0.45 },
];
let viewI = 0;
/* 분해 모드 전용 시점: 코치에게 가까이 붙고, 시선을 무릎 높이로 내려
   화면 위쪽에 몸 전체가 오게 한다 (아래쪽은 조작부가 덮기 때문) */
const STEP_VIEW = { name: '분해', az: 0.26, el: 0.07, dist: 4.3, ty: 0.92 };
let lookOff = 0, lookOffTo = 0;
const cam = { ...VIEWS[0] }, camTo = { ...VIEWS[0] };
const CENTER = new THREE.Vector3(0, 0, -1.6);
function setView(i) {
  viewI = i; Object.assign(camTo, VIEWS[i]);
  if (stepMode) lookOffTo = -camTo.ty * 0.5;   // 분해 중에는 어느 시점이든 몸을 화면 위쪽에 둔다
  $('btnView').textContent = `시점: ${VIEWS[i].name}`;
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: camTo.az, el: camTo.el }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  camTo.az = drag.az - (e.clientX - drag.x) * 0.008;
  camTo.el = Math.min(1.1, Math.max(0.02, drag.el + (e.clientY - drag.y) * 0.005));
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { camTo.dist = Math.min(11, Math.max(2.6, camTo.dist + e.deltaY * 0.004)); }, { passive: true });

/* ───────── 소리 ───────── */
const edm = new Edm();
const LESSON_FORM = [{ name: 'groove', bars: 2, energy: 0.6 }, { name: 'drop', bars: 30, energy: 1 }];
let lesson = LI.runningman, playing = false, tickN = -1;
/* 동작 분해: 코치를 한 박에 세워 두고 자세를 하나씩 본다 */
/* 정수 박은 동작이 스쳐 지나가는 지점이라 자세가 밋밋하다.
   그래서 기본은 박의 한가운데(+0.5)를 보여 주고, 슬라이더로 박 처음~끝을 훑는다 */
let stepMode = false, stepBase = 0, stepFine = 0.5, stepBeat = 0.5, stepAuto = false, stepAutoT = 0;
const STEP_HOLD = 1.0, STEP_GLIDE = 0.7;  // 자동 재생: 한 박 멈춤(초) → 다음 박으로 이동(초)
function restartMusic() {
  if (!edm.started) return;
  const base = TRACKS.find((t) => t.id === db.music) || TRACKS[0], m = MUSIC.find((x) => x.id === db.music) || MUSIC[0];
  edm.track = { ...base, bpm: Math.round(m.bpm * db.speed) };
  edm.applyTrack(); edm.form = LESSON_FORM;
  edm.t0 = edm.ctx.currentTime + 0.15; edm.nextStep = 0; tickN = -1;
  edm.setRoom(3);
}
function startAudio() {
  if (!edm.started) { edm.vol = db.vol / 100; edm.start(); edm.setVolume(db.vol / 100); }
  else edm.ctx.resume();
}
function setPlaying(on) {
  playing = on;
  if (on) { startAudio(); restartMusic(); edm.setVolume(db.vol / 100); }
  else if (edm.started) { edm.setVolume(0); }
  $('btnPlay').textContent = on ? '■ 멈춤' : '▶ 시범 시작';
  $('btnPlay').classList.toggle('on', on);
}
// 메트로놈: 박에 맞춰 짧은 소리 (1박은 높게)
function tick(t, accent) {
  const { ctx } = edm, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.09, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g); g.connect(edm.sfx); o.start(t); o.stop(t + 0.08);
}
const beatNow = () => (edm.started ? (edm.ctx.currentTime - (edm.ctx.outputLatency || 0) - edm.t0) / edm.spb : 0);

/* ───────── 박자 테스트 ─────────
   준비 8박 뒤 16박. 박마다 스페이스(또는 STEP 버튼)를 누른다. 어긋남 0.12박 이내 PERFECT, 0.25박 이내 GOOD */
const TEST_FROM = 8, TEST_LEN = 16;
let test = null;
function startTest() {
  closeResult();
  test = { hits: new Map(), done: false };
  setPlaying(true);
  $('pad').hidden = false; $('testBar').hidden = false; $('btnTest').disabled = true;
  coachSay('준비하세요! 8박 세고 시작합니다. 박마다 STEP을 누르면서 따라 추세요.');
  renderTestBar();
}
function judge(off) { const a = Math.abs(off); return a <= 0.12 ? 'perfect' : a <= 0.25 ? 'good' : null; }
function tap() {
  me.tapUntil = performance.now() / 1000 + edm.spb * 1.3;
  const pad = $('pad'); pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit');
  if (!test || test.done || !edm.started) return;
  const b = beatNow(), n = Math.round(b);
  if (n < TEST_FROM || n >= TEST_FROM + TEST_LEN) return;
  if (test.hits.has(n)) return;
  const j = judge(b - n);
  if (!j) { flash('MISS', 'miss'); return; }
  test.hits.set(n, j); flash(j === 'perfect' ? 'PERFECT' : 'GOOD', j);
  renderTestBar();
}
function flash(text, cls) { const el = $('judge'); el.textContent = text; el.className = `judge ${cls}`; void el.offsetWidth; el.classList.add('show'); }
function renderTestBar() {
  if (!test) return;
  const box = $('testBar'); box.textContent = '';
  for (let i = 0; i < TEST_LEN; i++) { const s = document.createElement('i'); const h = test.hits.get(TEST_FROM + i); if (h) s.className = h; else if (beatNow() > TEST_FROM + i + 0.3) s.className = 'miss'; box.append(s); }
}
function finishTest() {
  test.done = true;
  let per = 0, good = 0;
  test.hits.forEach((j) => (j === 'perfect' ? per++ : good++));
  const miss = TEST_LEN - per - good, score = Math.round(((per * 100 + good * 60) / TEST_LEN));
  const pass = score >= 70, prev = db.best[lesson.id] || 0;
  if (score > prev) { db.best[lesson.id] = score; save(); }
  $('pad').hidden = true; $('btnTest').disabled = false;
  $('rTitle').textContent = `${lesson.name} · ${Math.round(db.speed * 100)}% 박자 테스트`;
  $('rScore').textContent = score;
  $('rGrade').textContent = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  $('rGrade').className = `grade ${pass ? 'pass' : 'fail'}`;
  $('rCounts').innerHTML = `<span class="perfect">PERFECT ${per}</span><span class="good">GOOD ${good}</span><span class="miss">MISS ${miss}</span>`;
  $('rMsg').textContent = pass
    ? (score > prev ? `수료! 최고 기록 갱신 (${prev} → ${score}). ${db.speed < 1 ? '다음엔 속도를 올려 보세요.' : '이제 콤보에 도전!'}` : `수료! (최고 기록 ${prev}점)`)
    : `70점부터 수료입니다. ${miss > 6 ? '속도를 낮추고 카운트를 소리 내어 세 보세요.' : '조금만 더! 박이 들어오는 순간에 누르세요.'}`;
  $('resultModal').hidden = false; $('rAgain').focus();
  coachSay(pass ? pick(['좋아요! 리듬이 몸에 붙었어요.', '멋져요! 이대로 쭉 갑니다.', '수료 축하해요!']) : pick(['괜찮아요, 처음엔 다 그래요.', '박을 먼저 듣고, 발은 그다음이에요.', '속도를 낮춰서 한 번 더!']));
  renderLessons();
}
function closeResult() { $('resultModal').hidden = true; }

/* ───────── 화면 ───────── */
function coachSay(text) { const el = $('coachText'); el.textContent = text; el.parentElement.classList.remove('pop'); void el.offsetWidth; el.parentElement.classList.add('pop'); }
function renderLessons() {
  const box = $('lessonList'); box.textContent = '';
  LESSONS.forEach((L, i) => {
    const b = document.createElement('button'); b.className = `lesson${L === lesson ? ' on' : ''}`; b.style.animationDelay = `${i * 40}ms`;
    const best = db.best[L.id];
    b.innerHTML = `<span class="lNo">${i + 1}</span><span class="lTxt"><strong></strong><small></small></span>${best != null ? `<span class="lBest ${best >= 70 ? 'pass' : ''}">${best >= 70 ? '수료 ' : ''}${best}점</span>` : ''}`;
    b.querySelector('strong').textContent = L.name; b.querySelector('small').textContent = `${L.level} · ${L.desc}`;
    b.onclick = () => selectLesson(L);
    box.append(b);
  });
  const done = LESSONS.filter((L) => (db.best[L.id] || 0) >= 70).length;
  $('progress').textContent = `${done} / ${LESSONS.length} 수료`;
  $('progBar').style.width = `${(done / LESSONS.length) * 100}%`;
}
function selectLesson(L) {
  lesson = L; test = null; $('testBar').hidden = true; $('pad').hidden = true; $('btnTest').disabled = false;
  $('lName').textContent = L.name; $('lLevel').textContent = L.level;
  db.speed = L.speed; save(); renderSpeed();
  renderLessons(); coachSay(`${L.name}! ${L.desc}`);
  if (playing) restartMusic();
  if (stepMode) stepGo(0, false);
  if (innerWidth < 760) $('side').classList.remove('open');
}
function renderSpeed() {
  const box = $('speeds'); box.textContent = '';
  SPEEDS.forEach((s) => { const b = document.createElement('button'); b.textContent = `${Math.round(s * 100)}%`; b.className = s === db.speed ? 'on' : ''; b.setAttribute('aria-pressed', String(s === db.speed)); b.onclick = () => { db.speed = s; save(); renderSpeed(); if (playing) restartMusic(); }; box.append(b); });
  const m = MUSIC.find((x) => x.id === db.music) || MUSIC[0];
  $('bpm').textContent = `${Math.round(m.bpm * db.speed)} BPM`;
}
function renderMusic() {
  const box = $('musics'); box.textContent = '';
  MUSIC.forEach((m) => { const b = document.createElement('button'); b.textContent = m.name; b.className = m.id === db.music ? 'on' : ''; b.onclick = () => { db.music = m.id; save(); renderMusic(); renderSpeed(); if (playing) restartMusic(); }; box.append(b); });
}
const countCells = [];
for (let i = 0; i < 8; i++) {
  const c = document.createElement('span'); c.textContent = i + 1;
  c.onclick = () => { if (stepMode) stepGo(i, false); };   // 분해 모드에서는 눌러서 그 박으로 이동
  $('counts').append(c); countCells.push(c);
}

/* ───────── 동작 분해 ─────────
   음악을 끄고 코치의 자세를 한 박(또는 박 안의 한 지점)에 세워 둔다.
   사람의 자세는 clock.beat 하나로 정해지므로 beat를 고정하면 그 순간의 자세가 그대로 멈춘다 */
function renderStep() {
  countCells.forEach((el, i) => el.classList.toggle('on', stepMode && i === stepBase));
  if (!stepMode) return;
  $('stepCount').textContent = `${stepBase + 1} / 8 박`;
  $('stepPhase').textContent = stepAuto ? (stepFine > 0.52 ? '다음 박으로 이동 중' : '멈춤') : `박 안 ${Math.min(100, Math.round(stepFine * 100))}%`;
  $('cue').textContent = cueAt(lesson, stepBase);
  $('stepAuto').textContent = stepAuto ? '❚❚ 자동 멈춤' : '▶ 한 박씩 자동';
  $('stepAuto').classList.toggle('on', stepAuto);
}
function stepGo(base, keepAuto) {
  stepBase = ((base % 8) + 8) % 8; stepFine = 0.5; stepBeat = stepBase + 0.5;
  if (!keepAuto) { stepAuto = false; stepAutoT = 0; }
  $('stepFine').value = 50;
  stepTick();
  renderStep();
}
function stepTick() {   // 박이 바뀔 때 짧은 박자음 (소리를 켠 상태에서만)
  if (!db.metro || !edm.started) return;
  try { tick(edm.ctx.currentTime + 0.02, stepBase === 0); } catch { /* 소리 없이 진행 */ }
}
function setStep(on) {
  stepMode = on; stepAuto = false; stepAutoT = 0;
  $('btnStep').textContent = on ? '분해 끄기' : '동작 분해';
  $('btnStep').classList.toggle('on', on);
  $('btnStep').setAttribute('aria-pressed', String(on));
  $('stepBar').hidden = !on;
  $('btnPlay').disabled = on; $('btnTest').disabled = on;
  document.body.classList.toggle('stepping', on);
  countCells.forEach((el) => el.classList.toggle('pick', on));
  if (on) { Object.assign(camTo, STEP_VIEW); lookOffTo = -camTo.ty * 0.5; } else { Object.assign(camTo, VIEWS[viewI]); lookOffTo = 0; }
  if (on) {
    if (playing) setPlaying(false);
    test = null; $('testBar').hidden = true; $('pad').hidden = true;
    stepGo(0, false);
    coachSay(`${lesson.name}을 한 박씩 끊어서 볼게요. 자세를 멈춰 둘 테니 발 위치부터 확인해 보세요.`);
    toast('동작 분해: 다음 박을 눌러 자세를 하나씩 확인하세요');
  } else {
    lastCount = -99; countCells.forEach((el) => el.classList.remove('on'));
    $('cue').textContent = '▶ 시범 시작을 누르세요';
    coachSay(`다시 이어서 춰 볼까요? ${lesson.name}, 시범 시작을 눌러 주세요.`);
  }
}

// 온라인 채팅
const CHAT = [['지민', '러닝맨 무릎 너무 힘들어요ㅠ'], ['하준', '60%로 하니까 되네요!'], ['서연', '선생님 T스텝 한 번만 더요🙏'], ['민호', '거울 모드 좋아요'], ['수아', '층간소음 때문에 양말 신고 해요ㅋㅋ'], ['도윤', '콤보 수료했습니다!!'], ['예린', '발 보기 시점 꿀팁'], ['태오', '박자 테스트 82점 나왔어요'], ['지민', '찰스턴 왼발 오른발 헷갈려요'], ['서연', '오늘도 땀 쭉 뺐다']];
let chatI = 0;
function pushChat() {
  const [n, t] = CHAT[chatI++ % CHAT.length], box = $('chat'), row = document.createElement('p');
  row.innerHTML = '<b></b> <span></span>'; row.querySelector('b').textContent = n; row.querySelector('span').textContent = t;
  box.append(row); while (box.children.length > 4) box.firstChild.remove();
}
setInterval(pushChat, 6500); pushChat();
let viewers = 120 + Math.floor(Math.random() * 40);
setInterval(() => { viewers += Math.round((Math.random() - 0.45) * 4); $('viewers').textContent = `${viewers}명 수강 중`; }, 3000);
$('viewers').textContent = `${viewers}명 수강 중`;

/* ───────── 버튼 ───────── */
$('btnPlay').onclick = () => setPlaying(!playing);
$('btnTest').onclick = startTest;
$('btnMirror').onclick = () => { db.mirror = !db.mirror; save(); applyMirror(); toast(db.mirror ? '거울 모드: 화면을 보고 그대로 따라 하세요' : '거울 모드 끔: 코치의 실제 왼발·오른발'); };
$('btnView').onclick = () => setView((viewI + 1) % VIEWS.length);
$('btnStep').onclick = () => setStep(!stepMode);
$('stepPrev').onclick = () => stepGo(stepBase - 1, false);
$('stepNext').onclick = () => stepGo(stepBase + 1, false);
$('stepAuto').onclick = () => { stepAuto = !stepAuto; stepAutoT = 0; if (stepAuto) { stepFine = 0.5; $('stepFine').value = 50; } renderStep(); };
$('stepFine').oninput = (e) => { stepAuto = false; stepFine = +e.target.value / 100; stepBeat = stepBase + stepFine; renderStep(); };
$('btnMetro').onclick = () => { db.metro = !db.metro; save(); $('btnMetro').textContent = db.metro ? '박자음 켬' : '박자음 끔'; $('btnMetro').setAttribute('aria-pressed', String(db.metro)); };
$('btnLessons').onclick = () => $('side').classList.toggle('open');
$('sideX').onclick = () => $('side').classList.remove('open');
$('vol').value = db.vol;
$('vol').oninput = (e) => { db.vol = +e.target.value; save(); if (playing) edm.setVolume(db.vol / 100); };
$('pad').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
$('rAgain').onclick = startTest;
document.querySelectorAll('[data-close-result]').forEach((b) => (b.onclick = closeResult));
$('introGo').onclick = $('introX').onclick = () => { $('intro').hidden = true; setPlaying(true); coachSay(`안녕하세요, 코치 민지예요! 오늘은 ${lesson.name}부터. 거울 모드라 화면 그대로 따라 하면 됩니다.`); };
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'KeyJ') {
    e.preventDefault(); if (e.repeat) return;
    if (!$('intro').hidden) return;
    if (!$('resultModal').hidden) return;
    tap();
  } else if (stepMode && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault(); stepGo(stepBase + (e.key === 'ArrowRight' ? 1 : -1), false);
  } else if (e.key === 'Escape') { if (stepMode) setStep(false); closeResult(); $('side').classList.remove('open'); }
});
$('btnMetro').textContent = db.metro ? '박자음 켬' : '박자음 끔';
applyMirror(); renderLessons(); renderSpeed(); renderMusic(); setView(0); selectLesson(lesson);
$('intro').hidden = false;

/* ───────── 매 프레임 ───────── */
let last = performance.now(), lastCount = -1, lastTip = -1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  // 동작 분해 자동 재생: 한 박 멈췄다가 다음 박으로 천천히 넘어간다
  if (stepMode && stepAuto) {
    stepAutoT += dt;
    const CYC = STEP_HOLD + STEP_GLIDE;
    if (stepAutoT >= CYC) { stepAutoT -= CYC; stepBase = (stepBase + 1) % 8; stepTick(); }
    const u = stepAutoT <= STEP_HOLD ? 0 : (stepAutoT - STEP_HOLD) / STEP_GLIDE;
    stepFine = 0.5 + (u <= 0 ? 0 : u * u * (3 - 2 * u));
    stepBeat = stepBase + stepFine;
    $('stepFine').value = Math.min(100, Math.round(stepFine * 100));
    renderStep();
  }
  const b = stepMode ? stepBeat : (playing && edm.started ? beatNow() : 0);
  const clock = { beat: b };
  // 춤: 코치와 앞줄은 수업 동작, 나는 STEP을 누를 때만 따라 춘다
  const st = styleAt(lesson, b);
  [coach, backL, backR].forEach((p) => { p.danceStyle = st; p.danceTo = stepMode || (playing && b >= 0) ? 1 : 0; });
  me.danceStyle = st; me.danceTo = playing && (me.tapUntil || 0) > t ? 1 : 0;
  dancers.forEach((p) => updatePerson(p, dt, t, clock, null));
  // 카운트와 동작 안내
  if (stepMode) {
    /* 카운트와 안내는 renderStep()이 맡는다 */
  } else if (playing && edm.started) {
    const n = Math.floor(b);
    if (n !== lastCount) {
      lastCount = n;
      const c = ((n % 8) + 8) % 8;
      countCells.forEach((el, i) => el.classList.toggle('on', i === c && n >= 0));
      const inPrep = test && !test.done && n < TEST_FROM;
      $('cue').textContent = n < 0 ? '곧 시작합니다' : inPrep ? `준비 ${n >= 4 ? n + 1 : ''}` : cueAt(lesson, n);
      if (n >= 0 && n % 16 === 0 && n !== lastTip && !test) { lastTip = n; coachSay(lesson.tips[(n / 16) % lesson.tips.length]); }
    }
    // 박자음은 조금 앞서 예약해 정확히 맞춘다
    const raw = (edm.ctx.currentTime - edm.t0) / edm.spb, next = Math.floor(raw) + 1;
    if (db.metro && next > tickN && (next - raw) * edm.spb < 0.12 && next >= 0) { tickN = next; tick(edm.t0 + next * edm.spb, next % 8 === 0); }
    if (test && !test.done) {
      if (Math.floor(b * 4) !== test.q) { test.q = Math.floor(b * 4); renderTestBar(); }
      if (b > TEST_FROM + TEST_LEN + 0.4) finishTest();
    }
  } else { countCells.forEach((el) => el.classList.remove('on')); if (lastCount !== -99) { lastCount = -99; $('cue').textContent = '▶ 시범 시작을 누르세요'; } }
  // 카메라
  cam.az += (camTo.az - cam.az) * (1 - Math.exp(-6 * dt)); cam.el += (camTo.el - cam.el) * (1 - Math.exp(-6 * dt));
  cam.dist += (camTo.dist - cam.dist) * (1 - Math.exp(-6 * dt)); cam.ty += (camTo.ty - cam.ty) * (1 - Math.exp(-6 * dt));
  // 벽을 뚫고 나가지 않게 거리를 줄인다
  const ce = Math.cos(cam.el), sx = Math.sin(cam.az) * ce, sz = Math.cos(cam.az) * ce;
  let d = cam.dist;
  if (sz < -0.01) d = Math.min(d, (CENTER.z - (WZ + 0.5)) / -sz);
  if (Math.abs(sx) > 0.01) d = Math.min(d, (RW / 2 - 0.5) / Math.abs(sx));
  if (sz > 0.01) d = Math.min(d, (RD / 2 - 0.5 - CENTER.z) / sz);
  camera.position.set(CENTER.x + sx * d, cam.ty + lookOff + Math.sin(cam.el) * d, CENTER.z + sz * d);
  lookOff += (lookOffTo - lookOff) * (1 - Math.exp(-6 * dt));
  camera.lookAt(CENTER.x, cam.ty + lookOff, CENTER.z);
  markM.opacity = 0.25 + (playing || stepMode ? 0.25 * Math.exp(-(((b % 1) + 1) % 1) * 5) : 0);
  scene.userData.rec.visible = Math.floor(t * 1.4) % 2 === 0;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.shuffle = { edm, coach, me, scene, camera, renderer, state: () => ({ playing, lesson: lesson.id, speed: db.speed, beat: beatNow(), step: stepMode && { base: stepBase, fine: +stepFine.toFixed(3), auto: stepAuto }, test: test && { hits: test.hits.size, done: test.done } }), beatNow, tap, setStep, stepGo, LESSONS };
