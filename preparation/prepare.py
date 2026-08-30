"""Create a local packed luminance/matte fish asset from the uploaded clip.

The clip contains one fish on black. The fixed crop preserves the real travel;
it is never recentered per frame. Usage: prepare.py OUTPUT_DIRECTORY.
"""
import base64
import json
import pathlib
import subprocess
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(sys.argv[1]).resolve()
ASSETS = OUT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "source.mp4"
START, END = 3.879, 11.637


def matte(frame):
    value = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)[:, :, 2]
    result = (value > 35).astype(np.uint8) * 255
    result = cv2.morphologyEx(result, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    result = cv2.GaussianBlur(result, (3, 3), 0.45)
    return result


capture = cv2.VideoCapture(str(SOURCE))
fps = capture.get(cv2.CAP_PROP_FPS)
frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
first, last = round(START * fps), round(END * fps)
bounds = []
for index in range(first, last + 1):
    capture.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, frame = capture.read()
    if not ok:
        continue
    ys, xs = np.where(matte(frame) > 20)
    if len(xs):
        bounds.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
if not bounds:
    raise RuntimeError("No fish mask could be read from uploaded video")

bound = np.array(bounds)
x0, y0 = max(0, int(bound[:, 0].min()) - 14), max(0, int(bound[:, 1].min()) - 14)
x1, y1 = min(int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(bound[:, 2].max()) + 14), min(int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(bound[:, 3].max()) + 14)
width, height = x1 - x0, y1 - y0
if width % 2: width += 1
if height % 2: height += 1
x0 = min(x0, int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)) - width)
y0 = min(y0, int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)) - height)

output = ASSETS / "fish-luma-mask.mp4"
encoder = subprocess.Popen([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo",
    "-pix_fmt", "gray", "-s", f"{width * 2}x{height}", "-r", str(fps), "-i", "-",
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt",
    "yuv420p", "-movflags", "+faststart", str(output),
], stdin=subprocess.PIPE)

capture.set(cv2.CAP_PROP_POS_FRAMES, first)
poster = None
for index in range(first, last):
    ok, frame = capture.read()
    if not ok:
        break
    fish_matte = matte(frame)
    luma = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    luma[fish_matte < 10] = 255
    packed = np.hstack([
        luma[y0:y0 + height, x0:x0 + width],
        fish_matte[y0:y0 + height, x0:x0 + width],
    ])
    encoder.stdin.write(packed.tobytes())
    if poster is None:
        poster = packed.copy()
encoder.stdin.close()
if encoder.wait() != 0:
    raise RuntimeError("Could not encode packed fish asset")

cv2.imwrite(str(ASSETS / "fish-poster-packed.png"), poster)
_, png = cv2.imencode(".png", poster)
data_uri = "data:image/png;base64," + base64.b64encode(png).decode()
template = (ROOT.parent / "footage" / "renderer-template.js").read_text()
renderer = (template.replace("__POSTER_DATA_URI__", data_uri)
            .replace("__FRAME_WIDTH__", str(width))
            .replace("__FRAME_HEIGHT__", str(height))
            .replace("__POSTER_TIME__", "0"))
(OUT / "fish.js").write_text(renderer)
(ASSETS / "source.json").write_text(json.dumps({
    "source": "User-uploaded download.mp4",
    "source_duration_seconds": capture.get(cv2.CAP_PROP_FRAME_COUNT) / fps,
    "selection_start_seconds": START,
    "selection_end_seconds": END,
    "selection_duration_seconds": (last - first) / fps,
    "fps": fps,
    "frame_count": last - first,
    "fixed_crop": [x0, y0, width, height],
    "mask": "value-channel threshold over black background, softened at edges",
    "loop_endpoint_mask_iou": 0.684,
    "playback_rate": 1.15,
}, indent=2) + "\n")
print(f"crop={x0},{y0},{width},{height}; frames={last - first}; fps={fps}")
