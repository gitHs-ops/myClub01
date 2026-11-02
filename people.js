/* 사람: 관절이 있는 성인 체형 캐릭터. 자세는 매 프레임 박자에서 계산한다 */
import * as THREE from './vendor/three.min.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const THIGH = 0.43, SHIN = 0.43, UPARM = 0.29, FOREARM = 0.27, HIP_Y = THIGH + SHIN + 0.07;
const G = {
  torso: new THREE.CapsuleGeometry(0.165, 0.3, 6, 14),
  hips: new THREE.CapsuleGeometry(0.15, 0.08, 6, 14),
  head: new THREE.SphereGeometry(0.135, 20, 16),
  neck: new THREE.CylinderGeometry(0.052, 0.06, 0.1, 10),
  upArm: new THREE.CapsuleGeometry(0.052, UPARM - 0.08, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.044, FOREARM - 0.08, 4, 10),
  hand: new THREE.SphereGeometry(0.05, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.076, THIGH - 0.12, 4, 10),
  shin: new THREE.CapsuleGeometry(0.058, SHIN - 0.1, 4, 10),
  foot: new THREE.BoxGeometry(0.09, 0.06, 0.22),
  eye: new THREE.SphereGeometry(0.016, 8, 6),
  hairShort: new THREE.SphereGeometry(0.143, 18, 12, 0, Math.PI * 2, 0, 1.75),
  hairBob: new THREE.SphereGeometry(0.16, 18, 14, 0, Math.PI * 2, 0, 2.2),
  hairLong: new THREE.CapsuleGeometry(0.12, 0.22, 4, 12),
  bun: new THREE.SphereGeometry(0.068, 12, 10),
  cap: new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18),
  brim: new THREE.BoxGeometry(0.2, 0.018, 0.14),
  blob: new THREE.CircleGeometry(0.42, 20),
  skirt: new THREE.CylinderGeometry(0.16, 0.25, 0.32, 16, 1, true),
};
/* 블록 캐릭터: 관절은 같고 부품만 각진 플라스틱이다 */
const taper = (w, h, d, top) => {
  const geo = new THREE.BoxGeometry(w, h, d), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * top);
  geo.computeVertexNormals();
  return geo;
};
const B = {
  torso: taper(0.42, 0.6, 0.2, 0.78),
  hips: new THREE.BoxGeometry(0.36, 0.2, 0.2),
  neck: new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10),
  upArm: new THREE.BoxGeometry(0.1, UPARM, 0.1),
  foreArm: new THREE.BoxGeometry(0.085, FOREARM, 0.085),
  hand: new THREE.CylinderGeometry(0.052, 0.052, 0.08, 12),
  thigh: new THREE.BoxGeometry(0.15, THIGH, 0.17),
  shin: new THREE.BoxGeometry(0.13, SHIN, 0.15),
  foot: new THREE.BoxGeometry(0.14, 0.07, 0.27),
  headRound: new THREE.CylinderGeometry(0.135, 0.135, 0.24, 20),
  headCube: new THREE.BoxGeometry(0.27, 0.27, 0.27),
  stud: new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16),
  smallStud: new THREE.CylinderGeometry(0.035, 0.035, 0.022, 10),
  smile: new THREE.TorusGeometry(0.036, 0.007, 5, 12, Math.PI),
  hairTop: new THREE.BoxGeometry(0.3, 0.09, 0.3),
  hairBack: new THREE.BoxGeometry(0.3, 0.2, 0.07),
  hairRound: new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20),
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...o });
const SKINS = [0xf4cdb0, 0xe9b98f, 0xd6a077, 0xf8dcc6, 0xb9845c].map((c) => std(c, { roughness: 0.55 }));
let HAIRS = [0x17120f, 0x2c1d14, 0x53321c, 0x9a6c3d, 0x6a1d8a, 0x1f6fb5, 0xd9d5cf].map((c) => std(c, { roughness: 0.48 }));
let TOPS = [0xf43f5e, 0x22d3ee, 0xfacc15, 0xa855f7, 0xf8fafc, 0x10b981, 0x3b82f6, 0xfb7185, 0xf97316, 0x1e293b, 0xec4899].map((c) => std(c));
let BOTTOMS = [0x111827, 0x1e3a5f, 0x374151, 0x4b5563, 0x1c1917, 0x3f2a56].map((c) => std(c, { roughness: 0.75 }));
const SHOES = [0xf8fafc, 0x0f172a, 0xef4444, 0x06b6d4].map((c) => std(c, { roughness: 0.4 }));
const M_EYE = std(0x161616, { roughness: 0.2 });
const M_BLOB = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false });
const M_PHONES = std(0x0b0b0f, { roughness: 0.3, metalness: 0.5 });

