/* Original clownfish footage on an upright binary grid. A synchronized third
   plane orders the portal reveal by anatomy; the fish itself is not moved. */
(() => {
  'use strict';
  const data = window.BinaryFishData;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const scriptURL = document.currentScript ? document.currentScript.src : location.href;
  const videoURL = new URL('assets/fish-luma-mask.mp4', scriptURL).href;

  class BinaryFish {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.options = Object.assign({ color: '#554bc6', characterSize: 6,
        swimmingSpeed: 1.15, fishSize: 1280 }, options);
      this.fineCanvas = document.createElement('canvas');
      this.fineContext = this.fineCanvas.getContext('2d', { willReadFrequently: true });
      // Pair each presented frame with its timestamp rather than reading a
      // newer live frame with an older fade value in the next animation frame.
      this.decodedCanvas = document.createElement('canvas');
      this.decodedContext = this.decodedCanvas.getContext('2d');
      this.mode = this.state = this.phase = 'poster';
      this.disposed = this.wantsPlayback = this.restarting = this.hasDecodedFrame = false;
      this.generation = this.passCount = this.bitTime = this.mediaTime = this.poseRevision = 0;
      this.decodedTime = null;
      this.video = this.callback = this.lastClock = this.loadTimer = this.videoFrame = null;
      this.poster = new Image();
      this.poster.onload = () => {
        if (!this.disposed && this.mode === 'poster') this.renderCurrent();
      };
      this.poster.src = data.poster;
      this.resize(canvas.clientWidth || 1200, canvas.clientHeight || 800, window.devicePixelRatio || 1);
    }

    swimRate() {
      return clamp(Number(this.options.swimmingSpeed) || data.playbackRate || 1.15, .25, 3);
    }

    resize(width, height, pixelRatio = 1) {
      if (this.disposed) return;
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.pixelRatio = clamp(pixelRatio, 1, 2);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.fontSize = this.options.characterSize;
      this.cellWidth = this.fontSize * .62;
      this.cellHeight = this.fontSize * 1.02;
      this.targetFish = Math.min(this.options.fishSize, this.width * .90);
      this.renderCurrent();
    }

    frameAt(mediaTime) {
      return clamp(Math.floor(mediaTime * data.fps + 1e-6), 0, data.frameCount - 1);
    }

    sceneAt(mediaTime) {
      const scenes = data.scenes || [];
      for (let i = scenes.length - 1; i >= 0; i--) {
        if (mediaTime >= scenes[i].start) return i;
      }
      return 0;
    }

    portalAt(mediaTime) {
      const t = Math.max(0, mediaTime);
      const span = (data.portalSeconds || 1.2) * this.swimRate();
      const lastFrame = (data.frameCount - 1) / data.fps;
      if (t >= lastFrame) return { phase: 'hidden-restart', progress: 1 };
      if (t < span) return { phase: 'entering', progress: clamp(t / span, 0, 1) };
      if (t >= lastFrame - span) return { phase: 'departing', progress: clamp((t-lastFrame+span)/span, 0, 1) };
      return { phase: 'visible-swimming', progress: 1 };
    }

    portalOpacity(anatomy, state = this.portalState) {
      if (state.phase === 'visible-swimming' || state.phase === 'poster') return 1;
      if (state.phase === 'hidden-restart') return 0;
      const feather = data.portalFeather || .15;
      const u = clamp((state.progress * (1 + feather) - anatomy) / feather, 0, 1);
      const revealed = u*u*(3-2*u);
      return state.phase === 'entering' ? revealed : 1-revealed;
    }

    clear() {
      this.context.globalAlpha = 1;
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawnGlyphs = 0;
      this.bounds = { left: this.width / 2, top: this.height / 2,
        right: this.width / 2, bottom: this.height / 2 };
    }

    applyRate(rate) {
      if (this.video) this.video.playbackRate = rate;
    }

    armLoadTimeout() {
      clearTimeout(this.loadTimer);
      const generation = this.generation;
      this.loadTimer = setTimeout(() => {
        if (generation === this.generation && this.wantsPlayback) this.fail();
      }, 15000);
    }

    createVideo() {
      const video = this.video = document.createElement('video');
      video.muted = video.defaultMuted = video.playsInline = true;
      video.loop = false;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.addEventListener('error', () => { if (!this.disposed) this.fail(); });
      video.addEventListener('ended', () => {
        if (!this.disposed && this.wantsPlayback) this.restart();
      });
      video.src = videoURL;
    }

    async play() {
      if (this.disposed) return false;
      if (location.protocol === 'file:') { this.showPoster(); return false; }
      if (this.wantsPlayback && (this.state === 'playing' || this.state === 'loading')) return true;
      this.wantsPlayback = true;
      const generation = ++this.generation;
      if (!this.video) this.createVideo();
      if (this.video.ended) this.restarting = true;
      this.state = 'loading';
      this.applyRate(this.swimRate());
      this.armLoadTimeout();
      if (this.restarting && this.video.currentTime > .5) this.video.currentTime = 0;
      // Register before play: a detached video still needs a frame consumer.
      this.scheduleDecode();
      try {
        await this.video.play();
        if (generation !== this.generation || !this.wantsPlayback || this.disposed || document.hidden) {
          if (this.video && (!this.wantsPlayback || this.disposed || document.hidden)) this.video.pause();
          return false;
        }
        this.mode = 'video'; this.state = 'playing'; this.lastClock = null;
        if (this.hasDecodedFrame && !this.restarting) clearTimeout(this.loadTimer);
        this.renderCurrent(); this.scheduleDecode(); this.schedule();
        return true;
      } catch (_) {
        if (generation === this.generation && this.wantsPlayback && !this.disposed) this.fail();
        return false;
      }
    }

    restart() {
      if (this.restarting || !this.video || this.disposed) return;
      this.restarting = true;
      this.phase = 'hidden-restart'; this.fadeAlpha = 0;
      this.portalState = { phase: 'hidden-restart', progress: 1 };
      this.glyphsBeforeRestart = this.drawnGlyphs;
      this.clear();
      this.armLoadTimeout();
      const generation = this.generation;
      try {
        this.video.currentTime = 0;
        this.scheduleDecode();
        this.video.play().catch(() => {
          if (generation === this.generation && this.wantsPlayback) this.fail();
        });
      } catch (_) { this.fail(); }
    }

    acceptFrame(mediaTime) {
      if (!this.video || this.video.readyState < 2) return;
      // The old ending frame cannot be reused while the seek completes.
      if (this.restarting && (this.video.seeking || mediaTime > .5)) return;
      if (this.restarting) { this.restarting = false; this.passCount++; }
      const width = this.video.videoWidth, height = this.video.videoHeight;
      if (!width || !height) return;
      if (this.decodedCanvas.width !== width || this.decodedCanvas.height !== height) {
        this.decodedCanvas.width = width; this.decodedCanvas.height = height;
      }
      this.decodedContext.drawImage(this.video, 0, 0);
      this.decodedTime = this.mediaTime = mediaTime;
      this.hasDecodedFrame = true;
      this.poseRevision++;
      clearTimeout(this.loadTimer);
    }

    scheduleDecode() {
      if (!this.video || !this.video.requestVideoFrameCallback || this.videoFrame !== null
          || !this.wantsPlayback || this.disposed) return;
      this.videoFrame = this.video.requestVideoFrameCallback((_, metadata) => {
        this.videoFrame = null;
        if (!this.wantsPlayback || this.disposed) return;
        this.acceptFrame(metadata.mediaTime);
        this.scheduleDecode();
      });
    }

    schedule() {
      if (!this.wantsPlayback || this.disposed || this.callback !== null || this.state !== 'playing') return;
      this.callback = requestAnimationFrame(now => {
        this.callback = null;
        if (!this.wantsPlayback || this.disposed) return;
        if (document.hidden) { this.pause(); return; }
        const dt = this.lastClock === null ? 0 : clamp((now - this.lastClock) / 1000, 0, .1);
        this.lastClock = now; this.bitTime += dt;
        if (!this.video.requestVideoFrameCallback && !this.video.seeking) {
          this.acceptFrame(this.video.currentTime);
        }
        this.renderCurrent(); this.schedule();
      });
    }

    stopFrame() {
      if (this.callback !== null) cancelAnimationFrame(this.callback);
      if (this.videoFrame !== null && this.video) this.video.cancelVideoFrameCallback(this.videoFrame);
      this.videoFrame = this.callback = this.lastClock = null;
    }

    pause() {
      this.wantsPlayback = false;
      this.generation++;
      clearTimeout(this.loadTimer);
      if (this.video) this.video.pause();
      this.stopFrame();
      if (!this.disposed && this.state !== 'poster' && this.state !== 'error') this.state = 'paused';
    }

    showPoster() {
      if (this.disposed) return;
      this.pause();
      this.mode = this.state = this.phase = 'poster';
      this.renderCurrent();
    }

    fail() {
      if (this.disposed) return;
      this.showPoster(); this.state = 'error';
    }

    renderCurrent() {
      if (this.disposed) return;
      if (this.mode === 'poster') {
        if (this.poster.complete && this.poster.naturalWidth) {
          this.draw(this.poster, 0, data.posterFrame / data.fps, true);
        } else this.clear();
      } else if (this.restarting || !this.hasDecodedFrame) {
        this.phase = this.restarting ? 'hidden-restart' : 'loading'; this.fadeAlpha = 0;
        this.portalState = { phase: 'hidden-restart', progress: 1 };
        this.clear();
      } else this.draw(this.decodedCanvas, this.bitTime, this.decodedTime, false);
    }

    paintGlyphs(pixels, cols, rows, originX, originY, stepX, stepY, time) {
      const ctx = this.context, matteStride = cols * 4;
      let minC = cols, minR = rows, maxC = -1, maxR = -1;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < cols; column++) {
          const index = (row * cols * 3 + column) * 4;
          const matte = pixels[index + matteStride] / 255;
          if (matte < .018) continue;
          const luminance = pixels[index] / 255;
          const anatomy = pixels[index + matteStride * 2] / 255;
          const opacity = Math.pow(matte, .42) * (.40 + .60 * (1 - luminance * .50)) * this.portalOpacity(anatomy);
          if (opacity < .04) continue;
          const seed = (Math.imul(column + 17, 374761393) ^ Math.imul(row + 31, 668265263)) >>> 0;
          const tick = Math.floor(time * (1.6 + seed % 2 * .4) + seed % 97 / 97);
          let hash = (seed ^ Math.imul(tick + 1, 1274126177)) >>> 0;
          hash = Math.imul(hash ^ hash >>> 13, 1274126177);
          ctx.globalAlpha = opacity;
          ctx.fillText(((hash ^ hash >>> 16) & 1) ? '1' : '0',
            originX + (column + .5) * stepX, originY + (row + .5) * stepY);
          this.drawnGlyphs++;
          minC = Math.min(minC, column); maxC = Math.max(maxC, column);
          minR = Math.min(minR, row); maxR = Math.max(maxR, row);
        }
      }
      return { minC, minR, maxC, maxR };
    }

    draw(source, time, mediaTime, poster = false) {
      if (this.disposed) return;
      const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
      if (!width || !height) return;
      this.clear();
      this.sceneIndex = this.sceneAt(mediaTime);
      this.portalState = poster ? { phase: 'poster', progress: 1 } : this.portalAt(mediaTime);
      this.phase = this.portalState.phase;
      this.fadeAlpha = this.phase === 'hidden-restart' ? 0 : 1;
      // Fixed union bounds retain the complete recorded path.
      const scene = (data.scenes || [])[this.sceneIndex];
      const bounds = (poster && data.posterBounds) || (scene && scene.bounds) || [0, 0, data.width, data.height];
      const pad = Math.max(4, Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) * .04);
      const x0 = clamp(bounds[0] - pad, 0, data.width - 1), y0 = clamp(bounds[1] - pad, 0, data.height - 1);
      const x1 = clamp(bounds[2] + pad, x0 + 1, data.width), y1 = clamp(bounds[3] + pad, y0 + 1, data.height);
      const srcW = x1 - x0, srcH = y1 - y0;
      // Fit the complete recorded path by each axis, without camera tracking.
      const scale = Math.min(this.targetFish / srcW, this.height * .80 / srcH);
      const drawW = srcW * scale, drawH = srcH * scale;
      let originX = (this.width - drawW) / 2, originY = (this.height - drawH) / 2;
      if (poster && data.posterFishBounds) {
        // Center the selected still at the same scale as the recorded path;
        // this offset never affects the animated footage.
        const fishBounds = data.posterFishBounds;
        originX += ((x0+x1)-(fishBounds[0]+fishBounds[2]))*.5*scale;
        originY += ((y0+y1)-(fishBounds[1]+fishBounds[3]))*.5*scale;
      }
      this.swimmingBounds = { left: originX, top: originY,
        right: originX + drawW, bottom: originY + drawH };
      this.position = { x: originX, y: originY, phase: this.phase };
      this.sceneBounds = [x0, y0, x1, y1];
      if (this.fadeAlpha <= .001) return;
      const cols = this.columns = Math.max(1, Math.round(drawW / this.cellWidth));
      const rows = this.rows = Math.max(1, Math.round(drawH / this.cellHeight));
      if (this.fineCanvas.width !== cols * 3 || this.fineCanvas.height !== rows) {
        this.fineCanvas.width = cols * 3; this.fineCanvas.height = rows;
      }
      try {
        const plane = width / 3, sourceScaleX = plane / data.width, sourceScaleY = height / data.height;
        for (let channel = 0; channel < 3; channel++) {
          this.fineContext.drawImage(source, channel * plane + x0 * sourceScaleX, y0 * sourceScaleY,
            srcW * sourceScaleX, srcH * sourceScaleY, channel * cols, 0, cols, rows);
        }
        const pixels = this.fineContext.getImageData(0, 0, cols * 3, rows).data;
        const ctx = this.context;
        ctx.fillStyle = this.options.color;
        ctx.font = `500 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const stepX = drawW / cols, stepY = drawH / rows;
        const drawn = this.paintGlyphs(pixels, cols, rows, originX, originY, stepX, stepY, time);
        ctx.globalAlpha = 1;
        if (drawn.maxC >= 0) this.bounds = {
          left: originX + drawn.minC * stepX, top: originY + drawn.minR * stepY,
          right: originX + (drawn.maxC + 1) * stepX, bottom: originY + (drawn.maxR + 1) * stepY,
        };
      } catch (_) { if (!poster) this.fail(); }
    }

    dispose() {
      if (this.disposed) return;
      this.pause(); this.disposed = true;
      this.poster.onload = null;
      if (this.video) { this.video.removeAttribute('src'); this.video.load(); this.video = null; }
      this.fineCanvas.width = this.fineCanvas.height = 0;
      this.decodedCanvas.width = this.decodedCanvas.height = 0;
      this.clear(); this.state = 'disposed';
    }
  }
  window.BinaryFish = BinaryFish;
})();
