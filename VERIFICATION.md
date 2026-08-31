# Natural fish loop verification

- Runtime assets were left unchanged. The active video remains the original
  335-frame clownfish recording at 24000/1001 fps, with no audio.
- `node tests/placement.cjs` passed. It verifies source selection, independent
  transition timing, burst opacity reaching zero, responsive limits, and the
  fixed anchor that places the whole first-frame fish 24 pixels beyond the
  right edge at six viewport sizes.
- Chromium playback passed at 1440 by 900, 768 by 1024, 390 by 844, and 844 by
  390. The first visible pass began offscreen, decoded source frames changed
  during swimming, the clip reached an explosion, and the next pass restarted
  from frame zero without a reformation phase or artificial entrance shift.
- Across each live run, the source-space anchor remained constant during
  swimming and explosion. The recorded video alone controls where the fish
  travels on screen.
- The canvas stayed fixed and pointer-free. The 560-pixel content column had
  no horizontal overflow, and `.paper` resolved to `rgba(255, 255, 255, 0.88)`
  at every tested size. The page screenshot shows the fish passing behind the
  translucent panels.
- Browser console and page-error hooks reported no errors. `git diff --check`
  and JavaScript syntax checks passed.

The fish footage has source-edge fin cropping in some frames; that limitation
is inherent to the recording. Physical phones, Safari, and Firefox have not
been tested.
