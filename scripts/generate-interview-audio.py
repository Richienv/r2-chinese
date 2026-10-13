#!/usr/bin/env python3
"""Generate deployable Jiayin audio locally; models and Python stay outside the app.

Install piper-tts in a temporary virtualenv, download zh_CN-huayan-medium from
https://huggingface.co/rhasspy/piper-voices, then run this script with --model.
Requires ffmpeg. The supplied Mandarin is preserved verbatim.
"""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path

from piper import PiperVoice

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = json.loads((root / 'src/data/jiayin.json').read_text())
destination = root / 'public/audio/jiayin'
destination.mkdir(parents=True, exist_ok=True)
voice = PiperVoice.load(str(args.model))
model_hash = hashlib.sha256(args.model.read_bytes()).hexdigest()
manifest = {'version': 1, 'voice': 'Piper zh_CN-huayan-medium', 'modelSha256': model_hash,
            'source': source['source'], 'lines': {}, 'words': {}}
words = list({word['zh']: word for unit in source['units'] for word in unit['vocab']}.values()) + source['extraVocab']
items = [item for unit in source['units'] for item in unit['items']]
texts = [('words', word['zh']) for word in words]
for item in items:
    # Same sentence splitter used by answerChunks in jiayinPractice.ts.
    chunks = [part.strip() for part in re.findall(r'[^。！？]+[。！？]?', item['answerZh']) if part.strip()]
    texts.extend(('lines', chunk) for chunk in chunks)
    texts.append(('lines', item['answerZh']))
generated = {}
with tempfile.TemporaryDirectory(prefix='jiayin-wav-') as temporary:
    wav = Path(temporary) / 'utterance.wav'
    for kind, text in texts:
        key = re.sub(r'\s+', '', text)
        if key not in generated:
            file = 'h-' + hashlib.sha256((model_hash + key).encode()).hexdigest()[:20]
            mp3 = destination / (file + '.mp3')
            if not mp3.exists():
                with wave.open(str(wav), 'wb') as stream:
                    voice.synthesize_wav(text, stream)
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                                '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '48k', str(mp3)], check=True)
            duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                                     '-of', 'default=nw=1:nk=1', str(mp3)], text=True))
            if duration <= 0 or mp3.stat().st_size < 500:
                raise RuntimeError('Invalid audio for ' + text)
            generated[key] = {'f': file, 's': 0, 'e': duration, 'sha256': hashlib.sha256(mp3.read_bytes()).hexdigest()}
            if len(generated) % 25 == 0:
                print(f'{len(generated)} distinct clips generated', flush=True)
        manifest[kind][text] = generated[key]
(root / 'src/data/jiayin-audio.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Done: {len(generated)} clips, {sum(p.stat().st_size for p in destination.glob("*.mp3")) / 1e6:.1f} MB', flush=True)
