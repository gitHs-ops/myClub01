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

/* 가사: LRC([mm:ss.xx]) 또는 시간 없는 글. 저장은 원문 그대로 한다 */
export const isLrcFile = (f) => /\.lrc$/i.test(f.name);
export function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); }
  catch { try { return new TextDecoder('euc-kr').decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); } }
}
export const readText = async (f) => decodeText(new Uint8Array(await f.arrayBuffer()));
export function parseLrc(text) {
  let off = 0; const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const o = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i); if (o) { off = +o[1] / 1000; continue; }
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const line = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    for (const s of stamps) out.push({ t: +s[1] * 60 + parseFloat(s[2].replace(':', '.')), text: line });
  }
  if (out.length < 2) return null;
  out.forEach((l) => { l.t = Math.max(0, l.t + off); });
  return out.sort((a, b) => a.t - b.t);
}
/* 시간 정보가 없으면 곡 길이에 맞춰 고르게 나눈다 (앞 6%는 전주로 비워 둔다) */
export function lyricLines(text, dur) {
  const lrc = parseLrc(text);
  if (lrc) return { timed: true, lines: lrc };
  const rows = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!rows.length) return null;
  const d = dur > 5 ? dur : 180;
  return { timed: false, lines: rows.map((r, i) => ({ t: d * (0.06 + (0.9 * i) / rows.length), text: r })) };
}
/* mp3 안의 가사(ID3 USLT 또는 SYLT) */
export async function id3Lyrics(blob) {
  try {
    const h = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33 || h[3] < 3) return null;
    const ver = h[3], size = ((h[6] & 127) << 21) | ((h[7] & 127) << 14) | ((h[8] & 127) << 7) | (h[9] & 127);
    if (size > 16e6) return null;
    const d = new Uint8Array(await blob.slice(10, 10 + size).arrayBuffer());
    const be = (i) => ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;
    const ss = (i) => ((d[i] & 127) << 21) | ((d[i + 1] & 127) << 14) | ((d[i + 2] & 127) << 7) | (d[i + 3] & 127);
    let i = 0;
    if (h[5] & 0x40) i = ver === 4 ? ss(0) : be(0) + 4;
    const dec = (enc, b) => {
      if (enc === 3) return new TextDecoder('utf-8').decode(b);
      if (enc === 2) return new TextDecoder('utf-16be').decode(b);
      if (enc === 1) return b[0] === 0xfe && b[1] === 0xff ? new TextDecoder('utf-16be').decode(b.subarray(2)) : new TextDecoder('utf-16le').decode(b[0] === 0xff && b[1] === 0xfe ? b.subarray(2) : b);
      return decodeText(b);
    };
    const term = (b, at, enc) => {   // 문자열 끝(0) 위치
      if (enc === 1 || enc === 2) { for (let j = at; j + 1 < b.length; j += 2) if (!b[j] && !b[j + 1]) return [j, j + 2]; return [b.length, b.length]; }
      for (let j = at; j < b.length; j++) if (!b[j]) return [j, j + 1];
      return [b.length, b.length];
    };
    let uslt = null, sylt = null;
    while (i + 10 <= d.length) {
      const id = String.fromCharCode(d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const n = ver === 4 ? ss(i + 4) : be(i + 4), body = d.subarray(i + 10, i + 10 + n); i += 10 + n;
      if (id === 'USLT' && !uslt && body.length > 5) {
        const enc = body[0], [, s] = term(body, 4, enc);
        uslt = dec(enc, body.subarray(s)).replace(/\u0000/g, '').trim();
      } else if (id === 'SYLT' && !sylt && body.length > 7 && body[4] === 2) {
        const enc = body[0]; let [, p] = term(body, 6, enc); const rows = [];
        while (p < body.length) {
          const [e, nx] = term(body, p, enc); if (nx + 4 > body.length) break;
          const ms = ((body[nx] << 24) | (body[nx + 1] << 16) | (body[nx + 2] << 8) | body[nx + 3]) >>> 0;
          const txt = dec(enc, body.subarray(p, e)).replace(/^[\r\n]+/, '').trim();
          if (txt) rows.push(`[${String(Math.floor(ms / 60000)).padStart(2, '0')}:${((ms % 60000) / 1000).toFixed(2).padStart(5, '0')}]${txt}`);
          p = nx + 4;
        }
        if (rows.length > 1) sylt = rows.join('\n');
      }
    }
    return sylt || uslt || null;
  } catch { return null; }
}
