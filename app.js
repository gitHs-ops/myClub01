import * as THREE from './vendor/three.min.js';
import { Edm, TRACKS } from './edm.js?v=8';
import { makePerson, updatePerson, goTo, say, jump, setWardrobe } from './people.js?v=11';
import { buildWorld, ROOM, FLOOR, TABLES, BAR_SPOTS, POOL_AREA, POOL_SPOTS, POOL_STATE } from './world.js?v=16';
import { VENUES } from './venues.js?v=7';
import { listTracks, addTrack, putTrack, removeTrack, isAudioFile, titleOf, analyze, isLrcFile, readText, decodeText, lyricLines, id3Lyrics } from './mylist.js?v=2';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
/* 셔플은 동작이 여러 가지다 */
const SHUFFLES = [{ s: 6, name: '러닝맨' }, { s: 7, name: '찰스턴' }, { s: 8, name: 'T스텝' }, { s: 9, name: '크리스크로스' }, { s: 10, name: '사이드 킥' }];
let shuffleIdx = 0;
const isShuffle = () => grooving && GROOVES[grooveLevel].style === 6;
const isShuffleStyle = (s) => s >= 6 && s <= 10;
const pickStyle = (list) => { const s = pick(list); return s === 6 ? pick(SHUFFLES).s : s; };
const now = () => performance.now() / 1000;
const later = (sec, f) => setTimeout(f, sec * 1000);

/* ───── 설정 ───── */
const KEY = 'clubpulse.v1';
const settings = Object.assign({ allFollow: false, autoNext: true, volume: 80, tracks: { club: 'neon', live7080: 'gogo', jazz: 'swing', lp: 'lp_soul' }, lowFx: matchMedia('(prefers-reduced-motion: reduce)').matches }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
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
if (venue.jazz) { const li = document.querySelector('#steps li[data-step="5"] span'); if (li) li.textContent = venue.lp ? '신청곡' : '블루스'; }
if (venue.lp) edm.vinylAlways = true;   // 내 음원도 판처럼
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
// 손님: 8비트 도트 캐릭터 30%, 블록 캐릭터 30%, 사람 40%
let guestCount = 0;
const guestLook = () => { const n = ++guestCount % 10; return n === 2 || n === 5 || n === 8 ? { pixel: true } : n % 2 === 0 ? { brick: true } : {}; };
const spawn = (look) => { const p = makePerson(scene, look || guestLook()); everyone.push(p); return p; };
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
/* 기도: 마동석 스타일. 떡 벌어진 어깨, 굵은 팔다리, 짧은 머리, 짙은 눈썹과 수염 */
{
  const b = bouncer, meshes = (g) => g.children.filter((c) => c.isMesh);
  b.root.scale.setScalar(1.12);
  meshes(b.torso).forEach((m) => { if (m.position.y > 0.2 && m.position.y < 0.3) m.scale.set(1.5, 1.08, 1.15); });   // 가슴
  meshes(b.torso).forEach((m) => { if (m.position.y > 0.5 && m.position.y < 0.6) m.scale.set(1.7, 1, 1.7); });      // 목
  meshes(b.hips).forEach((m) => m.scale.set(1.35, 1.1, 1.3));
  [-1, 1].forEach((s) => {
    const arm = b.arms[s]; arm.a.position.x = s * 0.3;
    meshes(arm.a).forEach((m) => m.scale.set(1.75, 1, 1.75));
    meshes(arm.e).forEach((m) => m.scale.set(1.6, 1, 1.6));
    meshes(arm.h).forEach((m) => m.scale.setScalar(1.35));
    const leg = b.legs[s]; leg.t.position.x = s * 0.12;
    meshes(leg.t).forEach((m) => m.scale.set(1.4, 1, 1.4));
    meshes(leg.k).forEach((m) => m.scale.set(1.3, 1, 1.3));
  });
  const head = b.head, dark = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.9 });
  head.children.slice(3).forEach((c) => head.remove(c));   // 원래 머리카락은 빼고
  head.children[0].scale.set(1.1, 1, 1.05);   // 넓은 얼굴
  head.scale.setScalar(0.95);
  // 짧은 머리
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.152, 20, 10, 0, Math.PI * 2, 0, 1.25), dark); hair.scale.set(1.08, 0.9, 1.04); hair.position.set(0, 0.02, -0.01); hair.rotation.x = -0.25; head.add(hair);
  // 수염: 턱과 입 주변
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.149, 20, 10, Math.PI / 2 - 1.1, 2.2, 1.95, 0.95), new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 1, transparent: true, opacity: 0.82 }));
  beard.scale.set(1.08, 1, 1.05); head.add(beard);
  const mus = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.02), dark); mus.position.set(0, -0.045, 0.142); head.add(mus);
  // 짙은 눈썹, 약간 찌푸린 표정
  // 티셔츠 글씨
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.font = '900 104px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('나 마동석', 256, 86);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.11, 24, 1, true, -0.95, 1.9), new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.8, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.35, depthWrite: false }));
    tee.scale.set(1.01, 1, 0.8); tee.position.set(0, 0.41, 0); b.torso.add(tee);
  }
  // 굵은 팔에 맞춘 팔짱 (팔꿈치가 가슴 밖에 있게)
  const REST = [0, 0.25, 0, -0.2], CROSS_R = [-1.01, -0.43, -0.98, -1.21], CROSS_L = [-1.14, -0.55, -1.0, -1.32];
  const mix = (p, q, k) => p.map((v, i) => v + (q[i] - v) * k);
  b.armPose = () => [mix(REST, CROSS_L, b.cross), mix(REST, CROSS_R, b.cross)];
  [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.02), dark); e.position.set(s * 0.055, 0.045, 0.135); e.rotation.z = s * 0.25; head.add(e); });
}
/* 웨이터: 다른 테이블로 보낸 술을 쟁반에 받쳐 가져간다 */
const WAITER_HOME = [9.4, 3.2];
const waiter = spawn({ style: 0, top: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }), bottom: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }), skirt: false, height: 1.02 });
place(waiter, WAITER_HOME[0], WAITER_HOME[1], -Math.PI / 2); waiter.isStaff = true; waiter.speed = 2.6;
const tray = new THREE.Group(); scene.add(tray);
tray.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 24), new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.25, metalness: 0.8 })));
tray.visible = false;
const performers = [];
let drummerSticks = [], drummerRef = null, celloBow = null, lpOwner = null, lpSwapUntil = 0;
// 박자 안에서 스틱이 들린 정도: 0이면 북을 친 순간 [왼손, 오른손]
const drumLift = (b) => { const r = (b * 2) % 1, l = ((b + 1) % 2) / 2; return [Math.sin(Math.PI * Math.min(1, l * 1.4)) * (l < 0.72 ? 1 : 0), Math.sin(Math.PI * r)]; };
const stickA = new THREE.Vector3(), stickB = new THREE.Vector3(), stickUp = new THREE.Vector3(0, 1, 0), stickQ = new THREE.Quaternion();
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
    const g = new THREE.Group(); g.position.set(0, 0.2, 0.17); g.rotation.z = -0.42; g.scale.setScalar(1.4);   // 몸통은 오른쪽 아래, 넥은 왼쪽 위
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 18), body); b.rotation.x = Math.PI / 2; b.position.x = 0.12; b.scale.set(1.25, 1, 1); g.add(b);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.025), dark); n.position.x = -0.3; g.add(n);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.025), dark); h.position.x = -0.61; g.add(h);
    p.torso.add(g);
  };
  const strum = (b) => { const k = Math.sin(b * Math.PI * 2); return [[-0.45, 0.35, 0.6, -2.0], [0.02 + k * 0.08, 0.35, -0.8, -1.4 + k * 0.22]]; };
  if (venue.lp) {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
    // 사장님: 희끗한 머리, 조끼. 평소엔 판을 고르고, 신청곡이 오면 판을 바꿔 건다
    lpOwner = performer({ style: 0, top: M(0x5a3a1e), bottom: M(0x2a1c12), hair: M(0xc9c5bf), height: 1.02 }, 0, -20.05, (b, t) => {
      const sw = now() < lpSwapUntil ? Math.sin((lpSwapUntil - now()) * 3) : 0, pick2 = Math.sin(t * 0.4) > 0.6 ? 1 : 0;
      return [[-0.75 - Math.abs(sw) * 0.4, 0.42, -0.25, -1.25], [-0.55 - pick2 * 0.25 - Math.abs(sw) * 0.5, 0.3, -0.25, -1.4 + pick2 * 0.2]];
    });
  } else if (venue.jazz) {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, ...o });
    // 재즈 싱어: 붉은 드레스, 오른손은 스탠드 마이크에, 왼손은 노래에 맞춰 천천히
    const singer = performer({ style: 1, top: M(0xa3122a, { roughness: 0.3 }), bottom: M(0xa3122a, { roughness: 0.3 }), shoe: M(0x111111), height: 1 }, 0, -18.45, (b) => {
      const k = Math.sin(b * Math.PI * 0.5);
      return [[-0.55 + k * 0.3, 0.45 + k * 0.2, -0.25, -0.75 - k * 0.2], [-1.05, 0.12, -0.5, -1.55]];
    });
    singer.danceStyle = 0;
    // 피아니스트: 그랜드 피아노 앞에 앉아 오른쪽(+x)을 본다
    const pianist = performer({ style: 0, top: M(0x111827), bottom: M(0x111827), height: 1 }, -6.05, -19.85, (b, t) => {
      const l = Math.sin(t * 2.3) * 0.12, r = Math.sin(t * 3.1 + 1) * 0.14, tl = Math.max(0, Math.sin(t * 11)) * 0.05, tr = Math.max(0, Math.sin(t * 13 + 2)) * 0.05;
      return [[-0.55 - tl, 0.22 + l, -0.32, -1.25 + tl], [-0.55 - tr, 0.22 + r, -0.32, -1.25 + tr]];
    });
    place(pianist, -6.05, -19.85, Math.PI / 2); pianist.sit = true;
    // 첼리스트: 의자에 앉아 무릎 사이에 첼로, 왼손은 지판, 오른손은 활
    const CX = 3.6, CZ = -19.75, CYAW = -0.32;
    const cellist = performer({ style: 0, top: M(0xe5e7eb), bottom: M(0x111111), height: 1 }, CX, CZ, (b, t) => {
      const bow = Math.sin(b * Math.PI * (edm.track?.jazz === 'ballad' ? 0.25 : 0.5)), slide = Math.sin(t * 0.7) * 0.08;
      return [[-1.25 + slide, -0.05, -0.35, -1.55], [-0.62, 0.32 + bow * 0.3, -0.15, -1.15 + bow * 0.35]];
    });
    place(cellist, CX, CZ, CYAW); cellist.sit = true;
    const wood = M(0x7a3410, { roughness: 0.3 }), ebony = M(0x111111, { roughness: 0.3 }), steel = M(0xcfcfcf, { metalness: 0.8, roughness: 0.25 });
    const holder = new THREE.Group(); holder.position.set(CX, STAGE_Y, CZ); holder.rotation.y = CYAW; scene.add(holder);
    const cello = new THREE.Group(); cello.position.set(0.02, 0, 0.4); cello.rotation.set(-0.3, 0, -0.12); cello.scale.setScalar(1.3); holder.add(cello);
    const sph = (r, sx, sy, sz, y, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); m.scale.set(sx, sy, sz); m.position.y = y; cello.add(m); return m; };
    sph(0.2, 1, 1.05, 0.45, 0.36, wood);            // 아래 몸통
    sph(0.165, 1, 1.05, 0.45, 0.68, wood);          // 위 몸통
    sph(0.12, 1, 0.9, 0.42, 0.52, wood);            // 허리
    const nk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.035), ebony); nk.position.set(0, 1.0, 0.05); cello.add(nk);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.58, 0.012), ebony); fb.position.set(0, 0.86, 0.1); cello.add(fb);
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.014, 6, 12), wood); scroll.position.set(0, 1.28, 0.04); scroll.rotation.y = Math.PI / 2; cello.add(scroll);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), steel); pin.position.y = 0.1; cello.add(pin);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.01), M(0xe8cfa0)); bridge.position.set(0, 0.4, 0.1); cello.add(bridge);
    for (const x of [-0.015, -0.005, 0.005, 0.015]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.95, 0.002), steel); st.position.set(x, 0.85, 0.11); cello.add(st); }
    const bowG = new THREE.CylinderGeometry(0.005, 0.006, 1, 6); bowG.translate(0, 0.5, 0);
    const bowM = new THREE.Mesh(bowG, M(0x5a2d0c)); scene.add(bowM);
    celloBow = { m: bowM, p: cellist, cello, contact: new THREE.Vector3(0, 0.47, 0.12) };
  } else {
    const singer = performer({ style: 1, top: new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.55 }), height: 1 }, 0, -18.45, (b) => { const k = Math.sin(b * Math.PI); return [[-1.3 + k * 0.35, 0.55, 0, -0.45], [-0.95, 0.28, -0.58, -2.05]]; });
    const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.1, 4, 8), dark); mic.position.set(0, -0.09, 0.02); singer.arms[1].h.add(mic);
    singer.danceStyle = 0;
    guitar(performer({ style: 0, height: 1 }, 3.3, -19.4, strum), wood);
    guitar(performer({ style: 3, height: 1 }, -3.3, -19.4, strum), red);
    // 건반: 연주자는 건반 뒤에 서서 건반 쪽(관객 쪽)을 본다
    performer({ style: 0, height: 1 }, -5.7, -19.68, (b, t) => [[-0.07 + Math.sin(t * 9) * 0.04, 0.29, -0.32, -1.2 + Math.sin(t * 7) * 0.06], [-0.07 + Math.sin(t * 9 + 2) * 0.04, 0.29, -0.32, -1.2 + Math.sin(t * 7 + 2) * 0.06]]);
  }
  if (!venue.lp) {
  const drummer = performer({ style: 0, height: 1 }, 0, -21.6, (b) => { const [l, r] = drumLift(b); return [[-0.1 - l * 0.55, 0.35, -0.35, -1.75 + l * 0.5], [-0.1 - r * 0.55, 0.35, -0.35, -1.75 + r * 0.5]]; }, 1.49);
  drummer.sit = true;
  // 스틱: 손에서 북까지. 오른손은 8분음표, 왼손은 2·4박
  const stickM = new THREE.MeshStandardMaterial({ color: venue.jazz ? 0x2a2a2e : 0xe8cfa0, roughness: venue.jazz ? 0.3 : 0.5, metalness: venue.jazz ? 0.6 : 0 });   // 재즈는 브러시
  const stickG = new THREE.CylinderGeometry(0.009, 0.013, 1, 8); stickG.translate(0, 0.5, 0);
  const DRUM_TIPS = { [-1]: new THREE.Vector3(-0.42, 2.1, -21.05), [1]: new THREE.Vector3(0.42, 2.1, -21.05) };
  drummerSticks = [-1, 1].map((s) => { const m = new THREE.Mesh(stickG, stickM); scene.add(m); return { s, m, tip: DRUM_TIPS[s] }; });
  drummerRef = drummer;
  }
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

