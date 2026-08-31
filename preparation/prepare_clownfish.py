#!/usr/bin/env python3
"""Prepare the complete original clownfish, with an authored anatomy channel.

Run with a Python containing cv2/numpy. The original upload and archived
five-minute assets are read-only references; only assets/ is replaced.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import os

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
FPS = 24000 / 1001


def annotation(keys, frame):
    before = max((k for k in keys if k['frame'] <= frame), key=lambda k: k['frame'], default=keys[0])
    after = min((k for k in keys if k['frame'] >= frame), key=lambda k: k['frame'], default=keys[-1])
    t = (frame - before['frame']) / max(1, after['frame'] - before['frame'])
    t = np.clip(t, 0, 1)
    return tuple(np.array(before[name]) * (1-t) + np.array(after[name]) * t for name in ('nose', 'tail'))


def progression(frame, xx, yy, annotations):
    opening = frame < 167
    nose, tail = annotation(annotations['opening' if opening else 'closing'], frame)
    axis = tail - nose
    length = np.linalg.norm(axis)
    along = ((xx-nose[0])*axis[0] + (yy-nose[1])*axis[1]) / (length*length)
    lateral = np.abs((xx-nose[0])*axis[1] - (yy-nose[1])*axis[0]) / length
    if opening or frame < 298:
        # A frontal snout has no useful left-right ordering. Its head emerges
        # from the center; broad pectoral fins beside it belong later in order.
        head = np.sqrt(((xx-nose[0])/24)**2 + ((yy-nose[1])/28)**2)
        body = np.clip(.22 + along*.58, .20, .90)
        p = np.where(head <= 1, .025 + .18*head, body)
        side = (head > 1) & (lateral > 21) & (along < .60)
        p = np.where(side, np.clip(.68 + (lateral-21)/130, .68, .94), p)
        pelvic = yy > nose[1] + 23
        p = np.where(pelvic, np.clip(.90 + (yy-nose[1]-23)/160, .90, .98), p)
        p = np.where(along > .72, np.maximum(p, .82 + (along-.72)*.20), p)
    # Broadside projection follows the tilted body. Attached fins leave with
    # the adjacent body instead of lingering as disconnected fin islands.
    broad = np.clip(.04 + along*.86, .025, .97)
    if not opening:
        p = broad
    elif frame > 36:
        frontal_weight = np.clip((140-length)/60, 0, 1)
        p = p*frontal_weight + broad*(1-frontal_weight)
    return np.rint(np.clip(p, 0, 1)*255).astype(np.uint8)


def matte_for(frame):
    value = frame.max(axis=2)
    core = (value >= 12).astype(np.uint8)*255
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(core, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    silhouette = np.zeros_like(core)
    # Fill enclosed black stripes, but do not admit disconnected compression
    # speckles on the black source background.
    for contour in contours:
        if cv2.contourArea(contour) >= 12:
            cv2.drawContours(silhouette, [contour], -1, 255, cv2.FILLED)
    return cv2.GaussianBlur(silhouette, (3, 3), .55)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=HERE/'source-uploaded.mp4')
    parser.add_argument('--out', type=Path, default=HERE.parent/'assets')
    args = parser.parse_args()
    probe = json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe', '-v', 'error',
        '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate',
        '-of', 'json', str(args.source)]))['streams'][0]
    assert probe['r_frame_rate'] == '24000/1001' and int(probe['nb_frames']) == 335, probe
    annotations = json.loads((HERE/'clownfish-anatomy.json').read_text())
    source_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
    cap = cv2.VideoCapture(str(args.source))
    width, height = int(cap.get(3)), int(cap.get(4))
    assert (width, height) == (480, 360)
    args.out.mkdir(parents=True, exist_ok=True)
    output = args.out/'.clownfish-preparing.mp4'
    ffmpeg = subprocess.Popen(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo',
        '-pix_fmt', 'gray', '-s', f'{width*3}x{height}', '-r', '24000/1001', '-i', 'pipe:0',
        '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(output)], stdin=subprocess.PIPE)
    yy, xx = np.mgrid[:height, :width]
    union = [width, height, 0, 0]
    count = 0
    poster_frame = 60
    frame_bounds = []
    while True:
        ok, frame = cap.read()
        if not ok: break
        matte = matte_for(frame)
        luma = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        luma[matte == 0] = 255
        packed = np.hstack([luma, matte, progression(count, xx, yy, annotations)])
        ys, xs = np.where(matte > 4)
        box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
        frame_bounds.append(box)
        union = [min(union[0], box[0]), min(union[1], box[1]), max(union[2], box[2]), max(union[3], box[3])]
        if count == poster_frame:
            cv2.imwrite(str(args.out/'fish-poster-packed.png'), packed)
        ffmpeg.stdin.write(packed.tobytes())
        count += 1
    cap.release(); ffmpeg.stdin.close()
    assert ffmpeg.wait() == 0
    assert count == 335, f'Expected entire335frames; decoded{count}'
    prepared_probe = json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe', '-v', 'error',
        '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,r_frame_rate', '-of', 'json', str(output)]))['streams'][0]
    assert int(prepared_probe['nb_frames']) == count and prepared_probe['r_frame_rate'] == '24000/1001'
    os.replace(output, args.out/'fish-luma-mask.mp4')
    output = args.out/'fish-luma-mask.mp4'
    metadata = {
        'source': 'preparation/source-uploaded.mp4', 'sourceSHA256': source_hash,
        'sourceStart': 0, 'sourceEnd': count/FPS, 'width': width, 'height': height,
        'sourceFrameStart': 0, 'sourceFrameEndInclusive': count-1,
        'packedWidth': width*3, 'packedChannels': 3, 'channelOrder': ['luma', 'matte', 'anatomyProgression'],
        'fps': FPS, 'frameRate': '24000/1001', 'frameCount': count, 'duration': count/FPS,
        'posterFrame': poster_frame, 'posterBounds': union, 'posterFishBounds': frame_bounds[poster_frame],
        'scenes': [{'start': 0, 'end': count/FPS, 'bounds': union}], 'transitions': [],
        'portalSeconds': 1.2, 'portalFeather': .15, 'playbackRate': 1.15,
        'loop': 'anatomy-portal', 'mask': 'Threshold12,3pxclosing,filledexternalcontours,sigma.55softedges; dark interior stripes remain opaque.',
        'progression': annotations['method'], 'annotations': 'preparation/clownfish-anatomy.json',
        'frameBounds': frame_bounds,
    }
    (args.out/'source.json').write_text(json.dumps(metadata, indent=2)+'\n')
    poster = base64.b64encode((args.out/'fish-poster-packed.png').read_bytes()).decode()
    metadata['poster'] = 'data:image/png;base64,' + poster
    (args.out/'fish-data.js').write_text('window.BinaryFishData = '+json.dumps(metadata, separators=(',', ':'))+';\n')
    print(json.dumps({'frames': count, 'duration': count/FPS, 'bounds': union, 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
