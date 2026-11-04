/* PT GYM: 트레이너 시범을 보며 따라 하는 3D 헬스장. 목표·기록·통계는 이 브라우저(localStorage)에만 저장한다 */
import * as THREE from './vendor/three.min.js';
import { makePerson, say } from './people.js?v=7';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fast = /[?&]fast\b/.test(location.search) ? 8 : 1;   // 시험용: 시간을 8배로
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const mmss = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let toastT;
const toast = (msg, sec = 2.4) => { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), sec * 1000); };

/* ───────── 운동 도감 ─────────
   met: Compendium of Physical Activities 근사값. tempo: 1회에 걸리는 초. sec가 있으면 시간으로 한다 */
const EX = [
  { id: 'squat', name: '스쿼트', part: '하체', muscles: '대퇴사두근 · 둔근 · 햄스트링', equip: '맨몸', met: 5.0, sets: 3, reps: 12, tempo: 3.2, rest: 60, view: 'diag',
    cues: ['발은 어깨너비, 발끝은 살짝 바깥으로', '엉덩이를 뒤로 빼며 의자에 앉듯 내려가기', '허벅지가 바닥과 평행할 때까지, 가슴은 들고'], mistakes: ['무릎이 안쪽으로 모임', '뒤꿈치가 들림', '허리가 둥글게 말림'] },
  { id: 'lunge', name: '런지', part: '하체', muscles: '대퇴사두근 · 둔근', equip: '맨몸', met: 4.0, sets: 3, reps: 10, tempo: 3.0, rest: 60, view: 'side', alt: true,
    cues: ['한 발을 크게 앞으로 내딛기', '뒷무릎이 바닥에 닿기 직전까지 수직으로 내려가기', '앞발 뒤꿈치로 밀어 일어나기 (양쪽 번갈아)'], mistakes: ['앞무릎이 발끝보다 많이 나감', '상체가 앞으로 쏠림'] },
  { id: 'rdl', name: '덤벨 루마니안 데드리프트', short: '덤벨 RDL', part: '하체', muscles: '햄스트링 · 둔근 · 척추기립근', equip: '덤벨', met: 5.0, sets: 3, reps: 12, tempo: 3.4, rest: 75, view: 'side', dumbbell: true,
    cues: ['무릎은 살짝만 굽히고 고정', '엉덩이를 뒤로 밀며 상체를 숙이기', '덤벨은 허벅지를 스치듯 내리고, 등은 곧게'], mistakes: ['등이 굽음', '무릎을 너무 굽혀 스쿼트가 됨'] },
  { id: 'bridge', name: '글루트 브리지', part: '하체', muscles: '둔근 · 햄스트링', equip: '맨몸', met: 3.0, sets: 3, reps: 15, tempo: 2.6, rest: 45, view: 'side',
    cues: ['누워서 무릎을 세우고 발은 엉덩이 가까이', '엉덩이를 조이며 어깨~무릎이 일직선이 될 때까지 들기', '위에서 1초 멈췄다 천천히 내리기'], mistakes: ['허리를 과하게 젖힘', '발뒤꿈치가 엉덩이에서 너무 멂'] },
  { id: 'pushup', name: '푸시업', part: '가슴', muscles: '대흉근 · 삼두근 · 전면 삼각근', equip: '맨몸', met: 3.8, sets: 3, reps: 10, tempo: 2.6, rest: 60, view: 'side',
    cues: ['손은 어깨너비보다 조금 넓게', '머리~발끝 일직선, 배에 힘', '가슴이 바닥 가까이 갈 때까지 내려가기 (힘들면 무릎 대고)'], mistakes: ['엉덩이가 처지거나 솟음', '팔꿈치가 옆으로 90도 벌어짐'] },
  { id: 'press', name: '덤벨 숄더 프레스', short: '숄더 프레스', part: '어깨', muscles: '삼각근 · 삼두근', equip: '덤벨', met: 3.5, sets: 3, reps: 10, tempo: 2.8, rest: 60, view: 'front', dumbbell: true,
    cues: ['덤벨을 어깨 높이에서 시작', '머리 위로 곧게 밀어 올리기', '허리를 젖히지 말고 배에 힘'], mistakes: ['허리가 꺾임', '반동으로 올림'] },
  { id: 'lateral', name: '사이드 레터럴 레이즈', short: '레터럴 레이즈', part: '어깨', muscles: '측면 삼각근', equip: '덤벨', met: 3.5, sets: 3, reps: 12, tempo: 2.8, rest: 45, view: 'front', dumbbell: true,
    cues: ['팔꿈치를 살짝 굽힌 채 옆으로 들기', '어깨 높이까지만', '내릴 때 천천히 버티기'], mistakes: ['어깨가 귀 쪽으로 으쓱', '너무 무거운 무게로 반동'] },
  { id: 'curl', name: '덤벨 컬', part: '팔', muscles: '이두근', equip: '덤벨', met: 3.5, sets: 3, reps: 12, tempo: 2.6, rest: 45, view: 'diag', dumbbell: true,
    cues: ['팔꿈치는 옆구리에 고정', '손바닥이 위를 보게 들어 올리기', '내릴 때 2초 천천히'], mistakes: ['상체를 흔들어 반동', '팔꿈치가 앞으로 나감'] },
  { id: 'plank', name: '플랭크', part: '코어', muscles: '복횡근 · 복직근 · 어깨 안정근', equip: '맨몸', met: 3.8, sets: 3, sec: 30, tempo: 4, rest: 45, view: 'side', hold: true,
    cues: ['팔꿈치는 어깨 바로 아래', '머리~발끝 일직선', '배꼽을 당기고 숨은 계속 쉬기'], mistakes: ['엉덩이가 처짐', '숨을 참음'] },
  { id: 'climber', name: '마운틴 클라이머', part: '코어', muscles: '복근 · 고관절 굴곡근 · 심폐', equip: '맨몸', met: 8.0, sets: 3, sec: 30, tempo: 0.9, rest: 40, view: 'side', alt: true,
    cues: ['푸시업 자세에서 시작', '무릎을 가슴 쪽으로 번갈아 당기기', '엉덩이는 낮게 유지'], mistakes: ['엉덩이가 위로 솟음', '손이 어깨보다 앞에 있음'] },
  { id: 'jack', name: '점핑잭', part: '유산소', muscles: '전신 · 심폐', equip: '맨몸', met: 8.0, sets: 2, sec: 40, tempo: 1.0, rest: 30, view: 'front',
    cues: ['가볍게 뛰며 다리를 벌리고 팔을 머리 위로', '착지는 발 앞쪽으로 부드럽게', '리듬을 일정하게'], mistakes: ['무릎을 편 채 쿵쿵 착지'] },
  { id: 'knees', name: '하이니', part: '유산소', muscles: '고관절 굴곡근 · 심폐', equip: '맨몸', met: 8.0, sets: 2, sec: 30, tempo: 0.7, rest: 30, view: 'diag', alt: true,
    cues: ['제자리에서 무릎을 허리 높이까지 번갈아', '팔도 함께 힘차게', '상체는 곧게'], mistakes: ['상체가 뒤로 젖혀짐'] },
];
const EXI = Object.fromEntries(EX.map((e) => [e.id, e]));
const PARTS = ['전체', '하체', '가슴', '어깨', '팔', '코어', '유산소'];

/* 프로그램: 초보자 기준 (ACSM: 주요 근육 주 2회 이상, 8~12회 × 2~4세트) */
const PROGRAMS = [
  { id: 'starter', name: '처음 시작 전신', mins: 20, goal: ['keep', 'lose', 'fit', 'muscle'], desc: '주 2~3회. 하체·가슴·코어를 고르게', items: [['squat'], ['pushup', { reps: 8 }], ['bridge'], ['plank'], ['jack', { sets: 1 }]] },
  { id: 'burn', name: '맨몸 유산소 서킷', mins: 12, goal: ['lose', 'fit'], desc: '쉬는 시간 짧게 3바퀴. 땀 나는 날', circuit: 3, rest: 20, items: [['jack', { sec: 40 }], ['squat', { reps: 15 }], ['knees', { sec: 30 }], ['climber', { sec: 30 }]] },
  { id: 'legs', name: '하체 집중', mins: 18, goal: ['muscle', 'lose'], desc: '하체는 큰 근육이라 소모 열량도 큼', items: [['squat', { sets: 4 }], ['lunge'], ['rdl'], ['bridge']] },
  { id: 'upper', name: '덤벨 상체', mins: 16, goal: ['muscle', 'keep'], desc: '어깨·팔·가슴. 덤벨은 10~12회가 버거운 무게로', items: [['press'], ['lateral'], ['curl'], ['pushup']] },
  { id: 'core', name: '코어 10분', mins: 10, goal: ['fit', 'keep'], desc: '허리 건강과 자세', items: [['plank', { sec: 40 }], ['climber'], ['bridge', { sets: 2 }]] },
];
function expand(prog) {
  const steps = [];
  if (prog.circuit) {
    for (let r = 0; r < prog.circuit; r++) prog.items.forEach(([id, o = {}], i) => {
      const e = EXI[id];
      steps.push({ ex: e, set: r + 1, sets: prog.circuit, reps: o.sec ? 0 : (o.reps ?? e.reps ?? 0), sec: o.sec ?? (o.reps ? 0 : e.sec ?? 0), rest: i === prog.items.length - 1 ? 45 : prog.rest });
    });
  } else prog.items.forEach(([id, o = {}]) => {
    const e = EXI[id], sets = o.sets ?? e.sets;
    for (let s = 1; s <= sets; s++) steps.push({ ex: e, set: s, sets, reps: o.sec ? 0 : (o.reps ?? e.reps ?? 0), sec: o.sec ?? (e.sec ?? 0), rest: e.rest });
  });
  steps[steps.length - 1].rest = 0;
  return steps;
}