const CROWD_FLOOR = venue.jazz ? 0 : lowEnd ? 15 : 24, CROWD_TABLE = venue.jazz ? 0 : lowEnd ? 6 : 10, CROWD_BAR = lowEnd ? 2 : 4;
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
  if (role === 'floor') { p.danceTo = 1; p.danceStyle = pickStyle(venue.styles); }
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
/* ───── 재즈 바: 앉는 자리와 가끔 나와서 추는 블루스 커플 ───── */
function walkToSeat(p, S, done = null) {
  S.by = p; p.seat = S; p.sit = false;
  goTo(p, S.x, S.z, () => {
    p.x = S.x; p.z = S.z; p.yawTo = S.yaw; p.sit = true;
    if (p !== player) { setRole(p, 'table'); p.danceTo = 1; p.danceStyle = 0; p.groove = 0.3; if (p.cup) p.cup.visible = true; }
    done?.();
  });
}
function sitAt(p, S) { S.by = p; p.seat = S; place(p, S.x, S.z, S.yaw); p.sit = true; setRole(p, 'table'); p.danceTo = 1; p.danceStyle = 0; p.groove = 0.3; p.dance = 1; }
function leaveSeat(p) { p.sit = false; if (p.seat && p.seat.by === p) p.seat.by = null; p.seat = null; }
function seatGuest(p) {
  const free = TABLES.flatMap((T) => T.seats.filter((S) => !S.by && T !== myTable));
  if (!free.length) { const [x, z] = freeFloorSpot(); goTo(p, x, z, () => { p.yawTo = yawToStage(p.x, p.z); setRole(p, 'floor'); }); return; }
  free.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  walkToSeat(p, free[Math.floor(Math.random() * Math.min(4, free.length))], () => { if (!p.cup) npcCups(p); });
}
// 탁자 셋 중 하나는 비워 둔다 (내가 앉을 자리)
if (venue.jazz) {
  const cap = lowEnd ? 20 : 36;
  let n = 0;
  TABLES.forEach((T) => {
    if (T.i % 3 === 1 || n >= cap) return;
    const k = 2 + (T.i % 2), start = T.i % 4;
    for (let j = 0; j < k && n < cap; j++, n++) { const p = spawn(); npcs.push(p); sitAt(p, T.seats[(start + j * 2 + (j > 1 ? 1 : 0)) % 4]); npcCups(p); p.talkTo = 0; }
  });
}
const couples = [];
const COUPLE_MAX = venue.lp ? 0 : lowEnd ? 2 : 3;
let coupleNext = 0;
// 마주 보고 안은 자세: 리드는 허리를, 상대는 어깨를
const LEAD_ARMS = () => [[-1.0, 0.02, -0.42, -0.95], [-1.0, 0.02, -0.42, -0.95]];
const FOLLOW_ARMS = () => [[-1.55, 0.02, -0.32, -0.8], [-1.55, 0.02, -0.32, -0.8]];
function coupleSpot() {
  let best = [0, -15], bd = -1;
  for (let i = 0; i < 20; i++) {
    const x = rand(FLOOR.xMin + 0.8, FLOOR.xMax - 0.8), z = rand(FLOOR.zMin + 0.9, FLOOR.zMax - 0.5);
    const d = Math.min(9, ...couples.map((c) => Math.hypot(c.x - x, c.z - z)));
    if (d > bd) { bd = d; best = [x, z]; }
  }
  return best;
}
function startCouple(a, b, x, z, opt = {}) {
  const c = { a, b, x, z, ang: rand(0, 6.28), until: now() + rand(45, 90), on: false, player: !!opt.player };
  couples.push(c);
  a.partner = b; b.partner = a;
  [a, b].forEach((p) => { if (p !== player) { p.role = 'couple'; p.mingle = false; if (p.cup) p.cup.visible = false; } p.sit = false; p.talkTo = 0; });
  const hold = () => { c.on = true; [a, b].forEach((p) => { p.danceTo = 1; p.danceStyle = 0; p.groove = 0.28; }); a.armPose = LEAD_ARMS; b.armPose = FOLLOW_ARMS; };
  if (opt.instant) { place(a, x, z + 0.25); place(b, x, z - 0.25); hold(); return c; }
  let n = 0; const ready = () => { if (++n === 2) hold(); };
  goTo(a, x, z + 0.3, ready); goTo(b, x, z - 0.3, ready);
  return c;
}
function endCouple(c) {
  const i = couples.indexOf(c); if (i < 0) return;
  couples.splice(i, 1);
  [c.a, c.b].forEach((p) => {
    p.armPose = null; p.partner = null;
    if (p === player) return;
    if (p.home && (!p.home.by || p.home.by === p)) walkToSeat(p, p.home); else seatGuest(p);
  });
}
const playerCouple = () => couples.find((c) => c.player);
function pairFromTables(instant = false) {
  const seated = npcs.filter((n) => n.role === 'table' && n.sit && !n.target && n.seat);
  const byTable = new Map();
  seated.forEach((n) => { const T = n.seat.T; if (T !== myTable) byTable.set(T, [...(byTable.get(T) || []), n]); });
  const tables = [...byTable.values()].filter((g) => g.length >= 2);
  if (!tables.length) return;
  const [a, b] = pick(tables);
  [a, b].forEach((p) => { p.home = p.seat; p.sit = false; });   // 자리는 비워 두되 맡아 둔다
  const [x, z] = coupleSpot();
  if (!instant) say(a, pick(['우리 한 곡 출까요?', '이 곡 좋다, 나가요', '천천히 한 곡만요']), 2.2);
  startCouple(a, b, x, z, { instant });
}
let couplesInit = false;
function updateCouples(dt, t) {
  if (venue.jazz && !couplesInit) { couplesInit = true; for (let i = 0; i < COUPLE_MAX - 1; i++) pairFromTables(true); }
  for (const c of couples) {
    if (!c.on) continue;
    c.ang += dt * 0.3;
    const sx = Math.sin(c.ang) * 0.25, sz = Math.cos(c.ang) * 0.25, sway = Math.sin(t * 0.8 + c.x) * 0.04;
    c.a.x = c.x + sx + sway; c.a.z = c.z + sz; c.b.x = c.x - sx + sway; c.b.z = c.z - sz;
    c.a.yaw = c.a.yawTo = Math.atan2(-sx, -sz); c.b.yaw = c.b.yawTo = Math.atan2(sx, sz);
  }
  if (!venue.jazz) return;
  for (const c of [...couples]) if (!c.player && c.on && now() > c.until) endCouple(c);
  if (now() > coupleNext) {
    coupleNext = now() + rand(15, 32);
    if (couples.filter((c) => !c.player).length < COUPLE_MAX && Math.random() < 0.7) pairFromTables();
  }
}
/* 나도 블루스: 근처에 앉은 손님 한 분이 나와 함께 춘다 */
function blues(pref) {
  if (playerCouple()) { stopBlues(); return; }
  const want = pref && pref.root && pref.sit && pref.seat ? [pref] : [];
  const cand = want.length ? want : npcs.filter((n) => n.role === 'table' && n.sit && !n.target && n.seat).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  const n = cand[0];
  if (!n) { toast('함께 출 분이 없습니다'); return; }
  n.home = n.seat; n.sit = false;
  leaveSeat(player); stopMingle();
  const [x, z] = coupleSpot();
  say(player, '한 곡 추실래요?', 1.8); later(0.9, () => say(n, pick(['좋아요', '기꺼이요', '천천히 춰요']), 1.8));
  grooving = true; player.danceStyle = 0; player.groove = 0.28;
  startCouple(player, n, x, z, { player: true });
  camSet(cam.thetaTo, 1.34, 5.6, 1.7); setStep(5);
  toast('블루스: 천천히 돌며 춥니다', 2.4);
  renderUi();
}
function stopBlues() { const c = playerCouple(); if (!c) return; endCouple(c); applyGroove(); renderUi(); }

