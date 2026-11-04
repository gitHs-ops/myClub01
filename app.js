import * as THREE from './vendor/three.min.js';
import { Edm, TRACKS } from './edm.js?v=6';
import { makePerson, updatePerson, goTo, say, jump, setWardrobe } from './people.js?v=5';
import { buildWorld, ROOM, FLOOR, TABLES, BAR_SPOTS } from './world.js?v=7';
import { VENUES } from './venues.js?v=2';
import { listTracks, addTrack, putTrack, removeTrack, isAudioFile, titleOf, analyze } from './mylist.js?v=1';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const now = () => performance.now() / 1000;
const later = (sec, f) => setTimeout(f, sec * 1000);

/* ───── 설정 ───── */
const KEY = 'clubpulse.v1';
const settings = Object.assign({ autoNext: true, volume: 80, tracks: { club: 'neon', live7080: 'gogo' }, lowFx: matchMedia('(prefers-reduced-motion: reduce)').matches }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 사생활 모드 */ } };
const fxState = { full: !settings.lowFx };

/* ───── 어느 줄에 설까: 소리는 누른 순간에 시작해야 한다 ───── */
const edm = new Edm();
edm.setVolume(settings.volume / 100);
const venue = await new Promise((resolve) => {
  document.querySelectorAll('[data-venue]').forEach((b) => {
    b.onclick = () => {
      const v = VENUES[b.dataset.venue], want = settings.tracks[v.id];
      edm.track = TRACKS.find((t) => t.id === want && t.venue === v.id) || TRACKS.find((t) => t.venue === v.id);
      edm.applyTrack();
      edm.start();
      resolve(v);
    };
  });
});
document.title = venue.title;
setWardrobe(venue.wardrobe);

/* ───── 렌더러 ───── */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const lowEnd = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
let pixelRatio = Math.min(devicePixelRatio, lowEnd ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a18);
scene.fog = new THREE.FogExp2(venue.fog, 0.012);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260);
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 68 : 52; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const world = buildWorld(scene, fxState, venue);

/* ───── 사람들 ───── */
const everyone = [];
// 손님은 사람과 블록 캐릭터가 반반이다
let guestCount = 0;
const spawn = (look) => { const p = makePerson(scene, look || { brick: ++guestCount % 2 === 0 }); everyone.push(p); return p; };
const place = (p, x, z, yaw = 0) => { p.x = x; p.z = z; p.yaw = p.yawTo = yaw; p.root.position.set(x, 0, z); };

const player = spawn({ style: 0, top: new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.55 }), bottom: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 }), skirt: false, height: 1 });
player.isPlayer = true;
{
  const c = document.createElement('canvas'); c.width = 96; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = '#4f46e5'; g.beginPath(); g.arc(48, 40, 34, 0, 7); g.fill();
  g.beginPath(); g.moveTo(32, 66); g.lineTo(64, 66); g.lineTo(48, 90); g.fill();
  g.fillStyle = '#fff'; g.font = '800 38px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('나', 48, 42);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
  tag.scale.set(0.28, 0.28, 1); tag.position.y = 2.0; tag.renderOrder = 19; player.root.add(tag);
}
const marker = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; scene.add(marker);
const dest = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
dest.rotation.x = -Math.PI / 2; dest.position.y = 0.045; dest.visible = false; scene.add(dest);

const bouncer = spawn({ style: 0, top: new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.6 }), bottom: new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.6 }), skirt: false, height: 1.1 });
place(bouncer, -1.75, 11.15, 0.8); bouncer.crossTo = 1; bouncer.isStaff = true;
/* 웨이터: 다른 테이블로 보낸 술을 쟁반에 받쳐 가져간다 */
const WAITER_HOME = [9.4, 3.2];
const waiter = spawn({ style: 0, top: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }), bottom: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }), skirt: false, height: 1.02 });
place(waiter, WAITER_HOME[0], WAITER_HOME[1], -Math.PI / 2); waiter.isStaff = true; waiter.speed = 2.6;
const tray = new THREE.Group(); scene.add(tray);
tray.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 24), new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.25, metalness: 0.8 })));
tray.visible = false;
const performers = [];
const STAGE_Y = 1.15;
function performer(look, x, z, armPose, y0 = STAGE_Y) {
  const p = spawn({ skirt: false, brick: true, ...look }); place(p, x, z, 0); p.isStaff = true; p.y0 = y0; p.armPose = armPose; performers.push(p);
  return p;
}
if (!venue.band) {
  performer({ phones: true, style: 4, height: 1 }, 0, -20.45, null);
} else {
  const wood = new THREE.MeshStandardMaterial({ color: 0xb4632a, roughness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x20140c, roughness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.3 });
  const guitar = (p, body) => {
    const g = new THREE.Group(); g.position.set(0, 0.2, 0.15); g.rotation.z = 0.5;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 18), body); b.rotation.x = Math.PI / 2; b.position.x = 0.12; b.scale.set(1.25, 1, 1); g.add(b);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.025), dark); n.position.x = -0.3; g.add(n);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.025), dark); h.position.x = -0.61; g.add(h);
    p.torso.add(g);
  };
  const strum = (b) => { const k = Math.sin(b * Math.PI * 2); return [[-1.02, 0.62, -0.1, -0.72], [-0.5 + k * 0.1, 0.24, -0.42, -1.42 + k * 0.28]]; };
  const singer = performer({ style: 1, top: new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.55 }), height: 1 }, 0, -18.45, (b) => { const k = Math.sin(b * Math.PI); return [[-1.3 + k * 0.35, 0.55, 0, -0.45], [-0.95, 0.28, -0.58, -2.05]]; });
  const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.1, 4, 8), dark); mic.position.set(0, -0.09, 0.02); singer.arms[1].h.add(mic);
  singer.danceStyle = 0;
  guitar(performer({ style: 0, height: 1 }, 3.3, -19.4, strum), wood);
  guitar(performer({ style: 3, height: 1 }, -3.3, -19.4, strum), red);
  performer({ style: 0, height: 1 }, -5.7, -18.75, (b, t) => [[-1.08, 0.16, -0.12, -0.55 + Math.sin(t * 9) * 0.1], [-1.08, 0.16, -0.12, -0.55 + Math.sin(t * 9 + 2) * 0.1]]);
  performer({ style: 0, height: 1 }, 0, -21.85, (b) => { const k = Math.abs(Math.sin(b * Math.PI * 2)), l = Math.abs(Math.cos(b * Math.PI * 2)); return [[-1.15 - l * 0.42, 0.28, -0.28, -1.05], [-1.15 - k * 0.42, 0.28, -0.28, -1.05]]; }, 1.49);
}
[[12.75, -9], [12.75, -1.5]].forEach(([x, z]) => { const b = spawn({ top: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }), skirt: false }); place(b, x, z, -Math.PI / 2); b.isStaff = true; b.talkTo = 0.6; });