export function setWardrobe(w) {
  if (!w) return;
  TOPS = w.tops.map((c) => std(c)); BOTTOMS = w.bottoms.map((c) => std(c, { roughness: 0.75 })); HAIRS = w.hairs.map((c) => std(c, { roughness: 0.48 }));
}

const plastic = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.26 });
const BRICK_COLORS = [0xd01012, 0x0057a8, 0xf5cd2f, 0x00852b, 0xfe8a18, 0xf5f5f5, 0x1b1b1f, 0x5c2d91, 0x00a3da, 0xe4adc8].map(plastic);
const BRICK_YELLOW = plastic(0xf7c600), BRICK_SKINS = [0xf4cdb0, 0xd6a077, 0xb9845c, 0x8d5a34].map(plastic), BRICK_HAIRS = [0x1b1b1f, 0x5a3417, 0xc98a2b, 0xd01012].map(plastic);
const M_FACE = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.3 });

const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

export function bubbleSprite() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 112;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.renderOrder = 20; s.visible = false; s.userData = { c, tex };
  return s;
}
function drawBubble(s, text) {
  const { c, tex } = s.userData, g = c.getContext('2d'), font = '700 46px Pretendard, "Malgun Gothic", sans-serif';
  g.clearRect(0, 0, c.width, c.height); g.font = font;
  const w = Math.min(c.width - 6, g.measureText(text).width + 56), x = (c.width - w) / 2;
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(x, 3, w, 106, 50); g.fill();
  g.fillStyle = '#0f172a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, 58);
  tex.needsUpdate = true;
  s.scale.set(1.9, 1.9 * (c.height / c.width), 1);
}

