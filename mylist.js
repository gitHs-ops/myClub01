/* myList: 내가 올린 음원을 이 브라우저(IndexedDB)에 저장한다. 서버로 보내지 않는다 */
const DB = 'clubpulse-mylist', STORE = 'tracks';

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}
export const listTracks = () => run('readonly', (s) => s.getAll());
export const addTrack = (t) => run('readwrite', (s) => s.add(t));
export const putTrack = (t) => run('readwrite', (s) => s.put(t));
export const removeTrack = (id) => run('readwrite', (s) => s.delete(id));

export const isAudioFile = (f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma)$/i.test(f.name);
export const titleOf = (name) => name.replace(/\.[^.]+$/, '');

/* 음원을 분석해 박자와 구간을 얻는다: 사람과 조명이 이 값에 맞춰 움직인다 */
export function analyze(buf) {
  const sr = buf.sampleRate, n = buf.length, hop = Math.round(sr * 0.01), a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  const alpha = 1 - Math.exp((-2 * Math.PI * 170) / sr), frames = Math.floor(n / hop), env = new Float32Array(frames), loud = new Float32Array(frames);
  let lp = 0;
  for (let f = 0, i = 0; f < frames; f++) {
    let low = 0, all = 0;
    for (let k = 0; k < hop; k++, i++) { const v = (a[i] + b[i]) * 0.5; lp += alpha * (v - lp); low += lp * lp; all += v * v; }
    env[f] = Math.sqrt(low / hop); loud[f] = Math.sqrt(all / hop);
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, env[f] - env[f - 1]);

  // 곡 가운데 90초로 박자를 찾는다
  const span = Math.min(frames, 9000), from = Math.floor((frames - span) / 2);
  const comb = (lag) => {
    let best = 0, phase = 0;
    for (let p = 0; p < lag; p++) {
      let sum = 0, c = 0;
      for (let x = p; x < span; x += lag) { sum += onset[from + Math.round(x)]; c++; }
      if (c && sum / c > best) { best = sum / c; phase = p; }
    }
    return [best, phase];
  };
  let bestBpm = 120, bestScore = -1;
  for (let bpm = 70; bpm <= 160; bpm += 1) {
    const [s] = comb(6000 / bpm), w = Math.exp(-0.5 * (Math.log2(bpm / 118) / 0.7) ** 2), score = s * w;
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  let fine = bestBpm, fineScore = -1, finePhase = 0;
  for (let bpm = bestBpm - 1.5; bpm <= bestBpm + 1.5; bpm += 0.1) {
    const [s, p] = comb(6000 / bpm);
    if (s > fineScore) { fineScore = s; fine = bpm; finePhase = p; }
  }
  const bpm = Math.round(fine * 10) / 10, spb = 60 / bpm, duration = buf.duration;
  const offset = (((from + finePhase) * 0.01) % spb);

  // 마디별 크기로 후렴과 쉬는 구간을 나눈다
  const barLen = spb * 4, count = Math.max(1, Math.ceil((duration - offset) / barLen)), level = [];
  for (let i = 0; i < count; i++) {
    const s = Math.floor((offset + i * barLen) * 100), e = Math.min(frames, Math.floor((offset + (i + 1) * barLen) * 100));
    let sum = 0; for (let f = s; f < e; f++) sum += loud[f];
    level.push(e > s ? sum / (e - s) : 0);
  }
  const smooth = level.map((_, i) => { let sum = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(count - 1, i + 2); j++) { sum += level[j]; c++; } return sum / c; });
  const sorted = [...smooth].sort((x, y) => x - y), high = sorted[Math.floor(count * 0.7)] ?? 0, low = sorted[Math.floor(count * 0.2)] ?? 0;
  const kinds = smooth.map((v) => (v >= high && high > low ? 'drop' : v <= low ? 'break' : 'groove'));
  // 잠깐 바뀌는 구간은 앞 구간에 합쳐 후렴 표시가 자꾸 켜지지 않게 한다
  const runs = [];
  kinds.forEach((k) => { const r = runs[runs.length - 1]; if (r && r.name === k) r.bars++; else runs.push({ name: k, bars: 1 }); });
  const merged = [];
  runs.forEach((r) => { const m = merged[merged.length - 1]; if (m && (r.bars < 4 || m.name === r.name)) m.bars += r.bars; else merged.push({ ...r }); });
  const bars = [], ENERGY = { drop: 0.95, groove: 0.6, break: 0.35 };
  merged.forEach((r) => { for (let i = 0; i < r.bars; i++) bars.push({ name: r.name, barIn: i, bars: r.bars, energy: ENERGY[r.name] }); });
  return { bpm, offset, duration, bars };
}