/* 음료 */
const cupGlass = new THREE.CylinderGeometry(0.05, 0.04, 0.15, 14, 1, true);
const fluidG = new THREE.CylinderGeometry(0.046, 0.037, 0.13, 14); fluidG.translate(0, 0.065, 0);
const strawG = new THREE.CylinderGeometry(0.005, 0.005, 0.22, 6);
const strawM = new THREE.MeshBasicMaterial({ color: 0xffffff });
const glassM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
const handleG = new THREE.TorusGeometry(0.036, 0.008, 6, 14);
function makeCup(d) {
  const g = new THREE.Group(), [sx, sy] = d.glass || [1, 1];
  g.add(new THREE.Mesh(cupGlass, glassM));
  const fluid = new THREE.Mesh(fluidG, new THREE.MeshBasicMaterial({ color: d.color, toneMapped: false })); fluid.position.y = -0.068; g.add(fluid);
  if (!d.noStraw) { const straw = new THREE.Mesh(strawG, strawM); straw.position.set(0.018, 0.04, 0); straw.rotation.z = -0.22; g.add(straw); }
  if (d.mug) { const h = new THREE.Mesh(handleG, glassM); h.position.set(0, 0, 0.056); h.rotation.y = Math.PI / 2; g.add(h); }
  g.scale.set(sx, sy, sx);
  // 입에 닿는 곳: 빨대 끝, 빨대가 없으면 잔의 가장자리 (잔 안쪽 좌표)
  g.userData = { fluid, tilt: d.noStraw ? 0.95 : 0.22, grip: 0.05 * sx - 0.015, lip: d.noStraw ? new THREE.Vector3(0.05 * sx, 0.075 * sy, 0) : new THREE.Vector3(0.042 * sx, 0.148 * sy, 0) };
  scene.add(g);
  return g;
}
/* 잔은 언제나 똑바로 서 있고, 마실 때만 입 쪽으로 기운다 */
const cupF = new THREE.Vector3(), cupHand = new THREE.Vector3(), cupMouth = new THREE.Vector3(), cupLip = new THREE.Vector3(), cupAxis = new THREE.Vector3();
const cupYaw = new THREE.Quaternion(), cupTilt = new THREE.Quaternion(), CUP_REST = new THREE.Quaternion(), Y_AXIS = new THREE.Vector3(0, 1, 0);
function holdCup(p, cup) {
  const u = cup.userData, k = clamp((p.sip - 0.4) / 0.6, 0, 1), m = k * k * (3 - 2 * k) * (1 - p.hifive);
  p.root.getWorldDirection(cupF); cupF.y = 0; cupF.normalize();
  cupYaw.setFromAxisAngle(Y_AXIS, Math.atan2(cupF.z, -cupF.x));
  cupAxis.set(-cupF.z, 0, cupF.x);
  cupTilt.setFromAxisAngle(cupAxis, u.tilt * m);
  cup.quaternion.multiplyQuaternions(cupTilt, cupYaw);
  p.arms[1].h.localToWorld(cupHand.set(0, -0.02, 0)).addScaledVector(cupF, u.grip);
  p.head.localToWorld(cupMouth.set(0, -0.05, 0.14));
  cupLip.copy(u.lip).applyQuaternion(cup.quaternion);
  cup.position.lerpVectors(cupHand, cupMouth.sub(cupLip), m);
}
const DRINKS = venue.drinks;

const CROWD_FLOOR = lowEnd ? 15 : 24, CROWD_TABLE = lowEnd ? 6 : 10, CROWD_BAR = lowEnd ? 2 : 4;
const npcs = [];
const npcCups = (p, d = pick(DRINKS)) => {
  p.cup = makeCup(d);
};
const floorSpot = () => [rand(FLOOR.xMin + 1, FLOOR.xMax - 1), rand(FLOOR.zMin + 1, FLOOR.zMax - 0.5)];
function freeFloorSpot() {
  for (let i = 0; i < 24; i++) {
    const [x, z] = floorSpot();
    if (everyone.every((o) => o === player || Math.hypot(o.x - x, o.z - z) > 1.05)) return [x, z];
  }
  return floorSpot();
}
const yawToStage = (x, z) => Math.atan2(-x * 0.32, -17 - z - 2);
function setRole(p, role) {
  p.role = role; p.nextAct = now() + rand(2, 14);
  if (role === 'floor') { p.danceTo = 1; p.danceStyle = pick(venue.styles); }
}
function dancerAt(p, x, z) { place(p, x, z, yawToStage(x, z)); setRole(p, 'floor'); p.danceTo = 1; p.dance = 1; }

for (let i = 0; i < CROWD_FLOOR; i++) { const p = spawn(); npcs.push(p); const [x, z] = freeFloorSpot(); dancerAt(p, x, z); }
const tableFree = TABLES.map((T) => ({ T, n: 0 }));
for (let i = 0; i < CROWD_TABLE; i++) {
  // 스탠딩 테이블 둘에 한 곳은 비워 둔다: 플레이어가 설 자리
  const open = tableFree.filter((q, ix) => ix % 2 === 1 && q.n < 3);
  if (!open.length) break;
  const q = open[i % open.length], a = q.n * 2.1 + q.T.i, p = spawn(); npcs.push(p); q.n++;
  place(p, q.T.x + Math.sin(a) * 0.82, q.T.z + Math.cos(a) * 0.82, a + Math.PI);
  q.T.by = 'npc'; setRole(p, 'table'); p.danceTo = 1; p.danceStyle = 0; p.groove = 0.45; npcCups(p);
  p.talkTo = 0;
}
for (let i = 0; i < CROWD_BAR; i++) {
  const s = BAR_SPOTS[i * 2 % BAR_SPOTS.length], p = spawn(); npcs.push(p); s.by = p;
  place(p, s.x, s.z, Math.PI / 2 + rand(-0.3, 0.3)); setRole(p, 'bar'); npcCups(p); p.danceTo = 1; p.danceStyle = 0; p.groove = 0.3;
}

/* 충돌: 가구와 사람. 플레이어는 군중을 살짝 밀며 지나간다 */
const PERSON_R = 0.4;
function collide(p) {
  if (p.isStaff || p.inLine) return;
  for (const T of TABLES) {
    const dx = p.x - T.x, dz = p.z - T.z, d = Math.hypot(dx, dz), R = 0.62;
    if (d < R && d > 1e-3) { p.x = T.x + (dx / d) * R; p.z = T.z + (dz / d) * R; }
  }
  if (p.target || p.isPlayer) {
    for (const o of everyone) {
      if (o === p || o.isStaff || o.inLine) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      if (d < PERSON_R * 2 && d > 1e-3) {
        const push = PERSON_R * 2 - d, ux = dx / d, uz = dz / d;
        if (p.isPlayer && !o.isPlayer) { o.x -= ux * push; o.z -= uz * push; }
        else if (o.isPlayer) { p.x += ux * push; p.z += uz * push; }
        else { p.x += ux * push * 0.5; p.z += uz * push * 0.5; o.x -= ux * push * 0.5; o.z -= uz * push * 0.5; }
      }
    }
  }
  if (p.free !== true && p.z < ROOM.zMax + 0.4) {
    p.x = clamp(p.x, ROOM.xMin, ROOM.xMax); p.z = clamp(p.z, ROOM.zMin, ROOM.zMax + 0.4);
  }
}

/* ───── 카메라와 입력 ───── */
const cam = { theta: 0.82, phi: 1.46, dist: 8.2, thetaTo: 0.82, phiTo: 1.46, distTo: 8.2, x: 0, y: 2, z: 0, lookY: 2, auto: true };
const camSet = (theta, phi, dist, lookY = 1.4) => { cam.thetaTo = theta; cam.phiTo = phi; cam.distTo = dist; cam.lookY = lookY; cam.auto = true; };
let moved = 0, pointers = new Map(), pinch = 0;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const q = pointers.get(e.pointerId); if (!q) return;
  const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) cam.distTo = clamp(cam.distTo * (pinch / d), 2.6, 13);
    pinch = d; moved = 99; return;
  }
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 6) { cam.auto = false; cam.thetaTo -= dx * 0.0062; cam.phiTo = clamp(cam.phiTo - dy * 0.0042, 0.62, 1.56); }
});
const endPtr = (e) => {
  const was = pointers.has(e.pointerId), single = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (was && single && moved <= 6 && e.type === 'pointerup') tapFloor(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.distTo = clamp(cam.distTo * (1 + e.deltaY * 0.001), 2.6, 13); }, { passive: false });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function tapFloor(cx, cy) {
  if (!freeWalk()) return;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(groundPlane, hitP)) return;
  const near = TABLES.find((T) => Math.hypot(T.x - hitP.x, T.z - hitP.z) < 0.8);
  if (near) { walkToTable(near); return; }
  walkPlayer(clamp(hitP.x, ROOM.xMin, ROOM.xMax), clamp(hitP.z, ROOM.zMin, ROOM.zMax));
}
const keys = new Set();
addEventListener('keydown', (e) => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && freeWalk() && !modalOpen()) { keys.add(e.code); e.preventDefault(); } if (e.code === 'Escape') closeModals(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/* ───── 화면 ───── */
const modalOpen = () => !$('drinkModal').hidden || !$('settingsModal').hidden || !$('exitModal').hidden || !$('myListModal').hidden;
const closeModals = () => { $('drinkModal').hidden = true; $('settingsModal').hidden = true; $('exitModal').hidden = true; $('myListModal').hidden = true; };
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeModals; });
document.querySelectorAll('.modalBack').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) closeModals(); }));
let toastT;
const toast = (msg, sec = 2.4) => { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), sec * 1000); };
const caption = (main, sub = '') => { const el = $('caption'); const html = `${main}${sub ? `<small>${sub}</small>` : ''}`; if (el.dataset.t !== html) { el.dataset.t = html; el.innerHTML = html; } };
const setStep = (n) => {
  step = Math.max(step, n);
  document.querySelectorAll('#steps li').forEach((li) => { const k = +li.dataset.step; li.classList.toggle('on', k === step); li.classList.toggle('done', k < step); });
};
function actions(list) {
  const box = $('actions'), sig = list.map((a) => `${a.label}|${a.primary ? 1 : 0}|${a.on ? 1 : 0}|${a.disabled ? 1 : 0}`).join(',');
  if (box.dataset.sig === sig) { [...box.children].forEach((b, i) => { b.onclick = list[i].fn; }); return; }
  box.dataset.sig = sig; box.textContent = '';
  list.forEach((a) => {
    const b = document.createElement('button');
    b.className = `btn${a.primary ? ' primary' : ''}${a.on ? ' on' : ''}`; b.textContent = a.label; b.disabled = !!a.disabled; b.onclick = a.fn;
    if (a.on !== undefined) b.setAttribute('aria-pressed', String(!!a.on));
    box.append(b);
  });
}

