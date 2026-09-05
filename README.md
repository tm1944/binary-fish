# Tallal Mohar's portfolio

A static personal website in warm white and indigo. The background shows the
original recorded clownfish rendered as binary characters, swimming exactly
as recorded. The portfolio needs no framework, build step, or remote fonts.

## Preview

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:4173/). Opening `index.html` directly
shows the original binary still; video playback uses the local server.
The existing static hosting setup and `CNAME` remain unchanged.

## Editing the portfolio

`index.html` contains the biography, experience, projects, and contact links.
`style.css` defines the responsive editorial layout, colors, and typography,
with a `data-theme="dark"` palette alongside the default light one. The
header theme toggle persists to `localStorage` and otherwise follows the OS
color scheme; switching themes also recolors the fish (bright periwinkle on
dark so it stays readable) and the `theme-color` meta tag.
The fixed background canvas never intercepts pointer input or uses scrolling
to drive the fish.

The footer pause control freezes the recorded pose and its glide.
Reduced motion shows the original binary poster instead. Hidden pages pause
playback and character changes. The portfolio remains usable if JavaScript,
Canvas, or video decoding is unavailable.

## The original fish, swimming as recorded

`assets/fish-luma-mask.mp4` contains all 335 source frames at 24000/1001 fps.
`assets/fish-data.js` supplies the source metadata, frame bounds, and embedded
poster. The original video provides every silhouette, marking, body movement,
fin movement, and turn. No 3D model, invented pose, stretching, mirroring,
rotation, frame blending, or particle explosion is used. Only translation and
uniform scaling place the source fish.

`fish.js` preserves the original luminance/mask sampler, opacity formula,
6-pixel characters, violet color, and staggered digit clock. Cells brighter
than the `stripeLuma` threshold render as paper-colored (`stripeColor`)
marking glyphs, so the clownfish white stripes and pale belly knock out of
the violet body. Playback remains 1.15×, making each recorded pass about
12.15 seconds plus the swim-in/out glides.

Each pass plays the source motion 1:1 on a fixed center stage, then freezes
the end pose and explodes it into binary particles that scatter and fade.
While the debris clears, frame zero decodes underneath; the opening glyphs
then stream back in and reconstruct around the same center spot before
swimming resumes. The reset only happens through a fully exploded canvas,
so the loop never pops. Recorded fin cropping remains wherever it exists in
the source. Scaling is uniform and constant within a viewport, so recorded
changes in apparent size remain intact.

## Renderer interface

`main.js` owns the pause control, resize observer, reduced-motion preferences,
and page lifecycle. `BinaryFish` exposes:

- `resize(width, height, pixelRatio)` adjusts uniform scale and viewport
  placement without restarting the recorded pass. Pixel ratio is capped at 2.
- `play()` starts or resumes decoding and the swim/explode/reform loop.
  Returns a promise.
- `pause()` freezes the current pose and particle flight and cancels pending
  callbacks.
- `showPoster()` displays the original binary still at a visible location.
- `dispose()` cancels decoding and animation and releases canvas buffers.

Options are `color`, `stripeColor`, `stripeLuma`, `characterSize`, and
`swimmingSpeed`. Defaults are `#554bc6`, `#f7f7f2`, `155`, `6`, and `1.15`;
playback speed is clamped to 0.25–3 and the stripe threshold to 0–255.

The files under `preparation/` remain unchanged as source/preparation history.
The active packed video and its metadata are required deployment assets.

## Checks

The placement tests need only Node.js:

```sh
node tests/placement.cjs
node --check fish.js
node --check main.js
```

Optional browser checks require Playwright and its Chromium browser. Start
the local server, then run:

```sh
node tests/browser.cjs
```

`PREVIEW_URL` overrides the preview address. `CHECK_OUTPUT` changes the
screenshot/report directory, which defaults to `/tmp/original-fish-check`.
The browser suite compares source glyphs and canvas pixels against a frozen
copy of the original sampler/painter (updated once for the two-tone marking
render), observes three live explode/reconstruct loops, and checks responsive
layouts, pause/resume, and poster fallbacks.
See `VERIFICATION.md` for the latest results and their limits.
