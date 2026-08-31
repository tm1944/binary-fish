"""Final mask cleanup shared by source preparation and packed-asset repair.

python cleanup_mask.py [site-directory] can repair a prepared asset without
the original upload. It re-encodes the same grayscale frames without retiming.
"""
import base64
import json
from pathlib import Path
import shutil
import subprocess
import sys
import cv2
import numpy as np


def cleanup(alpha, t):
    alpha = alpha.copy()
    # These reviewed shots include a surface reflection in source rows 0–8.
    # Where a fish meets that edge, reflection and fin cannot be separated.
    # Remove this narrow strip, preserving all recorded anatomy below it.
    if t < 47.22 or 188.32 <= t < 271.28:
        alpha[:9] = 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 5).astype(np.uint8), 8)
    major = np.zeros(count, np.uint8)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= 64:
            major[label] = 1
    if major.any():
        near = cv2.dilate(major[labels], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
        keep = major.copy()
        for label in range(1, count):
            if not major[label] and np.any(near[labels == label]):
                keep[label] = 1
        alpha *= keep[labels]
    return alpha


def repair(site):
    assets = site / 'assets'
    meta = json.loads((assets / 'source.json').read_text())
    if (meta['fps'], meta['frameCount'], meta['duration']) != (25, 7500, 300):
        raise ValueError('Cleanup expects the reviewed 300-second, 25fps asset')
    cap = cv2.VideoCapture(str(assets / 'fish-luma-mask.mp4'))
    width, height = meta['width'], meta['height']
    temporary = assets / 'fish-cleaning.mp4'
    encoder = subprocess.Popen([
        shutil.which('ffmpeg') or 'ffmpeg', '-y', '-v', 'error',
        '-f', 'rawvideo', '-pixel_format', 'gray', '-video_size', f'{width*2}x{height}',
        '-framerate', '25', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast',
        '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '50', '-movflags', '+faststart',
        str(temporary)], stdin=subprocess.PIPE)
    poster = None
    try:
        for i in range(7500):
            ok, frame = cap.read()
            if not ok: raise RuntimeError(f'Incomplete asset at frame {i}')
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray[:, width:] = cleanup(gray[:, width:], i / 25)
            encoder.stdin.write(gray.tobytes())
            if i == meta['posterFrame']: poster = gray.copy()
            if i % 1000 == 0: print(f'{i}/7500', flush=True)
    finally:
        cap.release()
        encoder.stdin.close()
        result = encoder.wait()
    if result: raise RuntimeError('Encoding failed')
    temporary.replace(assets / 'fish-luma-mask.mp4')
    cv2.imwrite(str(assets / 'fish-poster-packed.png'), poster)
    meta['cleanup'] = 'Remove reviewed surface-reflection strip in rows 0–8; reject small components farther than 12px from fish'
    (assets / 'source.json').write_text(json.dumps(meta, indent=2) + '\n')
    runtime = {**meta, 'poster': 'data:image/png;base64,' + base64.b64encode((assets / 'fish-poster-packed.png').read_bytes()).decode()}
    (assets / 'fish-data.js').write_text('window.BinaryFishData = ' + json.dumps(runtime) + ';\n')
    print('Cleaned all 7500 frames')


if __name__ == '__main__':
    repair(Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent.parent)