/* ───── 진행 ───── */
let phase = 'gate', step = 0;
let grooving = false, grooveLevel = 0, grooveBeats = 0, lastBeatInt = -1;
let queue = [], queueTimer = 0, queueBusy = false;
const myDrink = { cup: null, def: null, level: 0, table: null, pos: new THREE.Vector3(), sipUntil: 0, sips: 0 };
let myTable = null, mingling = [], hi5 = 0, stageArrived = false;

const freeWalk = () => phase === 'room';
const inTableReach = () => myTable && Math.hypot(player.x - myTable.x, player.z - myTable.z) < 1.2;
const onFloor = () => player.x > FLOOR.xMin && player.x < FLOOR.xMax && player.z > FLOOR.zMin - 0.5 && player.z < FLOOR.zMax;

/* 1. 줄서기 */
const LINE_X = (i) => 1.15 + i * 1.02, LINE_Z = 11.55;
function setupQueue() {
  queue = [];
  const AHEAD = 2;   // 처음 내 앞 대기 인원
  for (let i = 0; i < AHEAD; i++) {
    const p = spawn(); p.inLine = true; p.lineChat = rand(2, 9); place(p, LINE_X(i), LINE_Z, -Math.PI / 2 + rand(-0.15, 0.15));
    p.danceStyle = 0; p.groove = 0.32; p.danceTo = 1;
    if (i % 2 === 0) { p.crossTo = 0; p.talkTo = 0.6; }
    queue.push(p);
  }
  queue.push(player); player.inLine = true; player.free = true;
  place(player, LINE_X(AHEAD), LINE_Z, -Math.PI / 2);
  for (let i = AHEAD + 1; i < AHEAD + 3; i++) { const p = spawn(); p.inLine = true; place(p, LINE_X(i) + 4, LINE_Z, -Math.PI / 2); p.danceStyle = 0; p.groove = 0.32; p.danceTo = 0; p.lineChat = rand(5, 12); queue.push(p); }
  layQueue();
  queueTimer = 3.4;
}
function layQueue() {
  queue.forEach((p, i) => {
    if (p === player) { goTo(player, LINE_X(i), LINE_Z, () => { player.yawTo = -Math.PI / 2; player.danceTo = grooving ? 1 : 0; }); return; }
    const dance = p.danceTo;
    goTo(p, LINE_X(i), LINE_Z, () => { p.yawTo = -Math.PI / 2 + rand(-0.15, 0.15); p.danceTo = dance || 1; });
  });
}
function npcEnters(p) {
  queue.shift(); queueBusy = true; p.free = true; p.danceTo = 0;
  goTo(p, 0.75, 11.4, () => {
    p.yawTo = -1.4; p.showIdTo = 1; say(bouncer, `${venue.ticket} 부탁합니다`, 1.4);
    bouncer.crossTo = 0; bouncer.yawTo = 1.2;
    later(1.3, () => {
      p.showIdTo = 0; edm.stamp(); say(bouncer, '들어가세요', 1.2); world.setDoor(true); edm.door();
      p.inLine = false;
      goTo(p, 0, 8, () => { if (phase === 'queue') world.setDoor(false); goTo(p, 0, 5.2, () => {
        p.free = false; npcs.push(p);
        const [x, z] = freeFloorSpot();
        goTo(p, x, z, () => { p.yawTo = yawToStage(p.x, p.z); setRole(p, 'floor'); });
      }); });
      bouncer.crossTo = 1; bouncer.yawTo = 0.8;
      queueBusy = false; layQueue();
      queueTimer = 3.2;
    });
  });
}
function renderQueue() {
  const ahead = queue.indexOf(player);
  caption(ahead > 0 ? `앞에 <b>${ahead}명</b> 남았습니다. 줄이 줄어들 때까지 기다리세요` : '곧 차례입니다', venue.queueHint);
  actions([
    { label: grooving ? '가만히 있기' : '줄 서서 건들거리기', on: grooving, fn: () => { grooving = !grooving; player.danceStyle = 0; player.groove = 0.4; renderUi(); } },
    { label: '앞사람에게 말 걸기', fn: () => {
      const i = queue.indexOf(player), o = queue[i - 1] || queue[i + 1];
      if (!o) return;
      say(player, pick(venue.myLine), 2.2);
      player.waveTo = 1; later(0.8, () => { player.waveTo = 0; });
      later(1.1, () => { o.yawTo = Math.atan2(player.x - o.x, player.z - o.z); say(o, pick(venue.replyLine), 2.4); later(3, () => { o.yawTo = -Math.PI / 2; }); });
    } },
  ]);
}
function atDoor() {
  phase = 'door'; setStep(2); player.danceTo = 0; grooving = false; player.free = true;
  queue.shift();
  goTo(player, 0.75, 11.4, () => {
    player.yawTo = -1.3; bouncer.crossTo = 0; bouncer.yawTo = 1.2;
    say(bouncer, `${venue.ticket} 보여 주시겠어요?`, 3.5);
    phase = 'id'; renderUi();
  });
  camSet(0.5, 1.42, 5.4, 1.7); renderUi();
}
/* 2. 입장 */
function showId() {
  phase = 'stamping'; player.showIdTo = 1; renderUi();
  later(1.25, () => {
    player.showIdTo = 0; edm.stamp();
    say(bouncer, '확인했습니다. 즐거운 시간 되세요!', 3); toast('손등에 입장 도장을 받았습니다');
    phase = 'canEnter'; renderUi();
  });
}
function enterClub() {
  phase = 'entering'; renderUi();
  world.setDoor(true); edm.door(); player.inLine = false; bouncer.crossTo = 1; bouncer.yawTo = 0.8;
  camSet(0, 1.42, 4, 1.5);
  player.run = false;
  goTo(player, 0, 9.3, () => {
    edm.setRoom(1);
    goTo(player, 0, 5.4, () => {
      edm.setRoom(2); world.setDoor(false);
      toast(venue.enterToast, 2.6);
      goTo(player, 0, -0.8, () => {
        player.free = false; phase = 'room'; setStep(3); camSet(0, 1.42, 5.6, 1.6); renderUi();
      });
    });
  });
}
/* 3. 스탠딩 테이블과 음료 */
function nearestFreeTable() {
  let best = null, bd = 1e9;
  for (const T of TABLES) { if (T.by === 'npc') continue; const d = Math.hypot(T.x - player.x, T.z - player.z); if (d < bd) { bd = d; best = T; } }
  return best || TABLES[0];
}
/* 마지막으로 하이파이브한 사람은 테이블과 스테이지를 함께 오간다 */
let buddy = null;
function buddyToTable(T, px, pz) {
  if (!buddy) return;
  const n = buddy, d = Math.hypot(px - T.x, pz - T.z) || 1, sx = T.x - ((px - T.x) / d) * 0.8, sz = T.z - ((pz - T.z) / d) * 0.8;
  n.mingle = false; mingling = mingling.filter((m) => m !== n);
  n.upTo = 0; n.role = 'table'; n.speed = Math.max(n.speed, player.speed);
  say(n, pick(['좋아요, 같이 가요!', '목 좀 축여요!', '저도 한 잔 할게요!']), 2);
  const settle = (tries) => {
    if (Math.hypot(n.x - sx, n.z - sz) > 1.2 && tries > 0) { goTo(n, sx, sz, () => settle(tries - 1)); return; }
    n.yawTo = Math.atan2(T.x - n.x, T.z - n.z);
    if (!n.cup) npcCups(n);
    n.danceTo = 1; n.danceStyle = 0; n.groove = 0.45; n.talkTo = 0.5; n.nextAct = now() + rand(3, 8);
    say(n, pick(venue.tableTalk), 2.4);
  };
  goTo(n, sx, sz, () => settle(2));
}
function buddyToStage(x, z) {
  if (!buddy) return;
  const n = buddy, a = rand(0, 6.28), sx = clamp(x + Math.sin(a) * 1.1, FLOOR.xMin + 0.5, FLOOR.xMax - 0.5), sz = clamp(z + Math.cos(a) * 1.1, ROOM.zMin, FLOOR.zMax - 0.3);
  n.talkTo = 0; n.speed = Math.max(n.speed, player.speed);
  say(n, pick(venue.hellos), 2);
  goTo(n, sx, sz, () => { n.yawTo = Math.atan2(player.x - n.x, player.z - n.z); setRole(n, 'floor'); n.nextAct = now() + rand(8, 20); });
}
function walkPlayer(x, z, done = null) {
  stopMingle(x, z);
  dest.position.set(x, 0.045, z); dest.visible = true;
  goTo(player, x, z, () => { dest.visible = false; done?.(); renderUi(); });
  renderUi();
}
function walkToTable(T) {
  const dirX = player.x - T.x, dirZ = player.z - T.z, d = Math.hypot(dirX, dirZ) || 1;
  const x = T.x + (dirX / d) * 0.72, z = T.z + (dirZ / d) * 0.72;
  if (T.by === 'npc') { toast('다른 손님들이 쓰는 테이블입니다. 함께 서 볼까요?', 2.2); }
  myTable = T;
  buddyToTable(T, x, z);
  camSet(clamp(-T.x * 0.05, -0.5, 0.5), 1.38, 4.6, 1.35);
  walkPlayer(x, z, () => {
    player.yawTo = Math.atan2(T.x - player.x, T.z - player.z);
    if (myDrink.table !== T && myDrink.cup) placeCupOnTable(T);
    if (!myDrink.def) { caption('어떤 음료로 할까요?'); openDrinks(); }
    if (step < 3) setStep(3);
  });
}
function openDrinks(offer = false) {
  const box = $('drinkList'); box.textContent = '';
  const send = offer && offer.send;
  $('drinkTitle').textContent = send ? `${send.i + 1}번 테이블에 무엇을 보낼까요?` : offer ? '무엇을 권할까요?' : '음료·주류 고르기';
  $('drinkDesc').textContent = send ? '그 테이블 손님 모두에게 한 잔씩 갑니다.' : offer ? '같이 온 분의 잔으로 가져다 드립니다.' : '테이블로 가져다 드립니다.';
  DRINKS.forEach((d) => {
    const b = document.createElement('button'); b.className = 'listBtn';
    const s = document.createElement('span'); s.className = 'swatch'; s.style.background = `#${d.color.toString(16).padStart(6, '0')}`;
    const t = document.createElement('span'); const st = document.createElement('strong'); st.textContent = d.name; const sm = document.createElement('small'); sm.textContent = d.desc; t.append(st, sm);
    b.append(s, t); b.onclick = () => { closeModals(); if (send) sendDrink(send, d); else if (offer) offerDrink(d); else orderDrink(d); };
    box.append(b);
  });
  $('drinkModal').hidden = false;
}
function placeCupOnTable(T) {
  const k = Math.atan2(player.x - T.x, player.z - T.z) + 0.75;
  myDrink.pos.set(T.x + Math.sin(k) * 0.24, 1.17, T.z + Math.cos(k) * 0.24);
  myDrink.table = T;
  myDrink.cup.position.copy(myDrink.pos);
}
function orderDrink(d) {
  if (myDrink.cup) { myDrink.cup.parent?.remove(myDrink.cup); }
  myDrink.def = d; myDrink.level = 1; myDrink.cup = makeCup(d); player.sipHigh = !!d.noStraw;
  placeCupOnTable(myTable || nearestFreeTable());
  edm.clink(); toast(`${d.name} 나왔습니다`); renderUi();
}
/* 같이 온 사람에게 권하기: 새 잔을 건네고, 내 잔이 있으면 함께 건배한다 */
let offering = false;
const buddyHere = () => !!buddy && buddy.role === 'table' && !buddy.target && Math.hypot(buddy.x - player.x, buddy.z - player.z) < 2.6;
function offerDrink(d) {
  const n = buddy;
  if (!buddyHere() || offering) return;
  offering = true; n.nextAct = now() + 12;
  player.yawTo = Math.atan2(n.x - player.x, n.z - player.z); n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
  say(player, `${d.name} 한 잔 어때요?`, 2);
  renderUi();
  later(1.6, () => {
    n.cup?.parent?.remove(n.cup);
    npcCups(n, d); edm.clink();
    say(n, pick(['좋죠, 고마워요!', '잘 마실게요!', '센스 있으시네요!']), 2);
    toast(`${d.name} 나왔습니다`);
  });
  later(3.6, () => {
    const cheers = venue.band ? '위하여!' : '건배!', together = myDrink.cup && myDrink.level > 0 && !player.sipTo;
    say(n, cheers, 1.6);
    if (together) { say(player, cheers, 1.6); sip(); }
    edm.clink();
    n.sipTo = 1;
    later(1.7, () => {
      n.sipTo = 0; n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
      if (n.cup) n.cup.userData.fluid.scale.y = 0.8;
      offering = false; renderUi();
    });
  });
}
/* 다른 테이블로 한 잔 보내기 */
let sending = false;
const guestsAt = (T) => npcs.filter((n) => n.role === 'table' && !n.target && Math.hypot(n.x - T.x, n.z - T.z) < 1.3);
function openSend() {
  const box = $('drinkList'); box.textContent = '';
  $('drinkTitle').textContent = '어느 테이블로 보낼까요?';
  $('drinkDesc').textContent = '테이블 위 번호를 보고 고르세요. 웨이터가 가져다 드립니다.';
  TABLES.forEach((T) => {
    const mine = T === myTable && inTableReach(), g = mine ? [] : guestsAt(T);
    const b = document.createElement('button'); b.className = 'listBtn'; b.disabled = !g.length;
    const s = document.createElement('span'); s.className = 'swatch tableNo'; s.textContent = T.i + 1;
    const t = document.createElement('span'); const st = document.createElement('strong'); st.textContent = `${T.i + 1}번 테이블`;
    const sm = document.createElement('small'); sm.textContent = mine ? '내 테이블' : g.length ? `손님 ${g.length}명` : '비어 있음'; t.append(st, sm);
    b.append(s, t); b.onclick = () => openDrinks({ send: T });
    box.append(b);
  });
  $('drinkModal').hidden = false;
}
function sendDrink(T, d) {
  const g = guestsAt(T);
  if (!g.length || sending) return;
  sending = true; renderUi();
  toast(`${T.i + 1}번 테이블로 ${d.name} ${g.length}잔을 주문했습니다`, 2.4);
  // 쟁반 위 잔
  tray.children.slice(1).forEach((c) => tray.remove(c));
  g.forEach((n, i) => { const c = makeCup(d); scene.remove(c); c.position.set(Math.sin(i * 2.1) * 0.09, 0.08 * (d.glass?.[1] || 1), Math.cos(i * 2.1) * 0.09); tray.add(c); });
  const k = Math.atan2(player.x - T.x, player.z - T.z) + 1.6, sx = T.x + Math.sin(k) * 0.95, sz = T.z + Math.cos(k) * 0.95;
  later(1.2, () => {
    waiter.showIdTo = 1; tray.visible = true;
    goTo(waiter, sx, sz, () => {
      waiter.yawTo = Math.atan2(T.x - waiter.x, T.z - waiter.z);
      say(waiter, '저쪽 손님이 보내셨습니다', 2.2);
      later(1.2, () => {
        tray.visible = false; waiter.showIdTo = 0; edm.clink();
        g.forEach((n) => { n.cup?.parent?.remove(n.cup); npcCups(n, d); n.nextAct = now() + 14; n.yawTo = Math.atan2(player.x - n.x, player.z - n.z); n.talkTo = 0; });
        later(0.9, () => {
          say(g[0], pick(venue.band ? [`${T.i + 1}번 테이블, 잘 마실게요!`, '고맙습니다! 위하여!'] : [`${T.i + 1}번 테이블, 땡큐!`, '잘 마실게요! 건배!']), 2.4);
          g.forEach((n, i) => { n.waveTo = 1; later(1.4, () => { n.waveTo = 0; later(0.3 + i * 0.2, () => { n.sipTo = 1; later(1.5, () => { n.sipTo = 0; }); }); }); });
          toast(`${T.i + 1}번 테이블에서 고맙다고 손을 흔듭니다`, 2.6);
          say(player, venue.band ? '위하여!' : '건배!', 1.4);
          if (myDrink.cup && myDrink.level > 0 && inTableReach() && !player.sipTo) later(1.6, sip);
        });
        later(2, () => { sending = false; renderUi(); });
        goTo(waiter, WAITER_HOME[0], WAITER_HOME[1], () => { waiter.yawTo = -Math.PI / 2; });
      });
    });
  });
}
function sip() {
  if (!myDrink.cup || myDrink.level <= 0 || player.sipTo) return;
  player.yawTo = Math.atan2(myDrink.pos.x - player.x, myDrink.pos.z - player.z);
  player.sipTo = 1; myDrink.sipUntil = now() + 1.75;
  later(0.68, () => edm.sip());
  later(1.75, () => {
    player.sipTo = 0; myDrink.level = Math.max(0, myDrink.level - 0.2); myDrink.sips++;
    myDrink.cup.userData.fluid.scale.y = Math.max(0.02, myDrink.level);
    later(0.5, () => edm.clink());
    if (myDrink.sips === 1) {
      toast('시원합니다'); setStep(4);
    }
    if (myDrink.level <= 0) toast('다 마셨습니다');
    renderUi();
  });
  renderUi();
}
/* 4. 건들거리기 */
const GROOVES = [{ name: '살짝', style: 0, g: 0.5 }, { name: '리듬 타기', style: 0, g: 1.0 }, { name: '신나게', style: 1, g: 1.2 }];
function toggleGroove() {
  grooving = !grooving;
  if (grooving) applyGroove(); else player.danceTo = 0;
  renderUi();
}
function applyGroove() { const g = GROOVES[grooveLevel]; player.danceStyle = g.style; player.groove = g.g; }
function nextGrooveLevel() {
  grooveLevel = (grooveLevel + 1) % GROOVES.length; applyGroove();
  if (!grooving) grooving = true;
  renderUi();
}
/* 5. 메인 스테이지와 어울리기 */
function goStage() {
  camSet(0.18, 1.45, 6.4, 1.75);
  let best = [0, -12], bd = 0;
  for (let i = 0; i < 16; i++) {
    const x = rand(-4, 4), z = rand(-14.5, -11);
    const near = Math.min(...npcs.filter((n) => n.role === 'floor').map((n) => Math.hypot(n.x - x, n.z - z)));
    if (near > bd) { bd = near; best = [x, z]; }
  }
  setStep(5);
  buddyToStage(best[0], best[1]);
  walkPlayer(best[0], best[1], () => {
    player.yawTo = 0 + Math.PI;
    edm.setRoom(3); stageArrived = true;
    grooving = true; if (grooveLevel === 0) grooveLevel = 1; applyGroove();
    toast('메인 스테이지 앞입니다. 이웃과 어울려 보세요', 3);
    renderUi();
  });
}
const HELLOS = venue.hellos;
function mingle() {
  stopMingle();
  const near = npcs.filter((n) => n.role === 'floor' && !n.target && Math.hypot(n.x - player.x, n.z - player.z) < 7).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 5);
  if (!near.length) { toast('주변에 사람이 없습니다. 플로어 쪽으로 가 보세요'); return; }
  const base = rand(0, 6);
  near.forEach((n, i) => {
    const a = base + (i / near.length) * Math.PI * 2, x = clamp(player.x + Math.sin(a) * 1.45, FLOOR.xMin + 0.5, FLOOR.xMax - 0.5), z = clamp(player.z + Math.cos(a) * 1.45, ROOM.zMin, FLOOR.zMax - 0.3);
    n.danceTo = 0; n.mingle = true;
    goTo(n, x, z, () => {
      n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
      n.danceTo = 1; n.danceStyle = pick(venue.mingleStyles); n.groove = 1.1;
    });
    later(0.3 + i * 1.1, () => { if (n.mingle) say(n, HELLOS[(i + Math.floor(base * 10)) % HELLOS.length], 2.3); });
  });
  mingling = near; camSet(cam.thetaTo, 1.34, 7.4, 1.9);
  grooving = true; applyGroove();
  say(player, '안녕하세요!', 1.8); player.waveTo = 1; later(1.1, () => { player.waveTo = 0; });
  renderUi();
}
function stopMingle(x = null, z = null) {
  const keep = x != null && Math.hypot(x - player.x, z - player.z) < 2.6;
  if (keep) return;
  mingling.forEach((n) => { n.mingle = false; });
  mingling = []; renderUi();
}
function handsUp() {
  player.upTo = player.upTo ? 0 : 1;
  if (player.upTo) { mingling.forEach((n, i) => later(0.15 * i, () => { n.upTo = 1; })); later(3.4, () => { player.upTo = 0; mingling.forEach((n) => { n.upTo = 0; }); renderUi(); }); }
  else mingling.forEach((n) => { n.upTo = 0; });
  renderUi();
}
function doJump() { jump(player); mingling.forEach((n, i) => later(0.08 * i, () => jump(n))); }
function highFive() {
  const pool = mingling.length ? mingling : npcs;
  const near = pool.map((n) => ({ n, d: Math.hypot(n.x - player.x, n.z - player.z) })).sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > 2.8) { toast('하이파이브할 사람이 가까이에 없습니다'); return; }
  const n = near.n;
  buddy = n;
  // 서로 손이 닿는 거리까지 다가선다
  const ux = (player.x - n.x) / near.d, uz = (player.z - n.z) / near.d;
  n.target = null; n.onArrive = null; goTo(n, player.x - ux * 0.84, player.z - uz * 0.84, () => { n.yawTo = Math.atan2(player.x - n.x, player.z - n.z); n.danceTo = 1; }); n.run = true; later(0.5, () => { n.run = false; });
  player.yawTo = Math.atan2(n.x - player.x, n.z - player.z); n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
  player.hifiveTo = 1; n.hifiveTo = 1;
  later(0.42, () => { edm.highFive(); hi5++; toast(`하이파이브 ${hi5}회!`, 1.4); say(n, pick(['예이!', '나이스!', '좋아요!']), 1.3); });
  later(0.8, () => { player.hifiveTo = 0; n.hifiveTo = 0; });
}