/* ───── LP 바: 신청곡 ───── */
function openRequest() {
  const box = $('reqList'); box.textContent = '';
  const opts = [...TRACKS.filter((x) => x.venue === venue.id).map((t) => ({ track: t, title: t.name, sub: t.desc })), ...myItems().map((it) => ({ item: it, title: it.title, sub: it.shared ? '공용 곡' : 'myList' }))];
  opts.forEach((o) => {
    const b = document.createElement('button'); b.className = 'listBtn';
    const t = document.createElement('span'); const st = document.createElement('strong'); st.textContent = o.title; const sm = document.createElement('small'); sm.textContent = o.sub; t.append(st, sm);
    b.append(t); b.onclick = () => { $('reqModal').hidden = true; requestTrack(o, player); };
    box.append(b);
  });
  $('reqModal').hidden = false;
}
function requestTrack(o, who) {
  const title = o.track ? o.track.name : o.item.title;
  say(who, '신청곡 부탁드려요', 1.8);
  toast(`신청곡 「${title}」을 적어 냈습니다`, 2.4);
  later(1.6, () => { if (lpOwner) say(lpOwner, pick(['신청곡 감사합니다. 바로 걸어 드릴게요', '좋은 판 고르셨네요', '이 판, 잘 아시는군요']), 2.6); });
  later(2.2, () => { lpSwapUntil = now() + 2.2; edm.scratch?.(); });
  later(4.4, () => {
    if (o.track) { if (nowFile) backToBand(); settings.tracks[venue.id] = o.track.id; saveSettings(); edm.setTrack(o.track.id); $('nowName').textContent = o.track.name; }
    else playItem(o.item);
    toast(`지금 거는 판: ${title}`, 2.4);
    setStep(5); renderUi();
  });
}
$('reqX').onclick = () => { $('reqModal').hidden = true; };
/* ───── 재즈 바: 합석 요청과 대화 ───── */
let mate = null, joinAsker = null, joinSeat = null, joinNext = 0;
const ieyo = (w) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이에요' : '예요'); };
const shortSay = (p, t, sec = 3.2) => say(p, t.length > 17 ? `${t.slice(0, 16)}…` : t, sec);
function sendBack(n) {
  const from = n.askFrom || {}; n.askFrom = null;
  if (from.seat && !from.seat.by) walkToSeat(n, from.seat);
  else if (from.bar && !from.bar.by) { from.bar.by = n; goTo(n, from.bar.x, from.bar.z, () => { n.yawTo = Math.PI / 2 + rand(-0.3, 0.3); setRole(n, 'bar'); n.danceTo = 1; n.danceStyle = 0; n.groove = 0.3; }); }
  else seatGuest(n);
}
function mateHere() { return !!mate && mate.seat?.T === myTable && mate.sit && !mate.target; }
function joinTick() {
  if (!venue.jazz || phase !== 'room') return;
  // 요청 중에 내가 자리를 뜨면 없던 일로
  if (joinAsker && !$('joinAsk').hidden && !(player.sit && player.seat?.T === myTable)) { declineJoin(true); return; }
  if (joinAsker || serving || !player.sit || !myTable || !myDrink.cup || playerCouple() || mateHere()) return;
  if (!joinNext) { joinNext = now() + rand(12, 20); return; }
  if (now() < joinNext) return;
  joinNext = now() + rand(40, 70);
  const S = myTable.seats.find((x) => !x.by);
  if (!S) return;
  const cand = npcs.filter((n) => !n.target && n !== mate && !n.partner && ((n.role === 'table' && n.sit && n.seat && n.seat.T !== myTable) || n.role === 'bar'))
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 8);
  if (!cand.length) return;
  const n = pick(cand);
  if (n.role === 'bar') { const b = BAR_SPOTS.find((x) => x.by === n); if (b) b.by = null; n.askFrom = { bar: b }; }
  else { n.askFrom = { seat: n.seat }; n.seat.by = null; n.seat = null; }
  n.sit = false; n.role = 'walk'; joinAsker = n; joinSeat = S; S.by = n;   // 자리는 맡아 둔다
  const T = myTable, dx = S.x - T.x, dz = S.z - T.z, d = Math.hypot(dx, dz) || 1;
  goTo(n, S.x + (dx / d) * 0.55, S.z + (dz / d) * 0.55, () => {
    if (joinAsker !== n) return;
    if (!(player.sit && player.seat?.T === T)) { declineJoin(true); return; }
    n.yawTo = Math.atan2(player.x - n.x, player.z - n.z); n.danceTo = 0;
    if (!player.target) player.yawTo = Math.atan2(n.x - player.x, n.z - player.z);
    const ask = pick(['혹시 합석해도 될까요?', '자리 비었으면 같이 앉아도 될까요?', '혼자 오셨어요? 같이 앉아도 돼요?']);
    shortSay(n, ask, 5);
    $('joinMsg').textContent = `“${ask}”`;
    $('joinAsk').hidden = false; renderUi();
  });
}
function acceptJoin() {
  const n = joinAsker, S = joinSeat; if (!n) return;
  $('joinAsk').hidden = true; joinAsker = null; joinSeat = null;
  if (n.askFrom?.seat) n.askFrom.seat.by = null;
  n.askFrom = null; S.by = null;
  say(player, '네, 앉으세요', 1.6);
  n.persona = n.persona || makePersona();
  walkToSeat(n, S, () => {
    if (!n.cup) npcCups(n);
    mate = n; n.nextAct = now() + 30;
    shortSay(n, '고마워요!', 2);
    openChat();
    later(0.8, () => mateSays(`고마워요. 저는 ${ieyo(n.persona.name)}. ${pick(['혼자 마시기 좀 쓸쓸했거든요.', '여기 자리가 음악 듣기 제일 좋네요.', '오늘 연주 정말 좋죠?'])}`));
    renderUi();
  });
}
function declineJoin(silent = false) {
  const n = joinAsker, S = joinSeat; if (!n) return;
  $('joinAsk').hidden = true; joinAsker = null; joinSeat = null;
  if (S && S.by === n) S.by = null;
  if (!silent) { say(player, '죄송해요, 일행이 와요', 1.8); later(1, () => shortSay(n, pick(['아, 네. 실례했습니다', '알겠어요. 좋은 시간 되세요', '네, 즐거운 밤 되세요']), 2.2)); }
  later(silent ? 0.2 : 2.2, () => sendBack(n));
  joinNext = now() + rand(45, 80); renderUi();
}
$('joinYes').onclick = acceptJoin;
$('joinNo').onclick = () => declineJoin();
$('joinX').onclick = () => declineJoin();