/* ───────── 저장 ───────── */
const KEY = 'ptgym-v1';
const db = Object.assign({ profile: { sex: 'm', age: 45, height: 170, weight: 70, target: 66, type: 'lose', act: 1.375, days: 3, mins: 150 }, logs: {}, voice: true }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('이 브라우저에는 저장할 수 없습니다'); } };
const dayLog = (d) => (db.logs[d] ??= { work: [] });
const lastWeight = () => { const ks = Object.keys(db.logs).filter((k) => db.logs[k].weight).sort(); return ks.length ? db.logs[ks[ks.length - 1]].weight : db.profile.weight; };
const kcalOf = (met, min, kg = lastWeight()) => (met * 3.5 * kg / 200) * min;

/* ───────── 3D 헬스장 ───────── */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
let pixelRatio = Math.min(devicePixelRatio, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe7ef); scene.fog = new THREE.Fog(0xdfe7ef, 16, 34);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 62 : 44; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 9, 6); scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe8ff, 0.6); fill.position.set(-6, 5, -3); scene.add(fill);

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, seg = 16, parent = scene) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; };
const RW = 18, RD = 14;   // 방 크기
const M = { rubber: std(0x30353d, { roughness: 0.95 }), wood: std(0xc8a27a, { roughness: 0.7 }), wall: std(0xeef1f5, { roughness: 0.9 }), teal: std(0x0d9488, { roughness: 0.5 }), dark: std(0x1f2937, { roughness: 0.45 }), steel: std(0xb6bec9, { roughness: 0.25, metalness: 0.85 }), black: std(0x111317, { roughness: 0.5 }), mat: std(0x14b8a6, { roughness: 0.85 }), mat2: std(0x6366f1, { roughness: 0.85 }), red: std(0xdc2626, { roughness: 0.45 }), mirror: std(0xcfd8e3, { roughness: 0.04, metalness: 0.92 }) };
box(RW, 0.1, RD, M.rubber, 0, -0.05, 0);
box(7.2, 0.02, 5.2, M.wood, 0, 0.01, 0.6);                                    // PT 존 원목 바닥
box(RW, 5, 0.2, M.wall, 0, 2.5, -RD / 2); box(0.2, 5, RD, M.wall, -RW / 2, 2.5, 0); box(0.2, 5, RD, M.wall, RW / 2, 2.5, 0);
box(RW, 0.35, 0.22, M.teal, 0, 0.6, -RD / 2 + 0.02); box(0.22, 0.35, RD, M.teal, -RW / 2 + 0.02, 0.6, 0); box(0.22, 0.35, RD, M.teal, RW / 2 - 0.02, 0.6, 0);
// 거울 벽
box(9, 2.4, 0.05, M.mirror, 0, 1.55, -RD / 2 + 0.14);
box(9.1, 0.06, 0.08, M.dark, 0, 2.78, -RD / 2 + 0.15); box(9.1, 0.06, 0.08, M.dark, 0, 0.33, -RD / 2 + 0.15);
// 천장 조명
for (let x = -6; x <= 6; x += 4) for (let z = -4; z <= 4; z += 4) box(2.6, 0.06, 0.4, new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 4.6, z);
// 간판
function textPlane(w, h, draw, x, y, z, ry = 0) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); draw(g, c.width, c.height);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  return { m, g, c, tex, redraw: (fn) => { g.clearRect(0, 0, c.width, c.height); fn(g, c.width, c.height); tex.needsUpdate = true; } };
}
textPlane(5, 0.9, (g, w, h) => {
  g.font = '800 150px Outfit, Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#0d9488'; g.fillText('PT GYM', w / 2, h / 2 + 6);
}, 0, 3.55, -RD / 2 + 0.12);
textPlane(4, 0.5, (g, w, h) => {
  g.font = '700 70px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#334155';
  g.fillText('NO PAIN, NO GAIN · 오늘도 한 세트 더', w / 2, h / 2);
}, -RW / 2 + 0.12, 3.4, 0, Math.PI / 2);
// 운동 안내 화면 (TV)
box(2.9, 1.7, 0.08, M.black, 4.6, 2.9, -RD / 2 + 0.2);
const tv = textPlane(2.7, 1.52, () => {}, 4.6, 2.9, -RD / 2 + 0.25);
function drawTv(title, big, sub) {
  tv.redraw((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0f766e'); gr.addColorStop(1, '#1e3a8a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.fillStyle = '#99f6e4'; g.font = '700 60px Pretendard, sans-serif'; g.fillText(title, w / 2, 110);
    g.fillStyle = '#fff'; g.font = '800 230px Outfit, sans-serif'; g.fillText(big, w / 2, 370);
    g.fillStyle = '#e2e8f0'; g.font = '600 50px Pretendard, sans-serif'; g.fillText(sub, w / 2, 490);
  });
}
drawTv('PT GYM', 'READY', '프로그램을 골라 시작하세요');

// 덤벨 랙 (왼쪽 벽)
const dumbbell = (x, y, z, s = 1, parent = scene, color = M.black) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const bar = cyl(0.016, 0.016, 0.3, M.steel, 0, 0, 0, 8, g); bar.rotation.z = Math.PI / 2;
  [-1, 1].forEach((k) => { const w = cyl(0.055, 0.055, 0.07, color, k * 0.12, 0, 0, 12, g); w.rotation.z = Math.PI / 2; });
  return g;
};
box(0.7, 0.06, 4.2, M.dark, -RW / 2 + 0.6, 0.55, -2.6); box(0.7, 0.06, 4.2, M.dark, -RW / 2 + 0.6, 0.95, -2.6);
[-1, 1].forEach((k) => box(0.06, 1.0, 0.06, M.dark, -RW / 2 + 0.6 + k * 0.3, 0.5, -0.6)); [-1, 1].forEach((k) => box(0.06, 1.0, 0.06, M.dark, -RW / 2 + 0.6 + k * 0.3, 0.5, -4.6));
for (let i = 0; i < 8; i++) { const s = 0.8 + (i % 4) * 0.12, z = -4.4 + Math.floor(i / 2) * 1.0 + (i % 2) * 0.45; const d = dumbbell(-RW / 2 + 0.6, i < 4 ? 0.64 : 1.04, z - 0.1, s); d.rotation.y = Math.PI / 2; }
// 스쿼트 랙
const rackX = -5.4, rackZ = -4.6;
[[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]].forEach(([x, z]) => box(0.08, 2.4, 0.08, M.red, rackX + x, 1.2, rackZ + z));
box(1.3, 0.08, 0.08, M.red, rackX, 2.4, rackZ - 0.45); box(1.3, 0.08, 0.08, M.red, rackX, 2.4, rackZ + 0.45);
{ const b = cyl(0.02, 0.02, 2.0, M.steel, rackX, 1.45, rackZ + 0.45, 8); b.rotation.z = Math.PI / 2; [-1, 1].forEach((k) => { const p = cyl(0.22, 0.22, 0.06, M.black, rackX + k * 0.82, 1.45, rackZ + 0.45, 18); p.rotation.z = Math.PI / 2; }); }
// 벤치
box(0.36, 0.08, 1.3, M.black, 5.0, 0.46, -3.6); box(0.08, 0.42, 0.08, M.steel, 5.0, 0.21, -3.1); box(0.08, 0.42, 0.08, M.steel, 5.0, 0.21, -4.1);
// 트레드밀 (오른쪽 벽)
const treadmills = [];
for (let i = 0; i < 3; i++) {
  const z = -3 + i * 2.4, x = RW / 2 - 1.3;
  box(1.7, 0.18, 0.8, M.dark, x, 0.09, z); box(1.5, 0.02, 0.6, M.black, x, 0.19, z);
  [-1, 1].forEach((k) => box(0.06, 1.1, 0.06, M.dark, x - 0.8, 0.7, z + k * 0.36));
  box(0.12, 0.3, 0.8, M.dark, x - 0.82, 1.3, z); box(0.02, 0.2, 0.5, new THREE.MeshBasicMaterial({ color: 0x22d3ee }), x - 0.89, 1.32, z);
  treadmills.push({ x: x + 0.15, z });
}
// 케틀벨·박스·짐볼
[[-2.6, -5.8], [-2.2, -5.8], [-1.8, -5.8]].forEach(([x, z], i) => { cyl(0.11, 0.13, 0.2, M.black, x, 0.1 + 0.0 * i, z, 12); const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), M.black); h.position.set(x, 0.24, z); scene.add(h); });
box(0.6, 0.5, 0.75, std(0x2563eb), 2.6, 0.25, -5.6);
{ const ball = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 16), std(0xf59e0b, { roughness: 0.4 })); ball.position.set(3.5, 0.33, -5.7); scene.add(ball); }
// 트레이너·나의 매트
const SPOT = { coach: [-1.05, 0], me: [1.05, 0] };
box(0.95, 0.03, 3.4, M.mat, SPOT.coach[0], 0.035, 0.1); box(0.95, 0.03, 3.4, M.mat2, SPOT.me[0], 0.035, 0.1);
// 물병 · 수건 소품
cyl(0.04, 0.04, 0.22, std(0x38bdf8, { roughness: 0.2, transparent: true, opacity: 0.8 }), 1.8, 0.11, 1.6, 12);

