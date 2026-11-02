/* EDM 엔진: 음원 파일 없이 Web Audio로 곡을 실시간 합성한다. 화면은 clock()의 박자에 맞춰 움직인다 */
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export const TRACKS = [
  {
    id: 'neon', name: 'Neon Rise', desc: '128 BPM · 프로그레시브 하우스', bpm: 128,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [33, 29, 36, 31],
    stab: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    bassLine: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    lead: [12, 16, 19, 24, 19, 16, 12, 16, 19, 24, 28, 24, 19, 16, 19, 24], wave: 'sawtooth',
  },
  {
    id: 'deep', name: 'Deep Pulse', desc: '124 BPM · 테크 하우스', bpm: 124,
    chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]], bass: [26, 26, 34, 36],
    stab: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    bassLine: [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1],
    lead: [12, 0, 15, 0, 12, 0, 19, 17, 12, 0, 15, 0, 22, 19, 17, 15], wave: 'square',
  },
  {
    id: 'sky', name: 'Sky Drop', desc: '132 BPM · 빅룸', bpm: 132,
    chords: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]], bass: [29, 25, 32, 27],
    stab: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    bassLine: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    lead: [24, 24, 27, 24, 31, 24, 27, 24, 24, 24, 27, 24, 32, 31, 27, 24], wave: 'sawtooth',
  },
];

/* 곡 구성(마디). energy는 조명과 군중의 흥에 쓴다 */
const FORM = [
  { name: 'intro', bars: 8, energy: 0.35 },
  { name: 'groove', bars: 8, energy: 0.6 },
  { name: 'break', bars: 8, energy: 0.25 },
  { name: 'build', bars: 4, energy: 0.55 },
  { name: 'drop', bars: 16, energy: 1 },
  { name: 'groove', bars: 8, energy: 0.65 },
  { name: 'break', bars: 4, energy: 0.25 },
  { name: 'build', bars: 4, energy: 0.55 },
  { name: 'drop', bars: 16, energy: 1 },
];
const FORM_BARS = FORM.reduce((s, f) => s + f.bars, 0);
const sectionAt = (bar) => {
  let b = ((bar % FORM_BARS) + FORM_BARS) % FORM_BARS;
  for (const f of FORM) { if (b < f.bars) return { ...f, barIn: b }; b -= f.bars; }
  return { ...FORM[0], barIn: 0 };
};

export class Edm {
  constructor() { this.track = TRACKS[0]; this.vol = 0.8; this.started = false; this.startBar = 0; }

  start() {
    if (this.started) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 128; this.analyser.smoothingTimeConstant = 0.72;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.room = ctx.createBiquadFilter(); this.room.type = 'lowpass'; this.room.frequency.value = 340; this.room.Q.value = 0.7;
    this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0.55;
    this.music = ctx.createGain();
    this.music.connect(this.room); this.room.connect(this.roomGain); this.roomGain.connect(comp); comp.connect(this.master);
    this.master.connect(this.analyser); this.analyser.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);

    this.duck = ctx.createGain(); this.duck.connect(this.music);
    this.synthFilter = ctx.createBiquadFilter(); this.synthFilter.type = 'lowpass'; this.synthFilter.frequency.value = 1200; this.synthFilter.Q.value = 2;
    this.synthFilter.connect(this.duck);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.24; this.verb.connect(this.verbGain); this.verbGain.connect(this.duck);
    this.echo = ctx.createDelay(1.5); this.echoFb = ctx.createGain(); this.echoFb.gain.value = 0.34;
    this.echo.connect(this.echoFb); this.echoFb.connect(this.echo); this.echo.connect(this.verb); this.echo.connect(this.duck);

    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // 거리 소음: 바깥에 있을 때만 들린다
    const street = ctx.createBufferSource(); street.buffer = buf; street.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 420;
    this.streetGain = ctx.createGain(); this.streetGain.gain.value = 0.06;
    street.connect(sf); sf.connect(this.streetGain); this.streetGain.connect(this.master); street.start();