/* 대화: 키워드로 알아듣는 간단한 말동무 (인공지능이 아니라 정해 둔 말로 답한다) */
const P_NAMES = ['지수', '민호', '서연', '태현', '유나', '준혁', '하린', '도윤', '수아', '현우'];
const P_JOBS = [['디자이너', '요즘 포스터 작업이 많아서 정신없어요'], ['간호사', '오늘 겨우 쉬는 날이에요'], ['개발자', '하루 종일 화면만 봤더니 눈이 아파요'], ['요리사', '주방 마감하고 바로 왔어요'], ['선생님', '방학이라 여유가 좀 있어요'], ['사진작가', '여기 조명이 좋아서 찍고 싶을 정도예요'], ['회사원', '야근 끝나고 한 잔 하러 왔어요'], ['대학원생', '논문 쓰다가 머리 식히러 왔어요']];
const P_HOBBY = ['LP 모으기', '주말 등산', '필름 사진', '요리', '피아노 배우기', '고양이 돌보기', '옛날 영화 보기', '달리기'];
const P_MUSIC = ['쳇 베이커', '빌 에반스', '엘라 피츠제럴드', '노라 존스', '마일스 데이비스', '보사노바'];
function makePersona() { const j = pick(P_JOBS); return { name: pick(P_NAMES), job: j[0], jobLine: j[1], hobby: pick(P_HOBBY), music: pick(P_MUSIC), regular: Math.random() < 0.5, asked: null, said: new Set(), lastTalk: now() }; }
function chatLine(who, text) {
  const li = document.createElement('div'); li.className = `msg ${who}`; li.textContent = text;
  $('chatLog').append(li); $('chatLog').scrollTop = $('chatLog').scrollHeight;
  return li;
}
function mateSays(text) { if (!mate) return; chatLine('you', text); shortSay(mate, text); mate.persona.lastTalk = now(); }
function openChat() {
  if (!mate) return;
  $('chatTitle').textContent = `${mate.persona.name} 님과 대화`;
  $('chatSub').textContent = `${mate.persona.job} · 같은 탁자`;
  $('chatPanel').hidden = false; renderUi();
  setTimeout(() => $('chatInput').focus(), 50);
}
function closeChat() { $('chatPanel').hidden = true; renderUi(); }
$('chatX').onclick = closeChat; $('chatClose').onclick = closeChat;
['안녕하세요', '이 곡 좋네요', '무슨 일 하세요?', '건배해요', '여기 자주 오세요?', venue.lp ? '신청곡 뭐 할까요?' : '블루스 한 곡 어때요?'].forEach((q) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'qchip'; b.textContent = q; b.onclick = () => sendChat(q); $('chatQuick').append(b);
});
$('chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('chatInput').value.trim(); if (v) sendChat(v); $('chatInput').value = ''; };
function sendChat(text) {
  if (!mate) return;
  chatLine('me', text); shortSay(player, text);
  if (!mateHere()) { later(0.6, () => chatLine('sys', `${mate.persona.name} 님이 자리에 없습니다`)); return; }
  const typing = chatLine('you typing', '…');
  later(rand(0.8, 1.6), () => { typing.remove(); const r = mateReply(text); mateSays(r.text); r.after?.(); });
}
function mateReply(raw) {
  const m = mate.persona, t = raw.trim(), has = (re) => re.test(t), once = (key, a, b) => { if (m.said.has(key)) return b; m.said.add(key); return a; };
  const nm = t.match(/(?:저는|전|제 이름은|난|나는)\s*([가-힣A-Za-z]{2,6}?)(?:이에요|예요|입니다|이야|야|라고 해요|이라고 해요|라고|이라고)/);
  const songName = edm.fileMode ? '이 곡' : `「${edm.track.name}」`;
  let text, after = null;
  const asked = m.asked; m.asked = null;
  if (nm) { m.playerName = nm[1]; text = `${nm[1]} 님, 반가워요. 이름 좋네요.`; }
  else if (has(/건배|짠|cheers|치어스|위하여/i)) {
    text = pick(['건배!', '좋아요, 건배!', '오늘 밤을 위하여!']);
    after = () => { edm.clink(); mate.sipTo = 1; later(1.5, () => { mate.sipTo = 0; }); if (myDrink.cup && myDrink.level > 0 && !player.sipTo) later(0.4, sip); };
  }
  else if (venue.lp && has(/신청|판\s*뭐|틀어|걸어/)) { const T = pick(TRACKS.filter((x) => x.venue === 'lp')); text = `「${T.name}」 어때요? 그 판 소리가 참 좋아요. 제가 적어 낼게요.`; after = () => later(1.5, () => requestTrack({ track: T }, mate)); }
  else if (venue.lp && has(/블루스|춤|춰|댄스|출까/)) text = '여긴 춤보다 듣는 곳이죠. 대신 신청곡 하나 써요.';
  else if (has(/블루스|춤|춰|댄스|출까/)) { text = pick(['좋아요, 한 곡 춰요!', '천천히 추는 거면 자신 있어요', '이 곡이면 딱이네요. 나가요']); after = () => later(1.2, () => { if (mateHere()) blues(mate); }); }
  else if (has(/안녕|반가|처음 뵙/)) text = once('hi', `안녕하세요! 저는 ${ieyo(m.name)}.`, '네, 다시 반가워요.');
  else if (has(/이름|누구세요|성함/)) text = `${ieyo(m.name)}. ${m.playerName ? `${m.playerName} 님 맞죠?` : '그쪽은요?'}`, m.asked = m.playerName ? null : 'name';
  else if (has(/무슨\s*일|어떤\s*일|직업|회사|일\s*하/)) { text = `${m.job} 일을 해요. ${m.jobLine}.`; m.asked = 'job'; }
  else if (has(/취미|주말|쉬는\s*날|뭐\s*하고\s*놀/)) text = `${m.hobby} 좋아해요. 요즘 거기에 빠져 있어요.`;
  else if (has(/나이|몇\s*살|연세|나이가/)) text = '그건 비밀이에요. 대신 이 바는 꽤 오래 다녔어요.';
  else if (has(/좋아하는\s*(가수|음악|뮤지션)|누구\s*좋아/)) { text = `${m.music} 좋아해요. 비 오는 밤에 들으면 최고예요. 그쪽은요?`; m.asked = 'music'; }
  else if (has(/LP|판|레코드|바늘|턴테이블/i)) text = pick(['지직거리는 소리가 있어야 음악 같아요.', '여기 사장님 판이 만 장 넘는대요.', '디지털이랑은 소리가 달라요. 둥글다고 해야 하나.']);
  else if (has(/첼로/)) text = '첼로 소리가 낮게 깔리니까 노래가 더 따뜻하게 들려요.';
  else if (has(/피아노/)) text = '피아노 치시는 분 손이 정말 가볍네요. 솔로 나올 때 소름 돋았어요.';
  else if (has(/드럼|브러시/)) text = '브러시로 쓸어 주는 소리, 저 그거 너무 좋아해요.';
  else if (has(/가수|보컬|노래\s*잘|목소리/)) text = '목소리가 벨벳 같죠? 저 가수 보러 오는 사람 많대요.';
  else if (has(/곡|노래|음악|재즈|스윙|보사|발라드|연주|밴드/)) { text = `지금 나오는 건 ${songName}${edm.fileMode ? '이에요' : ieyo(edm.track.name).slice(edm.track.name.length)}. ${pick(['리듬이 기분 좋네요.', '이런 곡엔 위스키가 어울리죠.', '눈 감고 들으면 더 좋아요.'])}`; if (Math.random() < 0.5) m.asked = 'music', text += ' 평소엔 어떤 음악 들으세요?'; }
  else if (has(/술|마시|음료|칵테일|위스키|와인|맥주|뭐\s*드|한\s*잔/)) text = `저는 ${mate.cup ? '이거' : '위스키'} 마시고 있어요. ${myDrink.def ? `${myDrink.def.name}도 맛있죠?` : '뭐 드실래요?'}`;
  else if (has(/자주|단골|여기\s*(와|오)|처음\s*(와|오)/)) { text = m.regular ? '한 달에 두세 번은 와요. 금요일 밤이 제일 좋아요.' : '저도 오늘 처음이에요. 친구 추천으로 왔어요.'; m.asked = 'place'; text += ' 그쪽은요?'; }
  else if (has(/날씨|비\s*(와|오)|추워|추운|더워|밖에/)) text = '밖은 바람이 좀 차더라고요. 여기 들어오니까 따뜻하네요.';
  else if (has(/고마|감사/)) text = pick(['천만에요.', '저야말로 고마워요.']);
  else if (has(/예쁘|잘생|멋지|멋있|매력/)) text = '어머, 고마워요. 그쪽도요.';
  else if (has(/ㅋㅋ|ㅎㅎ|하하|웃기/)) text = pick(['하하, 재밌는 분이네요.', '저도 모르게 웃었어요.']);
  else if (has(/가야|가볼|먼저\s*일어|잘\s*가|안녕히|집에/)) text = '벌써요? 오늘 즐거웠어요. 조심히 들어가세요.';
  else if (asked === 'music') text = `오, ${t.length > 12 ? '그 음악' : t} 좋죠. 취향이 잘 맞을 것 같아요.`;
  else if (asked === 'job') text = '와, 멋진 일 하시네요. 힘들진 않으세요?';
  else if (asked === 'name') { m.playerName = t.replace(/(이에요|예요|입니다|요)$/, '').slice(0, 6); text = `${m.playerName} 님, 기억할게요.`; }
  else if (asked === 'place') text = '그렇구나. 앞으로 여기서 자주 뵈면 좋겠네요.';
  else if (has(/\?|까요|나요|세요|어때/)) text = pick(['음… 글쎄요. 그쪽은 어떻게 생각하세요?', '좋은 질문이네요. 저는 반반이에요.', '그런 건 처음 생각해 봤어요.']);
  else text = pick(['그렇군요. 더 얘기해 주세요.', '아, 정말요?', '음악 소리 때문에 잘 못 들었어요. 한 번만 다시요?', '그 얘기 좋네요.', '맞아요, 저도 그렇게 생각해요.']);
  // 가끔은 먼저 묻는다
  if (!m.asked && !after && Math.random() < 0.3) {
    const q = pick([['music', ' 그쪽은 어떤 음악 좋아하세요?'], ['job', ' 무슨 일 하세요?'], ['place', ' 여기는 어떻게 알고 오셨어요?']]);
    if (!m.said.has('q' + q[0])) { m.said.add('q' + q[0]); m.asked = q[0]; text += q[1]; }
  }
  return { text, after };
}
for (let i = 0; i < CROWD_BAR; i++) {
  const s = BAR_SPOTS[i * 2 % BAR_SPOTS.length], p = spawn(); npcs.push(p); s.by = p;
  place(p, s.x, s.z, Math.PI / 2 + rand(-0.3, 0.3)); setRole(p, 'bar'); npcCups(p); p.danceTo = 1; p.danceStyle = 0; p.groove = 0.3;
}

/* ───── 7080 당구 코너: 치는 사람 하나와 구경 둘 ───── */
const poolFolk = [];
if (POOL_AREA.on) {
  const cueG = new THREE.CylinderGeometry(0.008, 0.015, 1.4, 8);
  const cueM = new THREE.MeshStandardMaterial({ color: 0xb8865a, roughness: 0.4 });
  POOL_SPOTS.forEach((S) => {
    const p = spawn(); npcs.push(p); poolFolk.push(p);
    place(p, S.x, S.z, S.yaw);
    setRole(p, 'pool'); p.danceStyle = 0; p.groove = 0.3;
    if (S.shooter) {
      p.danceTo = 0.12;                       // 테이블에 붙어 있으니 거의 움직이지 않는다
      const cue = new THREE.Mesh(cueG, cueM); cue.position.set(0, -0.62, 0.04); p.arms[1].h.add(cue);
      p.isShooter = true;
      p.armPose = (b, tt) => {
        if (POOL_STATE.phase === 'aim') {     // 겨누고 큐를 앞뒤로 밀어 본다
          const st = Math.sin(tt * 2.1);
          return [[-1.16, 0.2, 0, -0.4], [-0.66, 0.05, 0, -1.12 + st * 0.44]];
        }
        return [[-0.3, 0.22, 0, -0.5], [-0.26, 0.12, 0, -1.5]];   // 치고 나서 허리를 편다
      };
    } else {
      p.danceTo = 0.45;
      p.armPose = () => [[-0.62, 0.3, -0.5, -1.75], [-0.7, 0.3, -0.5, -1.75]];  // 팔짱 끼고 구경
    }
  });
  if (poolFolk[1]) npcCups(poolFolk[1]);
}
// 한 판이 끝나면 한마디 한다
let poolSeen = 0;
function poolTick() {
  if (!poolFolk.length || POOL_STATE.phase !== 'rest' || POOL_STATE.shot === poolSeen) return;
  poolSeen = POOL_STATE.shot;
  const lines = POOL_STATE.sunk ? (venue.poolHit || ['나이스!']) : (venue.poolMiss || ['아깝다']);
  const who = POOL_STATE.sunk ? pick(poolFolk.slice(1)) : poolFolk[0];
  if (who) say(who, pick(lines), 2);
}

/* 충돌: 가구와 사람. 플레이어는 군중을 살짝 밀며 지나간다 */
const PERSON_R = 0.4;
function collide(p) {
  if (p.isStaff || p.inLine) return;
  for (const T of TABLES) {
    const dx = p.x - T.x, dz = p.z - T.z, d = Math.hypot(dx, dz), R = 0.62;
    if (d < R && d > 1e-3) { p.x = T.x + (dx / d) * R; p.z = T.z + (dz / d) * R; }
  }
  if (POOL_AREA.on) {   // 당구대는 네모나게 막는다
    const dx = p.x - POOL_AREA.x, dz = p.z - POOL_AREA.z;
    const ox = POOL_AREA.hx + 0.3 - Math.abs(dx), oz = POOL_AREA.hz + 0.3 - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x = POOL_AREA.x + Math.sign(dx || 1) * (POOL_AREA.hx + 0.3);
      else p.z = POOL_AREA.z + Math.sign(dz || 1) * (POOL_AREA.hz + 0.3);
    }
  }
  if (p.target || p.isPlayer) {
    for (const o of everyone) {
      if (o === p || o.isStaff || o.inLine || o === p.partner) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      if (d < PERSON_R * 2 && d > 1e-3) {
        const push = PERSON_R * 2 - d, ux = dx / d, uz = dz / d;
        if (o.role === 'pool') { p.x += ux * push; p.z += uz * push; }   // 당구 치는 사람은 밀리지 않는다
        else if (p.isPlayer && !o.isPlayer) { o.x -= ux * push; o.z -= uz * push; }
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

const seatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.47);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function tapFloor(cx, cy) {
  if (!freeWalk()) return;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 재즈 바: 의자를 누르면 그 의자에 앉는다 (의자 높이에서 맞춰 본다)
  if (venue.jazz && ray.ray.intersectPlane(seatPlane, hitP)) {
    let best = null, bd = 0.42;
    for (const T of TABLES) for (const S of T.seats) { const d = Math.hypot(S.x - hitP.x, S.z - hitP.z); if (d < bd) { bd = d; best = S; } }
    if (best) { sitAtTable(best.T, best); return; }
  }
  if (!ray.ray.intersectPlane(groundPlane, hitP)) return;
  const near = TABLES.find((T) => Math.hypot(T.x - hitP.x, T.z - hitP.z) < 0.8);
  if (near) { walkToTable(near); return; }
  walkPlayer(clamp(hitP.x, ROOM.xMin, ROOM.xMax), clamp(hitP.z, ROOM.zMin, ROOM.zMax));
}
const keys = new Set();
addEventListener('keydown', (e) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && freeWalk() && !modalOpen()) { keys.add(e.code); e.preventDefault(); } if (e.code === 'Escape') closeModals(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/* ───── 화면 ───── */
const modalOpen = () => !$('reqModal').hidden || !$('drinkModal').hidden || !$('settingsModal').hidden || !$('exitModal').hidden || !$('myListModal').hidden;
const closeModals = () => { $('reqModal').hidden = true; $('drinkModal').hidden = true; $('settingsModal').hidden = true; $('exitModal').hidden = true; $('myListModal').hidden = true; };
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
/* VIP: 줄을 서 있으면 가끔 리무진이 서고, VIP가 일행과 내려 줄을 건너뛰고 들어간다 */
const LIMO_Z = 17.4;
let camFocus = null;   // 잠깐 다른 곳을 비출 때 (리무진)
const limo = (() => {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.18, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.05, metalness: 0.9 }), chrome = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.15, metalness: 1 });
  const bx = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  bx(8.4, 0.72, 1.92, white, 0, 0.62, 0);
  bx(6.3, 0.5, 1.78, glass, -0.25, 1.22, 0);
  bx(6.0, 0.06, 1.74, white, -0.25, 1.49, 0);
  bx(8.42, 0.05, 1.94, chrome, 0, 0.5, 0);
  [-3.2, -1.1, 1.0].forEach((x) => bx(0.06, 0.5, 1.8, white, x, 1.22, 0));   // 창 기둥
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  [[3.0, 0.92], [3.0, -0.92], [-3.0, 0.92], [-3.0, -0.92]].forEach(([x, z]) => { const w = new THREE.Mesh(wheel, tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); });
  const glowM = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  [-0.65, 0.65].forEach((z) => { bx(0.05, 0.12, 0.34, glowM(0xffffff), 4.21, 0.72, z); bx(0.05, 0.1, 0.34, glowM(0xff2020), -4.21, 0.72, z); });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.03; g.add(under);   // 바닥 무드등
  g.visible = false; scene.add(g);
  return { g, x: -80, v: 0, state: 'off' };
})();
const vipEvent = { at: 0, done: 0 };
const forceVip = /[?&]vip\b/.test(location.search);
function vipLook(kind) {
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  if (kind === 'vip') return { style: 0, top: m(0x0b0b0f, { roughness: 0.35 }), bottom: m(0x0b0b0f), shoe: m(0x2a1a10, { roughness: 0.2 }), skirt: false, height: 1.05, hair: m(0x111111) };
  const dress = kind === 'a' ? m(0xc8102e, { roughness: 0.25, metalness: 0.35 }) : m(0xd4af37, { roughness: 0.2, metalness: 0.75 });
  return { style: kind === 'a' ? 2 : 1, top: dress, bottom: dress, skirt: true, shoe: m(0x111111, { roughness: 0.15 }), height: 0.99, hair: m(kind === 'a' ? 0x1a1210 : 0xe8c872) };
}
function dressUpVip(p) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.2, metalness: 1 });
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.03), dark); shades.position.set(0, 0.02, 0.13); p.head.add(shades);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 20), gold); chain.rotation.x = Math.PI / 2 + 0.35; chain.position.set(0, 0.5, 0.03); p.torso.add(chain);
}
function startVip() {
  vipEvent.done++; queueBusy = true;
  camFocus = [1.2, 13.6]; camSet(0.9, 1.2, 12.5, 1.2);
  toast('리무진 한 대가 다가옵니다', 2.4);
  limo.x = -70; limo.v = 16; limo.state = 'in'; limo.g.visible = true; limo.g.position.set(limo.x, 0, LIMO_Z);
  edm.door?.();
  later(1.2, () => { const p = queue.find((q) => q !== player); if (p) say(p, pick(['어, 리무진이다!', '저 차 뭐야?', '와, 리무진!']), 2); });
}
function vipArrived() {
  const party = ['vip', 'a', 'b'].map((k, i) => {
    const p = spawn(vipLook(k)); p.isStaff = true; p.speed = 1.25;
    place(p, 0.9 - i * 0.75, LIMO_Z - 1.15, Math.PI);
    if (k === 'vip') dressUpVip(p);
    return p;
  });
  const [vip, a, b] = party;
  say(vip, '오늘 자리 있지?', 1.8);
  toast('VIP가 일행과 내려 줄을 건너뛰고 들어갑니다', 2.8);
  later(0.6, () => { say(queue.find((q) => q !== player) || bouncer, pick(['VIP인가 봐요', '연예인 아니에요?', '우린 언제 들어가…']), 2.2); });
  bouncer.crossTo = 0; bouncer.yawTo = 2.4;
  later(1.4, () => say(bouncer, 'VIP님, 바로 모시겠습니다', 2.2));
  const path = [[0.15, 15.2], [0.1, 12.6], [0, 10.9], [0, 8.2], [0, 5.3]];
  const walk = (p, dx, delay) => {
    let i = 0;
    const next = () => {
      if (i === 2) { world.setDoor(true); edm.door(); }
      if (i >= path.length) {   // 안으로 들어가면 플로어 손님이 된다
        p.isStaff = false; p.free = false; npcs.push(p);
        if (venue.jazz) { seatGuest(p); return; }
        const [x, z] = freeFloorSpot(); goTo(p, x, z, () => { p.yawTo = yawToStage(p.x, p.z); setRole(p, 'floor'); });
        return;
      }
      const [x, z] = path[i++]; goTo(p, x + dx, z, next);
    };
    later(delay, next);
  };
  walk(vip, 0, 0.6); walk(a, -0.5, 1.0); walk(b, 0.5, 1.2);
  later(2.8, () => say(a, pick(['여기 분위기 좋다!', '오늘 달려요!']), 1.8));
  // 일행이 문을 지나면 줄을 다시 움직인다
  const wait = () => {
    if (party.every((p) => p.z < 8.6)) {
      if (phase === 'queue') world.setDoor(false);
      bouncer.crossTo = 1; bouncer.yawTo = 0.8;
      queueBusy = false; queueTimer = 2.4;
      limo.state = 'out'; limo.v = 0.5;
      later(2.5, () => { camFocus = null; if (phase === 'queue') camSet(0.82, 1.46, 8.2, 2); });
      return;
    }
    later(0.3, wait);
  };
  later(3, wait);
}
function updateLimo(dt) {
  if (limo.state === 'off') return;
  if (limo.state === 'in') {
    limo.v = Math.max(0.6, Math.min(16, -limo.x * 0.85));
    limo.x += limo.v * dt;
    if (limo.x >= -0.02) { limo.x = 0; limo.state = 'park'; vipArrived(); }
  } else if (limo.state === 'out') {
    limo.v = Math.min(18, limo.v + 5 * dt); limo.x += limo.v * dt;
    if (limo.x > 85) { limo.state = 'off'; limo.g.visible = false; }
  }
  limo.g.position.x = limo.x;
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
        if (venue.jazz) { seatGuest(p); return; }
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
  if (venue.jazz) {
    for (const T of TABLES) { const free = T.seats.filter((S) => !S.by).length; if (!free) continue; const d = Math.hypot(T.x - player.x, T.z - player.z) + (T.by === 'npc' || T.seats.some((S) => S.by && S.by !== player) ? 6 : 0); if (d < bd) { bd = d; best = T; } }
    return best || TABLES[0];
  }
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
  stopMingle(x, z); leaveSeat(player); stopBlues();
  dest.position.set(x, 0.045, z); dest.visible = true;
  goTo(player, x, z, () => { dest.visible = false; done?.(); renderUi(); });
  renderUi();
}
function walkToTable(T) {
  if (venue.jazz) { sitAtTable(T); return; }
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
function sitAtTable(T, want = null) {
  stopBlues();
  if (want && want.by && want.by !== player) { toast('다른 손님이 앉은 자리입니다', 1.8); return; }
  if (want ? player.seat === want && player.sit : player.seat?.T === T && player.sit) return;
  const free = want ? [want] : T.seats.filter((S) => !S.by || S.by === player).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  if (!free.length) { toast('그 탁자는 자리가 다 찼습니다. 빈 자리로 갑니다', 2.2); const N = nearestFreeTable(); if (N !== T) sitAtTable(N); return; }
  if (T.seats.some((S) => S.by && S.by !== player)) toast('손님들과 합석합니다', 1.8);
  leaveSeat(player); stopMingle();
  if (myTable && myTable !== T && mate) { mate = null; closeChat(); }
  myTable = T;
  camSet(clamp(-T.x * 0.05, -0.5, 0.5), 1.2, 4.2, 1.2);
  dest.visible = false;
  player.lastSeat = free[0];
  walkToSeat(player, free[0], () => {
    if (myDrink.table !== T && myDrink.cup) placeCupOnTable(T);
    if (!myDrink.def) { caption('어떤 음료로 할까요?'); openDrinks(); }
    if (step < 3) setStep(3);
    renderUi();
  });
  renderUi();
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
  myDrink.pos.set(T.x + Math.sin(k) * 0.24, T.top + 0.07, T.z + Math.cos(k) * 0.24);
  myDrink.table = T;
  myDrink.cup.position.copy(myDrink.pos);
}
/* 주문하면 홀 직원이 쟁반에 받쳐 자리로 가져다준다 */
let serving = false;
function serveDrink(d) {
  if (sending) { later(1, () => serveDrink(d)); return; }
  const T = myTable || nearestFreeTable();
  serving = true;
  if (myDrink.cup) { myDrink.cup.parent?.remove(myDrink.cup); myDrink.cup = null; }
  myDrink.def = d; myDrink.level = 0;
  tray.children.slice(1).forEach((c) => tray.remove(c));
  const c = makeCup(d); scene.remove(c); c.position.set(0, 0.08 * (d.glass?.[1] || 1), 0); tray.add(c);
  toast(`${d.name} 주문했습니다. 홀 직원이 가져다 드립니다`, 2.4); renderUi();
  const k = Math.atan2(player.x - T.x, player.z - T.z) + 0.85, sx = T.x + Math.sin(k) * 1.3, sz = T.z + Math.cos(k) * 1.3;
  later(0.8, () => {
    waiter.showIdTo = 1; tray.visible = true;
    goTo(waiter, sx, sz, () => {
      waiter.yawTo = Math.atan2(T.x - waiter.x, T.z - waiter.z);
      say(waiter, `주문하신 ${d.name} 나왔습니다`, 2.2);
      if (!player.target) player.yawTo = Math.atan2(waiter.x - player.x, waiter.z - player.z);
      later(1.2, () => {
        tray.visible = false; waiter.showIdTo = 0; tray.remove(c);
        myDrink.cup = makeCup(d); myDrink.level = 1; player.sipHigh = !!d.noStraw;
        placeCupOnTable(T); edm.clink(); serving = false;
        later(0.4, () => say(player, '고맙습니다', 1.4));
        toast(`${d.name} 나왔습니다. 한 모금 하세요`, 2.2); renderUi();
        goTo(waiter, WAITER_HOME[0], WAITER_HOME[1], () => { waiter.yawTo = -Math.PI / 2; });
      });
    });
  });
}
const orderDrink = (d) => serveDrink(d);
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
    const cheers = venue.toastWord, together = myDrink.cup && myDrink.level > 0 && !player.sipTo;
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
  if (serving) { toast('홀 직원이 내 음료를 가져오는 중입니다. 잠시 뒤에 보내 주세요', 2.4); return; }
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
          say(g[0], pick(venue.band ? [`${T.i + 1}번 테이블, 잘 마실게요!`, `고맙습니다! ${venue.toastWord}`] : [`${T.i + 1}번 테이블, 땡큐!`, '잘 마실게요! 건배!']), 2.4);
          g.forEach((n, i) => { n.waveTo = 1; later(1.4, () => { n.waveTo = 0; later(0.3 + i * 0.2, () => { n.sipTo = 1; later(1.5, () => { n.sipTo = 0; }); }); }); });
          toast(`${T.i + 1}번 테이블에서 고맙다고 손을 흔듭니다`, 2.6);
          // 나도 그 테이블을 보며 같이 손을 흔든다
          if (!player.target) {
            player.yawTo = Math.atan2(T.x - player.x, T.z - player.z);
            later(0.35, () => { player.waveTo = 1; later(1.6, () => { player.waveTo = 0; }); });
          }
          say(player, venue.toastWord, 1.4);
          if (myDrink.cup && myDrink.level > 0 && inTableReach() && !player.sipTo) later(2.1, sip);
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
const GROOVES = [{ name: '살짝', style: 0, g: 0.5 }, { name: '리듬 타기', style: 0, g: 1.0 }, { name: '신나게', style: 1, g: 1.2 }, { name: '셔플댄스', style: 6, g: 1.2 }];
function toggleGroove() {
  grooving = !grooving;
  if (grooving) applyGroove(); else player.danceTo = 0;
  renderUi();
}
function applyGroove() { const g = GROOVES[grooveLevel]; player.danceStyle = g.style === 6 ? SHUFFLES[shuffleIdx].s : g.style; player.groove = g.g; }
function shuffleDance(idx = shuffleIdx) {
  const was = isShuffle();
  shuffleIdx = idx; grooving = true; grooveLevel = GROOVES.findIndex((g) => g.style === 6); applyGroove();
  const sh = SHUFFLES[shuffleIdx];
  toast(`셔플: ${sh.name}`, 1.6);
  // 근처 사람 몇이 따라 춘다 (이미 셔플 중이던 사람은 바뀐 동작으로)
  const near = npcs.filter((n) => n.role === 'floor' && !n.target && Math.hypot(n.x - player.x, n.z - player.z) < 4.5 && (!was || isShuffleStyle(n.danceStyle))).slice(0, 3);
  near.forEach((n, i) => later((was ? 0.4 : 1) + i * 0.6, () => { if (n.role === 'floor') { n.danceStyle = sh.s; n.groove = 1.1; if (i === 0) say(n, was ? pick([`${sh.name}!`, '이것도 좋다!', '따라 해요!']) : pick(['오, 셔플!', '나도!', '같이 가요!']), 1.6); } }));
  renderUi();
}
function nextShuffle() { shuffleDance((shuffleIdx + 1) % SHUFFLES.length); }
function stopShuffle() { grooveLevel = 1; applyGroove(); toast('리듬 타기로 돌아갑니다'); renderUi(); }
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
    const x = venue.jazz ? rand(FLOOR.xMin + 0.8, FLOOR.xMax - 0.8) : rand(-4, 4), z = venue.jazz ? rand(FLOOR.zMin + 1, FLOOR.zMax - 0.5) : rand(-14.5, -11);
    const near = Math.min(...npcs.filter((n) => n.role === 'floor').map((n) => Math.hypot(n.x - x, n.z - z)));
    if (near > bd) { bd = near; best = [x, z]; }
  }
  setStep(5);
  buddyToStage(best[0], best[1]);
  walkPlayer(best[0], best[1], () => {
    player.yawTo = 0 + Math.PI;
    edm.setRoom(3); stageArrived = true;
    grooving = true; if (grooveLevel === 0) grooveLevel = 1; applyGroove();
    toast(venue.jazz ? '무대 앞 작은 플로어입니다' : '메인 스테이지 앞입니다. 이웃과 어울려 보세요', 3);
    renderUi();
  });
}
const HELLOS = venue.hellos;
function mingle() {
  stopLine();
  stopMingle();
  const near = npcs.filter((n) => n.role === 'floor' && !n.target && Math.hypot(n.x - player.x, n.z - player.z) < 7).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 5);
  if (!near.length) { toast('주변에 사람이 없습니다. 플로어 쪽으로 가 보세요'); return; }
  const base = rand(0, 6);
  near.forEach((n, i) => {
    const a = base + (i / near.length) * Math.PI * 2, x = clamp(player.x + Math.sin(a) * 1.45, FLOOR.xMin + 0.5, FLOOR.xMax - 0.5), z = clamp(player.z + Math.cos(a) * 1.45, ROOM.zMin, FLOOR.zMax - 0.3);
    n.danceTo = 0; n.mingle = true;
    goTo(n, x, z, () => {
      n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
      n.danceTo = 1;
    });
    later(0.3 + i * 1.1, () => { if (n.mingle) say(n, HELLOS[(i + Math.floor(base * 10)) % HELLOS.length], 2.3); });
  });
  mingling = near; camSet(cam.thetaTo, 1.34, 7.4, 1.9);
  grooving = true; applyGroove();
  say(player, '안녕하세요!', 1.8); player.waveTo = 1; later(1.1, () => { player.waveTo = 0; });
  toast('모인 사람들이 내 동작을 따라 합니다', 2.4);
  renderUi();
}
/* 라인댄스: 어울린 사람들과 줄을 맞춰 16카운트 루틴을 함께 춘다 (벽이 바뀔 때마다 왼쪽으로 1/4 회전)
   1~4 오른쪽 그레이프바인 · 5~8 왼쪽으로 돌아오기 · 9~12 뒤로 세 걸음 박수 · 13~16 앞으로 세 걸음, 왼쪽으로 돌기 */