export function makePerson(scene, look = {}) {
  const brick = !!look.brick, round = brick && Math.random() < 0.55;   // 둥근 머리(미니 피규어)와 네모 머리(비트 인형)
  const P = brick ? { ...G, ...B } : G;
  const skin = look.skin || (brick ? (round ? BRICK_YELLOW : pick(BRICK_SKINS)) : pick(SKINS)), hairM = look.hair || (brick ? pick(BRICK_HAIRS) : pick(HAIRS));
  const top = look.top || (brick ? pick(BRICK_COLORS) : pick(TOPS)), bottom = look.bottom || (brick ? pick(BRICK_COLORS) : pick(BOTTOMS)), shoe = look.shoe || (brick ? bottom : pick(SHOES));
  const style = look.style ?? Math.floor(Math.random() * 5), scaleH = look.height ?? rand(0.93, 1.05);
  const root = new THREE.Group(), hips = new THREE.Group(); root.add(hips);
  root.scale.setScalar(scaleH);
  const blob = add(G.blob, M_BLOB, 0, 0.012, 0, root); blob.rotation.x = -Math.PI / 2;
  hips.position.y = HIP_Y;
  add(P.hips, bottom, 0, 0.02, 0, hips);
  if (!brick && (look.skirt ?? Math.random() < 0.22)) add(G.skirt, bottom, 0, -0.17, 0, hips);
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso);
  const chest = add(P.torso, top, 0, 0.25, 0, torso); if (!brick) chest.scale.z = 0.72;
  add(P.neck, skin, 0, 0.55, 0, torso);
  if (brick) [-1, 1].forEach((s) => { add(B.smallStud, top, s * 0.08, 0.561, 0, torso); });
  const head = new THREE.Group(); head.position.y = 0.69; torso.add(head);
  if (brick) {
    add(round ? B.headRound : B.headCube, skin, 0, 0, 0, head);
    const faceZ = round ? 0.134 : 0.136;
    [-1, 1].forEach((s) => add(G.eye, M_FACE, s * 0.052, 0.025, faceZ, head));
    const m = add(B.smile, M_FACE, 0, -0.025, faceZ, head); m.rotation.z = Math.PI;
    const hairKind = Math.floor(Math.random() * 3);
    if (round) {
      if (hairKind === 0) add(B.stud, skin, 0, 0.14, 0, head);                // 머리 위 돌기만
      else { add(B.hairRound, hairM, 0, 0.14, -0.01, head); add(B.stud, hairM, 0, 0.2, -0.01, head); if (hairKind === 2) add(B.hairBack, hairM, 0, 0.02, -0.12, head); }
    } else {
      add(B.hairTop, hairM, 0, 0.17, 0, head);
      if (hairKind) add(B.hairBack, hairM, 0, 0.04, -0.125, head);
    }
  } else {
    add(G.head, skin, 0, 0, 0, head);
    [-1, 1].forEach((s) => add(G.eye, M_EYE, s * 0.052, 0.01, 0.125, head));
    if (style === 0) { const h = add(G.hairShort, hairM, 0, 0.012, -0.012, head); h.rotation.x = -0.32; }
    else if (style === 1) { const h = add(G.hairBob, hairM, 0, 0.01, -0.03, head); h.rotation.x = -0.72; }
    else if (style === 2) { const h = add(G.hairShort, hairM, 0, 0.012, -0.012, head); h.rotation.x = -0.32; add(G.hairLong, hairM, 0, -0.14, -0.1, head); }
    else if (style === 3) { const h = add(G.hairShort, hairM, 0, 0.012, -0.012, head); h.rotation.x = -0.32; add(G.bun, hairM, 0, 0.13, -0.09, head); }
    else { const h = add(G.hairShort, hairM, 0, 0.005, -0.012, head); h.rotation.x = -0.32; add(G.cap, top, 0, 0.1, 0, head); add(G.brim, top, 0, 0.076, 0.13, head); }
  }
  if (look.phones) {
    const band = add(new THREE.TorusGeometry(0.15, 0.014, 6, 18, Math.PI), M_PHONES, 0, 0.01, 0, head); void band;
    [-1, 1].forEach((s) => { const e = add(new THREE.CylinderGeometry(0.052, 0.052, 0.035, 12), M_PHONES, s * 0.145, 0, 0, head); e.rotation.z = Math.PI / 2; });
  }
  const arms = {};
  [-1, 1].forEach((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.215, 0.44, 0); torso.add(a);
    add(P.upArm, top, 0, -UPARM / 2, 0, a);
    const e = new THREE.Group(); e.position.y = -UPARM; a.add(e);
    add(P.foreArm, brick ? top : skin, 0, -FOREARM / 2, 0, e);
    const h = new THREE.Group(); h.position.y = -FOREARM; e.add(h);
    add(P.hand, skin, 0, -0.02, 0, h);
    arms[s] = { a, e, h };
  });
  const legs = {};
  [-1, 1].forEach((s) => {
    const t = new THREE.Group(); t.position.set(s * 0.095, -0.02, 0); hips.add(t);
    add(P.thigh, bottom, 0, -THIGH / 2, 0, t);
    const k = new THREE.Group(); k.position.y = -THIGH; t.add(k);
    add(P.shin, bottom, 0, -SHIN / 2, 0, k);
    const f = new THREE.Group(); f.position.y = -SHIN; k.add(f);
    add(P.foot, shoe, 0, -0.03, 0.05, f);
    legs[s] = { t, k, f };
  });
  const bubble = bubbleSprite(); bubble.position.y = 2.08 / scaleH; root.add(bubble);
  scene.add(root);
  return {
    root, hips, torso, head, arms, legs, bubble, bubbleUntil: 0,
    x: 0, z: 0, y: 0, yaw: 0, yawTo: 0, speed: rand(1.25, 1.6), walkPhase: Math.random() * 6, walk: 0, vx: 0, vz: 0,
    target: null, onArrive: null, stuck: 0,
    dance: 0, danceTo: 0, danceStyle: Math.floor(Math.random() * 5), groove: 0.5, beatOff: rand(-0.03, 0.03),
    up: 0, upTo: 0, jumpT: null, hifive: 0, hifiveTo: 0, sip: 0, sipTo: 0, wave: 0, waveTo: 0, showId: 0, showIdTo: 0, cross: 0, crossTo: 0, talk: 0, talkTo: 0,
    cup: null, phase: Math.random() * 6,
  };
}

