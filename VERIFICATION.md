# Original fish restoration verification

Verified locally on September 4, 2026. Swim-as-recorded simplification and
explode/reconstruct loop verified with Node placement checks on September 5,
2026 (browser suite not re-run; no Playwright in this environment).

## Original appearance

The active packed video, metadata, source recording, and preparation files are
unchanged. The generated 3D mesh and synthetic fin animation have been removed.

The browser parity test decodes source frames 0, 60, 140, 210, 298, and 334.
For each, it compares every sampled glyph with the frozen original sampler,
then compares the rendered canvas with the original painter at the same
translation, scale, character-clock time, and inherited text styling, with
the particle effect null.
All six comparisons have identical glyph data and zero differing pixel bytes.
The reference code is retained in `tests/fixtures/original-glyph-reference.js`
from the original renderer at commit `6718f96`, updated once for the two-tone
marking render (cells brighter than `stripeLuma` sample as stripe glyphs and
paint in `stripeColor`).

An initial parity-test mismatch came from comparing a detached reference
canvas with the page canvas. Giving both the same inherited font-synthesis
and smoothing styles resolved the mismatch without changing the renderer.

## Swim loop and lifecycle

`node tests/placement.cjs` checks recorded-pose placements across six
viewport sizes. It verifies:

- Uniform scaling and translation preserve source displacements, and each
  recorded center maps exactly onto the fixed stage.
- Burst/form endpoints are exact: the explosion starts on the pose and
  clears it fully; the formation starts invisible and lands exactly on the
  staged pose, deterministically per glyph seed.
- Explosion only fires while swimming; formation requires staged opening
  glyphs and counts the fresh loop.
- The effect never affects the poster still.
- Stripe options honor defaults (155), custom values, and clamping.
- The original poster stays visible and disposal is safe to repeat.

The browser suite observes three complete explode/reconstruct loops at the
original 1.15× speed. Each reformation is checked while the exploded canvas
holds zero visible glyphs. The renderer stages the opening frame underneath
the visible debris, so seeking never shows.

The suite covers pause/resume without a changed pose or position, reduced
motion, simulated visibility and BFCache events, disposal, direct-file poster
preview, blocked-video poster fallback, JavaScript-disabled content, and
Canvas failure. It also checks playback without requestVideoFrameCallback.
That fallback test exposed duplicate seek-completion callbacks pausing an
already-started video. Completion now ignores stale callbacks and queues
only one fallback paint at a time.

## Website preservation

Compared with the accepted redesign at the start of this correction:

- Portfolio copy, layout, project illustrations, links, and navigation remain.
- The hero backing fade is removed and the hero is ~20% more compact.
- Six browser viewport sizes have no horizontal overflow; skip navigation and
  section anchors work, and scrolling does not drive fish travel.

JavaScript syntax checks and `git diff --check` passed. Screenshots and the
machine-readable report are written to `/tmp/original-fish-check` by
`tests/browser.cjs`.

## Local performance

100 animation-frame intervals per viewport at device pixel ratio 2.
Rendering time is the moving average of the JavaScript drawing work, excluding
video decoding and browser compositing. The browser reported zero page errors.

| Viewport | Average fps | Rendering time |
| --- | ---: | ---: |
| 1440 × 900 | 60 | 2.23 ms |
| 2560 × 1440 | 60 | 1.47 ms |
| 768 × 1024 | 60 | 0.42 ms |
| 390 × 844 | 60 | 0.52 ms |
| 320 × 568 | 60 | 0.85 ms |
| 844 × 390 | 60 | 0.63 ms |

## Limits

These are local headless Chromium checks on this Mac, including phone-sized
viewports at device pixel ratio 2. Physical phones, Safari, and Firefox have
not been tested. Visibility and BFCache events are simulated rather than
actual OS backgrounding and browser history restoration. Source-edge fin
cropping remains exactly as recorded. No deployment or domain changes were
made. The September 5 updates (direct recorded mapping, explode/reconstruct
reset loop, two-tone stripe markings, hero without backing fade, dark theme
with fish recolor) passed the Node placement suite, a headless theme-wiring
suite (OS init, toggle, persistence, OS follow, fish-failure and
storage-denied paths), and syntax/`git diff --check` gates here; the
Playwright browser suite, including the two-tone parity comparison and the
three-loop observation, still needs a re-run where Playwright is installed.