let line = null;
const LINE_PARTS = ['오른쪽으로 그레이프바인', '왼쪽으로 돌아오기', '뒤로 세 걸음, 박수', '앞으로 세 걸음, 왼쪽으로 돌기'];
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function lineOffset(k) {   // 오른쪽(R)·앞(F) 거리, 걷는 중인지
  if (k < 3) return [smooth(k / 3) * 1.1, 0, true];
  if (k < 4) return [1.1, 0, false];
  if (k < 7) return [1.1 - smooth((k - 4) / 3) * 1.1, 0, true];
  if (k < 8) return [0, 0, false];
  if (k < 11) return [0, -smooth((k - 8) / 3) * 0.9, true];
  if (k < 12) return [0, -0.9, false];
  if (k < 14) return [0, -0.9 + smooth((k - 12) / 2) * 0.9, true];
  return [0, 0, false];
}
function startLine() {
  if (line) return stopLine();
  const extra = npcs.filter((n) => n.role === 'floor' && !n.mingle && !n.target && Math.hypot(n.x - player.x, n.z - player.z) < 9)
    .sort((p, q) => Math.hypot(p.x - player.x, p.z - player.z) - Math.hypot(q.x - player.x, q.z - player.z)).slice(0, Math.max(0, 11 - mingling.length));
  const crew = [...mingling, ...extra];
  const COLS = 4, GAP = 1.5, rows = Math.ceil((crew.length + 1) / COLS);
  const cx = clamp(player.x, FLOOR.xMin + 1.2 + GAP * 1.5, FLOOR.xMax - 1.2 - GAP * 1.5);
  const z0 = clamp(player.z, FLOOR.zMin + 1.3, FLOOR.zMax - 1.3 - GAP * (rows - 1));
  // 나는 앞줄 가운데(왼쪽에서 두 번째), 나머지는 가까운 사람부터 앞줄로
  const spots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) spots.push({ x: cx + (c - 1.5) * GAP, z: z0 + r * GAP });
  const mine = spots.splice(1, 1)[0];
  line = { crew: [player, ...crew], extra, startBeat: null, gatherUntil: now() + 7, wall: 0, lastK: -1, F0: Math.PI };
  player.line = { hx: mine.x, hz: mine.z };
  crew.forEach((n, i) => {
    const sp = spots[i]; n.mingle = true; n.line = { hx: sp.x, hz: sp.z }; n.danceTo = 0; n.upTo = 0;
    n.run = true; goTo(n, sp.x, sp.z, () => { n.run = false; n.yawTo = line?.F0 ?? n.yawTo; });
  });
  stopGrooveShuffleForLine();
  goTo(player, mine.x, mine.z, () => { player.yawTo = Math.PI; renderUi(); });
  camSet(0.5, 1.22, 11, 1.4);
  say(player, '줄 맞춰 라인댄스 해요!', 2);
  toast(`라인댄스 ${line.crew.length}명 · 자리를 잡는 중입니다`, 2.4);
  renderUi();
}
function stopGrooveShuffleForLine() { grooving = true; if (grooveLevel === 0) grooveLevel = 1; applyGroove(); }
function stopLine() {
  if (!line) return;
  line.crew.forEach((p) => { p.stepMove = false; p.line = null; if (p !== player) { p.run = false; p.target = null; p.onArrive = null; p.danceTo = 1; p.danceStyle = pickStyle(venue.styles); } });
  line.extra.forEach((n) => { n.mingle = false; });
  line = null; player.target = null;
  toast('라인댄스를 마칩니다', 1.6);
  renderUi();
}
const lineCaption = () => {
  if (!line) return null;
  if (line.startBeat == null) return ['줄을 맞추는 중입니다', `${line.crew.length}명이 자리로 갑니다`];
  if (line.lastK < 0) return ['넷 세고 시작합니다', '5, 6, 7, 8!'];
  const part = Math.floor(line.lastK / 4);
  return [`${line.lastK + 1} · ${LINE_PARTS[part]}`, `라인댄스 ${line.crew.length}명 · ${line.wall + 1}번째 벽`];
};
function lineTick(clock) {
  if (!line) return;
  // 내가 걸어 나가면 끝낸다 (자리 잡는 동안은 제외)
  if (line.startBeat != null && player.target) return stopLine();
  if (line.startBeat == null) {
    const ready = !player.target && line.crew.every((p) => !p.target);
    if (ready || now() > line.gatherUntil) {
      line.startBeat = Math.ceil(clock.beat / 4) * 4 + 4;
      line.crew.forEach((p) => { if (p !== player) { p.target = null; p.onArrive = null; p.run = false; } });
      say(player, '5, 6, 7, 8!', 1.6);
    } else return;
  }
  const c = clock.beat - line.startBeat;
  line.crew.forEach((p, i) => {
    if (!p.line) return;
    if (c < 0) {   // 시작 전: 제자리에서 앞을 보고 가볍게 바운스
      p.stepMove = false; p.yawTo = line.F0; p.danceTo = 1; p.danceStyle = 1; p.groove = 0.5;
      if (p !== player && !p.target) { p.x += (p.line.hx - p.x) * 0.2; p.z += (p.line.hz - p.z) * 0.2; }
      return;
    }
    const cyc = Math.floor(c / 16), k = c - cyc * 16;
    const F = line.F0 - cyc * (Math.PI / 2) - (k >= 14 ? smooth((k - 14) / 2) * (Math.PI / 2) : 0), Fb = line.F0 - cyc * (Math.PI / 2);
    const [R, Fw, walking] = lineOffset(k);
    const rx = -Math.cos(Fb), rz = Math.sin(Fb), fx = Math.sin(Fb), fz = Math.cos(Fb);
    p.x = p.line.hx + rx * R + fx * Fw; p.z = p.line.hz + rz * R + fz * Fw;
    p.yaw = p.yawTo = F; p.stepMove = walking; p.target = null;
    // 걷지 않는 박: 박수 (스텝 박수 동작)
    p.danceStyle = 3; p.groove = 0.9; p.danceTo = walking ? 0 : 1; p.upTo = 0;
    p.beatOff = p === player ? 0 : -0.02 * ((i % 4) + 1);
  });
  const n = Math.floor(c);
  if (n >= 0 && n !== line.n) {
    line.n = n; const k = n % 16; line.lastK = k; line.wall = Math.floor(n / 16) % 4;
    if (k === 3 || k === 7 || k === 11) edm.clap?.(edm.ctx.currentTime, 0.32);
    if (k === 0 && n > 0) { const m = pick(line.crew.filter((p) => p !== player)); if (m) say(m, pick(['이번엔 이쪽 벽!', '잘한다!', '한 번 더!', '예이!']), 1.4); }
    const [m1, m2] = lineCaption(); caption(m1, m2);
  } else if (c < 0) { const [m1, m2] = lineCaption(); caption(m1, m2); }
}

