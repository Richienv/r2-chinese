#!/usr/bin/env python3
"""
Builds src/data/hsk4a-audio.json: where each book line and vocabulary word sits
inside the publisher's HSK Standard Course 4A recordings.

Only timestamps are written. The recordings stay out of git; install them first:

    node scripts/fetch-book-audio.mjs

Needs ffmpeg plus:  pip install faster-whisper zhconv

    python3 scripts/align-book-audio.py            # transcribe (cached) + align
    python3 scripts/align-book-audio.py --report   # also print per-lesson vocabulary counts
    python3 scripts/align-book-audio.py --through 3  # only lessons 1-3 (quick check)

How it works. Each track is "heading, the text read once, then its new words".
Whisper gives word timestamps, the book text is fitted onto that transcript
(tolerating recognition errors), and clip edges snap to the silences around
each reading. The vocabulary section is cut at its silences and assigned to the
lesson's word list by position, which is only trusted when the counts agree.
"""
import json, os, re, subprocess, sys
from pathlib import Path

try:
    from zhconv import convert as _zh
except ImportError:
    sys.exit('pip install faster-whisper zhconv')

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'public/audio/hsk4a'
CACHE = ROOT / '.cache/book-audio'
BOOK = json.loads((ROOT / 'src/data/hsk4a.json').read_text(encoding='utf-8'))
OUT = ROOT / 'src/data/hsk4a-audio.json'
CJK = re.compile(r'[㐀-鿿]')
PROPER = {'pr.n.', 'proper noun'}
MIN_LINE_COVERAGE = 0.8


def simp(c): return _zh(c, 'zh-cn')


# ---------------------------------------------------------------- transcription
_model = None