    this.t0 = ctx.currentTime + 0.12; this.nextStep = 0; this.started = true;
    this.applyTrack();
    this.timer = setInterval(() => this.schedule(), 40);
    ctx.resume();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ctx.resume(); });
  }

  impulse(sec) {
    const { ctx } = this, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
    return b;
  }

  applyTrack() { this.spb = 60 / this.track.bpm; this.spStep = this.spb / 4; if (this.echo) this.echo.delayTime.value = this.spb * 0.75; }

  /* 곡을 바꾸면 박자를 이어 가도록 현재 시각에서 다시 센다 */
  setTrack(id) {
    this.track = TRACKS.find((t) => t.id === id) || TRACKS[0];
    if (!this.started) { this.applyTrack(); return; }
    this.applyTrack();
    this.t0 = this.ctx.currentTime + 0.1; this.nextStep = 0;
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  /* 0: 길거리, 1: 복도, 2: 플로어 가장자리, 3: 메인 스테이지 앞 */
  setRoom(k) {
    if (!this.started || k === this.roomK) return;
    this.roomK = k;
    const t = this.ctx.currentTime, c = [340, 1100, 19000, 20000][k], g = [0.55, 0.78, 0.86, 1][k];
    this.room.frequency.setTargetAtTime(c, t, 0.35);
    this.roomGain.gain.setTargetAtTime(g, t, 0.35);
    this.streetGain.gain.setTargetAtTime(k === 0 ? 0.06 : 0, t, 0.5);
  }

  /* 현재 위치: beat는 연속값. 곡 구간과 흥을 함께 돌려준다 */
  clock() {
    if (!this.started) return { beat: performance.now() / 468, bar: 0, section: FORM[0], energy: 0.35, beatFrac: 0, kick: 0 };
    const beat = Math.max(0, (this.ctx.currentTime - this.t0) / this.spb), bar = Math.floor(beat / 4);
    const section = sectionAt(bar), beatFrac = beat % 1;
    const inBuild = section.name === 'build' ? (section.barIn + (beat % 4) / 4) / section.bars : 0;
    return { beat, bar, section, beatFrac, energy: section.energy + inBuild * 0.35, build: inBuild, kick: section.name === 'break' ? 0 : Math.exp(-beatFrac * 5) };
  }

  schedule() {
    if (this.ctx.state !== 'running') return;
    const ahead = document.hidden ? 1.6 : 0.22, end = this.ctx.currentTime + ahead;
    // 탭이 오래 멈췄다 돌아오면 밀린 음을 쏟지 않고 건너뛴다
    const now = Math.ceil((this.ctx.currentTime - this.t0) / this.spStep);
    if (now > this.nextStep + 8) this.nextStep = now;
    for (;;) {
      const t = this.t0 + this.nextStep * this.spStep;
      if (t > end) break;
      this.playStep(this.nextStep, t);
      this.nextStep++;
    }
  }

  playStep(step, t) {
    const T = this.track, s16 = step % 16, bar = Math.floor(step / 16), sec = sectionAt(bar), name = sec.name;
    const chordI = Math.floor(bar / 2) % T.chords.length, chord = T.chords[chordI], root = T.bass[chordI];
    const lastBarOfBuild = name === 'build' && sec.barIn === sec.bars - 1;
    const drop = name === 'drop', groove = name === 'groove', intro = name === 'intro', brk = name === 'break', build = name === 'build';
    const hasKick = (drop || groove || intro) && !(!drop && sec.barIn === sec.bars - 1 && s16 >= 12);

    // 필터: 빌드에서 열리고 드롭에서 활짝, 브레이크에서 닫힌다
    if (s16 === 0) {
      const f = this.synthFilter.frequency;
      f.cancelScheduledValues(t);
      if (build) { f.setValueAtTime(700 + sec.barIn * 900, t); f.linearRampToValueAtTime(700 + (sec.barIn + 1) * 900, t + this.spb * 4); }
      else f.setTargetAtTime(drop ? 9000 : groove ? 2600 : brk ? 1100 : 900, t, 0.3);
    }
    if (hasKick && s16 % 4 === 0) { this.kick(t, drop ? 1 : 0.9); this.sidechain(t, drop ? 0.22 : 0.45); }
    if ((drop || groove) && (s16 === 4 || s16 === 12)) this.clap(t, 0.5);
    if (!brk && !build && s16 % 4 === 2) this.hat(t, 0.28, 0.13);
    if ((drop || groove) && s16 % 2 === 1) this.hat(t, 0.09, 0.04);
    if (drop && bar % 4 === 3 && s16 >= 12) this.clap(t, 0.25 + (s16 - 12) * 0.08);

    if ((drop || groove || (intro && sec.barIn >= 4)) && T.bassLine[s16]) this.bass(t, midi(root + (s16 === 15 ? 12 : 0)), drop ? 0.42 : 0.34);
    if (drop && T.stab[s16]) this.stab(t, chord.map((n) => n + 12), 0.1);
    if (groove && T.stab[s16] && sec.barIn >= 4) this.stab(t, chord, 0.06);
    if ((brk || build) && s16 === 0 && sec.barIn % 2 === 0) this.pad(t, chord, this.spb * 8, brk ? 0.05 : 0.065);
    if ((drop && sec.barIn >= 8) || build || (brk && sec.barIn >= 2)) {
      const n = T.lead[s16];
      if (n) this.lead(t, midi(chord[0] + n), brk ? 0.05 : drop ? 0.08 : 0.06, T.wave);
    }
    if (build) {
      const every = sec.barIn < 2 ? 4 : lastBarOfBuild ? 1 : 2;
      if (s16 % every === 0) this.clap(t, 0.16 + (sec.barIn + s16 / 16) * 0.09);
      if (sec.barIn === 0 && s16 === 0) this.riser(t, this.spb * 4 * sec.bars);
    }
    if (drop && sec.barIn === 0 && s16 === 0) this.impact(t);
  }

  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  sidechain(t, low) {
    const g = this.duck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(low, t); g.linearRampToValueAtTime(1, t + this.spb * 0.72);
  }

  kick(t, v) {
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(v * 1.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.32);
  }

  noise(t, dur, type, freq, v, q = 0.8, dest = this.music) {
    const { ctx } = this, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.002, v, dur);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.03);
    return g;
  }

  hat(t, v, dur) { this.noise(t, dur, 'highpass', 8200, v); }
  clap(t, v) { const g = this.noise(t, 0.14, 'bandpass', 1700, v, 0.9); g.connect(this.verb); }

  bass(t, f, v) {
    const { ctx } = this, o = ctx.createOscillator(), s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), dur = this.spStep * 1.5;
    o.type = 'sawtooth'; o.frequency.value = f; s.type = 'sine'; s.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(880, t); lp.frequency.exponentialRampToValueAtTime(170, t + dur);
    this.env(g, t, 0.004, v, dur);
    o.connect(lp); s.connect(lp); lp.connect(g); g.connect(this.duck);
    for (const x of [o, s]) { x.start(t); x.stop(t + dur + 0.05); }
  }

  voice(t, freq, dur, v, type, detunes, dest) {
    const { ctx } = this, g = ctx.createGain();
    this.env(g, t, 0.006, v, dur); g.connect(dest);
    for (const de of detunes) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = de;
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
    return g;
  }

  stab(t, notes, v) {
    for (const n of notes) { const g = this.voice(t, midi(n), this.spStep * 1.7, v, 'sawtooth', [-14, -6, 0, 7, 15], this.synthFilter); g.connect(this.verb); }
  }

  pad(t, notes, dur, v) {
    const { ctx } = this;
    for (const n of notes) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3); g.gain.setValueAtTime(v, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(this.synthFilter); g.connect(this.verb);
      for (const de of [-9, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = de; o.connect(g); o.start(t); o.stop(t + dur + 0.02); }
    }
  }

  lead(t, f, v, wave) { const g = this.voice(t, f, this.spStep * 1.1, v, wave, [-5, 5], this.synthFilter); g.connect(this.echo); }

  riser(t, dur) {
    const { ctx } = this, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = this.noiseBuf; n.loop = true; f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.3, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.01);
    n.connect(f); f.connect(g); g.connect(this.music); n.start(t); n.stop(t + dur + 0.02);
  }

  impact(t) {
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.1);
    g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 1.25);
    const c = this.noise(t, 1.6, 'highpass', 4200, 0.3); c.connect(this.verb);
    this.cheer(0.12, t);
  }

  /* ── 효과음 ── */
  cheer(v = 0.18, t = this.ctx?.currentTime) {
    if (!this.started) return;
    const g = this.noise(t, 1.5, 'bandpass', 1500, v, 0.5, this.sfx); g.connect(this.verb);
  }
  stamp() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.06, 'lowpass', 1400, 0.8, 0.8, this.sfx); }
  door() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.5, 'lowpass', 420, 0.5, 0.8, this.sfx); }
  clink() {
    if (!this.started) return; const t = this.ctx.currentTime;
    for (const [f, d] of [[2300, 0], [3150, 0.06], [2700, 0.13]]) { const g = this.voice(t + d, f, 0.1, 0.05, 'sine', [0], this.sfx); void g; }
  }
  sip() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.3, 'bandpass', 2600, 0.09, 2, this.sfx); }
  highFive() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.08, 'bandpass', 2400, 0.95, 0.7, this.sfx); }
}