/* 어울리는 사람들은 내 동작을 그대로 따라 한다: 춤 종류·흥·손 들기·손 흔들기·박자 */
function syncMingle() {
  mingling.forEach((n, i) => {
    if (n.target || n.line) return;
    n.danceTo = player.danceTo; n.danceStyle = player.danceStyle; n.groove = player.groove;
    n.beatOff = player.beatOff - 0.02 * (i + 1);          // 아주 조금씩 늦게 따라 한다
    n.upTo = player.upTo; n.waveTo = player.waveTo;
    n.yawTo = Math.atan2(player.x - n.x, player.z - n.z);
  });
}
function stopMingle(x = null, z = null) {
  const keep = x != null && Math.hypot(x - player.x, z - player.z) < 2.6;
  if (keep) return;
  mingling.forEach((n) => { n.mingle = false; });
  mingling = []; renderUi();
}
/* 따라 하는 사람: 기본은 어울리는 사람만, '전원 따라 하기'를 켜면 나 말고 실내 손님 전원 (가까운 사람부터 물결처럼) */
const followers = () => {
  if (!settings.allFollow) return mingling;
  return npcs.filter((n) => !n.isStaff && !n.inLine && !n.target && !performers.includes(n) && ['floor', 'table', 'bar'].includes(n.role))
    .sort((p, q) => Math.hypot(p.x - player.x, p.z - player.z) - Math.hypot(q.x - player.x, q.z - player.z));
};
function handsUp() {
  player.upTo = player.upTo ? 0 : 1;
  const f = followers(), gap = settings.allFollow ? 0.04 : 0.15;
  if (player.upTo) { f.forEach((n, i) => later(gap * i, () => { n.upTo = 1; })); later(3.4 + gap * f.length, () => { player.upTo = 0; f.forEach((n) => { n.upTo = 0; }); renderUi(); }); }
  else f.forEach((n) => { n.upTo = 0; });
  renderUi();
}
function doJump() { jump(player); const f = followers(); f.forEach((n, i) => later((settings.allFollow ? 0.03 : 0.08) * i, () => jump(n))); }
function toggleAllFollow() {
  settings.allFollow = !settings.allFollow; saveSettings();
  if ($('allFollow')) $('allFollow').checked = settings.allFollow;
  toast(settings.allFollow ? '손 들기·점프를 나 말고 전원이 따라 합니다' : '어울리는 사람만 따라 합니다', 2.2);
  renderUi();
}
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
  if (!atTable && (!myTable || !hasCup || step < 4)) list.push({ label: venue.jazz ? '자리에 앉기' : '스탠딩 테이블로 가기', primary: step === 3, fn: () => walkToTable(myTable || nearestFreeTable()) });
  if (serving) list.push({ label: '서빙 기다리는 중', disabled: true, fn: () => {} });
  else if (atTable && !hasCup) list.push({ label: '음료 고르기', primary: true, fn: () => openDrinks() });
  if (atTable && hasCup) {
    if (myDrink.level > 0) list.push({ label: player.sipTo ? '마시는 중' : `한 모금 마시기 (${Math.round(myDrink.level * 100)}%)`, primary: step === 3, disabled: !!player.sipTo, fn: sip });
    else list.push({ label: '한 잔 더', fn: () => openDrinks() });
  }
  if (step >= 3 && !player.target) list.push({ label: sending ? '보내는 중' : '다른 테이블에 한 잔 보내기', disabled: sending, fn: openSend });
  if (venue.jazz && mateHere() && atTable) list.push({ label: $('chatPanel').hidden ? `${mate.persona.name} 님과 대화하기` : '대화창 닫기', primary: $('chatPanel').hidden && step >= 3, fn: () => ($('chatPanel').hidden ? openChat() : closeChat()) });
  if (atTable && buddyHere()) list.push({ label: offering ? '권하는 중' : '같이 온 분에게 권하기', disabled: offering, fn: () => openDrinks(true) });
  if (myDrink.sips > 0 || step >= 4) {
    list.push({ label: grooving ? '건들거리기 멈추기' : '건들거리기', primary: step === 4 && !grooving, on: grooving, fn: toggleGroove });
    if (grooving) list.push({ label: `흥: ${GROOVES[grooveLevel].name}`, fn: nextGrooveLevel });
    if (venue.lp) list.push({ label: '신청곡 쓰기', primary: step === 4 && grooveBeats >= 8, fn: openRequest });
    else if (venue.jazz) list.push({ label: playerCouple() ? '블루스 그만' : '블루스 추기', on: !!playerCouple(), primary: step === 4 && grooveBeats >= 8 && !playerCouple(), fn: blues });
    else if (!isShuffle()) list.push({ label: '셔플댄스', fn: () => shuffleDance() });
    else {
      list.push({ label: `셔플: ${SHUFFLES[shuffleIdx].name} ▸`, on: true, fn: nextShuffle });
      list.push({ label: '셔플 그만', fn: stopShuffle });
    }
  }
  if (venue.jazz) {
    if (!venue.lp && step >= 4 && !player.target && !playerCouple() && !onFloor()) list.push({ label: '플로어로 나가기', fn: goStage });
    if (step >= 4 && !player.target && !player.sit && myTable) list.push({ label: '내 자리로', fn: () => sitAtTable(myTable, player.lastSeat && (!player.lastSeat.by || player.lastSeat.by === player) ? player.lastSeat : null) });
  } else if (step >= 4 && !onFloor() && !player.target) {
    list.push({ label: '메인 스테이지로 가기', primary: grooveBeats >= 8, fn: goStage });
    if (!atTable && myTable) list.push({ label: '테이블로', fn: () => walkToTable(myTable) });
  } else if (step >= 4 && onFloor() && (stageArrived || !player.target)) {
    if (line) list.push({ label: '라인댄스 그만', on: true, fn: stopLine });
    else {
      list.push({ label: mingling.length ? '다른 사람과 어울리기' : '어울리기', primary: !mingling.length, fn: mingle });
      if (mingling.length) list.push({ label: '라인댄스', primary: true, fn: startLine });
    }
    list.push({ label: '손 들기', on: !!player.upTo, fn: handsUp });
    list.push({ label: '점프', fn: doJump });
    list.push({ label: settings.allFollow ? '전원 따라 하기: 켬' : '전원 따라 하기: 끔', on: settings.allFollow, fn: toggleAllFollow });
    list.push({ label: '하이파이브', fn: highFive });
    list.push({ label: '테이블로', fn: () => walkToTable(myTable || nearestFreeTable()) });
  }
  actions(list);

  if (line) { const [m1, m2] = lineCaption(); caption(m1, m2); }
  else if (player.target) caption('걸어가는 중입니다');
  else if (step === 3 && !atTable) caption(venue.jazz ? '빈 자리에 앉아 한 잔 하세요' : '스탠딩 테이블로 가서 목을 축이세요', venue.jazz ? '버튼을 누르거나 촛불 켜진 탁자를 눌러도 됩니다' : '버튼을 누르거나 빛나는 테이블을 눌러도 됩니다');
  else if (step === 3 && serving) caption('홀 직원이 음료를 가져다 드립니다', '잠시 기다리세요');
  else if (step === 3 && !hasCup) caption('어떤 음료로 할까요?');
  else if (step === 3) caption('시원하게 한 모금 하세요');
  else if (step === 4 && !grooving) caption('음악에 몸을 맡겨 보세요', '건들거리기를 누르면 박자에 맞춰 흔듭니다');
  else if (step === 4) caption(grooveBeats < 8 ? `좋습니다. 그대로 리듬을 타세요` : venue.lp ? '신청곡 쓰기로 듣고 싶은 판을 부탁해 보세요' : venue.jazz ? '블루스 추기를 누르면 근처 손님과 함께 춥니다' : '몸이 풀렸습니다. 메인 스테이지로 가 볼까요?');
  else if (venue.jazz && playerCouple()) caption('천천히 돌며 블루스를 춥니다', '블루스 그만을 누르면 자리로 돌아갑니다');
  else if (venue.jazz) caption('');
  else if (step === 5 && onFloor() && !mingling.length) caption('어울리기를 누르면 주변 사람들이 모입니다');
  else if (step === 5 && mingling.length) caption(`함께 ${mingling.length + 1}명이 어울리는 중입니다`, hi5 ? `하이파이브 ${hi5}회` : '라인댄스를 누르면 줄을 맞춰 다 함께 춥니다');
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
  // 기본 곡 다음에 myList 곡으로 이어진다
  const order = [...venueTracks, ...myItems()], cur = nowFile || edm.track, next = order[(order.indexOf(cur) + 1) % order.length];
  if (next.blob) { playItem(next); return; }
  nowFile = null;
  settings.tracks[venue.id] = next.id; saveSettings();
  edm.setTrack(next.id); announceTrack(next); renderMyList();
};
$('autoNextRow').hidden = venue.id !== 'club';
$('autoNext').onchange = (e) => { settings.autoNext = e.target.checked; edm.autoNext = venue.id === 'club' && settings.autoNext; saveSettings(); };
$('btnSettings').onclick = () => { drawTracks(); $('autoNext').checked = settings.autoNext; $('volume').value = settings.volume; $('lowFx').checked = settings.lowFx; $('allFollow').checked = settings.allFollow; $('settingsModal').hidden = false; };
const syncGuide = () => { const on = settings.guide !== false; document.body.classList.toggle('noGuide', !on); $('btnGuide').textContent = on ? '안내 켬' : '안내 끔'; $('btnGuide').setAttribute('aria-pressed', String(on)); };
$('btnGuide').onclick = () => { settings.guide = settings.guide === false; saveSettings(); syncGuide(); toast(settings.guide ? '안내 문구를 보여 줍니다' : '안내 문구를 숨깁니다', 1.4); };
syncGuide();
$('allFollow').onchange = (e) => { settings.allFollow = e.target.checked; saveSettings(); renderUi(); };
$('volume').oninput = (e) => { settings.volume = +e.target.value; edm.setVolume(settings.volume / 100); saveSettings(); };
$('lowFx').onchange = (e) => { settings.lowFx = e.target.checked; fxState.full = !settings.lowFx; saveSettings(); };