def transcribe(track):
    cached = CACHE / f'{track}.json'
    if cached.exists(): return json.loads(cached.read_text(encoding='utf-8'))
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 4)
    segs, info = _model.transcribe(str(AUDIO / f'{track}.mp3'), language='zh', initial_prompt='以下是普通话课文，使用简体中文。',
                                   word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    out = {'file': track, 'duration': round(info.duration, 2), 'segments': [
        {'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip(),
         'words': [{'w': w.word, 's': round(w.start, 2), 'e': round(w.end, 2)} for w in (s.words or [])]} for s in segs]}
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    return out


def speech_intervals(track, noise='-35dB', gap=0.30):
    """Stretches of sound separated by at least `gap` seconds of silence."""
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(AUDIO / f'{track}.mp3'), '-af', f'silencedetect=noise={noise}:d={gap}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).groups()
    duration = int(h) * 3600 + int(m) * 60 + float(s)
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    ends += [duration] * (len(starts) - len(ends))
    out, t = [], 0.0
    for a, b in zip(starts, ends):
        if a - t > 0.08: out.append((t, a))
        t = b
    if duration - t > 0.08: out.append((t, duration))
    return out, duration


# -------------------------------------------------------------------- alignment
def ref_chars(lines):
    return [(li, ci, ch) for li, line in enumerate(lines) for ci, ch in enumerate(line['zh']) if CJK.match(ch)]


def asr_chars(asr):
    """(char, token id, start, end) for every Chinese character Whisper heard, in Simplified."""
    out = []
    for tid, w in enumerate(w for seg in asr['segments'] for w in seg['words']):
        cs = [simp(c) for c in w['w'] if CJK.match(c)]
        for k, c in enumerate(cs):
            out.append((c, tid, w['s'] + (w['e'] - w['s']) * k / len(cs), w['s'] + (w['e'] - w['s']) * (k + 1) / len(cs)))
    return out


def fit_align(R, A, match=2.0, mismatch=-1.0, gap_ref=-1.0, gap_asr=-0.6):
    """Fit all of R into one stretch of A. Extra speech before and after (heading, vocabulary) is free."""
    m, n = len(R), len(A)
    NEG = -1e9
    dp = [[NEG] * (n + 1) for _ in range(m + 1)]
    bt = [[0] * (n + 1) for _ in range(m + 1)]
    dp[0] = [0.0] * (n + 1)
    for i in range(1, m + 1):
        ri, row, prev = R[i - 1][2], dp[i], dp[i - 1]
        for j in range(n + 1):
            best, how = prev[j] + gap_ref, 2
            if j:
                s = prev[j - 1] + (match if ri == A[j - 1][0] else mismatch)
                if s > best: best, how = s, 1
                g = row[j - 1] + gap_asr
                if g > best: best, how = g, 3
            row[j], bt[i][j] = best, how
    j = max(range(n + 1), key=lambda x: dp[m][x])
    pairs, i = [None] * m, m
    while i > 0:
        how = bt[i][j]
        if how == 1: pairs[i - 1] = j - 1; i -= 1; j -= 1
        elif how == 2: i -= 1
        else: j -= 1
    return pairs


def containing(intervals, t, slack=0.05):
    for a, b in intervals:
        if a - slack <= t <= b + slack: return (a, b)
    return None


def align_lines(lesson, k, asr, intervals, report):
    lines = BOOK['lessons'][lesson - 1]['texts'][k - 1]['lines']
    R, A = ref_chars(lines), asr_chars(asr)
    pairs = fit_align(R, A)
    hits = [(r, p) for r, p in enumerate(pairs) if p is not None and R[r][2] == A[p][0]]
    raw = []
    for li, line in enumerate(lines):
        mine = [(r, p) for r, p in hits if R[r][0] == li]
        total = sum(1 for x in R if x[0] == li)
        cover = len(mine) / total if total else 0
        raw.append({'li': li, 'zh': line['zh'], 'cover': cover, 'mine': mine,
                    't0': min((A[p][2] for _, p in mine), default=None), 't1': max((A[p][3] for _, p in mine), default=None)})
        report.append((f'L{lesson:02d}-{k}', li, cover))
    # snap each line to the silences around its reading
    for item in raw:
        if item['t0'] is None: continue
        iv0, iv1 = containing(intervals, item['t0']), containing(intervals, item['t1'])
        item['s'] = max(0.0, (iv0[0] - 0.06) if iv0 and item['t0'] - iv0[0] < 0.45 else item['t0'] - 0.15)
        item['e'] = (iv1[1] + 0.08) if iv1 and iv1[1] - item['t1'] < 0.45 else item['t1'] + 0.25
    ok = [x for x in raw if x['t0'] is not None]
    for a, b in zip(ok, ok[1:]):
        if a['e'] > b['s'] - 0.02:
            # Back-to-back lines have no silence to cut at: split at the midpoint of the two readings.
            a['e'] = b['s'] = (a['t1'] + b['t0']) / 2
    entries = {}
    for item in raw:
        if item['cover'] < MIN_LINE_COVERAGE or len(item['mine']) < 4: continue
        words = {}
        for r, p in item['mine']:
            words.setdefault(A[p][1], []).append((R[r][1], A[p][2], A[p][3]))
        spans = []
        for runs in words.values():
            first, last = min(x[0] for x in runs), max(x[0] for x in runs)
            start, end = min(x[1] for x in runs), max(x[2] for x in runs)
            spans.append([first, last - first + 1, round(max(0.0, start - item['s']), 2), round(end - start, 2)])
        spans.sort(key=lambda x: x[2])
        entries[item['zh']] = {'f': f'L{lesson:02d}-{k}', 's': round(item['s'], 2), 'e': round(item['e'], 2), 'w': spans}
    return entries, (max(x['t1'] for x in ok) if ok else None)


# ------------------------------------------------------------------ vocabulary
def interval_text(asr, a, b):
    toks = [(simp(w['w']), (w['s'] + w['e']) / 2) for seg in asr['segments'] for w in seg['words']]
    return ''.join(t for t, mid in toks if a - 0.05 <= mid <= b + 0.05)


def vocab_regions(asr, intervals, lines_end):
    """Word intervals after a text, split into (new words, proper nouns) by the spoken headings."""
    region = [iv for iv in intervals if iv[0] >= lines_end + 0.2]
    if not region: return [], []
    texts = [interval_text(asr, a, b) for a, b in region]
    is_proper = [bool(re.search(r'名词|有名|专有|名', t)) and i > 0 for i, t in enumerate(texts)]
    split = next((i for i, flag in enumerate(is_proper) if flag), len(region))
    words = [(region[i], texts[i]) for i in range(1, split)]          # region[0] is the "生词" heading
    proper = [(region[i], texts[i]) for i in range(split + 1, len(region))]
    return words, proper


def word_edges(items, duration):
    out = []
    for n, ((a, b), _) in enumerate(items):
        prev_b = items[n - 1][0][1] if n else 0.0
        next_a = items[n + 1][0][0] if n + 1 < len(items) else duration
        out.append((max(a - 0.07, (prev_b + a) / 2 if n else 0.0), min(b + 0.10, (b + next_a) / 2)))
    return out


def main():
    report_lines = '--report' in sys.argv
    through = int(sys.argv[sys.argv.index('--through') + 1]) if '--through' in sys.argv else 10
    manifest = {'version': 1, 'lines': {}, 'words': {}}
    cover_report, vocab_report, problems = [], [], []
    for lesson_no in range(1, through + 1):
        lesson = BOOK['lessons'][lesson_no - 1]
        words_seen, proper_seen = [], []
        for k in range(1, 6):
            track = f'L{lesson_no:02d}-{k}'
            if not (AUDIO / f'{track}.mp3').exists(): sys.exit(f'{track}.mp3 missing: run node scripts/fetch-book-audio.mjs')
            asr = transcribe(track)
            intervals, duration = speech_intervals(track)
            entries, lines_end = align_lines(lesson_no, k, asr, intervals, cover_report)
            for text, entry in entries.items(): manifest['lines'].setdefault(text, entry)
            if lines_end is None: problems.append(f'{track}: no lines aligned'); words_seen.append(None); proper_seen.append(None); continue
            w, p = vocab_regions(asr, intervals, lines_end)
            edges_w, edges_p = word_edges(w, duration), word_edges(p, duration)
            words_seen.append([(i, e) for i, e in zip(w, edges_w)])
            proper_seen.append([(i, e) for i, e in zip(p, edges_p)])
        regular = [v['zh'] for v in lesson['vocab'] if v['pos'] not in PROPER]
        proper = [v['zh'] for v in lesson['vocab'] if v['pos'] in PROPER]
        flat_w = [x for t in words_seen if t for x in t]
        flat_p = [x for t in proper_seen if t for x in t]
        tracks_w = [len(t) if t is not None else None for t in words_seen]
        tracks_p = [len(t) if t is not None else None for t in proper_seen]
        trusted = None not in words_seen and len(flat_w) == len(regular) and len(flat_p) == len(proper)
        vocab_report.append((lesson_no, len(regular), len(flat_w), tracks_w, len(proper), len(flat_p), tracks_p, trusted))
        if not trusted:
            problems.append(f'lesson {lesson_no}: vocabulary NOT aligned (words {len(flat_w)}/{len(regular)}, proper nouns {len(flat_p)}/{len(proper)})')
            continue
        track_of = [f'L{lesson_no:02d}-{k + 1}' for k, t in enumerate(words_seen) for _ in t]
        track_of_p = [f'L{lesson_no:02d}-{k + 1}' for k, t in enumerate(proper_seen) for _ in t]
        for zh, ((_, text), (s, e)), f in list(zip(regular, flat_w, track_of)) + list(zip(proper, flat_p, track_of_p)):
            manifest['words'].setdefault(zh, {'f': f, 's': round(s, 2), 'e': round(e, 2)})
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    total_lines = sum(len(t['lines']) for l in BOOK['lessons'][:through] for t in l['texts'])
    total_words = sum(len(l['vocab']) for l in BOOK['lessons'][:through])
    print(f"lines:  {len(manifest['lines'])}/{total_lines} recorded")
    print(f"vocab:  {len(manifest['words'])}/{total_words} entries recorded (unique words)")
    low = [(t, li, c) for t, li, c in cover_report if c < MIN_LINE_COVERAGE]
    print(f'lines below {MIN_LINE_COVERAGE:.0%} match (left on the neural voice): {len(low)}', *[f'  {t} line {li}: {c:.0%}' for t, li, c in low], sep='\n')
    for problem in problems: print('PROBLEM', problem)
    if report_lines:
        for row in vocab_report: print('vocab', row)


if __name__ == '__main__':
    main()