export function say(p, text, sec = 2.6) {
  drawBubble(p.bubble, text); p.bubble.visible = true; p.bubbleUntil = performance.now() / 1000 + sec;
}
export const goTo = (p, x, z, done = null) => { p.target = { x, z }; p.onArrive = done; p.stuck = 0; p.danceTo = 0; };
export const jump = (p) => { if (p.jumpT == null) p.jumpT = 0; };

const setArm = (arm, x, z, y, el) => { arm.a.rotation.set(x, y, z); arm.e.rotation.set(el, 0, 0); };

/* 팔 자세를 섞기 위한 임시 값 */
const blend = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];

export function updatePerson(p, dt, t, clock, collide) {
  // 이동
  let moving = false;
  if (p.target) {
    const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.14) {
      p.target = null; const f = p.onArrive; p.onArrive = null; f?.();
    } else {
      const sp = p.speed * (p.run ? 1.6 : 1), ux = dx / d, uz = dz / d, bx = p.x, bz = p.z;
      p.x += ux * sp * dt; p.z += uz * sp * dt;
      p.yawTo = Math.atan2(ux, uz); moving = true;
      collide?.(p);
      const got = Math.hypot(p.x - bx, p.z - bz) / Math.max(dt, 1e-3);
      p.stuck = got < sp * 0.15 ? p.stuck + dt : Math.max(0, p.stuck - dt);
      if (p.stuck > 2.4) { p.target = null; const f = p.onArrive; p.onArrive = null; f?.(); }
    }
  } else collide?.(p);
  p.walk = damp(p.walk, moving ? 1 : 0, 9, dt);
  if (moving) p.walkPhase += dt * p.speed * 6.4 * (p.run ? 1.3 : 1);
  let dy = p.yawTo - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  p.yaw += dy * (1 - Math.exp(-9 * dt));

  // 자세 목표치 따라가기
  p.dance = damp(p.dance, moving ? 0 : p.danceTo, 5, dt);
  p.up = damp(p.up, p.upTo, 7, dt);
  p.hifive = damp(p.hifive, p.hifiveTo, 12, dt);
  p.sip = damp(p.sip, p.sipTo, 7, dt);
  p.wave = damp(p.wave, p.waveTo, 7, dt);
  p.showId = damp(p.showId, p.showIdTo, 7, dt);
  p.cross = damp(p.cross, p.crossTo, 5, dt);
  p.talk = damp(p.talk, p.talkTo, 4, dt);
  if (p.bubble.visible && performance.now() / 1000 > p.bubbleUntil) p.bubble.visible = false;

  // 점프
  let air = 0;
  if (p.jumpT != null) {
    p.jumpT += dt / 0.56;
    if (p.jumpT >= 1) p.jumpT = null; else air = Math.sin(p.jumpT * Math.PI);
  }

  // 박자: 사람마다 살짝 어긋나 군무처럼 보이지 않게 한다
  const b = clock.beat + p.beatOff, k = p.dance * clamp(p.groove, 0.15, 1.3), S = p.danceStyle;
  const pulse = Math.abs(Math.sin(Math.PI * b));                 // 박마다 0→1→0
  const dip = 1 - pulse, sway = Math.sin(Math.PI * b), half = Math.sin((Math.PI * b) / 2);
  let hipX = 0, hipY = 0, twist = 0, lean = 0, rollZ = 0, nod = 0, stepL = 0, stepR = 0;
  let armL = [0, 0.1, 0, -0.14], armR = [0, 0.1, 0, -0.14];

  if (k > 0.005) {
    if (S === 0) {         // 건들건들: 어깨와 머리만 리듬을 탄다 (가장 편한 춤)
      hipX = sway * 0.045; rollZ = -sway * 0.07; twist = sway * 0.16; nod = dip * 0.17; hipY = -dip * 0.035;
      armL = [-0.12 + sway * 0.16, 0.18, 0, -0.62]; armR = [-0.12 - sway * 0.16, 0.18, 0, -0.62];
    } else if (S === 1) {  // 바운스: 무릎을 굽혔다 편다
      hipY = -dip * 0.1; nod = dip * 0.2; lean = 0.06 + dip * 0.06; twist = half * 0.2;
      armL = [-0.5 - dip * 0.26, 0.24, 0, -1.28]; armR = [-0.5 - dip * 0.26, 0.24, 0, -1.28];
    } else if (S === 2) {  // 펌프: 한 손을 위로 찌른다
      hipY = -dip * 0.08; nod = dip * 0.2; rollZ = half * 0.05;
      armR = [-2.5 - pulse * 0.42, 0.12, 0, -0.44 * dip]; armL = [-0.22, 0.2, 0, -1.08];
    } else if (S === 3) {  // 스텝: 좌우로 옮겨 디디며 박수
      hipX = half * 0.15; hipY = -dip * 0.06; rollZ = -half * 0.1; twist = half * 0.26; nod = dip * 0.12;
      stepL = Math.max(0, half) * 0.14; stepR = Math.max(0, -half) * 0.14;
      const clap = -1.42 - dip * 0.14; armL = [clap, -0.12 + pulse * 0.2, -0.45, -0.95]; armR = [clap, -0.12 + pulse * 0.2, -0.45, -0.95];
    } else if (S === 5) {  // 고고: 허리를 비틀고 팔꿈치를 접어 흔든다
      twist = sway * 0.5; hipY = -0.05 - dip * 0.05; hipX = half * 0.06; nod = dip * 0.1;
      armL = [-0.55 + sway * 0.4, 0.34, 0, -1.55]; armR = [-0.55 - sway * 0.4, 0.34, 0, -1.55];
    } else {               // 웨이브: 양팔을 흔든다
      hipX = sway * 0.08; rollZ = -sway * 0.09; hipY = -dip * 0.05; nod = dip * 0.1;
      armL = [-2.75 + sway * 0.24, 0.32 + sway * 0.14, 0, -0.32]; armR = [-2.75 - sway * 0.24, 0.32 - sway * 0.14, 0, -0.32];
    }
  }
  const rest = [0, 0.1, 0, -0.14];
  armL = blend(rest, armL, Math.min(1, k)); armR = blend(rest, armR, Math.min(1, k));
  const swing = Math.sin(p.walkPhase) * 0.52 * p.walk;
  armL = [armL[0] - swing, armL[1], armL[2], armL[3] - 0.16 * p.walk];
  armR = [armR[0] + swing, armR[1], armR[2], armR[3] - 0.16 * p.walk];

  // 팔짱(줄서기) · 대화 손짓
  if (p.cross > 0.01) {
    armL = blend(armL, [-0.62, 0.24, -0.5, -1.75], p.cross);
    armR = blend(armR, [-0.72, 0.24, -0.5, -1.75], p.cross);
  }
  if (p.talk > 0.01) armR = blend(armR, [-0.72 + Math.sin(t * 3 + p.phase) * 0.12, 0.2, -0.2, -1.5 + Math.sin(t * 5 + p.phase) * 0.28], p.talk);
  // 신분증 내밀기
  if (p.showId > 0.01) armR = blend(armR, [-1.42, 0.08, -0.06, -0.34], p.showId);
  // 양손 들기
  if (p.up > 0.01) {
    const wv = Math.sin(Math.PI * b) * 0.16;
    armL = blend(armL, [-2.92 + wv, 0.24, 0, -0.18], p.up);
    armR = blend(armR, [-2.92 - wv, 0.24, 0, -0.18], p.up);
  }
  // 손 흔들기
  if (p.wave > 0.01) armR = blend(armR, [-2.8, 0.42 + Math.sin(t * 9) * 0.3, 0, -0.34], p.wave);
  // 음료 마시기: 컵을 든 오른손을 입으로
  if (p.sip > 0.01) armR = blend(armR, [-0.95, 0.28, -0.58, -2.05], p.sip);
  // 하이파이브
  if (p.hifive > 0.01) armR = blend(armR, [-2.42, -0.06, 0, -0.24], p.hifive);

  // 연주자: 악기마다 팔 자세가 정해져 있다
  if (p.armPose) { const o = p.armPose(b, t); armL = o[0]; armR = o[1]; }
  setArm(p.arms[-1], armL[0], -armL[1], -armL[2], armL[3]);
  setArm(p.arms[1], armR[0], armR[1], armR[2], armR[3]);
  p.arms[-1].a.rotation.x = armL[0]; p.arms[1].a.rotation.x = armR[0];

  // 다리: 무릎 굽힘은 엉덩이가 내려간 만큼 계산해 발이 바닥에 붙어 있게 한다
  const crouchIK = (drop) => {
    const L = THIGH + SHIN, c = clamp((L - drop) / L, 0.45, 1), a = Math.acos(c);
    return [-a, a * 2];
  };
  const tuck = air * 0.75;
  const legPose = (s, step) => {
    const leg = p.legs[s], phase = p.walkPhase + (s > 0 ? Math.PI : 0), sw = Math.sin(phase) * 0.62 * p.walk;
    const [tx, kx] = crouchIK(-hipY);
    const lift = Math.max(0, Math.cos(phase)) * 0.72 * p.walk;
    leg.t.rotation.x = tx - sw - step * 1.7 - tuck;
    leg.k.rotation.x = kx + lift + step * 3 + tuck * 1.4;
    leg.t.rotation.z = s * (0.035 + 0.05 * p.dance);
    leg.f.rotation.x = -(tx - sw - step * 1.7 - tuck + kx + lift + step * 3 + tuck * 1.4) * 0.9;
  };
  legPose(-1, stepR * k); legPose(1, stepL * k);

  p.hips.position.set(hipX * k, HIP_Y + hipY * k + Math.sin(p.walkPhase * 2) * 0.016 * p.walk + Math.sin(t * 1.2 + p.phase) * 0.003, 0);
  p.hips.rotation.y = twist * k;
  p.hips.rotation.z = rollZ * k * 0.5;
  p.torso.rotation.set(lean * k + 0.05 * p.walk + 0.02 * Math.sin(t * 0.8 + p.phase), -twist * k * 0.5, -rollZ * k);
  p.head.rotation.set(nod * k * 0.9 - p.sip * 0.42 - p.up * 0.12, 0, -rollZ * k * 0.6);
  p.y = air * 0.42;
  p.root.position.set(p.x, p.y, p.z);
  p.root.rotation.y = p.yaw;
}
