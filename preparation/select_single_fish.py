#!/usr/bin/env python3
"""Select frames 0–539 from the preserved five-minute packed master.

Requires numpy, opencv-python, ffmpeg, and ffprobe. No original upload needed.
Run from any directory: python preparation/select_single_fish.py
"""
import base64
import json
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np

SITE = Path(__file__).resolve().parent.parent
ASSETS = SITE / 'assets'
MASTER = SITE / 'preparation' / 'five-minute-master'
START, END, FPS = 0, 540, 25
COUNT = END - START
POSTER_FRAME = 275  # Original source 11.00 seconds.


def probe(path):
    result = subprocess.check_output([
        shutil.which('ffprobe') or 'ffprobe', '-v', 'error',
        '-show_entries', 'stream=codec_type,nb_frames,duration,r_frame_rate',
        '-of', 'json', str(path)])
    return json.loads(result)['streams']


if not MASTER.exists():
    current = json.loads((ASSETS / 'source.json').read_text())
    if current['frameCount'] != 7500 or current['duration'] != 300:
        raise RuntimeError('Expected the five-minute master before first selection')
    MASTER.mkdir()
    for name in ['fish-luma-mask.mp4', 'source.json', 'fish-poster-packed.png', 'fish-data.js']:
        shutil.copy2(ASSETS / name, MASTER / name)

master_meta = json.loads((MASTER / 'source.json').read_text())
master_path = MASTER / 'fish-luma-mask.mp4'
streams = probe(master_path)
if len(streams) != 1 or int(streams[0]['nb_frames']) != 7500:
    raise RuntimeError('The preserved master must contain 7500 video frames only')

temporary = ASSETS / 'fish-selection.mp4'
subprocess.run([
    shutil.which('ffmpeg') or 'ffmpeg', '-y', '-v', 'error', '-i', str(master_path),
    '-vf', f'trim=start_frame={START}:end_frame={END},setpts=PTS-STARTPTS',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-g', '25', '-movflags', '+faststart', str(temporary),
], check=True)
streams = probe(temporary)
if (len(streams) != 1 or streams[0]['codec_type'] != 'video'
        or int(streams[0]['nb_frames']) != COUNT
        or streams[0]['r_frame_rate'] != '25/1'
        or abs(float(streams[0]['duration']) - COUNT / FPS) > .001):
    raise RuntimeError('Excerpt validation failed; current runtime retained')

width, height = master_meta['width'], master_meta['height']
cap = cv2.VideoCapture(str(temporary))
bounds, poster = None, None
for i in range(COUNT):
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Cannot decode excerpt frame {i}')
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if i == POSTER_FRAME:
        poster = gray.copy()
    yy, xx = np.where(gray[:, width:] > 8)
    if len(xx):
        b = [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]
        bounds = b if bounds is None else [min(bounds[0], b[0]), min(bounds[1], b[1]),
                                          max(bounds[2], b[2]), max(bounds[3], b[3])]
cap.release()
if bounds is None or poster is None:
    raise RuntimeError('Excerpt has no usable fish or poster')
bounds = [max(0, bounds[0] - 8), max(0, bounds[1] - 8),
          min(width, bounds[2] + 8), min(height, bounds[3] + 8)]
duration = COUNT / FPS
metadata = {
    **master_meta,
    'sourceStart': START / FPS,
    'sourceEnd': END / FPS,
    'sourceFrameStart': START,
    'sourceFrameEndInclusive': END - 1,
    'preparedMaster': 'preparation/five-minute-master/fish-luma-mask.mp4',
    'selection': 'Opening single fish rising, traveling left to right, and turning downward',
    'frameCount': COUNT,
    'duration': duration,
    'posterFrame': POSTER_FRAME,
    'posterBounds': bounds,
    'scenes': [{'start': 0, 'end': duration, 'bounds': bounds}],
    'transitions': [],
    'emptyFrames': 0,
}
temporary.replace(ASSETS / 'fish-luma-mask.mp4')
cv2.imwrite(str(ASSETS / 'fish-poster-packed.png'), poster)
png = (ASSETS / 'fish-poster-packed.png').read_bytes()
(ASSETS / 'source.json').write_text(json.dumps(metadata, indent=2) + '\n')
runtime = {**metadata, 'poster': 'data:image/png;base64,' + base64.b64encode(png).decode()}
(ASSETS / 'fish-data.js').write_text('window.BinaryFishData = ' + json.dumps(runtime) + ';\n')
print(json.dumps({'frames': COUNT, 'seconds': duration, 'bounds': bounds,
                  'bytes': (ASSETS / 'fish-luma-mask.mp4').stat().st_size}))
