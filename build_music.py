"""공용 곡 목록 만들기: music/<무대>/ 폴더의 음원을 찾아 music/tracks.json을 다시 쓴다.

무대 폴더: club(CLUB PULSE), live7080(7080), jazz(재즈 바)
같은 이름의 .lrc 파일이 있으면 가사로 붙인다.
GitHub는 파일 하나가 100MB를 넘으면 올라가지 않는다.

    python build_music.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent / 'music'
VENUES = ['club', 'live7080', 'jazz']
AUDIO = {'.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac'}
LIMIT = 95 * 1024 * 1024

tracks, too_big = [], []
for v in VENUES:
    d = ROOT / v
    d.mkdir(parents=True, exist_ok=True)
    for f in sorted(d.iterdir(), key=lambda x: x.name):
        if f.suffix.lower() not in AUDIO:
            continue
        if f.stat().st_size > LIMIT:
            too_big.append(f.name)
            continue
        item = {'venue': v, 'title': f.stem, 'file': f'{v}/{f.name}', 'size': f.stat().st_size}
        lrc = f.with_suffix('.lrc')
        if lrc.exists():
            item['lyrics'] = f'{v}/{lrc.name}'
        tracks.append(item)

(ROOT / 'tracks.json').write_text(json.dumps({'tracks': tracks}, ensure_ascii=False, indent=2), encoding='utf-8')
for v in VENUES:
    n = sum(1 for t in tracks if t['venue'] == v)
    print(f'{v}: {n}곡')
if too_big:
    print('100MB 가까이 되어 뺀 파일:', ', '.join(too_big))
