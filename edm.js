/* EDM 엔진: 음원 파일 없이 Web Audio로 곡을 실시간 합성한다. 화면은 clock()의 박자에 맞춰 움직인다 */
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export const TRACKS = [
  {
    id: 'neon', venue: 'club', name: 'Neon Rise', desc: '128 BPM · 프로그레시브 하우스', bpm: 128,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [33, 29, 36, 31],
    stab: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    bassLine: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    lead: [12, 16, 19, 24, 19, 16, 12, 16, 19, 24, 28, 24, 19, 16, 19, 24], wave: 'sawtooth',
  },
  {
    id: 'deep', venue: 'club', name: 'Deep Pulse', desc: '124 BPM · 테크 하우스', bpm: 124,
    chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]], bass: [26, 26, 34, 36],
    stab: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    bassLine: [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1],
    lead: [12, 0, 15, 0, 12, 0, 19, 17, 12, 0, 15, 0, 22, 19, 17, 15], wave: 'square',
  },
  {
    id: 'sky', venue: 'club', name: 'Sky Drop', desc: '132 BPM · 빅룸', bpm: 132,
    chords: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]], bass: [29, 25, 32, 27],
    stab: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    bassLine: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    lead: [24, 24, 27, 24, 31, 24, 27, 24, 24, 24, 27, 24, 32, 31, 27, 24], wave: 'sawtooth',
  },
  {
    id: 'trance', venue: 'club', name: 'Starlight Gate', desc: '138 BPM · 트랜스', bpm: 138, hue: 0.55, led: 'rays',
    chords: [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67]], bass: [38, 34, 41, 36],
    stab: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    bassLine: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1], leadAlways: true,
    lead: [0, 3, 7, 12, 15, 12, 7, 3, 0, 3, 7, 12, 19, 15, 12, 7], wave: 'sawtooth',
  },
  {
    id: 'dubstep', venue: 'club', name: 'Heavy Wobble', desc: '140 BPM · 덥스텝', bpm: 140, div: 2, hue: 0.28, led: 'grid',
    kicks: [0, 10], snares: [8], bassType: 'wobble', bassLen: 7, noOpenHat: true, duck: 0.6,
    chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 53, 57]], bass: [28, 28, 24, 26],
    stab: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassLine: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    lead: [12, 0, 0, 15, 0, 0, 12, 0, 19, 0, 0, 17, 0, 15, 0, 0], wave: 'square',
  },
  {
    id: 'dnb', venue: 'club', name: 'Night Runner', desc: '174 BPM · 드럼 앤 베이스', bpm: 174, div: 2, hue: 0.42, led: 'scan',
    kicks: [0, 10], snares: [4, 12], bassType: 'reese', bassLen: 9, noOpenHat: true, duck: 0.65,
    chords: [[48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]], bass: [24, 32, 27, 34],
    stab: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    bassLine: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], leadAlways: true,
    lead: [24, 0, 0, 22, 0, 0, 19, 0, 24, 0, 0, 27, 0, 0, 22, 0], wave: 'sawtooth',
  },
  {
    id: 'future', venue: 'club', name: 'Soft Neon', desc: '150 BPM · 퓨처 베이스', bpm: 150, div: 2, hue: 0.12, led: 'wave',
    kicks: [0, 7, 10], snares: [8], bassType: 'sub', bassLen: 5, noOpenHat: true, duck: 0.15, stabV: 0.13,
    chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]], bass: [29, 31, 28, 33],
    stab: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    bassLine: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], leadAlways: true, leadType: 'pluck',
    lead: [24, 0, 19, 0, 16, 0, 19, 0, 24, 0, 28, 0, 26, 24, 19, 0], wave: 'triangle',
  },
  {
    id: 'techno', venue: 'club', name: 'Warehouse 130', desc: '130 BPM · 애시드 테크노', bpm: 130, hue: 0.2, led: 'scan',
    bassType: 'acid', hat16: true, duck: 0.55,
    chords: [[45, 48, 52], [45, 48, 52], [45, 48, 52], [43, 46, 50]], bass: [33, 33, 33, 31],
    stab: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassLine: [1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
    bassNotes: [0, 0, 0, 12, 0, 0, 3, 0, 0, 0, 7, 0, 0, 12, 0, 10],
    lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], wave: 'square',
  },
  {
    id: 'tropical', venue: 'club', name: 'Island Sunset', desc: '110 BPM · 트로피컬 하우스', bpm: 110, hue: 0.62, led: 'wave',
    kickV: 0.72, clapV: 0.26, bassType: 'sub', bassLen: 3, duck: 0.5, stabV: 0.045, leadAlways: true, leadType: 'pluck',
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bass: [36, 31, 33, 29],
    stab: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bassLine: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    lead: [12, 0, 16, 19, 0, 16, 12, 0, 24, 0, 19, 16, 0, 19, 16, 0], wave: 'triangle',
  },
  /* 7080: 직접 지은 곡. melody는 코드 구성음 번호(0 쉼표, 1~6 위로 올라감), 2마디 32칸 */
  {
    id: 'gogo', venue: 'live7080', style: 'band', feel: 'gogo', name: '그 밤의 고고', desc: '124 BPM · 1970년대 고고', bpm: 124,
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: [36, 33, 29, 31],
    melody: [4, 0, 5, 0, 6, 0, 5, 4, 0, 0, 3, 0, 4, 0, 0, 0, 3, 0, 4, 0, 5, 0, 4, 3, 2, 0, 3, 0, 1, 0, 0, 0],
  },
  {
    id: 'folk', venue: 'live7080', style: 'band', feel: 'folk', name: '통기타 사랑방', desc: '92 BPM · 포크', bpm: 92,
    chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55]], bass: [31, 26, 28, 36],
    melody: [3, 0, 0, 4, 5, 0, 4, 0, 3, 0, 0, 2, 3, 0, 0, 0, 4, 0, 0, 5, 6, 0, 5, 0, 4, 0, 3, 0, 2, 0, 0, 0],
  },
  {
    id: 'disco', venue: 'live7080', style: 'band', feel: 'disco', name: '토요일 밤 디스코', desc: '114 BPM · 1980년대 디스코', bpm: 114,
    chords: [[57, 60, 64], [50, 53, 57], [55, 59, 62], [48, 52, 55]], bass: [33, 26, 31, 36],
    melody: [6, 0, 5, 4, 0, 4, 5, 0, 6, 0, 4, 0, 3, 0, 0, 0, 5, 0, 4, 3, 0, 3, 4, 0, 5, 0, 3, 0, 2, 0, 0, 0],
  },
  /* 재즈 바: 직접 지은 곡. chords는 7화음 4음, melody는 그 구성음 번호(1~8), 2마디 32칸 */
  {
    id: 'swing', venue: 'jazz', style: 'band', jazz: 'swing', name: '블루 아워 스윙', desc: '132 BPM · 스윙', bpm: 132,
    chords: [[55, 58, 62, 65], [52, 55, 58, 60], [53, 57, 60, 64], [50, 54, 57, 60]], bass: [43, 36, 41, 38],
    melody: [3, 0, 0, 4, 5, 0, 0, 0, 4, 0, 3, 0, 2, 0, 0, 0, 1, 0, 2, 0, 3, 0, 5, 0, 4, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'ballad', venue: 'jazz', style: 'band', jazz: 'ballad', name: '새벽 두 시의 발라드', desc: '68 BPM · 재즈 발라드', bpm: 68,
    chords: [[51, 55, 58, 62], [48, 51, 55, 58], [53, 56, 60, 63], [46, 50, 53, 56]], bass: [39, 36, 41, 46],
    melody: [5, 0, 0, 0, 4, 0, 3, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 6, 0, 5, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'bossa', venue: 'jazz', style: 'band', jazz: 'bossa', name: '비 오는 날의 보사노바', desc: '118 BPM · 보사노바', bpm: 118,
    chords: [[57, 60, 64, 67], [50, 54, 57, 60], [55, 59, 62, 66], [48, 52, 55, 59]], bass: [45, 38, 43, 36],
    melody: [4, 0, 0, 3, 0, 0, 4, 0, 5, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 2, 0, 0, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  },
  /* LP 바: 직접 지은 곡을 낡은 레코드처럼 (지직 소리와 따뜻한 고음 감쇠) */
  {
    id: 'lp_soul', venue: 'lp', style: 'band', feel: 'gogo', vinyl: true, name: '빗물 소울', desc: '98 BPM · 오래된 소울 LP', bpm: 98,
    chords: [[50, 53, 57], [55, 59, 62], [52, 55, 59], [57, 61, 64]], bass: [38, 43, 40, 45],
    melody: [3, 0, 4, 0, 5, 0, 0, 4, 3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 4, 5, 0, 6, 0, 5, 0, 4, 0, 0, 0, 0, 0],
  },
  {
    id: 'lp_blues', venue: 'lp', style: 'band', jazz: 'swing', vinyl: true, name: '새벽 세 시 블루스', desc: '92 BPM · 셔플 블루스 LP', bpm: 92,
    chords: [[48, 52, 55, 58], [53, 57, 60, 63], [48, 52, 55, 58], [55, 59, 62, 65]], bass: [36, 41, 36, 43],
    melody: [4, 0, 0, 3, 4, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 4, 0, 5, 0, 4, 0, 3, 0, 2, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'lp_chanson', venue: 'lp', style: 'band', jazz: 'ballad', vinyl: true, name: '낡은 샹송', desc: '70 BPM · 샹송풍 발라드 LP', bpm: 70,
    chords: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]], bass: [45, 38, 43, 36],
    melody: [5, 0, 0, 4, 3, 0, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 3, 0, 4, 0, 5, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0],
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
/* 밴드 곡: drop은 후렴, groove는 절, build는 후렴 앞, break는 연주 구간 */
const FORM_BAND = [
  { name: 'intro', bars: 4, energy: 0.35 },
  { name: 'groove', bars: 8, energy: 0.55 },
  { name: 'build', bars: 4, energy: 0.55 },
  { name: 'drop', bars: 8, energy: 0.95 },
  { name: 'groove', bars: 8, energy: 0.6 },
  { name: 'build', bars: 4, energy: 0.55 },
  { name: 'drop', bars: 8, energy: 0.95 },
  { name: 'break', bars: 8, energy: 0.5 },
  { name: 'drop', bars: 8, energy: 1 },
];
const sectionAt = (bar, form = FORM) => {
  const total = form.reduce((s, f) => s + f.bars, 0);
  let b = ((bar % total) + total) % total;
  for (const f of form) { if (b < f.bars) return { ...f, barIn: b }; b -= f.bars; }
  return { ...form[0], barIn: 0 };
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
    // LP: 고음을 깎아 따뜻하게 (평소에는 그대로 통과)
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 20000; this.tone.Q.value = 0.5;
    this.music.connect(this.tone); this.tone.connect(this.room); this.room.connect(this.roomGain); this.roomGain.connect(comp); comp.connect(this.master);
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
    // 바늘 소리: LP 곡에서만 들린다
    const hiss = ctx.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3800; hf.Q.value = 0.4;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    hiss.connect(hf); hf.connect(this.hissGain); this.hissGain.connect(this.room); hiss.start();

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

  applyTrack() { if (this.tone) { const vin = !!this.track.vinyl || !!this.vinylAlways; this.tone.frequency.value = vin ? 5600 : 20000; this.hissGain.gain.value = vin ? 0.012 : 0; } this.form = this.track.style === 'band' ? FORM_BAND : FORM; if (this.duck && this.track.style === 'band') { this.duck.gain.cancelScheduledValues(0); this.duck.gain.value = 1; } this.spb = 60 / this.track.bpm; this.spStep = this.spb / 4; if (this.echo) this.echo.delayTime.value = this.spb * 0.75; }

  /* 곡을 바꾸면 박자를 이어 가도록 현재 시각에서 다시 센다 */
  setTrack(id) {
    if (this.fileMode) this.stopFile();
    this.track = TRACKS.find((t) => t.id === id) || TRACKS[0];
    if (!this.started) { this.applyTrack(); return; }
    this.applyTrack();
    this.t0 = this.ctx.currentTime + 0.1; this.nextStep = 0;
  }

  /* 재생 목록의 다음 곡으로 박자가 끊기지 않게 넘어간다 */
  advance(t) {
    const list = this.playlist || TRACKS, i = list.indexOf(this.track), next = list[(i + 1) % list.length];
    this.track = next; this.applyTrack();
    this.t0 = t; this.nextStep = 0;
    this.onTrack?.(next);
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
  /* 내 음원 재생: 합성을 멈추고 같은 소리 길로 내보낸다. 줄 밖에서는 똑같이 먹먹하게 들린다 */
  playFile(url, analysis) {
    if (!this.fileEl) {
      const el = this.fileEl = new Audio();
      const src = this.ctx.createMediaElementSource(el), g = this.ctx.createGain();
      g.gain.value = 0.9; src.connect(g); g.connect(this.music);
      el.addEventListener('ended', () => this.onFileEnd?.());
      el.addEventListener('error', () => { if (this.fileMode && el.getAttribute('src')) this.onFileError?.(); });
    }
    this.fileMode = true; this.analysis = analysis || null;
    this.fileEl.src = url;
    return this.fileEl.play();
  }

  stopFile() {
    if (!this.fileMode) return;
    this.fileMode = false; this.analysis = null;
    this.fileEl.pause(); this.fileEl.removeAttribute('src'); this.fileEl.load();
    this.applyTrack();
    this.t0 = this.ctx.currentTime + 0.1; this.nextStep = 0;
  }

  togglePause() {
    if (!this.fileMode) return false;
    if (this.fileEl.paused) this.fileEl.play(); else this.fileEl.pause();
    return !this.fileEl.paused;
  }

  fileClock() {
    const a = this.analysis || { bpm: 120, offset: 0, bars: [] }, el = this.fileEl, spb = 60 / a.bpm;
    const raw = Math.max(0, (el.currentTime - a.offset) / spb), bar = Math.floor(raw / 4), beat = raw / (a.bpm >= 150 ? 2 : 1), beatFrac = beat % 1;
    const section = a.bars[bar] || { name: 'groove', barIn: bar % 8, bars: 8, energy: 0.6 };
    return { track: null, beat, bar, section, beatFrac, energy: section.energy, build: 0, kick: el.paused || section.name === 'break' ? 0 : Math.exp(-beatFrac * 5) };
  }

  clock() {
    if (this.fileMode) return this.fileClock();
    if (!this.started) return { beat: performance.now() / 468, bar: 0, section: FORM[0], energy: 0.35, beatFrac: 0, kick: 0 };
    const raw = Math.max(0, (this.ctx.currentTime - this.t0) / this.spb), bar = Math.floor(raw / 4), beat = raw / (this.track.div || 1);
    const section = sectionAt(bar, this.form), beatFrac = beat % 1;
    const inBuild = section.name === 'build' ? (section.barIn + (raw % 4) / 4) / section.bars : 0;
    return { track: this.track, beat, bar, section, beatFrac, energy: section.energy + inBuild * 0.35, build: inBuild, kick: section.name === 'break' ? 0 : Math.exp(-beatFrac * 5) };
  }

  schedule() {
    if (this.ctx.state !== 'running' || this.fileMode) return;
    const ahead = document.hidden ? 1.6 : 0.22, end = this.ctx.currentTime + ahead;
    // 탭이 오래 멈췄다 돌아오면 밀린 음을 쏟지 않고 건너뛴다
    const now = Math.ceil((this.ctx.currentTime - this.t0) / this.spStep);
    if (now > this.nextStep + 8) this.nextStep = now;
    for (;;) {
      const t = this.t0 + this.nextStep * this.spStep;
      if (t > end) break;
      if (this.autoNext && this.nextStep >= this.form.reduce((s, f) => s + f.bars, 0) * 16) {
        this.advance(t); continue;
      }
      this.playStep(this.nextStep, t);
      this.nextStep++;
    }
  }

  /* 밴드: 드럼, 베이스, 기타, 건반, 관악 멜로디 */
  playBand(step, t) {
    if (this.track.jazz) { this.playJazz(step, t); return; }
    const T = this.track, s16 = step % 16, bar = Math.floor(step / 16), sec = sectionAt(bar, this.form), name = sec.name, feel = T.feel;
    const chord = T.chords[bar % T.chords.length], root = T.bass[bar % T.bass.length];
    const drop = name === 'drop', intro = name === 'intro', brk = name === 'break', build = name === 'build', folk = feel === 'folk', disco = feel === 'disco';
    const lastBar = sec.barIn === sec.bars - 1, fill = lastBar && s16 >= 12 && !intro;
    if (s16 === 0) this.synthFilter.frequency.setTargetAtTime(drop ? 4200 : 2600, t, 0.2);

    // 드럼
    if (!(folk && intro)) {
      const kickOn = disco ? s16 % 4 === 0 : folk ? s16 === 0 || s16 === 10 : s16 === 0 || s16 === 6 || s16 === 8;
      if (kickOn && !fill) this.kick(t, folk ? 0.5 : 0.78);
      if ((s16 === 4 || s16 === 12) && !intro && !fill) this.snare(t, folk ? 0.14 : 0.3);
      if (s16 % 2 === 0 && !fill) this.hat(t, folk ? 0.07 : 0.13, 0.05);
      if (disco && s16 % 4 === 2 && !intro) this.hat(t, 0.2, 0.2);
      if (fill && s16 % (folk ? 2 : 1) === 0) this.tom(t, 210 - (s16 - 12) * 26, folk ? 0.26 : 0.44);
      if (drop && sec.barIn === 0 && s16 === 0) { const c = this.noise(t, 1.2, 'highpass', 5200, 0.2); c.connect(this.verb); this.cheer(0.09, t); }
    }
    // 베이스
    if (!intro || folk) {
      const line = disco ? { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 0, 14: 12 } : folk ? { 0: 0, 8: 7 } : { 0: 0, 4: 7, 6: 9, 8: 12, 12: 7, 14: 4 };
      if (line[s16] !== undefined) this.bandBass(t, midi(root + 12 + line[s16]), folk ? 0.22 : 0.27);
    }
    // 기타
    if (folk) {
      if ([0, 4, 6, 10, 12, 14].includes(s16)) this.strum(t, chord, s16 % 4 === 0 ? 0.075 : 0.05, s16 === 6 || s16 === 10 || s16 === 14);
    } else if (s16 % 4 === 2) this.chop(t, chord, disco ? 0.05 : 0.07);
    else if (disco && s16 % 2 === 1 && !intro) this.chop(t, chord, 0.022);
    // 건반과 현악
    if (s16 === 0 && !intro && !build) this.pad(t, chord.map((n) => n + (folk ? 0 : 12)), this.spb * 3.9, drop ? 0.034 : 0.018);
    if (disco && drop && (s16 === 3 || s16 === 11)) this.stab(t, chord.map((n) => n + 12), 0.04);
    if (build) { if (s16 % (sec.barIn >= 2 ? 2 : 4) === 0) this.snare(t, 0.06 + (sec.barIn + s16 / 16) * 0.05); }
    // 관악 멜로디: 절은 낮게, 후렴과 연주 구간은 높게
    if (!intro && !build) {
      const n = T.melody[(step % 32)];
      if (n) {
        const up = Math.floor((n - 1) / 3), note = chord[(n - 1) % 3] + 12 * up + (drop || brk ? 12 : 0);
        this.horn(t, midi(note), drop || brk ? 0.075 : 0.055);
      }
    }
  }

  /* 재즈: 브러시 드럼, 첼로, 피아노, 보컬. break는 피아노 솔로 */
  playJazz(step, t0) {
    const T = this.track, s16 = step % 16, bar = Math.floor(step / 16), sec = sectionAt(bar, this.form), name = sec.name, feel = T.jazz;
    const chord = T.chords[bar % T.chords.length], root = T.bass[bar % T.bass.length], next = T.bass[(bar + 1) % T.bass.length];
    const intro = name === 'intro', brk = name === 'break', drop = name === 'drop', swing = feel === 'swing', ballad = feel === 'ballad';
    // 스윙은 뒤 8분음표를 늦게 친다
    const t = swing && s16 % 4 === 2 ? t0 + this.spStep * 0.66 : t0;
    if (s16 === 0) this.synthFilter.frequency.setTargetAtTime(drop ? 3600 : 2600, t, 0.3);
    const tone = (n) => chord[(n - 1) % 4] + 12 * Math.floor((n - 1) / 4);

    // 드럼: 라이드와 브러시
    if (swing) {
      if ([0, 4, 6, 8, 12, 14].includes(s16) && !(intro && sec.barIn < 2)) this.ride(t, s16 % 4 ? 0.05 : 0.075);
      if (s16 === 4 || s16 === 12) this.hat(t, 0.05, 0.03);
      if (s16 % 4 === 0) this.kick(t, 0.12);
      if (!intro && (s16 === 6 || s16 === 14) && (bar + s16) % 3 === 0) this.brush(t, 0.08, 0.08);
    } else if (ballad) {
      if (s16 % 4 === 0) this.brush(t, this.spb * 0.85, 0.05);
      if (s16 === 4 || s16 === 12) this.brush(t, 0.12, 0.06);
      if (s16 === 0 && drop) this.ride(t, 0.04);
    } else {
      if (s16 % 2 === 0) this.ride(t, s16 % 4 ? 0.035 : 0.05);
      if (s16 === 0 || s16 === 6 || s16 === 8 || s16 === 14) this.kick(t, 0.16);
      if ([0, 6, 12].includes(s16) || (bar % 2 && [4, 10].includes(s16))) this.rim(t, 0.09);
    }
    if (drop && sec.barIn === 0 && s16 === 0) this.cheer(0.05, t);

    // 첼로: 스윙은 걷는 베이스, 발라드는 길게 켜고, 보사는 근음과 5도
    if (swing) {
      if (s16 % 4 === 0) {
        const beat = s16 / 4, n = [root, root + (chord[1] - chord[0]), root + 7, next + (bar % 2 ? 1 : -1)][beat];
        this.cello(t, midi(n), this.spb * 0.9, 0.2, false);
      }
    } else if (ballad) {
      if (s16 === 0) this.cello(t, midi(root), this.spb * 2.6, 0.12, true);
      if (s16 === 8) this.cello(t, midi(root + 7), this.spb * 1.8, 0.1, true);
    } else if (s16 === 0 || s16 === 6 || s16 === 8 || s16 === 14) {
      this.cello(t, midi(s16 >= 8 ? root + 7 : root), this.spStep * 2.4, 0.2, false);
    }

    // 피아노 반주
    const voicing = chord.slice(1).concat(chord[0] + 12);
    if (swing) {
      if (s16 === 0 || (s16 === 6 && bar % 2 === 0) || (s16 === 10 && bar % 2)) voicing.forEach((n, i) => this.piano(t + i * 0.006, midi(n), 0.035, this.spb * 1.2));
    } else if (ballad) {
      if (s16 === 0) voicing.forEach((n, i) => this.piano(t + i * 0.06, midi(n), 0.04, this.spb * 3));
      if (s16 === 8 && !brk) [voicing[1], voicing[3]].forEach((n, i) => this.piano(t + i * 0.05, midi(n + 12), 0.025, this.spb * 1.5));
    } else if ([0, 3, 6, 10, 12].includes(s16)) voicing.forEach((n) => this.piano(t, midi(n), 0.028, this.spStep * 1.6));

    // 노래와 피아노 솔로
    if (intro) return;
    const i = step % 32, n = T.melody[i];
    if (!n) return;
    let len = 1; while (len < 8 && !T.melody[(i + len) % 32]) len++;
    if (brk) {   // 피아노 솔로: 노래 선율을 한 옥타브 위에서 꾸며 친다
      this.piano(t, midi(tone(n) + 12), 0.07, this.spStep * len);
      if (len > 2) this.piano(t + this.spStep * (swing ? 1.33 : 1), midi(tone(n + 1) + 12), 0.05, this.spStep * (len - 1));
      return;
    }
    const vowel = 'aoaue'[(Math.floor(step / 8) + n) % 5];
    this.sing(t, midi(tone(n) + 12), this.spStep * len * 0.95, drop ? 0.2 : 0.16, vowel);
  }

  ride(t, v) {
    const g = this.noise(t, 0.5, 'highpass', 5200, v, 0.7); g.connect(this.verb);
    this.voice(t, 3150, 0.35, v * 0.07, 'sine', [0, 1180], this.music);
  }

  brush(t, dur, v) {
    const { ctx } = this, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.08, dur * 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.music); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.03);
  }

  rim(t, v) {
    this.noise(t, 0.04, 'bandpass', 1800, v, 4);
    this.voice(t, 820, 0.04, v * 0.5, 'square', [0], this.music);
  }

  /* 첼로: 톱니파를 몸통 공명처럼 걸러 낸다. bowed면 천천히 켜고 떨림을 준다 */
  cello(t, f, dur, v, bowed) {
    const { ctx } = this, o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 4;
    lp.type = 'lowpass'; lp.frequency.value = bowed ? 1500 : 1100; lp.Q.value = 1.2;
    bp.type = 'peaking'; bp.frequency.value = 280; bp.gain.value = 6; bp.Q.value = 1.5;
    const a = bowed ? 0.18 : 0.01;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
    if (bowed) { g.gain.setValueAtTime(v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    if (bowed) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.4);
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    o.connect(lp); o2.connect(lp); lp.connect(bp); bp.connect(g); g.connect(this.music); g.connect(this.verb);
    for (const x of [o, o2]) { x.start(t); x.stop(t + dur + a + 0.1); }
  }

  /* 피아노: 맑은 어택과 빠른 감쇠, 배음을 조금 섞는다 */
  piano(t, f, v, dur) {
    const { ctx } = this, g = ctx.createGain(), d = Math.max(0.25, Math.min(2.4, dur * 1.4));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(this.music); g.connect(this.verb);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([h, type, k]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * h; o.detune.value = h === 2 ? 3 : 0; og.gain.value = k;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.05);
    });
  }

  /* 보컬: 성대(톱니파)에 모음 공명(포먼트)을 씌우고 비브라토를 늦게 건다 */
  sing(t, f, dur, v, vowel = 'a') {
    const { ctx } = this, F = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 2000, 2550] }[vowel] || [800, 1150, 2900];
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o2.frequency.value = f;
    o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);   // 살짝 아래에서 올라붙는다
    lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + Math.min(0.25, dur * 0.4)); lg.gain.linearRampToValueAtTime(f * 0.016, t + Math.min(0.6, dur * 0.8));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const end = t + Math.max(0.18, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.06); g.gain.setValueAtTime(v, end - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    F.forEach((ff, k) => {
      const bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 9; fg.gain.value = [2.6, 1.4, 0.55][k];
      o.connect(bp); bp.connect(fg); fg.connect(g);
    });
    const og = ctx.createGain(); og.gain.value = 0.35; o2.connect(og); og.connect(g);
    g.connect(this.music); g.connect(this.verb); g.connect(this.echo);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.2); }
  }

  snare(t, v) {
    this.noise(t, 0.14, 'bandpass', 2100, v, 0.8).connect(this.verb);
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(205, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(v * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.12);
  }

  tom(t, f, v) {
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.16);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.music); g.connect(this.verb); o.start(t); o.stop(t + 0.22);
  }

  bandBass(t, f, v) {
    const { ctx } = this, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), dur = this.spStep * 1.8;
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 900;
    this.env(g, t, 0.006, v, dur);
    o.connect(lp); lp.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  strum(t, chord, v, upward) {
    const notes = [chord[0] - 12, chord[2] - 12, chord[0], chord[1], chord[2], chord[0] + 12];
    (upward ? [...notes].reverse().slice(0, 4) : notes).forEach((n, i) => {
      const g = this.voice(t + i * 0.012, midi(n), this.spStep * 2.6, v, 'triangle', [0, 3], this.synthFilter);
      g.connect(this.verb);
    });
  }

  chop(t, chord, v) {
    for (const n of chord) { const g = this.voice(t, midi(n + 12), 0.07, v, 'sawtooth', [0], this.synthFilter); void g; }
  }

  horn(t, f, v) {
    const g = this.voice(t, f, this.spStep * 2.4, v, 'sawtooth', [-4, 5], this.synthFilter);
    g.connect(this.echo); g.connect(this.verb);
  }

  /* 판 긁히는 소리 */
  crackle(t) {
    if (Math.random() < 0.22) this.noise(t + Math.random() * this.spStep, 0.004 + Math.random() * 0.006, 'highpass', 1800, 0.05 + Math.random() * 0.16, 0.7);
    if (Math.random() < 0.015) this.noise(t, 0.02, 'lowpass', 900, 0.25, 0.7);
  }

  playStep(step, t) {
    if (this.track.vinyl || this.vinylAlways) this.crackle(t);
    if (this.track.style === 'band') { this.playBand(step, t); return; }
    const T = this.track, s16 = step % 16, bar = Math.floor(step / 16), sec = sectionAt(bar, this.form), name = sec.name;
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
    if (hasKick && (T.kicks || [0, 4, 8, 12]).includes(s16)) { this.kick(t, (T.kickV || 1) * (drop ? 1 : 0.9)); this.sidechain(t, T.duck ?? (drop ? 0.22 : 0.45)); }
    if ((drop || groove) && (T.snares || [4, 12]).includes(s16)) { if (T.snares) this.snare(t, 0.52); else this.clap(t, T.clapV || 0.5); }
    if (!brk && !build && !T.noOpenHat && s16 % 4 === 2) this.hat(t, 0.28, 0.13);
    if ((drop || groove) && (T.hat16 || s16 % 2 === 1)) this.hat(t, T.hat16 ? 0.07 : 0.09, 0.04);
    if (drop && bar % 4 === 3 && s16 >= 12) this.clap(t, 0.25 + (s16 - 12) * 0.08);

    if ((drop || groove || (intro && sec.barIn >= 4)) && T.bassLine[s16]) this.playBass(T, t, midi(root + (T.bassNotes ? T.bassNotes[s16] : s16 === 15 ? 12 : 0)), drop ? 0.42 : 0.34, drop, bar);
    if (drop && T.stab[s16]) this.stab(t, chord.map((n) => n + 12), T.stabV || 0.1);
    if (groove && T.stab[s16] && sec.barIn >= 4) this.stab(t, chord, 0.06);
    if ((brk || build) && s16 === 0 && sec.barIn % 2 === 0) this.pad(t, chord, this.spb * 8, brk ? 0.05 : 0.065);
    if ((drop && (T.leadAlways || sec.barIn >= 8)) || build || (brk && sec.barIn >= 2)) {
      const n = T.lead[s16];
      if (n || (T.leadAlways && s16 % 8 === 0)) {
        if (T.leadType === 'pluck') this.pluck(t, midi(chord[0] + n), brk ? 0.08 : 0.13);
        else this.lead(t, midi(chord[0] + n), brk ? 0.05 : drop ? 0.08 : 0.06, T.wave);
      }
    }
    if (build) {
      const every = sec.barIn < 2 ? 4 : lastBarOfBuild ? 1 : 2;
      if (s16 % every === 0) this.clap(t, 0.16 + (sec.barIn + s16 / 16) * 0.09);
      if (sec.barIn === 0 && s16 === 0) this.riser(t, this.spb * 4 * sec.bars);
    }
    if (drop && sec.barIn === 0 && s16 === 0) this.impact(t);
  }

  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  playBass(T, t, f, v, drop, bar) {
    const dur = this.spStep * (T.bassLen || 1.5);
    if (T.bassType === 'wobble') this.wobble(t, f, v, dur, drop ? (bar % 2 ? 6 : 3) : 2);
    else if (T.bassType === 'reese') this.reese(t, f, v, dur);
    else if (T.bassType === 'sub') this.sub(t, f, v * 0.62, dur);
    else if (T.bassType === 'acid') this.acid(t, f, v * 0.5);
    else this.bass(t, f, v);
  }

  /* 덥스텝: 필터가 박자에 맞춰 울렁인다 */
  wobble(t, f, v, dur, perBeat) {
    const { ctx } = this, a = ctx.createOscillator(), b = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    a.type = 'sawtooth'; b.type = 'square'; a.frequency.value = f; b.frequency.value = f * 1.004;
    lp.type = 'lowpass'; lp.Q.value = 9; lp.frequency.value = 560;
    lfo.frequency.value = perBeat / this.spb; depth.gain.value = 470; lfo.connect(depth); depth.connect(lp.frequency);
    g.gain.setValueAtTime(v * 0.3, t); g.gain.setValueAtTime(v * 0.3, t + dur * 0.92); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    a.connect(lp); b.connect(lp); lp.connect(g); g.connect(this.duck);
    for (const x of [a, b, lfo]) { x.start(t); x.stop(t + dur + 0.03); }
    this.sub(t, f, v * 0.34, dur);
  }

  /* 드럼 앤 베이스: 살짝 어긋난 톱니파 두 개가 맥놀이를 낸다 */
  reese(t, f, v, dur) {
    const { ctx } = this, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(320, t); lp.frequency.linearRampToValueAtTime(760, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(300, t + dur);
    g.gain.setValueAtTime(v * 0.42, t); g.gain.setValueAtTime(v * 0.42, t + dur * 0.9); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(this.duck);
    for (const de of [-16, 15]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = de; o.connect(lp); o.start(t); o.stop(t + dur + 0.03); }
    this.sub(t, f, v * 0.34, dur);
  }

  sub(t, f, v, dur) {
    const { ctx } = this, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.duck); o.start(t); o.stop(t + dur + 0.03);
  }

  /* 애시드 테크노: 공명이 강한 필터가 음마다 튄다 */
  acid(t, f, v) {
    const { ctx } = this, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), dur = this.spStep * 1.05;
    o.type = 'sawtooth'; o.frequency.value = f * 2;
    lp.type = 'lowpass'; lp.Q.value = 16; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
    this.env(g, t, 0.003, v, dur);
    o.connect(lp); lp.connect(g); g.connect(this.duck); g.connect(this.echo); o.start(t); o.stop(t + dur + 0.03);
  }

  /* 마림바처럼 톡 튀는 음 */
  pluck(t, f, v) {
    const g = this.voice(t, f, 0.26, v, 'triangle', [0], this.duck);
    g.connect(this.echo); g.connect(this.verb);
    this.voice(t, f * 2, 0.08, v * 0.4, 'sine', [0], this.duck);
  }

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
  scratch() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.25, 'bandpass', 1400, 0.25, 3, this.sfx); this.noise(t + 0.3, 0.05, 'lowpass', 700, 0.4, 0.7, this.sfx); }
  sip() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.3, 'bandpass', 2600, 0.09, 2, this.sfx); }
  highFive() { if (!this.started) return; const t = this.ctx.currentTime; this.noise(t, 0.08, 'bandpass', 2400, 0.95, 0.7, this.sfx); }
}
