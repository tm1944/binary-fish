# Connected particle reform verification

- SHA-256 checks confirm every runtime asset is unchanged. The full 335-frame
  video remains 13.972292 seconds at 24000/1001 fps, without audio. Its third
  anatomy plane is retained but no longer sampled by the renderer.
- Initial assembly and three subsequent cycles passed in Chromium at 1440
  by 900 and 390 by 844. Object identities and IDs remained unchanged from
  each explosion through reformation. Every sampled transition frame had
  visible digits within the viewport. No separate incoming cloud appeared.
- Media stayed paused during each one-second effect. The opening frame
  decoded during the burst, and changing video hashes confirmed that real
  swimming resumed afterward. Framing remained fixed throughout the clip.
- Screenshots at four points in each effect showed outward dispersion and
  convergence into the opening fish. Softened burst distances removed the
  line of particles that initially collected at the bottom viewport edge.
- Completion and the first swimming frame matched pixel-for-pixel at five
  viewport sizes. At 99.9% convergence, the alpha difference from the finished
  silhouette was below 0.4% of its total alpha. Merged opacity matched every
  target to floating-point precision.
- Resizing preserved transition progress and existing IDs. Enlarging a phone
  layout created descendants only at existing particle positions, with their
  root identities retained. All new destination glyphs were covered.
- Deliberately delayed opening-frame readiness left a visible, gently moving
  cloud. Hidden-tab pause froze particles and digit time; resuming continued
  with the same IDs. Pause/resume and resizing also passed during both effects.
- Other checks covered reduced motion, foreground scrolling and clicks,
  direct-file and playback-error posters, disposal during pending loading,
  and a complete cycle without requestVideoFrameCallback.
- At 1440 by 900, 7,228 particles took a median 5.5 ms to render in each
  effect. The 95th percentiles were 7.0 ms for explosion and 6.3 ms for reform,
  across 100 synchronous renders each. These measure renderer work, not
  total browser frame time or performance on physical phones.
- Repository checks passed for visible endpoints, continuous paths,
  identity retention, opacity merging, descendant origins, duration
  independent of playback speed, and six responsive layouts.
- Independent review found no actionable correctness issues. A separate
  2560 by 1440 cycle measured 7.1 ms median for explosion and 7.7 ms for
  reform. Initial capture and destination mapping took 31 ms for 8,348
  particles, so that larger layout may show a brief hitch at burst onset.

The original clips fin edges in frames 140 through 148. Those pixels cannot
be recovered; the selected poster at frame 60 is not clipped. Phone layouts
were emulated in desktop Chromium. Physical phones, Safari, and Firefox were
not tested.

The parent workspace holds browser reports and transition screenshots in
`work/reform-fish-qa/`. Browser scripts are `work/check-reform-fish.cjs` and
`work/check-reform-edges.cjs`. They use the local Range-capable preview on
port 4182. `node tests/placement.cjs` reruns the repository's selection,
particle continuity, merging, duration, and responsive framing checks.