/* 동작 버튼과 안내 */
function renderUi() {
  if (phase === 'queue') return renderQueue();
  if (phase === 'door') { caption('차례가 왔습니다. 입구로 갑니다'); return actions([]); }
  if (phase === 'id') { caption(`입구에서 ${venue.ticket}을 확인합니다`); return actions([{ label: `${venue.ticket} 보여 주기`, primary: true, fn: showId }]); }
  if (phase === 'stamping') { caption('확인 중입니다'); return actions([]); }
  if (phase === 'canEnter') { caption('문이 열립니다'); return actions([{ label: '입장하기', primary: true, fn: enterClub }]); }
  if (phase === 'entering') { caption('복도를 지나갑니다. 소리가 점점 커집니다'); return actions([]); }
  if (phase !== 'room') return;

  const list = [];
  const atTable = inTableReach();
  const hasCup = !!myDrink.cup;
  if (!atTable && (!myTable || !hasCup || step < 4)) list.push({ label: '스탠딩 테이블로 가기', primary: step === 3, fn: () => walkToTable(myTable || nearestFreeTable()) });
  if (atTable && !hasCup) list.push({ label: '음료 고르기', primary: true, fn: () => openDrinks() });
  if (atTable && hasCup) {
    if (myDrink.level > 0) list.push({ label: player.sipTo ? '마시는 중' : `한 모금 마시기 (${Math.round(myDrink.level * 100)}%)`, primary: step === 3, disabled: !!player.sipTo, fn: sip });
    else list.push({ label: '한 잔 더', fn: () => openDrinks() });
  }
  if (step >= 3 && !player.target) list.push({ label: sending ? '보내는 중' : '다른 테이블에 한 잔 보내기', disabled: sending, fn: openSend });
  if (atTable && buddyHere()) list.push({ label: offering ? '권하는 중' : '같이 온 분에게 권하기', disabled: offering, fn: () => openDrinks(true) });
  if (myDrink.sips > 0 || step >= 4) {
    list.push({ label: grooving ? '건들거리기 멈추기' : '건들거리기', primary: step === 4 && !grooving, on: grooving, fn: toggleGroove });
    if (grooving) list.push({ label: `흥: ${GROOVES[grooveLevel].name}`, fn: nextGrooveLevel });
  }
  if (step >= 4 && !onFloor() && !player.target) {
    list.push({ label: '메인 스테이지로 가기', primary: grooveBeats >= 8, fn: goStage });
    if (!atTable && myTable) list.push({ label: '테이블로', fn: () => walkToTable(myTable) });
  } else if (step >= 4 && onFloor() && (stageArrived || !player.target)) {
    list.push({ label: mingling.length ? '다른 사람과 어울리기' : '어울리기', primary: !mingling.length, fn: mingle });
    list.push({ label: '손 들기', on: !!player.upTo, fn: handsUp });
    list.push({ label: '점프', fn: doJump });
    list.push({ label: '하이파이브', fn: highFive });
    list.push({ label: '테이블로', fn: () => walkToTable(myTable || nearestFreeTable()) });
  }
  actions(list);

  if (player.target) caption('걸어가는 중입니다');
  else if (step === 3 && !atTable) caption('스탠딩 테이블로 가서 목을 축이세요', '버튼을 누르거나 빛나는 테이블을 눌러도 됩니다');
  else if (step === 3 && !hasCup) caption('어떤 음료로 할까요?');
  else if (step === 3) caption('시원하게 한 모금 하세요');
  else if (step === 4 && !grooving) caption('음악에 몸을 맡겨 보세요', '건들거리기를 누르면 박자에 맞춰 흔듭니다');
  else if (step === 4) caption(grooveBeats < 8 ? `좋습니다. 그대로 리듬을 타세요` : '몸이 풀렸습니다. 메인 스테이지로 가 볼까요?');
  else if (step === 5 && onFloor() && !mingling.length) caption('어울리기를 누르면 주변 사람들이 모입니다');
  else if (step === 5 && mingling.length) caption(`함께 ${mingling.length + 1}명이 어울리는 중입니다`, hi5 ? `하이파이브 ${hi5}회` : venue.chorusHint);
  else if (step === 5) caption('메인 스테이지로 가서 사람들과 어울려 보세요');
  else caption('');
}

