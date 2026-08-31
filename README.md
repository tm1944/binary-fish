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
about 13.97 seconds. Swimming lasts about 12.15 seconds at 1.15× speed.
The two particle effects add about two seconds to each cycle. The runtime
asset has no audio.

After the final video frame, the fish's actual binary glyphs burst outward
for one second. Those particles stay visible, then travel along gentle curves
for one second to form the next fish at its original starting position.
There is no blank gap or separate incoming cloud. The first appearance still
uses the original scattered-digit assembly.

The opening pose is cached during initial loading. Playback seeks to that
frame during the burst and stays paused while particles gather. If decoding
is delayed, the cloud remains visible with gentle movement until it is ready.
Swimming begins when the particles have reached the opening silhouette.

The final pose has more glyphs than the opening pose. Surplus particles merge
into shared destinations with combined opacity, avoiding dark clumps. Their
values and shading settle into the opening frame before playback resumes.
The recorded path repeats without added swimming motion.

Stable bounds fit the fish's complete recorded path without following it.
The swimming area is capped at 1,280 pixels wide and fits within 90% of
viewport width and 80% of viewport height, preserving its aspect ratio.
`main.js` configures the area width, speed, violet `#554bc6`, and upright 6-pixel
characters. `transitionDuration` sets each particle effect's duration in
seconds, independently of `swimmingSpeed`; its default is `1`. Digits change
independently at the existing staggered 1.6–2 Hz.

The canvas remains fixed behind scrollable `main`, ignores pointer input, and
is hidden from assistive technologies. No foreground content is included.
`BinaryFish` retains `resize()`, `play()`, `pause()`, `showPoster()`, and
`dispose()`. Hidden tabs pause decoding, particles, and digit timing. Resizing
preserves particle positions, identities, and progress while remapping their
destinations. Any extra particles needed for a larger layout originate from
existing particles. Reduced motion,
direct-file previews, and playback failure use a centered clownfish still.

## Reproduce the clownfish assets

The original clownfish upload remains untouched at
`preparation/source-uploaded.mp4`. Preparation generates synchronized luminance,
soft silhouette, and anatomy progression planes in one local video. The
renderer now uses only luminance and silhouette. The third plane and its
portal metadata remain as preparation history and do not affect playback.
The explosion change requires no video reprocessing.

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