/* ───── myList: 내 음원 (무대마다 따로) ───── */
let saved = [], temp = [], shared = [], nowFile = null, nowUrl = null, armedDelete = null, tempSeq = 0;
const myItems = () => [...shared, ...saved, ...temp];
/* 공용 곡: 저장소 music/ 폴더의 곡을 모두가 함께 듣는다 (목록은 music/tracks.json) */
async function loadShared() {
  try {
    const r = await fetch(`music/tracks.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const list = (await r.json()).tracks || [];
    shared = list.filter((x) => (x.venue || 'live7080') === venue.id).map((x) => ({ shared: true, title: x.title, url: `music/${x.file}`, size: x.size || 0, lrc: x.lyrics ? `music/${x.lyrics}` : null, lyrics: null, analysis: null }));
    renderMyList();
  } catch { /* 목록이 없으면 공용 곡 없이 */ }
}
/* 가사(자막) */
let lyricsOn = localStorage.getItem('clubpulse-lyrics') !== 'off', lyr = null, lyrIdx = -2, lyrItem = null;
/* 가사는 실내 왼쪽 벽 전광판에만 띄운다 */
const lyBoard = (() => {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 400;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.54), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  m.position.set(-13.86, 3.65, -6); m.rotation.y = Math.PI / 2; m.visible = false; scene.add(m);
  return { c, g: c.getContext('2d'), tex, m };
})();
function drawBoard(now, next) {
  const { c, g, tex } = lyBoard, W = c.width, H = c.height, acc = venue.band ? '#ffb347' : '#ff4fd8';
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,6,18,0.78)'; g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 40); g.fill();
  g.lineWidth = 6; g.strokeStyle = acc; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (text, size, weight, maxW) => { let s = size; do { g.font = `${weight} ${s}px Pretendard, "Malgun Gothic", sans-serif`; s -= 6; } while (g.measureText(text).width > maxW && s > 40); };
  fit(now, 150, 800, W - 140); g.shadowColor = acc; g.shadowBlur = 34; g.fillStyle = '#ffffff'; g.fillText(now, W / 2, next ? H * 0.4 : H / 2);
  g.shadowBlur = 0;
  if (next) { fit(next, 78, 600, W - 200); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(next, W / 2, H * 0.78); }
  tex.needsUpdate = true;
}
function setLyrics(it) {
  lyrItem = it; lyrIdx = -2;
  lyr = it?.lyrics ? lyricLines(it.lyrics, edm.fileEl?.duration || it.analysis?.duration) : null;
  $('btnLyrics').hidden = !lyr; $('btnLyrics').classList.toggle('on', lyricsOn);
  $('btnLyrics').setAttribute('aria-pressed', String(lyricsOn));
  $('lyrics').hidden = true;
  lyBoard.m.visible = !!(lyr && lyricsOn);
  if (lyBoard.m.visible) drawBoard('♪', lyr.lines[0]?.text || '');
}
function updateLyrics() {
  if (!lyr || !lyricsOn || !nowFile || !edm.fileEl) return;
  if (!lyr.timed && lyrItem && edm.fileEl.duration > 5 && Math.abs(lyr.lines[lyr.lines.length - 1].t - edm.fileEl.duration * (0.06 + 0.9 * (lyr.lines.length - 1) / lyr.lines.length)) > 1) setLyrics(lyrItem);
  const ct = edm.fileEl.currentTime + 0.15, L = lyr.lines;
  let i = -1; for (let j = 0; j < L.length && L[j].t <= ct; j++) i = j;
  if (i === lyrIdx) return;
  lyrIdx = i;
  const now = i >= 0 ? L[i].text : '', next = L.slice(i + 1).find((l) => l.text)?.text || '';
  drawBoard(now || '♪', next);
}
async function findId3(it) {
  if (it.shared || it.lyrics || it.id3Checked || !/mpeg|mp3/i.test(it.type || '') && !/\.mp3$/i.test(it.name)) return;
  it.id3Checked = true;
  const text = await id3Lyrics(it.blob);
  if (!text || it.lyrics) return;
  it.lyrics = text; if (!it.temp) putTrack(it).catch(() => {});
  if (nowFile === it) setLyrics(it);
  toast('음원 파일 안에 든 가사를 찾았습니다', 2.2); renderMyList();
}
let lyEdit = null;
function openLyrics(it) {
  lyEdit = it;
  $('lySong').textContent = it.title; $('lyText').value = it.lyrics || '';
  $('myListModal').hidden = true; $('lyricsModal').hidden = false;
  setTimeout(() => $('lyText').focus(), 50);
}
async function saveLyrics(text) {
  const it = lyEdit; if (!it) return;
  it.lyrics = text.trim() || null;
  try { if (!it.temp) await putTrack(it); } catch { toast('저장하지 못했습니다'); return; }
  if (nowFile === it) setLyrics(it);
  toast(it.lyrics ? (lyricLines(it.lyrics, 0)?.timed ? '시간 맞춘 가사를 저장했습니다' : '가사를 저장했습니다 (곡 길이에 맞춰 나눕니다)') : '가사를 지웠습니다', 2.4);
  $('lyricsModal').hidden = true; renderMyList(); $('myListModal').hidden = false;
}
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
async function refreshSaved() {
  // 무대마다 목록이 따로다. 예전에 저장한 곡(무대 표시 없음)은 7080 곡이다
  try { saved = (await listTracks()).filter((x) => (x.venue || 'live7080') === venue.id); } catch { saved = []; toast('이 브라우저에서는 myList를 쓸 수 없습니다'); }
  // 재생 중인 곡은 같은 항목으로 다시 잇는다
  if (nowFile && !nowFile.temp && !nowFile.shared) nowFile = saved.find((x) => x.id === nowFile.id) || nowFile;
}
function renderMyList() {
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
    sm.textContent = [it.shared ? '공용 곡' : it.temp ? '저장되지 않음' : 'myList', dur ? fmtTime(dur) : null, fmtSize(it.size), it.analysis ? `${Math.round(it.analysis.bpm)} BPM` : null].filter(Boolean).join(' · ');
    text.append(st, sm); play.append(icon, text);
    play.setAttribute('aria-label', `${it.title} ${nowFile === it && !paused ? '일시정지' : '재생'}`);
    play.onclick = () => { if (nowFile === it) { edm.togglePause(); renderMyList(); } else playItem(it); };
    row.append(play);
    if (it.shared) { if (it.lrc) { const tag = document.createElement('span'); tag.className = 'mlSmall has'; tag.textContent = '가사 ✓'; row.append(tag); } box.append(row); return; }
    const ly = document.createElement('button'); ly.className = `mlSmall${it.lyrics ? ' has' : ''}`; ly.textContent = it.lyrics ? '가사 ✓' : '가사';
    ly.setAttribute('aria-label', `${it.title} 가사 ${it.lyrics ? '고치기' : '넣기'}`); ly.onclick = () => openLyrics(it);
    row.append(ly);
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
  nowFile = null; edm.stopFile(); setLyrics(null);
  if (nowUrl) { URL.revokeObjectURL(nowUrl); nowUrl = null; }
  $('nowName').textContent = edm.track.name;
  renderMyList();
}
function playItem(it) {
  if (nowUrl) URL.revokeObjectURL(nowUrl);
  nowUrl = it.shared ? null : URL.createObjectURL(it.blob); nowFile = it;
  if (it.shared && it.lrc && it.lyrics == null) fetch(it.lrc).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { it.lyrics = b ? decodeText(new Uint8Array(b)) : ''; if (nowFile === it) setLyrics(it); renderMyList(); }).catch(() => { it.lyrics = ''; });
  edm.playFile(it.shared ? it.url : nowUrl, it.analysis).catch((err) => {
    if (err?.name === 'NotAllowedError') toast('재생 버튼을 한 번 더 눌러 주세요');
  });
  $('nowName').textContent = it.title; toast(it.title, 2.2);
  setLyrics(it); findId3(it);
  renderMyList();
  if (!it.analysis && (it.shared || it.size < 80 * 1048576)) analyzeItem(it);
}
async function analyzeItem(it) {
  try {
    const data = it.shared ? await (await fetch(it.url)).arrayBuffer() : await it.blob.arrayBuffer(), buf = await edm.ctx.decodeAudioData(data);
    it.analysis = analyze(buf);
    if (nowFile === it) edm.analysis = it.analysis;
    if (!it.temp && !it.shared) await putTrack(it);
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
    const rec = { venue: venue.id, title: it.title, name: it.name, size: it.size, type: it.type, blob: it.blob, analysis: it.analysis || null, addedAt: Date.now() };
    const id = await addTrack(rec);
    temp = temp.filter((x) => x !== it);
    await refreshSaved();
    if (nowFile === it) nowFile = saved.find((x) => x.id === id) || null;
    toast('myList에 저장했습니다'); renderMyList();
  } catch (err) { toast(err?.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다' : '저장하지 못했습니다'); }
}
async function addFiles(files, keep) {
  const lrcs = files.filter(isLrcFile), good = files.filter(isAudioFile), bad = files.length - good.length - lrcs.length;
  if (bad) toast(`음원이 아닌 파일 ${bad}개는 뺐습니다`);
  const lrcOf = {};
  for (const f of lrcs) { try { lrcOf[titleOf(f.name)] = await readText(f); } catch { /* 읽지 못한 가사는 건너뛴다 */ } }
  const lyricsFor = (f) => lrcOf[titleOf(f.name)] || null;
  // 가사 파일만 올렸으면 이름이 같은 곡에 붙인다
  const orphan = Object.keys(lrcOf).filter((k) => !good.some((f) => titleOf(f.name) === k));
  if (orphan.length) {
    let n = 0;
    for (const k of orphan) {
      const it = myItems().find((x) => x.title === k); if (!it) continue;
      it.lyrics = lrcOf[k]; n++;
      if (!it.temp) await putTrack(it).catch(() => {});
      if (nowFile === it) setLyrics(it);
    }
    toast(n ? `가사 ${n}개를 같은 이름의 곡에 붙였습니다` : '이름이 같은 곡이 없어 가사를 붙이지 못했습니다', 2.6);
    renderMyList();
  }
  if (!good.length) return;
  let first = null;
  if (keep) {
    navigator.storage?.persist?.();
    for (const f of good) {
      const dup = saved.find((x) => x.name === f.name && x.size === f.size);
      if (dup) {
        if (lyricsFor(f)) { dup.lyrics = lyricsFor(f); await putTrack(dup).catch(() => {}); if (nowFile === dup) setLyrics(dup); toast(`가사를 붙였습니다: ${dup.title}`); }
        else toast(`이미 있는 곡입니다: ${titleOf(f.name)}`);
        continue;
      }
      try {
        const id = await addTrack({ venue: venue.id, title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null, lyrics: lyricsFor(f), addedAt: Date.now() });
        first ??= id;
      } catch (err) { toast(err?.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다' : '이 브라우저에서는 저장할 수 없어 이번만 재생합니다'); temp.push({ temp: true, id: `t${++tempSeq}`, title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null, lyrics: lyricsFor(f) }); }
    }
    await refreshSaved();
    renderMyList();
    const it = saved.find((x) => x.id === first) || temp[temp.length - 1];
    if (it) { playItem(it); toast(`${good.length}곡을 myList에 저장했습니다`); }
  } else {
    const added = good.map((f) => ({ temp: true, id: `t${++tempSeq}`, title: titleOf(f.name), name: f.name, size: f.size, type: f.type, blob: f, analysis: null, lyrics: lyricsFor(f) }));
    temp.push(...added); playItem(added[0]);
  }
}
{
  $('btnMyList').hidden = false;
  $('myListStop').textContent = venue.band ? '밴드 연주로 돌아가기' : 'DJ 음악으로 돌아가기';
  $('btnMyList').onclick = () => { armedDelete = null; renderMyList(); $('myListModal').hidden = false; };
  $('mlAdd').onclick = () => $('mlSaveInput').click();
  $('mlTemp').onclick = () => $('mlTempInput').click();
  $('mlSaveInput').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f, true); };
  $('mlTempInput').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f, false); };
  $('btnLyrics').onclick = () => {
    lyricsOn = !lyricsOn; localStorage.setItem('clubpulse-lyrics', lyricsOn ? 'on' : 'off');
    setLyrics(nowFile); toast(lyricsOn ? '가사를 켭니다 (왼쪽 벽 전광판)' : '가사를 끕니다', 1.4);
  };
  $('lySave').onclick = () => saveLyrics($('lyText').value);
  $('lyClear').onclick = () => { $('lyText').value = ''; $('lyText').focus(); };
  $('lyFile').onclick = () => $('lyInput').click();
  $('lyInput').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) $('lyText').value = await readText(f); };
  $('lyBack').onclick = () => { $('lyricsModal').hidden = true; renderMyList(); $('myListModal').hidden = false; };
  $('myListStop').onclick = () => { backToBand(); toast(venue.band ? '밴드 연주로 돌아갑니다' : 'DJ 음악으로 돌아갑니다'); };
  edm.onFileEnd = () => {
    const list = myItems(), i = list.indexOf(nowFile);
    if (!list.length || i < 0) { backToBand(); return; }
    playItem(list[(i + 1) % list.length]);
  };
  edm.onFileError = () => { toast('이 형식은 재생할 수 없습니다'); backToBand(); };
  await refreshSaved();
  loadShared();
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
    if (!n.mingle && Math.random() < 0.3) n.danceStyle = pickStyle(venue.styles);
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d > 2 && d < 7 && Math.random() < 0.08) say(n, pick(venue.cheers), 1.6);
    if (!n.mingle && Math.random() < 0.14) {
      const [x, z] = freeFloorSpot();
      goTo(n, x, z, () => { n.yawTo = yawToStage(n.x, n.z); n.danceTo = 1; });
    }
  } else if (n.role === 'pool') {
    if (Math.random() < 0.45) say(n, pick(venue.poolTalk || venue.tableTalk), 2);
    if (n.cup) { n.sipTo = 1; later(1.5, () => { n.sipTo = 0; }); }
  } else if (n.cup && n.role !== 'couple') {
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
    npcs.filter((n) => n.role === 'floor' && !n.mingle).forEach((n, i) => {
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
    for (let i = 0; i < 4; i++) { const n = pick(npcs); if (n.role === 'floor' && !n.target && !n.line) jump(n); }
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
      if (player.sit || player.partner) { leaveSeat(player); stopBlues(); }
      player.target = { x: player.x + (wx / l) * 0.8, z: player.z + (wz / l) * 0.8 }; player.onArrive = null;
      player.target.x = clamp(player.target.x, ROOM.xMin, ROOM.xMax); player.target.z = clamp(player.target.z, ROOM.zMin, ROOM.zMax);
      dest.visible = false;
    }
  }

  // 플레이어 춤 유지
  if (phase === 'room' || phase === 'queue') player.danceTo = grooving ? 1 : 0;
  if (phase === 'queue' && grooving) { player.danceStyle = 0; player.groove = 0.42; }
  lineTick(clock);

  // 줄
  updateLimo(dt);
  if (phase === 'queue' && !vipEvent.done && vipEvent.at && t > vipEvent.at && !queueBusy && limo.state === 'off') startVip();
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
    if (p.armPose !== undefined && performers.includes(p)) { p.danceTo = 1; p.danceStyle = !venue.band && clock.section.name === 'drop' ? 4 : venue.stageStyle; p.groove = venue.jazz ? 0.35 : venue.band ? 0.55 : 0.8; p.upTo = !venue.band && clock.section.name === 'build' && clock.section.barIn >= 2 ? 1 : 0; }
    // 말풍선은 벽 너머나 먼 곳이면 보이지 않는다
    if (p.bubble.visible) {
      const sameSide = p === player || (p.z > 4.9) === (player.z > 4.9);
      p.bubble.material.opacity = sameSide && Math.hypot(p.x - player.x, p.z - player.z) < 13 ? 1 : 0;
    }
  }
  poolTick();
  for (const p of everyone) if (p.cup) holdCup(p, p.cup);
  updateLyrics();
  if (drummerRef) {
    const lift = drumLift(clock.beat + drummerRef.beatOff);
    for (const st of drummerSticks) {
      drummerRef.arms[st.s].h.localToWorld(stickA.set(0, -0.03, 0.02));
      stickB.copy(st.tip); stickB.y += lift[st.s < 0 ? 0 : 1] * 0.32; stickB.z -= lift[st.s < 0 ? 0 : 1] * 0.1;
      const d = stickB.sub(stickA), len = d.length();
      stickQ.setFromUnitVectors(stickUp, d.normalize());
      st.m.quaternion.copy(stickQ); st.m.position.copy(stickA).addScaledVector(d, -0.06); st.m.scale.set(1, len + 0.06, 1);
    }
  }
  if (celloBow) {   // 활: 오른손에서 현을 지나 조금 더
    celloBow.p.arms[1].h.localToWorld(stickA.set(0, -0.03, 0.02));
    celloBow.cello.localToWorld(stickB.copy(celloBow.contact));
    const d = stickB.sub(stickA), len = d.length();
    stickQ.setFromUnitVectors(stickUp, d.normalize());
    celloBow.m.quaternion.copy(stickQ); celloBow.m.position.copy(stickA).addScaledVector(d, -0.12); celloBow.m.scale.set(1, len + 0.42, 1);
  }
  if (tray.visible) { waiter.arms[1].h.getWorldPosition(tray.position); tray.position.y += 0.02; }
  syncMingle();
  updateCouples(dt, t);
  joinTick();
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
  const fx0 = camFocus ? camFocus[0] : player.x, fz0 = camFocus ? camFocus[1] : player.z, fk = camFocus ? 1.6 : 6;
  cam.x = damp(cam.x, fx0, fk, dt); cam.y = damp(cam.y, cam.lookY, 3, dt); cam.z = damp(cam.z, fz0, fk, dt);
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
// 가끔(10번 중 4번) 줄 서 있는 동안 VIP가 온다. 주소 끝에 ?vip를 붙이면 항상 온다
if (forceVip || Math.random() < 0.4) vipEvent.at = now() + 2.2;
camSet(0.82, 1.46, 8.2, 2);

// 시험용 접근점
window.club = { edm, bouncer, limo, vipEvent, queue: () => queue, player, npcs, waiter, tray, TABLES, everyone, performers, renderer, scene, camera, buddy: () => buddy, state: () => ({ phase, step, grooving, grooveBeats, hi5, mingling: mingling.length, sips: myDrink.sips, x: player.x, z: player.z, queue: queue.indexOf(player) }), clockNow: () => edm.clock() };