/* 설정 */
function drawTracks() {
  const box = $('trackList'); box.textContent = '';
  TRACKS.filter((x) => x.venue === venue.id).forEach((t) => {
    const b = document.createElement('button'); b.className = `listBtn${!edm.fileMode && edm.track.id === t.id ? ' on' : ''}`;
    const s = document.createElement('span'); const st = document.createElement('strong'); st.textContent = t.name; const sm = document.createElement('small'); sm.textContent = t.desc; s.append(st, sm); b.append(s);
    b.setAttribute('aria-pressed', String(!edm.fileMode && edm.track.id === t.id));
    b.onclick = () => { settings.tracks[venue.id] = t.id; saveSettings(); edm.setTrack(t.id); nowFile = null; $('nowName').textContent = t.name; drawTracks(); };
    box.append(b);
  });
}
/* 지금 곡 표시를 누르면 다음 곡. EDM은 곡이 끝나면 저절로 다음 곡으로 넘어간다 */
const venueTracks = TRACKS.filter((x) => x.venue === venue.id);
edm.playlist = venueTracks;
edm.autoNext = venue.id === 'club' && settings.autoNext;
const announceTrack = (t) => { $('nowName').textContent = t.name; toast(`${t.name} · ${t.desc}`, 2.6); if (!$('settingsModal').hidden) drawTracks(); };
edm.onTrack = announceTrack;
$('nowChip').onclick = () => {
  // 7080은 기본 곡 다음에 myList 곡으로 이어진다
  const order = [...venueTracks, ...myItems()], cur = nowFile || edm.track, next = order[(order.indexOf(cur) + 1) % order.length];
  if (next.blob) { playItem(next); return; }
  nowFile = null;
  settings.tracks[venue.id] = next.id; saveSettings();
  edm.setTrack(next.id); announceTrack(next); renderMyList();
};
$('autoNextRow').hidden = venue.id !== 'club';
$('autoNext').onchange = (e) => { settings.autoNext = e.target.checked; edm.autoNext = venue.id === 'club' && settings.autoNext; saveSettings(); };
$('btnSettings').onclick = () => { drawTracks(); $('autoNext').checked = settings.autoNext; $('volume').value = settings.volume; $('lowFx').checked = settings.lowFx; $('settingsModal').hidden = false; };
$('volume').oninput = (e) => { settings.volume = +e.target.value; edm.setVolume(settings.volume / 100); saveSettings(); };
$('lowFx').onchange = (e) => { settings.lowFx = e.target.checked; fxState.full = !settings.lowFx; saveSettings(); };