/* ───────── 사람과 자세 ───────── */
const THIGH = 0.43, SHIN = 0.43, UPARM = 0.29, FORE = 0.3, HIP_Y = 0.93;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
function person(look, x, z, yaw = 0) {
  const p = makePerson(scene, { height: 1, skirt: false, ...look });
  p.x = x; p.z = z; p.yaw = yaw; p.root.rotation.order = 'YXZ'; p.blob = p.root.children.find((c) => c.isMesh);
  p.frame = new THREE.Object3D(); p.dbs = [];
  p.root.position.set(x, 0, z);
  return p;
}
function giveDumbbells(p, on) {
  if (on && !p.dbs.length) [-1, 1].forEach((s) => { const d = dumbbell(0, -0.05, 0.0, 0.7, p.arms[s].h); d.rotation.y = Math.PI / 2; p.dbs.push(d); });
  p.dbs.forEach((d) => { d.visible = on; });
}
function shirtText(p, text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = color; g.font = '800 78px Outfit, Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  m.scale.set(1, 1, 0.78); m.position.set(0, 0.38, 0); p.torso.add(m);
}
function tagSprite(text, bg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, 240, 64, 32); g.fill(); g.beginPath(); g.moveTo(112, 70); g.lineTo(128, 92); g.lineTo(144, 70); g.fill();
  g.fillStyle = '#fff'; g.font = '800 40px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false })); s.scale.set(0.5, 0.19, 1); s.renderOrder = 5; scene.add(s); return s;
}
const coach = person({ style: 0, top: mat(0x0f766e), bottom: mat(0x111827), shoe: mat(0xf8fafc), hair: mat(0x111111) }, ...SPOT.coach);
shirtText(coach, 'PT COACH');
const me = person({ top: mat(0x6366f1), bottom: mat(0x1f2937) }, ...SPOT.me);
const coachTag = tagSprite('코치', '#0f766e'), meTag = tagSprite('나', '#6366f1');
// 다른 회원들: 저마다 운동 중
const members = [
  { p: person({ brick: true }, -RW / 2 + 1.6, -1.6, -Math.PI / 2 + Math.PI), ex: 'curl', off: 0.3 },
  { p: person({}, rackX, rackZ + 0.1, 0), ex: 'squat', off: 1.1 },
  { p: person({ brick: true }, 3.4, -2.4, Math.PI * 0.9), ex: 'pushup', off: 0.6, yawFix: true },
  { p: person({}, treadmills[0].x, treadmills[0].z, -Math.PI / 2), ex: 'jog', off: 0, y: 0.2 },
  { p: person({ brick: true }, treadmills[1].x, treadmills[1].z, -Math.PI / 2), ex: 'jog', off: 0.4, y: 0.2 },
  { p: person({}, -3.6, 2.6, Math.PI * 0.3), ex: 'lateral', off: 0.8 },
  { p: person({}, 4.2, 2.8, -Math.PI * 0.7), ex: 'plank', off: 0 },
];
members.forEach((m) => giveDumbbells(m.p, !!EXI[m.ex]?.dumbbell));

// 두 관절 팔다리를 목표점으로 (yz 평면). bend +1: 관절이 뒤(-z)쪽, -1: 앞쪽
function solve2(dy, dz, L1, L2, bend) {
  const D = clamp(Math.hypot(dy, dz), 0.02, L1 + L2 - 1e-3), th = Math.atan2(-dz, -dy);
  const al = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), ga = Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  return [th + bend * al, -bend * (Math.PI - ga)];
}
const V = new THREE.Vector3();
/* 자세 하나를 몸에 입힌다. 좌표는 '사람 기준'(발 아래가 원점, 앞이 +z) */
function applyPose(p, s, t) {
  p.frame.position.set(p.x, p.yBase || 0, p.z); p.frame.rotation.set(0, p.yaw, 0); p.frame.updateMatrixWorld();
  V.set(0, s.rootY || 0, s.rootZ || 0); p.frame.localToWorld(V);
  p.root.position.copy(V); p.root.rotation.set(s.tilt || 0, p.yaw, 0);
  p.hips.position.set(0, s.hipY ?? HIP_Y, s.hipZ || 0); p.hips.rotation.set(s.hipRX || 0, 0, s.hipRZ || 0);
  p.torso.rotation.set(s.torsoRX || 0, s.torsoRY || 0, 0);
  p.head.rotation.set(s.headRX || 0, 0, 0);
  p.blob.visible = !s.tilt;
  p.root.updateMatrixWorld(true);
  [-1, 1].forEach((side) => {
    const arm = p.arms[side], spec = side < 0 ? s.armL : s.armR;
    if (spec && spec.ik) {
      V.set(spec.ik[0] * side, spec.ik[1], spec.ik[2]); p.frame.localToWorld(V); p.torso.worldToLocal(V); V.sub(arm.a.position);
      const [a, e] = solve2(V.y, V.z, UPARM, FORE, spec.bend ?? 1);
      arm.a.rotation.set(a, 0, side * (spec.out ?? 0.08)); arm.e.rotation.set(e, 0, 0);
    } else {
      const q = spec || [0, 0.1, 0, -0.14];
      arm.a.rotation.set(q[0], side * q[2], side * q[1]); arm.e.rotation.set(q[3], 0, 0);
    }
    const leg = p.legs[side], ls = side < 0 ? s.legL : s.legR;
    if (ls && ls.ik) {
      V.set(ls.ik[0] * side, ls.ik[1], ls.ik[2]); p.frame.localToWorld(V); p.hips.worldToLocal(V); V.sub(leg.t.position);
      const [a, k] = solve2(V.y, V.z, THIGH, SHIN, ls.bend ?? -1);
      leg.t.rotation.set(a, 0, side * 0.03); leg.k.rotation.x = k;
      leg.f.rotation.set(ls.footRel ?? (-((s.tilt || 0) + (s.hipRX || 0) + a + k) + (ls.foot || 0)), 0, 0);
    } else {
      const q = ls || {};
      leg.t.rotation.set(q.t || 0, 0, side * (q.z ?? 0.03)); leg.k.rotation.x = q.k || 0;
      leg.f.rotation.set(q.f ?? -((s.tilt || 0) + (q.t || 0) + (q.k || 0)), 0, -side * (q.z || 0) * 0.9);
    }
  });
}
const FEET = { ik: [0.12, 0.05, 0] };
const smooth = (ph) => 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);   // 0→1→0
/* 운동마다 u(0=시작, 1=가장 힘든 지점), side(번갈아 하는 쪽) */
const POSES = {
  stand: (u, side, t) => ({ hipY: HIP_Y + Math.sin(t * 1.6) * 0.004, legL: FEET, legR: FEET, armL: [0.02, 0.1, 0, -0.16], armR: [0.02, 0.1, 0, -0.16], headRX: 0.02 }),
  squat: (u) => ({ hipY: HIP_Y - 0.4 * u, hipZ: -0.2 * u, torsoRX: 0.55 * u, headRX: -0.35 * u, legL: FEET, legR: FEET, armL: [-0.1 - 1.4 * u, 0.12, 0, -0.08], armR: [-0.1 - 1.4 * u, 0.12, 0, -0.08] }),
  lunge: (u, side) => {
    const front = { ik: [0.11, 0.05, 0.42] }, back = { ik: [0.11, 0.06 + 0.04 * u, -0.44], foot: 0.25 + 0.6 * u };
    const hands = [0.32, 0.5, 0, -1.95];
    return { hipY: 0.85 - 0.36 * u, torsoRX: 0.04, legL: side > 0 ? back : front, legR: side > 0 ? front : back, armL: hands, armR: hands };
  },
  rdl: (u) => ({ hipY: HIP_Y - 0.06 * u, hipZ: -0.24 * u, torsoRX: 1.2 * u, headRX: -0.75 * u, legL: FEET, legR: FEET, armL: [-1.2 * u, 0.06, 0, -0.04], armR: [-1.2 * u, 0.06, 0, -0.04] }),
  bridge: (u) => {
    const lift = 0.3 * u, b = Math.atan2(lift, 0.5);
    return { tilt: -Math.PI / 2, rootY: 0.15, hipZ: lift, torsoRX: -b * 0.8, headRX: b * 0.8 - 0.15, legL: { ik: [0.13, 0.05, -0.45], bend: -1 }, legR: { ik: [0.13, 0.05, -0.45], bend: -1 }, armL: [0.06, 0.22, 0, 0], armR: [0.06, 0.22, 0, 0] };
  },
  pushup: (u) => {
    const a = 1.16 + 0.24 * u, hands = { ik: [0.27, 0.03, 1.31], bend: 1, out: 0.12 };
    return { tilt: a, headRX: -0.35, armL: hands, armR: hands, legL: { f: 0.25 }, legR: { f: 0.25 } };
  },
  plank: (u, side, t) => {
    const a = 1.37 + Math.sin(t * 1.5) * 0.004, hands = { ik: [0.13, 0.04, 1.66], bend: 1, out: 0.06 };
    return { tilt: a, headRX: -0.3, armL: hands, armR: hands, legL: { f: 0.25 }, legR: { f: 0.25 } };
  },
  climber: (u, side) => {
    const a = 1.18, hands = { ik: [0.24, 0.03, 1.32], bend: 1, out: 0.1 };
    const drive = { ik: [0.1, 0.16, 0.12 + 0.55 * u], bend: -1, footRel: 0.5 }, base = { f: 0.25 };
    return { tilt: a, headRX: -0.35, armL: hands, armR: hands, legL: side > 0 ? drive : base, legR: side > 0 ? base : drive };
  },
  jack: (u, side, t, ph) => ({
    rootY: Math.abs(Math.sin(ph * Math.PI * 2)) * 0.06, hipY: HIP_Y - 0.03 * u,
    legL: { z: 0.04 + 0.26 * u, k: 0.06 }, legR: { z: 0.04 + 0.26 * u, k: 0.06 },
    armL: [0, 0.15 + 2.75 * u, 0, -0.15], armR: [0, 0.15 + 2.75 * u, 0, -0.15],
  }),
  knees: (u, side) => {
    const up = { t: -1.45 * u, k: 1.55 * u }, down = { t: 0.05, k: 0.05 };
    const runA = [-0.75 * u - 0.1, 0.1, 0, -1.45], runB = [0.45 * u, 0.1, 0, -1.3];
    return { rootY: 0.03 * u, hipY: HIP_Y - 0.02, legL: side > 0 ? up : down, legR: side > 0 ? down : up, armL: side > 0 ? runB : runA, armR: side > 0 ? runA : runB, torsoRX: 0.05 };
  },
  jog: (u, side, t, ph) => {
    const s = Math.sin(ph * Math.PI * 2), l = { t: -0.55 * Math.max(0, s) + 0.35 * Math.max(0, -s), k: 0.25 + 1.0 * Math.max(0, s) }, r = { t: -0.55 * Math.max(0, -s) + 0.35 * Math.max(0, s), k: 0.25 + 1.0 * Math.max(0, -s) };
    return { rootY: Math.abs(s) * 0.03, hipY: HIP_Y - 0.04, torsoRX: 0.1, legL: l, legR: r, armL: [0.5 * s - 0.2, 0.1, 0, -1.4], armR: [-0.5 * s - 0.2, 0.1, 0, -1.4] };
  },
  press: (u) => {
    const k = 1 - u;   // u=1이 머리 위
    return { legL: FEET, legR: FEET, armL: [-1.45 - 1.5 * u, 0.55 - 0.3 * u + 0.15 * k, 0, -1.75 * k - 0.05], armR: [-1.45 - 1.5 * u, 0.55 - 0.3 * u + 0.15 * k, 0, -1.75 * k - 0.05] };
  },
  lateral: (u) => ({ legL: FEET, legR: FEET, torsoRX: 0.06, armL: [-0.12, 0.14 + 1.42 * u, 0, -0.3], armR: [-0.12, 0.14 + 1.42 * u, 0, -0.3] }),
  curl: (u) => ({ legL: FEET, legR: FEET, armL: [0.06 - 0.18 * u, 0.1, 0, -0.12 - 2.15 * u], armR: [0.06 - 0.18 * u, 0.1, 0, -0.12 - 2.15 * u] }),
};
function poseFor(p, id, phase, rep, t) {
  const e = EXI[id], f = POSES[id] || POSES.stand;
  const side = e?.alt ? (rep % 2 ? -1 : 1) : 1;
  const u = id === 'knees' || id === 'climber' ? Math.sin(phase * Math.PI) : smooth(phase);
  applyPose(p, f(u, side, t, phase), t);
}

