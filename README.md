# One fish in binary

The original clownfish swims as violet binary characters on white. The entire
uploaded clip plays in order, preserving its turns, body shading, and fin motion.
There are no extra fish or added wandering.

## Preview

```sh
cd binary-fish
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [the website](http://127.0.0.1:4173/), or refresh the existing preview.
Opening `index.html` directly shows a binary still.

## Playback and size

The recording contains all 335 frames at 24000/1001 frames per second,
about 13.97 seconds. Each pass lasts about 12.15 seconds at 1.15× speed.
The runtime asset has no audio.

During the final 1.2 seconds, the fish disappears head first, then body and
trailing fins. Once it is invisible, playback restarts at the original starting
position. The opening frame must decode before the same head-first reveal
begins, lasting 1.2 seconds. A soft boundary spans 15% of the progression mask.
There is no visible portal ring, global crossfade, or offscreen translation.
The recorded path and poses repeat.

Stable bounds fit the fish's complete recorded path without following it.
The swimming area is capped at 1,280 pixels wide and fits within 90% of
viewport width and 80% of viewport height, preserving its aspect ratio.
`main.js` configures the area width, speed, violet `#554bc6`, and upright 6-pixel
characters. Digits change independently at the existing staggered 1.6–2 Hz.

The canvas remains fixed behind scrollable `main`, ignores pointer input, and
is hidden from assistive technologies. No foreground content is included.
`BinaryFish` retains `resize()`, `play()`, `pause()`, `showPoster()`, and
`dispose()`. Hidden tabs pause decoding and digit timing. Reduced motion,
direct-file previews, and playback failure use a centered clownfish still.

## Reproduce the clownfish assets

The original clownfish upload remains untouched at
`preparation/source-uploaded.mp4`. Preparation generates synchronized luminance,
soft silhouette, and anatomy progression planes in one local video. Keeping
them in the same decoded frame prevents a moving mask from drifting away
from the fish. The progression mask accounts for the camera-facing opening
pose so the side fins do not appear before the face.

With Python, numpy, opencv-python, ffmpeg, and ffprobe installed:

```sh
python3 preparation/prepare_clownfish.py
node tests/placement.cjs
```

The script regenerates the runtime video, metadata, and embedded poster.
The public renderer API and page layout remain unchanged.

The five-minute recording and metadata remain in `preparation/five-minute-master/`.
They are not loaded by the website. `prepare.py`, `cleanup_mask.py`, and
`select_single_fish.py` document that older footage workflow. Running the
selection script replaces the active clownfish with the old selected excerpt.

Some fin detail was already outside the source frame and cannot be recovered.
This remains a local preview. Confirm footage reuse permission before publishing.