/* ───── myList: 내 음원 (7080 무대) ───── */
let saved = [], temp = [], nowFile = null, nowUrl = null, armedDelete = null, tempSeq = 0;
const myItems = () => [...saved, ...temp];
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
async function refreshSaved() {
  try { saved = await listTracks(); } catch { saved = []; toast('이 브라우저에서는 myList를 쓸 수 없습니다'); }
  // 재생 중인 곡은 같은 항목으로 다시 잇는다
  if (nowFile && !nowFile.temp) nowFile = saved.find((x) => x.id === nowFile.id) || nowFile;
}
function renderMyList() {
  if (!venue.band) return;
  const box = $('myListItems'); box.textContent = '';
  $('myListEmpty').hidden = myItems().length > 0;
  myItems().forEach((it) => {
    const row = document.createElement('div'); row.className = `mlRow${nowFile === it ? ' on' : ''}`;
    const play = document.createElement('button'); play.className = 'mlMain';
    const paused = nowFile === it && edm.fileEl?.paused;
    const icon = document.createElement('span'); icon.className = 'mlIcon'; icon.textContent = nowFile === it && !paused ? '❚❚' : '▶';
    const text = document.createElement('span'); text.className = 'mlText';
    const st = document.createElement('strong'); st.textContent = it.title;
    const sm = document.createElement('small');
    const dur = it.analysis?.duration;
    sm.textContent = [it.temp ? '저장되지 않음' : 'myList', dur ? fmtTime(dur) : null, fmtSize(it.size), it.analysis ? `${Math.round(it.analysis.bpm)} BPM` : null].filter(Boolean).join(' · ');
    text.append(st, sm); play.append(icon, text);
    play.setAttribute('aria-label', `${it.title} ${nowFile === it && !paused ? '일시정지' : '재생'}`);
    play.onclick = () => { if (nowFile === it) { edm.togglePause(); renderMyList(); } else playItem(it); };
    row.append(play);
    if (it.temp) {
      const keep = document.createElement('button'); keep.className = 'mlSmall'; keep.textContent = '저장';
      keep.onclick = () => keepTemp(it);
      row.append(keep);
    }
    const del = document.createElement('button'); del.className = 'mlSmall danger'; del.textContent = armedDelete === it ? '정말 삭제' : '삭제';
    del.onclick = () => { if (armedDelete === it) deleteItem(it); else { armedDelete = it; renderMyList(); } };
    row.append(del);
    box.append(row);
  });
  $('myListStop').hidden = !nowFile;
  if (navigator.storage?.estimate) navigator.storage.estimate().then((s) => { $('myListUsage').textContent = `사용 중 ${fmtSize(s.usage || 0)}`; }).catch(() => {});
}
function backToBand() {
  nowFile = null; edm.stopFile();
  if (nowUrl) { URL.revokeObjectURL(nowUrl); nowUrl = null; }
  $('nowName').textContent = edm.track.name;
  renderMyList();
}
function playItem(it) {
  if (nowUrl) URL.revokeObjectURL(nowUrl);
  nowUrl = URL.createObjectURL(it.blob); nowFile = it;
  edm.playFile(nowUrl, it.analysis).catch((err) => {
    if (err?.name === 'NotAllowedError') toast('재생 버튼을 한 번 더 눌러 주세요');
  });
  $('nowName').textContent = it.title; toast(it.title, 2.2);
  renderMyList();
  if (!it.analysis && it.size < 80 * 1048576) analyzeItem(it);
}
async function analyzeItem(it) {
  try {
    const data = await it.blob.arrayBuffer(), buf = await edm.ctx.decodeAudioData(data);
    it.analysis = analyze(buf);
    if (nowFile === it) edm.analysis = it.analysis;
    if (!it.temp) await putTrack(it);
    renderMyList();
  } catch { /* 분석하지 못해도 재생은 계속된다 (120 BPM으로 움직인다) */ }
}
function deleteItem(it) {
  armedDelete = null;
  if (nowFile === it) backToBand();
  if (it.temp) { temp = temp.filter((x) => x !== it); renderMyList(); return; }
  removeTrack(it.id).then(refreshSaved).then(() => { toast('myList에서 지웠습니다'); renderMyList(); }).catch(() => toast('지우지 못했습니다'));
}
async function keepTemp(it) {
  try {
    const rec = { title: it.title, name: it.name, size: it.size, type: it.type, blob: it.blob, analysis: it.analysis || null, addedAt: Date.now() };
    const id = await addTrack(rec);
    temp = temp.filter((x) => x !== it);
    await refreshSaved();
    if (nowFile === it) nowFile = saved.find((x) => x.id === id) || null;
    toast('myList에 저장했습니다'); renderMyList();
  } catch (err) { toast(err?.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다' : '저장하지 못했습니다'); }
}
async function addFiles(files, keep) {
  const good = [...files].filter(isAudioFile), bad = files.length - good.length;
  if (bad) toast(`음원이 아닌 파일 ${bad}개는 뺐습니다`);
  if (!good.length) return;
  let first = null;
  if (keep) {
    navigator.storage?.persist?.();
    for (const f of good) {
      if (saved.some((x) => x.name === f.name && x.size === f.size)) { toast(`이미 있는 곡입니다: ${titleOf(f.name)}`); continue; }
      try {
        const id = await addTrack({ title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null, addedAt: Date.now() });
        first ??= id;
      } catch (err) { toast(err?.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다' : '이 브라우저에서는 저장할 수 없어 이번만 재생합니다'); temp.push({ temp: true, id: `t${++tempSeq}`, title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null }); }
    }
    await refreshSaved();
    renderMyList();
    const it = saved.find((x) => x.id === first) || temp[temp.length - 1];
    if (it) { playItem(it); toast(`${good.length}곡을 myList에 저장했습니다`); }
  } else {
    const added = good.map((f) => ({ temp: true, id: `t${++tempSeq}`, title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null }));
    temp.push(...added); playItem(added[0]);
  }
}
if (venue.band) {
  $('btnMyList').hidden = false;
  $('btnMyList').onclick = () => { armedDelete = null; renderMyList(); $('myListModal').hidden = false; };
  $('mlAdd').onclick = () => $('mlSaveInput').click();
  $('mlTemp').onclick = () => $('mlTempInput').click();
  $('mlSaveInput').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f, true); };
  $('mlTempInput').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f, false); };
  $('myListStop').onclick = () => { backToBand(); toast('밴드 연주로 돌아갑니다'); };
  edm.onFileEnd = () => {
    const list = myItems(), i = list.indexOf(nowFile);
    if (!list.length || i < 0) { backToBand(); return; }
    playItem(list[(i + 1) % list.length]);
  };
  edm.onFileError = () => { toast('이 형식은 재생할 수 없습니다'); backToBand(); };
  await refreshSaved();
}