/* ───────── 카메라 (끌어서 돌리기) ───────── */
const cam = { th: 0.32, ph: 1.28, d: 5.6, look: new THREE.Vector3(0, 0.95, 0.3), auto: true, mode: 0 };
const camTo = { th: cam.th, ph: cam.ph, d: cam.d };
const VIEWS = { front: [0.18, 1.3, 5.2], diag: [0.72, 1.22, 5.4], side: [1.25, 1.06, 5.6] };
const VIEW_NAMES = ['자동', '정면', '대각', '측면'];
function setView(v) { const [th, ph, d] = VIEWS[v] || VIEWS.diag; Object.assign(camTo, { th, ph, d }); }
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  camTo.th -= (e.clientX - drag.x) * 0.006; camTo.ph = clamp(camTo.ph - (e.clientY - drag.y) * 0.004, 0.55, 1.5);
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { camTo.d = clamp(camTo.d + e.deltaY * 0.004, 2.8, 10); }, { passive: true });
$('btnView').onclick = () => {
  cam.mode = (cam.mode + 1) % VIEW_NAMES.length; cam.auto = cam.mode === 0;
  $('btnView').textContent = `시점: ${VIEW_NAMES[cam.mode]}`;
  if (cam.auto) setView(curView()); else setView(['', 'front', 'diag', 'side'][cam.mode]);
};
const curView = () => (sess ? sess.steps[sess.i].ex.view : demo ? EXI[demo].view : 'diag');

/* ───────── 소리: 박자 신호음과 음성 카운트 ───────── */
let actx = null;
const beep = (f = 880, d = 0.09, v = 0.12) => {
  try {
    actx ??= new AudioContext(); if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  } catch { /* 소리 없이 진행 */ }
};
const NUM = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열하나', '열둘', '열셋', '열넷', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스물'];
let koVoice = null;
const pickVoice = () => { koVoice = window.speechSynthesis?.getVoices?.().find((v) => /ko/i.test(v.lang)) || null; };
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, cut = false) {
  if (!db.voice || !('speechSynthesis' in window)) return;
  if (cut) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; if (koVoice) u.voice = koVoice; u.rate = 1.15; u.volume = 0.9;
  speechSynthesis.speak(u);
}
const syncVoiceBtn = () => { $('btnVoice').textContent = db.voice ? '음성 켬' : '음성 끔'; $('btnVoice').setAttribute('aria-pressed', String(db.voice)); };
$('btnVoice').onclick = () => { db.voice = !db.voice; save(); syncVoiceBtn(); if (!db.voice) window.speechSynthesis?.cancel(); toast(db.voice ? '횟수를 소리 내어 셉니다' : '음성 카운트를 끕니다', 1.6); };
syncVoiceBtn();

/* ───────── 따라 하기 세션 ───────── */
let sess = null, demo = null, demoT = 0;
const caption = (main, sub = '') => { const c = $('gCaption'); if (!main) { c.hidden = true; return; } c.hidden = false; c.innerHTML = ''; c.append(main); if (sub) { const s = document.createElement('small'); s.textContent = sub; c.append(s); } };

