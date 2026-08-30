# Binary fish

A minimal white page with one violet fish made entirely of changing `0` and `1`
characters. Its movement, fins, turns, and shading are sampled from the
user-provided `download.mp4`, not generated geometry.

Run it through a local server:

```sh
cd /Users/tallalmohar/Documents/Codex/2026-08-30/p/outputs/fish-site
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4173>. Opening `index.html` directly deliberately
shows a binary still, because browsers do not permit video-frame canvas
sampling from a `file:` URL.

`fish.js` is the footage renderer. It samples a local H.264 file containing
luminance on the left half and a matching soft fish mask on the right. The
source brightness and local contrast control violet opacity, so body folds are
denser than highlights and thin fins fade toward the white page. `main.js`
owns initialization, resizing, motion preference, and tab visibility. Adjust
the color, character size, or 1.15× swimming speed there.

The `assets/` folder contains the browser asset, binary poster, and exact
selection metadata. `preparation/` retains the uploaded source and the script
used to produce the fixed-crop asset. The renderer uses a 7.76-second forward
segment whose endpoint fish masks overlap by 0.684 and share the same
rear-facing orientation; it loops without reverse
playback or a double-fish crossfade.
