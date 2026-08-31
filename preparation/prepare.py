#!/usr/bin/env python3
"""Prepare exactly source seconds 0–300. Requires opencv-python, numpy, ffmpeg.

Usage: python preparation/prepare.py /path/to/download1.mp4 [site-directory]
The source is read only. scenes.json contains visually reviewed dissolve ranges.
"""
import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from cleanup_mask import cleanup

HERE = Path(__file__).resolve().parent
SOURCE = Path(sys.argv[1]).expanduser().resolve()
SITE = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else HERE.parent
ASSETS = SITE / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
FPS, COUNT = 25, 7500
review = json.loads((HERE / 'scenes.json').read_text())
transitions = review['transitions']
edges = [0] + [(t['start'] + t['end']) / 2 for t in transitions] + [300]
scenes = [{'start': a, 'end': b, 'bounds': None} for a, b in zip(edges, edges[1:])]


def matte(frame, source_time):
    # Keep every component, including separate fish. Reject only tiny noise and
    # isolated, almost horizontal tank lines, never select the largest fish.
    value = frame.max(axis=2)
    alpha = np.clip((value.astype(np.float32) - 18) / 20, 0, 1)
    foreground = (alpha > .02).astype(np.uint8)
    # Remove thin water-surface streaks even when they touch a fish.
    horizontal = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, np.ones((1, 61), np.uint8))
    vertical = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, np.ones((5, 1), np.uint8))
    streak = horizontal & (1 - vertical)
    streak[24:] = 0
    alpha[streak > 0] = 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (alpha > .02).astype(np.uint8), 8)
    keep = np.ones(count, np.uint8)
    keep[0] = 0
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        if area < 12 or (w > 40 and h <= 3) or (y < 10 and y + h <= 10 and w > 25):
            keep[label] = 0
    alpha *= keep[labels]
    # Black eyes and body patches are opaque, not holes through the animal.
    # Fill only enclosed holes, leaving the outer silhouette and fin softness.
    binary = (alpha > .02).astype(np.uint8)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(binary)
    cv2.drawContours(filled, contours, -1, 1, cv2.FILLED)
    alpha[(filled > 0) & (binary == 0)] = 1
    if 137.8 <= source_time < 150.7:
        # This fish has source-black body patches connected to the background.
        # Bridge its narrow silhouette gaps before filling, only in this shot.
        support = (value > 8).astype(np.uint8)
        count, labels, stats, _ = cv2.connectedComponentsWithStats(support, 8)
        keep = np.zeros(count, np.uint8)
        for label in range(1, count):
            if stats[label, cv2.CC_STAT_AREA] >= 30:
                keep[label] = 1
        support = cv2.morphologyEx(keep[labels], cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)))
        contours, _ = cv2.findContours(support, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(support, contours, -1, 1, cv2.FILLED)
        alpha = np.maximum(alpha, support)
    return cleanup(cv2.GaussianBlur((alpha * 255).astype(np.uint8), (3, 3), .45), source_time)


cap = cv2.VideoCapture(str(SOURCE))
if not cap.isOpened():
    raise RuntimeError(f'Cannot read {SOURCE}')
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
if abs(cap.get(cv2.CAP_PROP_FPS) - FPS) > .001:
    raise RuntimeError('Expected 25 fps source. Re-review timing for another source.')
temporary = ASSETS / 'fish-luma-mask.preparing.mp4'
encoder = subprocess.Popen([
    shutil.which('ffmpeg') or 'ffmpeg', '-y', '-v', 'error',
    '-f', 'rawvideo', '-pixel_format', 'gray', '-video_size', f'{width * 2}x{height}',
    '-framerate', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast',
    '-crf', '20', '-pix_fmt', 'yuv420p', '-g', '50', '-movflags', '+faststart',
    str(temporary)], stdin=subprocess.PIPE)
poster_frame = 500
poster = None
scene_id = 0
empty = 0
try:
    for index in range(COUNT):
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError(f'Source ended at frame {index}, expected {COUNT}')
        t = index / FPS
        while scene_id + 1 < len(scenes) and t >= scenes[scene_id]['end']:
            scene_id += 1
        alpha = matte(frame, t)
        luma = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        luma[alpha < 5] = 255
        packed = np.hstack([luma, alpha])
        encoder.stdin.write(packed.tobytes())
        if index == poster_frame:
            poster = packed.copy()
        # Dissolves are hidden. Do not let the other shot inflate scene bounds.
        hidden = any(tr['start'] <= t <= tr['end'] for tr in transitions)
        yy, xx = np.where(alpha > 5)
        if len(xx) and not hidden:
            b = [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]
            old = scenes[scene_id]['bounds']
            scenes[scene_id]['bounds'] = b if old is None else [
                min(old[0], b[0]), min(old[1], b[1]), max(old[2], b[2]), max(old[3], b[3])]
        if not len(xx):
            empty += 1
        if index % 500 == 0:
            print(f'{index}/{COUNT} frames', flush=True)
finally:
    cap.release()
    encoder.stdin.close()
    result = encoder.wait()
if result or index + 1 != COUNT:
    raise RuntimeError('Incomplete encoding; previous runtime asset retained')
for scene in scenes:
    if scene['bounds'] is None:
        raise RuntimeError('Scene has no visible fish')
    x0, y0, x1, y1 = scene['bounds']
    scene['bounds'] = [max(0, x0 - 8), max(0, y0 - 8),
                       min(width, x1 + 8), min(height, y1 + 8)]
temporary.replace(ASSETS / 'fish-luma-mask.mp4')
cv2.imwrite(str(ASSETS / 'fish-poster-packed.png'), poster)
png = (ASSETS / 'fish-poster-packed.png').read_bytes()
metadata = {
    'source': str(SOURCE), 'sourceStart': 0, 'sourceEnd': 300,
    'width': width, 'height': height, 'packedWidth': width * 2,
    'fps': FPS, 'frameCount': COUNT, 'duration': 300,
    'posterFrame': poster_frame, 'posterBounds': scenes[0]['bounds'],
    'scenes': scenes, 'transitions': transitions,
    'fadeSeconds': .6, 'playbackRate': 1.15, 'loop': 'fade-through-white',
    'mask': 'All components, soft value threshold 18–38, 0.45px smoothing; enclosed dark areas opaque; remove tiny noise and separable waterline streaks; black-fish scene uses threshold 8 and 27px elliptical closing to connect silhouette gaps',
    'emptyFrames': empty,
    'sourceLimitations': 'Some fish reach the recording edge. Pixels absent from the original cannot be recovered.',
    'cleanup': 'Remove reviewed surface-reflection strip in rows 0–8; reject small components farther than 12px from fish',
}
(ASSETS / 'source.json').write_text(json.dumps(metadata, indent=2) + '\n')
runtime = {**metadata, 'poster': 'data:image/png;base64,' + base64.b64encode(png).decode()}
(ASSETS / 'fish-data.js').write_text('window.BinaryFishData = ' + json.dumps(runtime) + ';\n')
print(f'Prepared {COUNT} frames, 300 seconds, {len(scenes)} scenes.')