function startSession(name, steps) {
  closeModals(); demo = null;
  sess = { name, steps, i: 0, mode: 'ready', left: 6, rep: 0, ph: 0, t: 0, paused: false, elapsed: 0, kcal: 0, done: [], cue: 0, cueT: 0 };
  setPanel(false); $('sess').hidden = false; caption('');
  enterStep(true);
  beep(660, 0.12);
}
function enterStep(first) {
  const st = sess.steps[sess.i];
  sess.mode = 'ready'; sess.left = first ? 6 : 4; sess.rep = 0; sess.ph = 0; sess.work = 0;
  giveDumbbells(coach, !!st.ex.dumbbell); giveDumbbells(me, !!st.ex.dumbbell);
  if (cam.auto) setView(st.ex.view);
  say(coach, first ? `${st.ex.name}부터 갑니다!` : `다음은 ${st.ex.name}!`, 2.4);
  speak(`${st.ex.name}, ${st.sec ? `${st.sec}초` : `${st.reps}회`}. 준비`, true);
  drawSess();
}
function finishSet() {
  const st = sess.steps[sess.i];
  sess.done.push({ ex: st.ex.id, reps: st.sec ? 0 : sess.rep, sec: st.sec ? Math.round(sess.work) : 0, work: sess.work });
  beep(988, 0.18, 0.14);
  if (sess.i >= sess.steps.length - 1) { sess.mode = 'done'; endSession(true); return; }
  if (st.rest > 0) {
    sess.mode = 'rest'; sess.left = st.rest;
    const nx = sess.steps[sess.i + 1];
    say(coach, pick(['좋아요! 숨 고르세요', '잘했어요! 물 한 모금', '훌륭해요, 잠깐 쉬어요']), 2.2);
    speak(`좋아요. ${st.rest}초 휴식. 다음은 ${nx.ex.name}`, true);
  } else { sess.i++; enterStep(false); }
  drawSess();
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function endSession(complete) {
  const s = sess; if (!s) return;
  if (s.mode === 'work' && s.work > 3) { const st = s.steps[s.i]; s.done.push({ ex: st.ex.id, reps: st.sec ? 0 : s.rep, sec: st.sec ? Math.round(s.work) : 0, work: s.work }); }
  sess = null; $('sess').hidden = true;
  giveDumbbells(coach, false); giveDumbbells(me, false);
  if (cam.auto) setView('diag');
  drawTv('PT GYM', complete ? 'DONE!' : 'READY', complete ? '오늘도 해냈습니다' : '프로그램을 골라 시작하세요');
  window.speechSynthesis?.cancel();
  if (!s.done.length) { toast('기록할 운동이 없어 저장하지 않았습니다'); setPanel(true); return; }
  // 운동별로 묶어서 오늘 기록에 넣는다
  const by = {};
  s.done.forEach((d) => { const b = (by[d.ex] ??= { ex: d.ex, sets: 0, reps: 0, sec: 0, work: 0 }); b.sets++; b.reps += d.reps; b.sec += d.sec; b.work += d.work; });
  const min = s.elapsed / 60, log = dayLog(today()), entry = { id: Date.now(), src: 'follow', name: s.name, min: +min.toFixed(1), kcal: Math.round(s.kcal), items: Object.values(by).map((b) => ({ ex: b.ex, sets: b.sets, reps: b.reps, sec: b.sec })), rpe: null };
  log.work.push(entry); save();
  lastEntry = entry;
  say(coach, complete ? '오늘 운동 끝! 정말 잘했어요' : '오늘은 여기까지! 수고했어요', 3);
  speak(complete ? '오늘 운동 끝. 정말 잘했어요' : '수고했어요', true);
  const tiles = [['운동 시간', mmss(s.elapsed), ''], ['소모 열량', Math.round(s.kcal), 'kcal'], ['완료 세트', s.done.length, '세트'], ['총 횟수', s.done.reduce((a, d) => a + d.reps, 0), '회']];
  $('doneTiles').innerHTML = tiles.map(([a, b, c]) => `<div class="tile"><small>${a}</small><b>${b}<i>${c}</i></b></div>`).join('');
  $('doneTitle').textContent = complete ? '수고했습니다! 오늘 운동 완료' : '여기까지 기록합니다';
  rpe = null; drawRpe(); $('doneModal').hidden = false;
}
let lastEntry = null, rpe = null;
function drawRpe() {
  const box = $('rpe'); box.textContent = '';
  for (let i = 1; i <= 10; i++) { const b = document.createElement('button'); b.textContent = i; b.className = rpe === i ? 'on' : ''; b.onclick = () => { rpe = i; drawRpe(); }; box.append(b); }
  $('rpeHint').textContent = rpe == null ? '7~8 정도가 알맞습니다 (2~3회 더 할 수 있는 정도).' : rpe <= 5 ? '여유가 있었네요. 다음엔 횟수나 무게를 조금 올려 보세요.' : rpe <= 8 ? '알맞은 강도입니다. 이대로 꾸준히!' : '많이 힘들었네요. 다음엔 휴식을 늘리거나 횟수를 줄여 보세요.';
}
$('doneSave').onclick = () => { if (lastEntry) { lastEntry.rpe = rpe; save(); } closeModals(); toast('기록에 저장했습니다'); setPanel(true); showTab('stats'); };

function drawSess() {
  const s = sess; if (!s) return;
  const st = s.steps[s.i], e = st.ex;
  $('sProg').textContent = `${s.name} · ${s.i + 1}/${s.steps.length}`;
  $('sName').textContent = s.mode === 'rest' ? `다음: ${s.steps[s.i + 1].ex.name}` : e.name;
  $('sStage').textContent = s.mode === 'ready' ? '준비' : s.mode === 'rest' ? '휴식' : s.paused ? '일시정지' : '운동 중';
  $('sStage').className = `sStage${s.mode === 'rest' ? ' rest' : ''}`;
  const nx = s.mode === 'rest' ? s.steps[s.i + 1] : st;
  $('sSet').textContent = `${nx.set}/${nx.sets}세트 · ${nx.sec ? `${nx.sec}초` : `${nx.reps}회`} · ${nx.ex.part}`;
  $('sMore').hidden = s.mode !== 'rest';
  $('sSkip').textContent = s.mode === 'rest' ? '휴식 건너뛰기' : s.mode === 'ready' ? '바로 시작' : '이 세트 끝';
  $('sPause').textContent = s.paused ? '계속하기' : '일시정지';
  let big, unit, frac;
  if (s.mode === 'work') {
    if (st.sec) { big = Math.ceil(Math.max(0, st.sec - s.work)); unit = '초 남음'; frac = s.work / st.sec; }
    else { big = s.rep; unit = `/ ${st.reps}회`; frac = s.rep / st.reps; }
  } else { big = Math.ceil(s.left); unit = s.mode === 'rest' ? '초 휴식' : '초 뒤 시작'; frac = 0; }
  const bEl = $('sCount');
  if (bEl.textContent !== String(big)) { bEl.textContent = big; bEl.classList.remove('pop'); void bEl.offsetWidth; bEl.classList.add('pop'); }
  $('sUnit').textContent = unit; $('sBarFill').style.width = `${clamp(frac, 0, 1) * 100}%`;
  $('sCue').textContent = s.mode === 'rest' ? `물 한 모금, 호흡을 고르세요. 다음 포인트: ${nx.ex.cues[0]}` : `💡 ${e.cues[s.cue % e.cues.length]}`;
  $('sClock').textContent = mmss(s.elapsed); $('sKcal').textContent = `${Math.round(s.kcal)} kcal`;
  drawTv(`${e.name} ${nx.set}/${nx.sets}`, s.mode === 'work' ? String(big) : s.mode === 'rest' ? `휴식 ${Math.ceil(s.left)}` : String(Math.ceil(s.left)), s.mode === 'work' ? (st.sec ? '초 남음' : `/ ${st.reps}회`) : s.mode === 'rest' ? `다음: ${s.steps[s.i + 1].ex.name}` : '준비');
}
let lastDraw = 0;
function tickSession(dt) {
  const s = sess; if (!s || s.paused) return;
  const st = s.steps[s.i];
  s.elapsed += dt;
  s.kcal += kcalOf(s.mode === 'work' ? st.ex.met : 2.0, dt / 60);
  if (s.mode === 'ready' || s.mode === 'rest') {
    const before = Math.ceil(s.left); s.left -= dt; const after = Math.ceil(s.left);
    if (after !== before && after <= 3 && after > 0) { beep(660, 0.08); if (s.mode === 'ready') speak(String(after)); }
    if (s.left <= 0) {
      if (s.mode === 'rest') { s.i++; enterStep(false); return; }
      s.mode = 'work'; s.work = 0; s.ph = 0; beep(1175, 0.2, 0.15); speak('시작!', true); say(coach, '시작!', 1.2);
    }
  } else {
    s.work += dt; s.cueT += dt;
    if (s.cueT > 7) { s.cueT = 0; s.cue++; }
    s.ph += dt / st.ex.tempo;
    if (s.ph >= 1) {
      s.ph -= 1;
      if (!st.sec) {
        s.rep++; beep(784, 0.06, 0.08); speak(NUM[s.rep] || String(s.rep), true);
        if (s.rep === st.reps - 2 && st.reps >= 6) say(coach, '두 개 남았어요!', 1.4);
        if (s.rep >= st.reps) { finishSet(); return; }
      } else s.rep++;
    }
    if (st.sec) {
      const left = st.sec - s.work;
      if (Math.ceil(left) !== Math.ceil(left + dt) && left <= 3 && left > 0) beep(660, 0.08);
      if (Math.abs(left - st.sec / 2) < dt) { say(coach, '반 왔어요, 버텨요!', 1.6); speak('절반'); }
      if (left <= 0) { finishSet(); return; }
    }
  }
  lastDraw += dt; if (lastDraw > 0.1) { lastDraw = 0; drawSess(); }
}
$('sPause').onclick = () => { if (!sess) return; sess.paused = !sess.paused; if (sess.paused) window.speechSynthesis?.cancel(); drawSess(); };
$('sSkip').onclick = () => {
  if (!sess) return;
  if (sess.mode === 'ready') { sess.left = 0.01; } else if (sess.mode === 'rest') { sess.i++; enterStep(false); } else finishSet();
};
$('sMore').onclick = () => { if (sess?.mode === 'rest') { sess.left += 10; drawSess(); } };
$('sEnd').onclick = () => endSession(false);

/* ───────── UI: 패널 ───────── */
const modalIds = ['exModal', 'doneModal'];
function closeModals() { modalIds.forEach((id) => { $(id).hidden = true; }); }
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeModals; });
document.querySelectorAll('.modalBack').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) closeModals(); }));
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
function setPanel(on) { $('panel').hidden = !on; $('panelOpen').hidden = on; document.body.classList.toggle('panelOn', on); }
$('panelX').onclick = () => setPanel(false);
$('panelOpen').onclick = () => setPanel(true);
let tab = 'train';
function showTab(name) {
  tab = name; setPanel(true);
  document.querySelectorAll('.gTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('#panel [data-pane]').forEach((s) => { s.hidden = s.dataset.pane !== name; });
  ({ train: drawTrain, log: drawLog, stats: drawStats, goal: drawGoal })[name]();
  $('panel').scrollTop = 0;
}
document.querySelectorAll('.gTabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

/* 운동 탭 */
let partF = '전체';
function weekDays(endDay = today()) {   // 이번 주(월~일)
  const d = parseYmd(endDay), mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return ymd(x); });
}
const dayMin = (d) => (db.logs[d]?.work || []).reduce((a, w) => a + (w.min || 0), 0);
function streak() { let n = 0, d = today(); if (!dayMin(d)) d = addDays(d, -1); while (dayMin(d) > 0) { n++; d = addDays(d, -1); } return n; }
function drawTrain() {
  const wk = weekDays(), done = wk.filter((d) => dayMin(d) > 0).length, mins = Math.round(wk.reduce((a, d) => a + dayMin(d), 0));
  const goalT = db.profile.type, rec = PROGRAMS.find((p) => p.goal[0] === goalT) || PROGRAMS[0];
  $('todayHint').textContent = `이번 주 ${done}/${db.profile.days}일 · ${mins}/${db.profile.mins}분 운동했습니다.${streak() ? ` ${streak()}일 연속!` : ''} 목표(${({ lose: '감량', keep: '유지', muscle: '근육', fit: '체력' })[goalT]})에 맞춰 '${rec.name}'을 권합니다.`;
  const pl = $('progList'); pl.textContent = '';
  PROGRAMS.forEach((p, i) => {
    const steps = expand(p), sets = steps.length, b = document.createElement('button');
    b.className = `prog${p === rec ? ' rec' : ''}`; b.style.animationDelay = `${i * 0.04}s`;
    b.innerHTML = `<span class="pIco">${p.mins}′</span><span><strong></strong><small></small></span>${p === rec ? '<span class="badge">추천</span>' : ''}`;
    b.querySelector('strong').textContent = p.name;
    b.querySelector('small').textContent = `${p.desc} · ${[...new Set(p.items.map(([id]) => EXI[id].short || EXI[id].name))].join(', ')} · ${sets}세트`;
    b.onclick = () => startSession(p.name, steps);
    pl.append(b);
  });
  const f = $('exFilter'); f.textContent = '';
  PARTS.forEach((pt) => { const b = document.createElement('button'); b.textContent = pt; b.className = pt === partF ? 'on' : ''; b.onclick = () => { partF = pt; drawTrain(); }; f.append(b); });
  const g = $('exList'); g.textContent = '';
  EX.filter((e) => partF === '전체' || e.part === partF).forEach((e, i) => {
    const b = document.createElement('button'); b.className = 'exCard'; b.style.animationDelay = `${i * 0.03}s`;
    b.innerHTML = '<span class="pt"></span><strong></strong><small></small>';
    b.querySelector('.pt').textContent = `${e.part} · ${e.equip}`; b.querySelector('strong').textContent = e.name;
    b.querySelector('small').textContent = `${e.sets}세트 × ${e.sec ? `${e.sec}초` : `${e.reps}회`} · 휴식 ${e.rest}초`;
    b.onclick = () => openEx(e);
    g.append(b);
  });
}
function history(exId) {   // 최근 기록 (오래된 순)
  const out = [];
  Object.keys(db.logs).sort().forEach((d) => db.logs[d].work.forEach((w) => (w.items || []).forEach((it) => { if (it.ex === exId) out.push({ d, ...it }); })));
  return out;
}
let exOpen = null;
function openEx(e) {
  exOpen = e;
  $('exTag').textContent = `${e.part} · ${e.equip}`; $('exTitle').textContent = e.name;
  $('exMeta').textContent = `주 근육: ${e.muscles} · 권장 ${e.sets}세트 × ${e.sec ? `${e.sec}초` : `${e.reps}회`}, 세트 사이 ${e.rest}초 · 약 ${e.met} MET`;
  $('exCues').innerHTML = ''; e.cues.forEach((c) => { const li = document.createElement('li'); li.textContent = c; $('exCues').append(li); });
  $('exMist').innerHTML = ''; e.mistakes.forEach((c) => { const li = document.createElement('li'); li.textContent = c; $('exMist').append(li); });
  const h = history(e.id).slice(-2);
  const target = e.sec ? e.sec * e.sets : e.reps * e.sets;
  $('exNext').textContent = !h.length ? '' : h.length === 2 && h.every((x) => (e.sec ? x.sec : x.reps) >= target)
    ? `최근 두 번 모두 목표를 채웠습니다. 다음엔 ${e.equip === '덤벨' ? '무게를 2~10% 올려' : e.sec ? '시간을 10초 늘려' : '회수를 2회 늘려'} 보세요 (점진적 과부하).`
    : `지난 기록: ${h[h.length - 1].d.slice(5).replace('-', '/')} · ${h[h.length - 1].sets}세트 ${e.sec ? `${h[h.length - 1].sec}초` : `${h[h.length - 1].reps}회`}`;
  $('exModal').hidden = false;
}
$('exDemo').onclick = () => { const e = exOpen; closeModals(); startDemo(e); };
$('exGo').onclick = () => { const e = exOpen; startSession(e.name, expand({ items: [[e.id]] })); };
function startDemo(e) {
  if (sess) return;
  demo = e.id; demoT = 0; giveDumbbells(coach, !!e.dumbbell); giveDumbbells(me, !!e.dumbbell);
  if (cam.auto) setView(e.view);
  say(coach, `${e.name}, 이렇게 합니다`, 2.4);
  caption(`${e.name} 시범 · ${e.cues[0]}`, '나(오른쪽)도 따라 합니다. 화면을 끌면 시점이 돕니다');
  drawTv(e.name, '시범', e.cues[0]);
  if (innerWidth < 720) setPanel(false);
}

