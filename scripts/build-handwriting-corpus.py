"""Rebuild the target-independent local corpus from pinned hanzi-writer-data 2.0.1.

Usage: python3 scripts/build-handwriting-corpus.py /path/to/hanzi-writer-data-2.0.1.tgz
Public source: https://registry.npmjs.org/hanzi-writer-data/-/hanzi-writer-data-2.0.1.tgz
Only Arphic-licensed medians are used. No dictionary definitions or GPL recognizer code.
"""
import base64
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import tarfile

EXPECTED = 'nbQwM+MaryGoq7pBMIZLCd3lFq03nXuJuwku1+6UbjL58uU+9OULVcMkoNvNuJSoIV7f1bbPRfD4D/LQa5S7qg=='
SAMPLES = 16
DESTINATION = Path(__file__).resolve().parents[1] / 'src/assets/handwriting'


def resample(stroke):
    distances = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(stroke, stroke[1:])]
    total = sum(distances)
    if total < .001:
        return [stroke[0]] * SAMPLES
    points = [stroke[0]]
    segment, passed = 1, 0
    for i in range(1, SAMPLES):
        target = total * i / (SAMPLES - 1)
        while segment < len(stroke) - 1 and passed + distances[segment - 1] < target:
            passed += distances[segment - 1]
            segment += 1
        a, b = stroke[segment - 1], stroke[segment]
        distance = distances[segment - 1]
        ratio = max(0, min(1, (target - passed) / distance)) if distance else 0
        points.append([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio])
    return points


def compact(medians):
    strokes = [[[x, 900 - y] for x, y in stroke] for stroke in medians]
    all_points = [point for stroke in strokes for point in stroke]
    min_x, max_x = min(p[0] for p in all_points), max(p[0] for p in all_points)
    min_y, max_y = min(p[1] for p in all_points), max(p[1] for p in all_points)
    span = max(max_x - min_x, max_y - min_y, 1)
    center_x, center_y = (min_x + max_x) / 2, (min_y + max_y) / 2
    output = bytearray()
    for stroke in strokes:
        for x, y in resample(stroke):
            output.append(max(0, min(255, math.floor(((x - center_x) / span + .5) * 255 + .5))))
            output.append(max(0, min(255, math.floor(((y - center_y) / span + .5) * 255 + .5))))
    return output


archive = Path(sys.argv[1])
archive_bytes = archive.read_bytes()
actual = base64.b64encode(hashlib.sha512(archive_bytes).digest()).decode()
if actual != EXPECTED:
    raise SystemExit('Pinned npm package integrity mismatch')
notice = {
    'name': 'Yulu compact universal Hanzi stroke templates',
    'copyright': 'Copyright (C) 1999 Arphic Technology Co., Ltd.',
    'license': 'Arphic Public License; see ARPHICPL.TXT',
    'source': 'hanzi-writer-data 2.0.1, derived from skishore/makemeahanzi graphics.txt',
    'source_url': 'https://registry.npmjs.org/hanzi-writer-data/-/hanzi-writer-data-2.0.1.tgz',
    'modified': '2026-10-03: median-only extraction, Y-axis inversion, whole-character normalization, 16 arc-length samples per stroke, 8-bit coordinates; independent classifier code.',
    'redistribution': 'This modified data is freely redistributable under the Arphic Public License. No warranty.',
}
entries = []
with tarfile.open(archive) as source:
    for member in source.getmembers():
        name = Path(member.name).stem
        if not member.name.endswith('.json') or len(name) != 1:
            continue
        data = json.load(source.extractfile(member))
        if not data.get('medians'):
            continue
        if len(data['medians']) > 64 or any(not stroke for stroke in data['medians']):
            raise SystemExit(f'Invalid stroke data for {name}')
        entries.append((name, data['medians']))
    license_text = source.extractfile('package/APL/english/ARPHICPL.TXT').read()
entries.sort(key=lambda item: ord(item[0]))
metadata = json.dumps(notice, ensure_ascii=False, separators=(',', ':')).encode()
output = bytearray(struct.pack('<4sHHII', b'YHWR', 1, SAMPLES, len(entries), len(metadata)))
output.extend(metadata)
for character, medians in entries:
    output.extend(struct.pack('<IB', ord(character), len(medians)))
    output.extend(compact(medians))
DESTINATION.mkdir(parents=True, exist_ok=True)
(DESTINATION / 'medians.bin').write_bytes(output)
(DESTINATION / 'ARPHICPL.TXT').write_bytes(license_text)
manifest = {**notice, 'characters': len(entries), 'bytes': len(output), 'samples_per_stroke': SAMPLES, 'source_integrity': 'sha512-' + EXPECTED, 'corpus_sha256': hashlib.sha256(output).hexdigest()}
(DESTINATION / 'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'{len(entries)} characters, {len(output):,} bytes, SHA256 {manifest["corpus_sha256"]}')
