/* The original recorded clownfish, swimming exactly as recorded.
   Each pass plays the source motion 1:1 on a fixed stage, then explodes
   into binary particles and reconstructs in the same spot before swimming
   again. Light markings (the clownfish white stripes and pale belly) render
   as paper-colored glyphs knocked out of the violet body. Only translation
   and uniform scaling affect the source fish. */
(() => {
  'use strict';
  const data = window.BinaryFishData;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const scriptURL = document.currentScript ? document.currentScript.src : location.href;
  const videoURL = new URL('assets/fish-luma-mask.mp4', scriptURL).href;
  const EXPLODE_DUR = 0.9, FORM_DUR = 1.1;

  class BinaryFish {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      if (!this.context) throw new Error('Canvas 2D is unavailable');
      this.options = { color: '#554bc6', stripeColor: '#f7f7f2', stripeLuma: 155,
        characterSize: 6, swimmingSpeed: 1.15, ...options };
      this.fineCanvas = document.createElement('canvas');
      this.fineContext = this.fineCanvas.getContext('2d', { willReadFrequently: true });
      this.decodedCanvas = document.createElement('canvas');
      this.decodedContext = this.decodedCanvas.getContext('2d');
      this.mode = this.state = this.phase = 'poster';
      this.disposed = this.wantsPlayback = this.hasDecodedFrame = false;
      this.generation = this.passCount = this.bitTime = this.mediaTime = this.poseRevision = 0;
      this.decodedTime = null;
      this.video = this.callback = this.lastClock = this.videoFrame = this.cancelSeek = null;
      this.effect = null;
      this.fxClock = 0;
      this.burstGlyphs = this.openGlyphs = null;
      this.frameCost = 0;
      this.poster = new Image();
      this.poster.onload = () => { if (!this.disposed && this.mode === 'poster') this.renderCurrent(); };
      this.poster.src = data.poster;
      this.resize(canvas.clientWidth || 1200, canvas.clientHeight || 800, window.devicePixelRatio || 1);
    }

    swimRate() { return clamp(Number(this.options.swimmingSpeed) || 1.15, .25, 3); }
    frameAt(t) { return clamp(Math.floor(t * data.fps + 1e-5), 0, data.frameCount - 1); }

    resize(width, height, pixelRatio = 1) {
      if (this.disposed) return;
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.pixelRatio = clamp(pixelRatio, 1, 2);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.fontSize = this.options.characterSize;
      this.cellWidth = this.fontSize * .62; this.cellHeight = this.fontSize * 1.02;
      this.scale = Math.min(this.width * (this.width < 640 ? .76 : .48) / 270, this.height * .62 / 215, 760 / 270);
      this.layoutRevision = (this.layoutRevision || 0) + 1;
      this.renderCurrent();
    }

    clear() {
      this.context.globalAlpha = 1;
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawnGlyphs = 0;
      this.visibleGlyphs = 0;
      this.bounds = { left: this.width / 2, top: this.height / 2,
        right: this.width / 2, bottom: this.height / 2 };
    }

    // Luma above this renders as a paper-colored marking glyph instead of a
    // body glyph. ~155 keeps every true white stripe cell while also catching
    // the pale belly; measured against the color source it holds ~70%+ precision.
    stripeThreshold() {
      const v = Number(this.options.stripeLuma);
      return Number.isFinite(v) ? clamp(v, 0, 255) : 155;
    }

    // The recorded silhouette center, exactly as recorded: no smoothing, no
    // authored travel. This is what makes the fish swim like in the video.
    recordedCenter(mediaTime) {
      const frame = clamp(mediaTime * data.fps, 0, data.frameCount - 1);
      const i = Math.floor(frame), j = Math.min(i + 1, data.frameCount - 1), t = frame - i;
      const a = data.frameBounds[i], b = data.frameBounds[j];
      return { x: ((a[0]+a[2])/2) * (1-t) + ((b[0]+b[2])/2) * t,
        y: ((a[1]+a[3])/2) * (1-t) + ((b[1]+b[3])/2) * t };
    }

    // Fixed stage the recorded center maps to. The weave around this point
    // is the source footage itself, not page travel.
    stagePoint() { return { x: this.width * .5, y: this.height * .46 }; }

    layout(poster = false) {
      const box = (poster && data.posterBounds) || data.scenes[0].bounds;
      const pad = Math.max(4, Math.max(box[2]-box[0], box[3]-box[1])*.04);
      const x0 = clamp(box[0]-pad, 0, data.width-1), y0 = clamp(box[1]-pad, 0, data.height-1);
      const x1 = clamp(box[2]+pad, x0+1, data.width), y1 = clamp(box[3]+pad, y0+1, data.height);
      const srcW = x1-x0, srcH = y1-y0, scale = this.scale;
      const anchor = poster ? { x: (data.posterFishBounds[0]+data.posterFishBounds[2])/2,
        y: (data.posterFishBounds[1]+data.posterFishBounds[3])/2 }
        : this.recordedCenter(this.decodedTime ?? 0);
      const stage = this.stagePoint();
      const position = poster ? { x: this.width * (this.width < 640 ? .58 : .76),
        y: this.height * (this.width < 640 ? .74 : .43) }
        : { x: stage.x, y: stage.y };
      this.position = position;
      return { x0, y0, srcW, srcH, scale,
        originX: position.x - (anchor.x-x0)*scale,
        originY: position.y - (anchor.y-y0)*scale };
    }

    sampleGlyphs(source, poster = false) {
      const l = this.layout(poster);
      const width = source.naturalWidth || source.width;
      const height = source.naturalHeight || source.height;
      if (!width || !height) return [];
      const cols = this.columns = Math.max(1, Math.round(l.srcW*l.scale/this.cellWidth));
      const rows = this.rows = Math.max(1, Math.round(l.srcH*l.scale/this.cellHeight));
      if (this.fineCanvas.width !== cols*2 || this.fineCanvas.height !== rows) {
        this.fineCanvas.width = cols*2; this.fineCanvas.height = rows;
      }
      const plane = width/(data.packedChannels || 3), sx = plane/data.width, sy = height/data.height;
      for (let c = 0; c < 2; c++) this.fineContext.drawImage(source,
        c*plane+l.x0*sx, l.y0*sy, l.srcW*sx, l.srcH*sy, c*cols, 0, cols, rows);
      const pixels = this.fineContext.getImageData(0,0,cols*2,rows).data;
      const glyphs = [];
      const stripeAt = this.stripeThreshold();
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const i = (row*cols*2+col)*4;
        const matte = pixels[i+cols*4]/255;
        if (matte < .018) continue;
        const luma = pixels[i];
        const opacity = Math.pow(matte,.42)*(.40+.60*(1-luma/255*.50));
        if (opacity < .04) continue;
        const seed = (Math.imul(col+17,374761393)^Math.imul(row+31,668265263))>>>0;
        glyphs.push({ targetX: l.x0+(col+.5)*l.srcW/cols,
          targetY: l.y0+(row+.5)*l.srcH/rows, opacity, seed, stripe: luma > stripeAt });
      }
      return glyphs;
    }

    paintGlyphs(glyphs, poster = false) {
      this.clear();
      const l = this.layout(poster), ctx = this.context;
      ctx.font = `500 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Burst/form particle transform, in source units so it scales with the
      // fish. Each glyph flies radially around the captured burst center on
      // a deterministic per-seed ray: out and fading for the explosion, back
      // in along the same ray while fading up for the reconstruction. Poster
      // and the parity harness (effect null) paint untouched.
      const fx = !poster && this.effect;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const p of glyphs) {
        let gx = p.targetX, gy = p.targetY, ga = p.opacity;
        if (fx) {
          const u = Math.imul(p.seed ^ 0x9E3779B9, 2654435761) >>> 0;
          let ux = gx - fx.cx, uy = gy - fx.cy;
          const vl = Math.hypot(ux, uy);
          if (vl > 1) { ux /= vl; uy /= vl; }
          else { const a0 = (u / 4294967296) * Math.PI * 2; ux = Math.cos(a0); uy = Math.sin(a0); }
          const dist = 60 + 120 * (((u >>> 11) % 1000) / 1000);
          if (fx.kind === 'burst') {
            const e = 1 - Math.pow(1 - fx.p, 3);
            gx += ux * dist * e; gy += uy * dist * e; ga *= Math.pow(1 - fx.p, 1.3);
          } else {
            const q = fx.p < .5 ? 4 * fx.p * fx.p * fx.p : 1 - Math.pow(-2 * fx.p + 2, 3) / 2;
            gx += ux * dist * (1 - q); gy += uy * dist * (1 - q); ga *= Math.min(1, fx.p * 2.5);
          }
        }
        if (ga < .04) continue;
        // Markings knock out to paper; body stays violet. One fillStyle per
        // glyph keeps pixel output identical to the parity reference.
        ctx.fillStyle = p.stripe ? this.options.stripeColor : this.options.color;
        const x = l.originX+(gx-l.x0)*l.scale, y = l.originY+(gy-l.y0)*l.scale;
        const tick = Math.floor((poster?0:this.bitTime)*(1.6+p.seed%2*.4)+p.seed%97/97);
        let hash = (p.seed^Math.imul(tick+1,1274126177))>>>0;
        hash = Math.imul(hash^hash>>>13,1274126177);
        ctx.globalAlpha = ga;
        ctx.fillText(((hash^hash>>>16)&1)?'1':'0',x,y);
        this.drawnGlyphs++;
        if (x+this.cellWidth/2 > 0 && x-this.cellWidth/2 < this.width
            && y+this.cellHeight/2 > 0 && y-this.cellHeight/2 < this.height) this.visibleGlyphs++;
        left = Math.min(left,x-this.cellWidth/2); right = Math.max(right,x+this.cellWidth/2);
        top = Math.min(top,y-this.cellHeight/2); bottom = Math.max(bottom,y+this.cellHeight/2);
      }
      ctx.globalAlpha = 1;
      if (this.drawnGlyphs) this.bounds = { left, top, right, bottom };
    }

    renderCurrent() {
      if (this.disposed) return;
      try {
        if (this.mode === 'poster') {
          if (this.poster.complete && this.poster.naturalWidth) this.paintGlyphs(this.sampleGlyphs(this.poster,true),true);
          else this.clear();
        } else if (this.hasDecodedFrame) {
          if (this.glyphCacheRevision !== this.poseRevision || this.glyphCacheLayout !== this.layoutRevision) {
            this.glyphCache = this.sampleGlyphs(this.decodedCanvas);
            this.glyphCacheRevision = this.poseRevision;
            this.glyphCacheLayout = this.layoutRevision;
          }
          this.paintGlyphs(this.glyphCache);
        } else this.clear();
      } catch (_) { if (this.mode !== 'poster') this.fail(); }
    }

    createVideo() {
      const video = this.video = document.createElement('video');
      video.muted = video.defaultMuted = video.playsInline = true;
      video.loop = false; video.preload = 'auto';
      video.setAttribute('playsinline','');
      this.onVideoError = () => { if (!this.disposed) this.fail(); };
      this.onVideoEnded = () => {
        if (!this.disposed && this.wantsPlayback && this.phase === 'swimming') this.beginExplode();
      };
      video.addEventListener('error',this.onVideoError);
      video.addEventListener('ended',this.onVideoEnded);
      video.src = videoURL;
    }

    acceptFrame(mediaTime) {
      const v = this.video;
      if (!v || v.readyState < 2 || !v.videoWidth) return false;
      if (this.decodedCanvas.width !== v.videoWidth || this.decodedCanvas.height !== v.videoHeight) {
        this.decodedCanvas.width = v.videoWidth; this.decodedCanvas.height = v.videoHeight;
      }
      this.decodedContext.drawImage(v,0,0);
      this.decodedTime = this.mediaTime = mediaTime;
      this.hasDecodedFrame = true; this.poseRevision++;
      return true;
    }

    cancelDecode() {
      if (this.videoFrame !== null && this.video) this.video.cancelVideoFrameCallback(this.videoFrame);
      this.videoFrame = null;
    }

    scheduleDecode() {
      const video = this.video;
      if (!video || !video.requestVideoFrameCallback || this.videoFrame !== null
          || !this.wantsPlayback || this.disposed || this.phase !== 'swimming') return;
      const generation = this.generation;
      this.videoFrame = video.requestVideoFrameCallback((_,metadata) => {
        this.videoFrame = null;
        if (generation !== this.generation || !this.wantsPlayback || this.disposed || this.phase !== 'swimming') return;
        this.acceptFrame(metadata.mediaTime); this.scheduleDecode();
      });
    }

    // An offscreen seek must finish before the next pass begins. seeked establishes
    // the requested decoded frame; RVFC consumes its presentation where present.
    // The painted seeked fallback also works in browsers without RVFC.
    decodeHeldFrame(target) {
      if (this.cancelSeek) this.cancelSeek();
      this.cancelDecode();
      const video = this.video, generation = this.generation;
      video.pause();
      return new Promise(resolve => {
        let done = false, seekStarted = false, frameCallback = null;
        let fallback = null, paint1 = null, paint2 = null;
        const valid = () => !this.disposed && this.wantsPlayback && generation === this.generation;
        const finish = success => {
          if (done) return;
          done = true;
          clearTimeout(timeout); clearTimeout(fallback);
          if (paint1 !== null) cancelAnimationFrame(paint1);
          if (paint2 !== null) cancelAnimationFrame(paint2);
          if (frameCallback !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback);
          video.removeEventListener('loadedmetadata',seek);
          video.removeEventListener('loadeddata',onReady);
          video.removeEventListener('seeked',onReady);
          video.removeEventListener('error',onError);
          if (this.cancelSeek === cancel) this.cancelSeek = null;
          resolve(success);
        };
        const cancel = () => finish(false);
        const complete = timestamp => {
          if (done) return;
          if (!valid()) { finish(false); return; }
          if (video.seeking || video.readyState < 2) return;
          if (this.frameAt(timestamp) !== this.frameAt(target)) return;
          video.pause();
          if (this.acceptFrame(target)) finish(true);
        };
        const paintedFallback = () => {
          if (done || !valid() || paint1 !== null || paint2 !== null) return;
          paint1 = requestAnimationFrame(() => {
            paint1 = null;
            paint2 = requestAnimationFrame(() => { paint2 = null; complete(video.currentTime); });
          });
        };
        const onReady = () => {
          if (!seekStarted || video.seeking || video.readyState < 2 || Math.abs(video.currentTime-target) > 1/data.fps) return;
          if (video.requestVideoFrameCallback) {
            clearTimeout(fallback); fallback = setTimeout(paintedFallback,120);
          } else paintedFallback();
        };
        const seek = () => {
          if (seekStarted || !valid() || video.readyState < 1) return;
          seekStarted = true;
          if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback((_,m) => {
            frameCallback = null; complete(m.mediaTime);
          });
          // A sub-frame seek forces a new decode even on initial timezero,
          // while remaining strictly inside the requested source frame.
          video.currentTime = target + .0001;
          onReady();
        };
        const onError = () => finish(false);
        const timeout = setTimeout(() => finish(false),15000);
        this.cancelSeek = cancel;
        video.addEventListener('loadedmetadata',seek);
        video.addEventListener('loadeddata',onReady);
        video.addEventListener('seeked',onReady);
        video.addEventListener('error',onError);
        seek();
      });
    }

    // Decode frame zero and sample its glyphs to stage the first formation.
    // Later loops stage theirs by seeking underneath the frozen burst.
    async openPass() {
      const generation = this.generation;
      this.phase = 'loading';
      const ready = await this.decodeHeldFrame(0);
      if (generation !== this.generation || !this.wantsPlayback || this.disposed) return false;
      if (!ready) { this.fail(); return false; }
      this.mode = 'video';
      this.openGlyphs = this.sampleGlyphs(this.decodedCanvas);
      return this.startForm();
    }

    // Freeze the swimming end pose and blow it apart around its own center.
    // The opening frame decodes underneath while debris is still visible.
    beginExplode() {
      if (this.phase !== 'swimming') return;
      const generation = this.generation;
      if (this.video) this.video.pause();
      this.cancelDecode();
      this.burstGlyphs = (this.glyphCache || []).slice();
      let cx = 0, cy = 0;
      for (const g of this.burstGlyphs) { cx += g.targetX; cy += g.targetY; }
      if (this.burstGlyphs.length) { cx /= this.burstGlyphs.length; cy /= this.burstGlyphs.length; }
      // The reconstruction gathers around this same center: explode and
      // reform share one spot.
      this.fxCX = cx; this.fxCY = cy;
      this.phase = 'exploding'; this.fxClock = 0;
      this.openGlyphs = null;
      this.effect = { kind: 'burst', p: 0, cx: this.fxCX, cy: this.fxCY };
      this.paintGlyphs(this.burstGlyphs);
      if (!this.video) return;
      this.decodeHeldFrame(0).then(ready => {
        if (generation !== this.generation || !this.wantsPlayback || this.disposed) return;
        if (!ready) { this.fail(); return; }
        this.openGlyphs = this.sampleGlyphs(this.decodedCanvas);
      });
    }

    // Gather the staged opening glyphs back onto the burst center spot and
    // resume swimming once fully formed. Counts as a fresh loop for observers.
    startForm() {
      if (this.disposed || !this.openGlyphs) return false;
      let cx = 0, cy = 0;
      for (const g of this.openGlyphs) { cx += g.targetX; cy += g.targetY; }
      if (this.openGlyphs.length) { cx /= this.openGlyphs.length; cy /= this.openGlyphs.length; }
      this.mode = 'video'; this.phase = 'forming'; this.state = 'playing';
      this.fxClock = 0; this.passCount++;
      this.fxCX = cx; this.fxCY = cy;
      this.effect = { kind: 'form', p: 0, cx, cy };
      this.schedule();
      return true;
    }

    async startSwimming() {
      const generation = this.generation;
      this.mode = 'video'; this.phase = 'swimming'; this.state = 'playing';
      this.video.playbackRate = this.swimRate();
      this.scheduleDecode();
      try {
        await this.video.play();
        if (generation !== this.generation || !this.wantsPlayback || this.disposed) return false;
        this.scheduleDecode(); this.schedule();
        return true;
      } catch (_) {
        if (generation === this.generation && this.wantsPlayback && !this.disposed) this.fail();
        return false;
      }
    }

    async play() {
      if (this.disposed) return false;
      if (location.protocol === 'file:') { this.showPoster(); return false; }
      if (this.wantsPlayback) return true;
      this.wantsPlayback = true; this.generation++;
      if (!this.video) this.createVideo();
      this.lastClock = null;
      if (this.phase === 'swimming') {
        if (this.video.ended) this.beginExplode();
        else return this.startSwimming();
      }
      // Resume a paused burst/formation mid-flight instead of restarting it.
      if (this.phase === 'exploding' || this.phase === 'forming') {
        this.state = 'playing'; this.schedule(); return true;
      }
      return this.openPass();
    }

    schedule() {
      if (!this.wantsPlayback || this.disposed || this.callback !== null || this.state !== 'playing') return;
      this.callback = requestAnimationFrame(now => {
        this.callback = null;
        if (!this.wantsPlayback || this.disposed) return;
        if (document.hidden) { this.pause(); return; }
        const start = performance.now();
        const dt = this.lastClock === null ? 0 : clamp((now-this.lastClock)/1000,0,.05);
        this.lastClock = now; this.bitTime += dt;
        if (this.phase === 'exploding') {
          this.fxClock += dt;
          const progress = Math.min(this.fxClock / EXPLODE_DUR, 1);
          this.effect = { kind: 'burst', p: progress, cx: this.fxCX, cy: this.fxCY };
          this.paintGlyphs(this.burstGlyphs);
          // The opening frame is already decoding underneath; forming starts
          // the moment debris is gone AND the new pose is staged.
          if (progress >= 1 && this.openGlyphs) this.startForm();
        } else if (this.phase === 'forming') {
          this.fxClock += dt;
          const progress = Math.min(this.fxClock / FORM_DUR, 1);
          this.effect = { kind: 'form', p: progress, cx: this.fxCX, cy: this.fxCY };
          this.paintGlyphs(this.openGlyphs || []);
          if (progress >= 1) { this.effect = null; this.startSwimming(); }
        } else if (this.phase === 'swimming') {
          if (this.video.ended) { this.beginExplode(); }
          else {
            if (!this.video.requestVideoFrameCallback && !this.video.seeking && !this.video.paused) this.acceptFrame(this.video.currentTime);
            this.renderCurrent();
          }
        }
        this.frameCost = this.frameCost * .95 + (performance.now() - start) * .05;
        this.schedule();
      });
    }

    stopFrame() {
      if (this.callback !== null) cancelAnimationFrame(this.callback);
      this.callback = this.lastClock = null;
      this.cancelDecode();
    }

    pause() {
      if (this.disposed) return;
      this.wantsPlayback = false; this.generation++;
      if (this.video) this.video.pause();
      if (this.cancelSeek) this.cancelSeek();
      this.stopFrame();
      if (this.state !== 'poster' && this.state !== 'error') this.state = 'paused';
    }

    showPoster() {
      if (this.disposed) return;
      this.pause(); this.mode = this.state = this.phase = 'poster';
      this.effect = null;
      this.renderCurrent();
    }

    fail() { this.showPoster(); this.state = 'error'; }

    dispose() {
      if (this.disposed) return;
      this.pause(); this.disposed = true;
      this.poster.onload = null;
      if (this.video) {
        this.video.removeEventListener('error',this.onVideoError);
        this.video.removeEventListener('ended',this.onVideoEnded);
        this.video.removeAttribute('src'); this.video.load(); this.video = null;
      }
      this.fineCanvas.width = this.fineCanvas.height = 0;
      this.decodedCanvas.width = this.decodedCanvas.height = 0;
      this.glyphCache = null;
      this.clear(); this.state = 'disposed';
    }
  }
  window.BinaryFish = BinaryFish;
})();