/* 기록 탭 */
let curDay = today();
function drawLog() {
  $('dPick').value = curDay; $('dNext').disabled = curDay >= today();
  const L = db.logs[curDay] || { work: [] };
  $('fWeight').value = L.weight ?? ''; $('fFat').value = L.fat ?? ''; $('fSleep').value = L.sleep ?? ''; $('fWater').value = L.water ?? ''; $('fMemo').value = L.memo ?? '';
  drawCond(L.cond);
  const box = $('dayWork'); box.textContent = '';
  if (!L.work.length) box.innerHTML = '<p class="empty">아직 운동 기록이 없습니다. 따라 하기를 마치면 자동으로 들어옵니다.</p>';
  L.work.forEach((w) => {
    const r = document.createElement('div'); r.className = 'wRow';
    const items = (w.items || []).map((it) => `${EXI[it.ex]?.short || EXI[it.ex]?.name || it.name || it.ex} ${it.sets}세트${it.reps ? ` ${it.reps}회` : ''}${it.sec ? ` ${it.sec}초` : ''}${it.kg ? ` ${it.kg}kg` : ''}`).join(', ');
    r.innerHTML = '<span><b></b><br><small></small></span><button class="x">삭제</button>';
    r.querySelector('b').textContent = `${w.src === 'follow' ? '따라 하기' : '직접 입력'} · ${w.name}`;
    r.querySelector('small').textContent = `${items} · ${w.min}분 · ${w.kcal}kcal${w.rpe ? ` · 강도 ${w.rpe}/10` : ''}`;
    r.querySelector('.x').onclick = () => { L.work = L.work.filter((x) => x !== w); save(); drawLog(); toast('지웠습니다'); };
    box.append(r);
  });
  const sel = $('mEx'); if (!sel.options.length) { EX.forEach((e) => sel.add(new Option(`${e.name} (${e.part})`, e.id))); [['bench', '벤치 프레스'], ['deadlift', '바벨 데드리프트'], ['latpull', '랫 풀다운'], ['legpress', '레그 프레스'], ['row', '시티드 로우'], ['run', '러닝머신'], ['bike', '실내 자전거'], ['etc', '기타']].forEach(([v, n]) => sel.add(new Option(n, v))); }
  drawCal();
}
const EXTRA = { bench: { name: '벤치 프레스', part: '가슴', met: 5.0 }, deadlift: { name: '바벨 데드리프트', part: '하체', met: 6.0 }, latpull: { name: '랫 풀다운', part: '등', met: 4.0 }, legpress: { name: '레그 프레스', part: '하체', met: 5.0 }, row: { name: '시티드 로우', part: '등', met: 4.0 }, run: { name: '러닝머신', part: '유산소', met: 8.3 }, bike: { name: '실내 자전거', part: '유산소', met: 6.8 }, etc: { name: '기타', part: '기타', met: 4.0 } };
const exInfo = (id) => EXI[id] || EXTRA[id] || { name: id, part: '기타', met: 4 };
function drawCond(v) {
  const box = $('fCond'); box.textContent = '';
  ['😫 1', '😕 2', '🙂 3', '😊 4', '🔥 5'].forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; b.className = v === i + 1 ? 'on' : ''; b.onclick = () => { const L = dayLog(curDay); L.cond = L.cond === i + 1 ? null : i + 1; save(); drawCond(L.cond); }; box.append(b); });
}
const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };
$('fSave').onclick = () => {
  const L = dayLog(curDay); L.weight = num('fWeight'); L.fat = num('fFat'); L.sleep = num('fSleep'); L.water = num('fWater'); L.memo = $('fMemo').value.trim() || null;
  if (L.weight && curDay === today()) db.profile.weight = L.weight;
  save(); toast(`${curDay.slice(5).replace('-', '/')} 기록을 저장했습니다`); drawLog();
};
$('mAdd').onclick = () => {
  const id = $('mEx').value, info = exInfo(id), sets = num('mSets') || 0, reps = num('mReps') || 0, kg = num('mKg') || 0;
  let min = num('mMin') || 0;
  if (!sets && !min) { toast('세트나 시간을 넣어 주세요'); return; }
  if (!min) min = +(sets * 1.5 + Math.max(0, sets - 1) * 1.5).toFixed(1);   // 세트당 약 1.5분 + 휴식
  const L = dayLog(curDay);
  L.work.push({ id: Date.now(), src: 'manual', name: info.name, min, kcal: Math.round(kcalOf(info.met, min)), items: [{ ex: id, name: info.name, sets, reps: reps * sets, perSet: reps, kg, sec: 0 }] });
  save(); toast(`${info.name}을 기록했습니다`); drawLog();
};
$('dPick').onchange = (e) => { if (e.target.value) { curDay = e.target.value > today() ? today() : e.target.value; drawLog(); } };
$('dPrev').onclick = () => { curDay = addDays(curDay, -1); drawLog(); };
$('dNext').onclick = () => { if (curDay < today()) { curDay = addDays(curDay, 1); drawLog(); } };
$('dToday').onclick = () => { curDay = today(); drawLog(); };
function drawCal() {
  const d = parseYmd(curDay), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  $('calTitle').textContent = `${y}년 ${m + 1}월 · 진할수록 오래 운동한 날`;
  const box = $('cal'); box.textContent = '';
  ['월', '화', '수', '목', '금', '토', '일'].forEach((w) => { const s = document.createElement('span'); s.textContent = w; box.append(s); });
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) box.append(document.createElement('span'));
  for (let i = 1; i <= days; i++) {
    const k = `${y}-${pad(m + 1)}-${pad(i)}`, mins = dayMin(k), b = document.createElement('button');
    b.textContent = i; b.className = [mins >= 40 ? 'l3' : mins >= 20 ? 'l2' : mins > 0 ? 'l1' : '', k === curDay ? 'sel' : '', k === today() ? 'today' : ''].join(' ');
    b.setAttribute('aria-label', `${m + 1}월 ${i}일 ${mins ? `${Math.round(mins)}분 운동` : '운동 없음'}`);
    b.disabled = k > today(); b.onclick = () => { curDay = k; drawLog(); };
    box.append(b);
  }
}