/* 나가기: 확인 뒤 화면을 어둡게 하고 줄 고르는 처음 화면으로 돌아간다 */
$('btnExit').onclick = () => {
  $('exitText').textContent = phase === 'queue' || phase === 'door' || phase === 'id' || phase === 'stamping' || phase === 'canEnter' ? '줄에서 빠져나와 처음 화면으로 돌아갑니다.' : '문밖으로 나가 처음 화면으로 돌아갑니다. 다시 들어오려면 줄을 새로 섭니다.';
  $('exitModal').hidden = false;
};
$('btnExitYes').onclick = () => {
  closeModals(); $('bottom').hidden = true; $('hud').hidden = true;
  edm.setVolume(0);
  $('fade').classList.add('on');
  later(0.9, () => location.reload());
};

/* ───── NPC 행동 ───── */
function npcTick(n, t, clock) {
  // 곡의 흥에 따라 춤의 크기가 달라진다
  if (n.role === 'floor' && !n.mingle) n.groove = 0.42 + clock.energy * 0.75;
  if (t < n.nextAct || n.target) return;
  n.nextAct = t + rand(8, 22);
  if (n.role === 'floor') {
    if (Math.random() < 0.3) n.danceStyle = pick(venue.styles);
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d > 2 && d < 7 && Math.random() < 0.08) say(n, pick(venue.cheers), 1.6);
    if (!n.mingle && Math.random() < 0.14) {
      const [x, z] = freeFloorSpot();
      goTo(n, x, z, () => { n.yawTo = yawToStage(n.x, n.z); n.danceTo = 1; });
    }
  } else if (n.cup) {
    n.sipTo = 1; later(1.5, () => { n.sipTo = 0; });
    if (Math.random() < 0.3) say(n, pick(venue.tableTalk), 2);
  }
}
let dropSeen = -1;
function crowdBeat(clock) {
  // 드롭 첫 박: 플로어 전체가 뛰고 손을 든다
  if (clock.section.name === 'drop' && clock.section.barIn === 0 && clock.bar !== dropSeen) {
    dropSeen = clock.bar;
    if (phase === 'room' && player.z < 4) toast(venue.dropToast, 1.4);
    npcs.filter((n) => n.role === 'floor').forEach((n, i) => {
      if (venue.jumps && Math.random() < 0.8) later(i * 0.012, () => jump(n));
      if (!venue.jumps && Math.random() > 0.55) return;
      n.upTo = 1; later(rand(2.2, 5), () => { n.upTo = 0; });
    });
    edm.cheer(0.14);
  }
  // 드롭 중 박자마다 일부가 뛴다
  const b = Math.floor(clock.beat);
  if (venue.jumps && clock.section.name === 'drop' && b !== crowdBeat.last) {
    crowdBeat.last = b;
    for (let i = 0; i < 4; i++) { const n = pick(npcs); if (n.role === 'floor' && !n.target) jump(n); }
    if (mingling.length && b % 4 === 0) jump(pick(mingling));
  }
}

