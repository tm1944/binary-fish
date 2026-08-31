# Clownfish explosion verification

- SHA-256 checks confirm every runtime asset is unchanged. The full 335-frame
  video remains 13.972292 seconds at 24000/1001 fps, without audio. Its third
  anatomy plane is retained but no longer sampled by the renderer.
- Three consecutive cycles passed in Chromium at 1440 by 900 and 390 by 844.
  Each cycle includes recorded swimming, explosion, an invisible restart,
  and reassembly. Decoded video hashes changed during swimming and the crop
  remained fixed. No source or archived master video was loaded at runtime.
- Media remained paused throughout each one-second particle effect. Explosion
  used the final source frame; reassembly held source frame zero. Outgoing
  particles were fully invisible before the next pose was loaded.
- Screenshots at several points in each effect showed individual glyphs
  moving outward and converging, rather than a stationary fish fading.
- Reassembly completion and the first swimming frame matched pixel-for-pixel
  at five viewport sizes, including after resizing during reassembly. Particle
  counts matched the new character grid and transition progress was preserved.
- Pause/resume and resizing passed during both effects. Other browser checks
  covered reduced motion, foreground scrolling and clicks, direct-file and
  playback-error posters, disposal, and disposal during a pending media load.
- The fallback without requestVideoFrameCallback completed a full cycle.
  An independent reviewer also ran two fallback cycles and cancelled/resumed
  pending opening-frame seeks. Opening and final-frame pixel hashes matched
  across loops, with no actionable review findings.
- Rendering at 1440 by 900 took a median 1.1 ms for 3,000 assembly particles
  and 2.7 ms for 7,228 explosion particles. The respective 95th percentiles
  were 1.3 ms and 3.0 ms across 150 synchronous renders per effect. These are
  renderer costs, not total browser frame times.
- Repository checks passed for particle endpoints, deceleration, late opacity
  changes, duration independent of swimming speed, and six responsive layouts.

The original clips fin edges in frames 140 through 148. Those pixels cannot
be recovered; the selected poster at frame 60 is not clipped. Phone layouts
were emulated in desktop Chromium. Physical phones, Safari, and Firefox were
not tested.

The parent workspace holds browser reports and transition screenshots in
`work/explosion-fish-qa/`. `node tests/placement.cjs` reruns the repository's
selection, particle motion, duration, and responsive framing checks.