/* 통계 탭: 한 차트에 한 계열, 한 가지 색(청록). 막대 위에 올리면 값이 뜬다 */
const tip = $('tip');
const showTip = (e, text) => { tip.hidden = false; tip.textContent = text; tip.style.left = `${Math.min(innerWidth - 160, e.clientX + 12)}px`; tip.style.top = `${e.clientY - 34}px`; };
const hideTip = () => { tip.hidden = true; };
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent?.append(n); return n; };
const C = { main: '#0d9488', soft: '#99f6e4', grid: 'rgba(148,163,184,.28)', goal: '#2563eb' };
function niceRange(lo, hi, n = 4) { const span = Math.max(hi - lo, 1e-6), step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0); return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step]; }
function lineChart(box, pts, goal, unit) {
  box.textContent = '';
  if (pts.length < 2) { box.innerHTML = `<p class="empty" style="padding:14px 8px">체중을 이틀 이상 기록하면 그래프가 그려집니다.</p>`; return; }
  const W = 360, H = 170, L = 34, R = 10, T = 10, B = 22;
  const ys = pts.map((p) => p.v).concat(goal ? [goal] : []);
  const [lo, hi, step] = niceRange(Math.min(...ys) - 0.5, Math.max(...ys) + 0.5);
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `체중 변화 그래프, ${pts[0].v}${unit}에서 ${pts[pts.length - 1].v}${unit}` }, box);
  for (let v = lo; v <= hi + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: C.grid, 'stroke-width': 1 }, svg); el('text', { x: L - 6, y: Y(v) + 3, 'text-anchor': 'end' }, svg).textContent = +v.toFixed(1); }
  [pts[0], pts[pts.length - 1]].forEach((p, i) => { el('text', { x: X(p.t), y: H - 6, 'text-anchor': i ? 'end' : 'start' }, svg).textContent = p.d.slice(5).replace('-', '/'); });
  if (goal) { el('line', { x1: L, x2: W - R, y1: Y(goal), y2: Y(goal), stroke: C.goal, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg); el('text', { x: W - R, y: Y(goal) - 4, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = `목표 ${goal}${unit}`; }
  el('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(''), fill: 'none', stroke: C.main, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  const last = pts[pts.length - 1];
  el('circle', { cx: X(last.t), cy: Y(last.v), r: 4, fill: C.main, stroke: '#fff', 'stroke-width': 2 }, svg);
  el('text', { x: X(last.t) - 6, y: Y(last.v) - 8, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = `${last.v}${unit}`;
  // 십자선 + 가장 가까운 점 값
  const cross = el('line', { y1: T, y2: H - B, stroke: '#94a3b8', 'stroke-width': 1, visibility: 'hidden' }, svg), dot = el('circle', { r: 4, fill: C.main, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const hit = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, class: 'hit' }, svg);
  hit.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
    const p = pts.reduce((a, b) => (Math.abs(X(b.t) - x) < Math.abs(X(a.t) - x) ? b : a));
    cross.setAttribute('x1', X(p.t)); cross.setAttribute('x2', X(p.t)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', X(p.t)); dot.setAttribute('cy', Y(p.v)); dot.setAttribute('visibility', 'visible');
    showTip(e, `${p.d.slice(5).replace('-', '/')} · ${p.v}${unit}`);
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); });
}
function barChart(box, rows, goal, fmt, labelEvery = 1) {
  box.textContent = '';
  const W = 360, H = 160, L = 30, R = 8, T = 12, B = 22, n = rows.length;
  const [, hi, step] = niceRange(0, Math.max(1, goal || 0, ...rows.map((r) => r.v)));
  const Y = (v) => T + (1 - v / hi) * (H - T - B), bw = (W - L - R) / n, gap = 2;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': rows.map((r) => `${r.k} ${fmt(r.v)}`).join(', ') }, box);
  for (let v = 0; v <= hi + 1e-9; v += step) { el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: v ? C.grid : '#94a3b8', 'stroke-width': 1 }, svg); el('text', { x: L - 5, y: Y(v) + 3, 'text-anchor': 'end' }, svg).textContent = v; }
  rows.forEach((r, i) => {
    const x = L + i * bw + gap, w = Math.max(2, bw - gap * 2), h = Math.max(0, Y(0) - Y(r.v));
    if (h > 0) { const rr = Math.min(4, w / 2, h); el('path', { d: `M${x},${Y(0)}V${Y(r.v) + rr}Q${x},${Y(r.v)} ${x + rr},${Y(r.v)}H${x + w - rr}Q${x + w},${Y(r.v)} ${x + w},${Y(r.v) + rr}V${Y(0)}Z`, fill: i === n - 1 ? C.main : '#5eead4' }, svg); }
    if (i % labelEvery === 0 || i === n - 1) el('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle' }, svg).textContent = r.k;
    const hit = el('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, class: 'hit' }, svg);
    hit.addEventListener('pointermove', (e) => showTip(e, `${r.full || r.k} · ${fmt(r.v)}`)); hit.addEventListener('pointerleave', hideTip);
  });
  if (goal) { el('line', { x1: L, x2: W - R, y1: Y(goal), y2: Y(goal), stroke: C.goal, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg); el('text', { x: W - R, y: Y(goal) - 4, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = `목표 ${goal}분`; }
}
function hbarChart(box, rows, fmt) {
  box.textContent = '';
  if (!rows.length) { box.innerHTML = '<p class="empty" style="padding:14px 8px">최근 30일 운동 기록이 없습니다.</p>'; return; }
  const W = 360, rowH = 24, L = 52, R = 40, H = rows.length * rowH + 6, max = Math.max(...rows.map((r) => r.v));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': rows.map((r) => `${r.k} ${fmt(r.v)}`).join(', ') }, box);
  rows.forEach((r, i) => {
    const y = 3 + i * rowH, w = Math.max(3, (r.v / max) * (W - L - R));
    el('text', { x: L - 6, y: y + 15, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = r.k;
    el('rect', { x: L, y: y + 4, width: w, height: rowH - 9, rx: 4, fill: i === 0 ? C.main : '#5eead4' }, svg);
    el('text', { x: L + w + 5, y: y + 15 }, svg).textContent = fmt(r.v);
    const hit = el('rect', { x: 0, y, width: W, height: rowH, class: 'hit' }, svg);
    hit.addEventListener('pointermove', (e) => showTip(e, `${r.k} · ${fmt(r.v)}`)); hit.addEventListener('pointerleave', hideTip);
  });
}
function drawStats() {
  const P = db.profile, wk = weekDays(), wDays = wk.filter((d) => dayMin(d) > 0).length, wMin = Math.round(wk.reduce((a, d) => a + dayMin(d), 0));
  const monthKey = today().slice(0, 7), mKcal = Object.keys(db.logs).filter((k) => k.startsWith(monthKey)).reduce((a, k) => a + db.logs[k].work.reduce((s, w) => s + (w.kcal || 0), 0), 0);
  const tiles = [
    ['이번 주 운동한 날', wDays, `/ ${P.days}일`, wDays / P.days],
    ['이번 주 운동 시간', wMin, `/ ${P.mins}분`, wMin / P.mins],
    ['연속 운동', streak(), '일', null],
    ['이번 달 소모 열량', Math.round(mKcal).toLocaleString(), 'kcal', null],
  ];
  $('tiles').innerHTML = tiles.map(([a, b, c, f], i) => `<div class="tile" style="animation-delay:${i * 0.04}s"><small>${a}</small><b>${b}<i>${c}</i></b>${f != null ? `<div class="meter"><i style="width:${clamp(f, 0, 1) * 100}%"></i></div>` : ''}</div>`).join('');
  // 체중
  const from = addDays(today(), -60), wPts = Object.keys(db.logs).filter((k) => k >= from && db.logs[k].weight).sort().map((k) => ({ d: k, t: parseYmd(k).getTime() / 864e5, v: db.logs[k].weight }));
  lineChart($('chWeight'), wPts, P.target, 'kg');
  // 주간 시간
  const weeks = [];
  for (let i = 7; i >= 0; i--) { const days = weekDays(addDays(today(), -7 * i)); weeks.push({ k: `${+days[0].slice(5, 7)}/${+days[0].slice(8)}`, full: `${days[0].slice(5).replace('-', '/')} 주`, v: Math.round(days.reduce((a, d) => a + dayMin(d), 0)) }); }
  barChart($('chWeek'), weeks, P.mins, (v) => `${v}분`, 2);
  // 부위별 세트
  const parts = {}, from30 = addDays(today(), -30);
  Object.keys(db.logs).filter((k) => k >= from30).forEach((k) => db.logs[k].work.forEach((w) => (w.items || []).forEach((it) => { const pt = exInfo(it.ex).part; parts[pt] = (parts[pt] || 0) + (it.sets || 0); })));
  hbarChart($('chPart'), Object.entries(parts).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v), (v) => `${v}세트`);
  // 최고 기록
  const best = {};
  Object.keys(db.logs).forEach((k) => db.logs[k].work.forEach((w) => (w.items || []).forEach((it) => {
    if (!it.kg) return; const reps = it.perSet || Math.round((it.reps || 0) / Math.max(1, it.sets)) || 1, rm = it.kg * (1 + reps / 30);
    if (!best[it.ex] || rm > best[it.ex].rm) best[it.ex] = { rm, kg: it.kg, reps, d: k };
  })));
  const rows = Object.entries(best);
  $('bestTbl').innerHTML = rows.length ? `<table class="tbl"><tr><th>운동</th><th>기록</th><th style="text-align:right">추정 1RM</th></tr>${rows.map(([id, b]) => `<tr><td>${exInfo(id).name}</td><td>${b.kg}kg × ${b.reps}회 <small>(${b.d.slice(5).replace('-', '/')})</small></td><td class="n">${b.rm.toFixed(1)}kg</td></tr>`).join('')}</table>` : '<p class="empty">무게를 넣은 운동을 직접 기록하면 1RM을 추정해 보여 줍니다.</p>';
}

/* 목표 탭 */
const BMI_CAT = (b) => (b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '비만 전단계' : b < 30 ? '1단계 비만' : b < 35 ? '2단계 비만' : '3단계 비만');
function drawGoal() {
  const P = db.profile;
  $('gSex').value = P.sex; $('gAge').value = P.age; $('gHeight').value = P.height; $('gWeight').value = lastWeight(); $('gTarget').value = P.target; $('gType').value = P.type; $('gAct').value = String(P.act); $('gDays').value = P.days; $('gMin').value = P.mins;
  const w = lastWeight(), h = P.height / 100, bmi = w / (h * h);
  const bmr = 10 * w + 6.25 * P.height - 5 * P.age + (P.sex === 'm' ? 5 : -161), tdee = bmr * P.act;
  const intake = P.type === 'lose' ? Math.max(bmr, tdee - 500) : P.type === 'muscle' ? tdee + 250 : tdee;
  const prot = [P.type === 'lose' || P.type === 'muscle' ? 1.6 : 1.2, P.type === 'lose' || P.type === 'muscle' ? 2.0 : 1.6];
  const diff = +(w - P.target).toFixed(1), weeks = P.type === 'lose' && diff > 0 ? Math.ceil(diff / 0.5) : 0;
  const good = { lose: '유산소 주 150분 이상 + 근력 주 2~3회로 근육을 지키며 감량', keep: '근력 주 2회 + 유산소 주 150분', muscle: '부위별 주 10세트 이상, 8~12회가 버거운 무게, 단백질 충분히', fit: '서킷과 인터벌로 심폐 체력, 주 3~5회' }[P.type];
  $('goalOut').innerHTML = `<div class="tiles">
    <div class="tile"><small>BMI</small><b>${bmi.toFixed(1)}<i>${BMI_CAT(bmi)}</i></b></div>
    <div class="tile"><small>기초대사량</small><b>${Math.round(bmr).toLocaleString()}<i>kcal</i></b></div>
    <div class="tile"><small>하루 소비량</small><b>${Math.round(tdee).toLocaleString()}<i>kcal</i></b></div>
    <div class="tile"><small>권장 섭취</small><b>${Math.round(intake).toLocaleString()}<i>kcal</i></b></div>
    <div class="tile"><small>단백질</small><b>${Math.round(w * prot[0])}~${Math.round(w * prot[1])}<i>g/일</i></b></div>
    <div class="tile"><small>물</small><b>${(w * 0.03).toFixed(1)}~${(w * 0.035).toFixed(1)}<i>L/일</i></b></div>
  </div>
  <div class="goalCard"><b>${({ lose: '체중 감량', keep: '유지·건강', muscle: '근육 늘리기', fit: '체력 향상' })[P.type]} 계획</b>
    <p>${good}. 주 ${P.days}일 · ${P.mins}분을 목표로 합니다.${weeks ? ` 목표 체중까지 ${diff}kg, 주 0.5kg씩이면 약 ${weeks}주 걸립니다.` : ''}${P.type === 'lose' && diff <= 0 ? ' 목표 체중에 도달했습니다! 유지로 바꿔 보세요.' : ''}</p></div>`;
}
$('gSave').onclick = () => {
  const P = db.profile;
  P.sex = $('gSex').value; P.age = num('gAge') || P.age; P.height = num('gHeight') || P.height; P.target = num('gTarget') || P.target; P.type = $('gType').value; P.act = parseFloat($('gAct').value); P.days = clamp(num('gDays') || P.days, 1, 7); P.mins = num('gMin') || P.mins;
  const w = num('gWeight'); if (w && w !== lastWeight()) { P.weight = w; dayLog(today()).weight = w; }
  save(); drawGoal(); toast('목표를 저장했습니다');
};

/* ───────── 매 프레임 ───────── */
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1) * fast, t = clock.elapsedTime * fast;
  tickSession(dt);
  // 트레이너와 나
  if (sess) {
    const st = sess.steps[sess.i], id = sess.mode === 'work' ? st.ex.id : sess.mode === 'ready' ? st.ex.id : 'stand';
    const ph = sess.mode === 'work' ? sess.ph : 0;
    poseFor(coach, id, ph, sess.rep, t);
    poseFor(me, id, Math.max(0, ph - 0.05), sess.rep, t);   // 나는 코치를 조금 늦게 따라 한다
  } else if (demo) {
    demoT += dt; const e = EXI[demo], ph = (demoT / e.tempo) % 1, rep = Math.floor(demoT / e.tempo);
    poseFor(coach, demo, ph, rep, t); poseFor(me, demo, Math.max(0, ph - 0.05), rep, t);
  } else { poseFor(coach, 'stand', 0, 0, t); poseFor(me, 'stand', 0, 0, t); }
  for (const m of members) {
    const e = EXI[m.ex], tempo = e ? e.tempo * 1.15 : 0.7, tt = t + m.off * 3, ph = (tt / tempo) % 1;
    m.p.yBase = m.y || 0; poseFor(m.p, m.ex, ph, Math.floor(tt / tempo), t);
  }
  for (const p of [coach, me, ...members.map((m) => m.p)]) if (p.bubble.visible && performance.now() / 1000 > p.bubbleUntil) p.bubble.visible = false;
  for (const [p, tag] of [[coach, coachTag], [me, meTag]]) { p.head.getWorldPosition(tag.position); tag.position.y += 0.27; }
  // 카메라
  const k = 1 - Math.exp(-5 * dt / fast);
  cam.th += (camTo.th - cam.th) * k; cam.ph += (camTo.ph - cam.ph) * k; cam.d += (camTo.d - cam.d) * k;
  camera.position.set(cam.look.x + Math.sin(cam.th) * Math.sin(cam.ph) * cam.d, cam.look.y + Math.cos(cam.ph) * cam.d, cam.look.z + Math.cos(cam.th) * Math.sin(cam.ph) * cam.d);
  camera.lookAt(cam.look);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
setView('diag');
// 입력 칸 이름과 단위를 한 줄로
document.querySelectorAll('.formGrid label').forEach((l) => { const sp = document.createElement('span'); while (l.firstChild && !/^(INPUT|SELECT|TEXTAREA)$/.test(l.firstChild.nodeName)) sp.append(l.firstChild); l.prepend(sp); });
showTab('train');
caption('PT GYM에 오신 걸 환영합니다', '오른쪽에서 프로그램을 고르면 코치를 따라 운동합니다. 화면을 끌면 시점이 돕니다');
say(coach, '어서 오세요! 오늘도 시작해 볼까요?', 3);
requestAnimationFrame(frame);
window.gym = { db, coach, me, members, scene, camera, renderer, EX, PROGRAMS, startSession, expand, startDemo, poseFor, setView, state: () => ({ sess: sess && { i: sess.i, mode: sess.mode, rep: sess.rep, left: sess.left, done: sess.done.length }, demo }) };