/* ───── 메인 루프 ───── */
const tmp = new THREE.Vector3(), tmpTarget = new THREE.Vector3();
let last = performance.now(), frames = 0, fpsT = 0, uiT = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - last) / 1000, 0.05); last = nowMs;
  const t = nowMs / 1000, clock = edm.clock();

  // 키보드 이동
  if (keys.size && phase === 'room') {
    const ax = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const az = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    if (ax || az) {
      const sin = Math.sin(cam.theta), cos = Math.cos(cam.theta), wx = ax * cos + az * sin, wz = -ax * sin + az * cos, l = Math.hypot(wx, wz);
      player.target = { x: player.x + (wx / l) * 0.8, z: player.z + (wz / l) * 0.8 }; player.onArrive = null;
      player.target.x = clamp(player.target.x, ROOM.xMin, ROOM.xMax); player.target.z = clamp(player.target.z, ROOM.zMin, ROOM.zMax);
      dest.visible = false;
    }
  }

  // 플레이어 춤 유지
  if (phase === 'room' || phase === 'queue') player.danceTo = grooving ? 1 : 0;
  if (phase === 'queue' && grooving) { player.danceStyle = 0; player.groove = 0.42; }

  // 줄
  if (phase === 'queue') {
    queueTimer -= dt;
    if (queueTimer <= 0 && !queueBusy) {
      const head = queue[0];
      if (head === player) atDoor();
      else if (head) npcEnters(head);
    }
    for (const p of queue) {
      if (p === player) continue;
      p.lineChat -= dt;
      if (p.lineChat < 0) { p.lineChat = rand(5, 13); if (Math.random() < 0.6) say(p, pick(venue.lineTalk), 2); }
    }
    if (uiT++ % 20 === 0) renderUi();
  }

  // 사람 갱신
  for (const p of everyone) {
    if (!p.isPlayer && !p.isStaff && p.role) npcTick(p, t, clock);
    updatePerson(p, dt, t, clock, collide);
    if (p.y0) { p.root.position.y = p.y0 + p.y; }
    if (p.armPose !== undefined && performers.includes(p)) { p.danceTo = 1; p.danceStyle = !venue.band && clock.section.name === 'drop' ? 4 : venue.stageStyle; p.groove = venue.band ? 0.55 : 0.8; p.upTo = !venue.band && clock.section.name === 'build' && clock.section.barIn >= 2 ? 1 : 0; }
    // 말풍선은 벽 너머나 먼 곳이면 보이지 않는다
    if (p.bubble.visible) {
      const sameSide = p === player || (p.z > 4.9) === (player.z > 4.9);
      p.bubble.material.opacity = sameSide && Math.hypot(p.x - player.x, p.z - player.z) < 13 ? 1 : 0;
    }
  }
  for (const p of everyone) if (p.cup) holdCup(p, p.cup);
  if (tray.visible) { waiter.arms[1].h.getWorldPosition(tray.position); tray.position.y += 0.02; }
  if (phase === 'room' && (clock.section.name === 'drop')) crowdBeat(clock); else crowdBeat.last = -1;
  if (clock.section.name !== 'drop') dropSeen = -1;

  // 건들거린 박자 세기
  const bi = Math.floor(clock.beat);
  if (bi !== lastBeatInt) {
    lastBeatInt = bi;
    if (grooving && phase === 'room' && !player.target) {
      grooveBeats++;
      if (grooveBeats === 8 && step === 4) { toast('리듬을 탔습니다. 메인 스테이지로 가 볼까요?', 3); renderUi(); }
    }
  }
  $('beatDot').style.transform = `scale(${0.75 + clock.kick * 0.7})`;

  // 플레이어 위치 표시
  marker.position.x = player.x; marker.position.z = player.z; marker.visible = phase !== 'gate';
  marker.material.opacity = 0.45 + clock.kick * 0.5;
  if (dest.visible && !player.target) dest.visible = false;

  // 플로어 앞 소리
  if (phase === 'room') edm.setRoom(player.z < -4 ? 3 : 2);
  if (phase === 'room' && uiT++ % 12 === 0) renderUi();
  if (stageArrived && !onFloor() && mingling.length) stopMingle();
  if (mingling.length && Math.hypot(mingling[0].x - player.x, mingling[0].z - player.z) > 5) stopMingle();

  // 음료 잔: 테이블 ↔ 손 ↔ 입
  if (myDrink.cup) {
    const k = clamp(player.sip * 1.25, 0, 1), s = k * k * (3 - 2 * k);
    holdCup(player, myDrink.cup);
    myDrink.cup.position.lerpVectors(myDrink.pos, myDrink.cup.position, s);
    myDrink.cup.quaternion.slerp(CUP_REST, 1 - s);
  }

  // 월드
  world.update(dt, t, clock, edm, player.z);

  // 카메라
  cam.theta = damp(cam.theta, cam.thetaTo, 4, dt); cam.phi = damp(cam.phi, cam.phiTo, 4, dt); cam.dist = damp(cam.dist, cam.distTo, 4, dt);
  cam.x = damp(cam.x, player.x, 6, dt); cam.y = damp(cam.y, cam.lookY, 3, dt); cam.z = damp(cam.z, player.z, 6, dt);
  // 드롭에서 살짝 울린다
  const shake = venue.shake && fxState.full && clock.section.name === 'drop' ? clock.kick * 0.022 : 0;
  tmpTarget.set(cam.x, cam.y + shake, cam.z);
  const sinP = Math.sin(cam.phi);
  const ox = Math.sin(cam.theta) * sinP * cam.dist, oz = Math.cos(cam.theta) * sinP * cam.dist, oy = Math.cos(cam.phi) * cam.dist;
  // 벽을 뚫지 않도록 시선 방향은 유지한 채 거리만 줄인다
  let reach = 1;
  const limit = (o, base, lo, hi) => { if (o > 0 && base + o * reach > hi) reach = Math.max(0.08, (hi - base) / o); if (o < 0 && base + o * reach < lo) reach = Math.max(0.08, (lo - base) / o); };
  if (player.z < 4.9) { limit(ox, cam.x, -13.7, 13.7); limit(oz, cam.z, -23.6, 4.7); limit(oy, cam.y, 0.3, 7.7); }
  else if (player.z < 10.1) { limit(ox, cam.x, -1.35, 1.35); limit(oy, cam.y, 0.3, 3.1); }
  else { limit(oz, cam.z, 10.75, 60); }
  camera.position.set(cam.x + ox * reach, cam.y + oy * reach + shake, cam.z + oz * reach);
  camera.lookAt(tmpTarget);

  renderer.render(scene, camera);

  // 느린 기기는 해상도를 낮춘다
  frames++; fpsT += dt;
  if (fpsT > 3) {
    const fps = frames / fpsT; frames = 0; fpsT = 0;
    if (fps < 28 && pixelRatio > 0.8) { pixelRatio = Math.max(0.8, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
  }
}
place(player, LINE_X(5), LINE_Z, -Math.PI / 2);
cam.x = player.x; cam.z = player.z;
renderer.compile(scene, camera);
requestAnimationFrame(frame);

/* 시작 */
edm.setRoom(0);
$('gate').hidden = true; $('hud').hidden = false; $('bottom').hidden = false;
$('nowName').textContent = edm.track.name;
phase = 'queue'; setupQueue(); setStep(1); renderUi();
camSet(0.82, 1.46, 8.2, 2);

// 시험용 접근점
window.club = { edm, player, npcs, waiter, tray, TABLES, everyone, performers, renderer, scene, camera, buddy: () => buddy, state: () => ({ phase, step, grooving, grooveBeats, hi5, mingling: mingling.length, sips: myDrink.sips, x: player.x, z: player.z, queue: queue.indexOf(player) }), clockNow: () => edm.clock() };
