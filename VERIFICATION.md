# Clownfish portal verification

- The runtime contains all 335 original video frames at 24000/1001 fps,
  lasting 13.972292 seconds, without audio. Luminance, silhouette, and anatomy
  progression are synchronized in three horizontal video planes.
- All source frames were compared with their runtime counterparts. The mask
  retained at least 99.98% of source pixels above the foreground threshold.
  All masks fit within the fixed scene bounds; no empty source frame was found.
- SHA-256 checks confirm the original clownfish upload and the five-minute
  reference master were unchanged.
- Seventy transition frames were individually rendered and visually inspected.
  The face emerges before the body and fins. The exit removes the head and
  adjacent body before the trailing tail, without detached fin patches.
- Three consecutive loops passed in Chromium at 1440 by 900 and 390 by 844.
  Each preceding final frame already had zero visible glyphs before seeking.
  After every restart, the first rendered frame was at source time zero or
  the immediately following frame, still fully invisible. No ending pose
  leaked into the next entrance.
- Decoded image hashes changed throughout playback. The crop stayed fixed,
  and neither original footage nor the five-minute master was requested.
- Portal ordering and the soft boundary passed checks at three playback rates.
  Responsive bounds passed at six viewport sizes. Browser checks covered
  resizing, hidden-tab pause/resume during both transitions, reduced motion,
  a centered poster, foreground scrolling and clicks, disposal, direct-file
  preview, media failure, and browser errors.
- An independent reviewer checked packed channels, source-frame alignment,
  portal math, and lifecycle behavior. A misleading restart diagnostic was
  corrected, and checks now inspect the preceding frame and opening timestamp.

The original clips fin edges in frames 140 through 148. Those pixels cannot
be recovered; the selected poster at frame 60 is not clipped. Phone layouts
were emulated in desktop Chromium. Physical phones, Safari, and Firefox were
not tested.

The parent workspace holds browser reports and all transition contact sheets
in `work/portal-fish-qa/`. `node tests/placement.cjs` reruns the repository's
selection, portal ordering, and responsive framing checks.
