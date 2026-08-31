# A personal page in blue ink

A centered personal page with a fixed binary clownfish behind it. Original
footage supplies every pose, turn, body shadow, and fin movement. The content
panels use an 88% white veil, so violet digits show through softly.

## Preview

```sh
cd /Users/tallalmohar/Documents/Codex/2026-08-30/p/outputs/fish-site
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [the website](http://127.0.0.1:4173/). Opening `index.html` directly shows
a binary still; animated video needs a local server.

## Make it yours

Edit `index.html` to update the introduction, projects, and contact details as
your work changes. The page title and meta description are near the top. The
About, Work, Contact, and Back to top links navigate within the page.

The 560-pixel column stays centered with at least 24 pixels on either side on
phones. The canvas is a pointer-free, fixed background so content can scroll
and remain accessible above it.

## Playback and size

The recording contains all 335 frames at 24000/1001 frames per second, about
13.97 seconds. It plays at 1.15× speed, so the video portion lasts about 12.15
seconds. The complete first-frame fish starts 24 pixels beyond the right edge.
It enters only through the movement recorded in the footage: the renderer never
slides, recenters, chases, or holds it in place.

At the final video frame, its visible binary digits burst outward for one
second. Each particle fades fully to transparent during the burst. Only after
the canvas is blank does the renderer seek and decode frame zero, then start
the next pass naturally offscreen. The short blank decode interval is
intentional. There is no incoming particle cloud or added entrance motion.

Stable bounds fit the recorded path without following the fish. The swimming
area is capped at 1,280 pixels wide and fits within 90% of viewport width and
80% of viewport height. `main.js` configures violet `#554bc6`, upright 6-pixel
characters, fish size, playback speed, and `transitionDuration`. Digit changes
use a separate staggered clock from movement.

`BinaryFish` retains `resize()`, `play()`, `pause()`, `showPoster()`, and
`dispose()`. Hidden tabs pause decoding, particles, and digit timing. Reduced
motion, direct-file previews, and playback failures show a right-positioned
clownfish still.

## Reproduce the clownfish assets

The original clownfish upload remains untouched at
`preparation/source-uploaded.mp4`. Preparation generates synchronized
luminance, soft silhouette, and anatomy-progression planes in one local video.
The renderer uses luminance and silhouette; the third plane remains preparation
history and does not affect playback. This update requires no asset reprocessing.

With Python, numpy, opencv-python, ffmpeg, and ffprobe installed:

```sh
python3 preparation/prepare_clownfish.py
node tests/placement.cjs
```

The five-minute recording and its metadata remain in
`preparation/five-minute-master/` as reference material and are not loaded by
the website. Some fin detail was already outside the source frame and cannot be
recovered. This remains a local preview; confirm footage reuse permission before
publishing.
