/* Real fish footage, sampled as upright binary glyphs. The two halves of the
   local video contain luminance and a matching soft matte from the same frame. */
(() => {
  'use strict';

  const POSTER = 'data:image/png;base64,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';
  const FRAME_WIDTH = 374;
  const FRAME_HEIGHT = 226;
  const POSTER_TIME = 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const scriptURL = document.currentScript ? document.currentScript.src : location.href;
  const videoURL = new URL('assets/fish-luma-mask.mp4', scriptURL).href;

  class BinaryFish {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d', { alpha: false });
      this.options = Object.assign({
        color: '#7770c4', characterSize: 10, swimmingSpeed: 1.15,
      }, options);
      this.sampleCanvas = document.createElement('canvas');
      this.sampleContext = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
      this.poster = new Image();
      this.poster.onload = () => {
        if (!this.disposed && this.mode === 'poster') this.draw(this.poster, 0);
      };
      this.poster.src = POSTER;
      this.mode = 'poster';
      this.state = 'poster';
      this.disposed = false;
      this.wantsPlayback = false;
      this.generation = 0;
      this.video = null;
      this.callback = null;
      this.bitTime = 0;
      this.lastClock = null;
      this.resize(canvas.clientWidth || 760, canvas.clientHeight || 640,
        window.devicePixelRatio || 1);
    }

    resize(width, height, pixelRatio = 1) {
      if (this.disposed) return;
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.pixelRatio = clamp(pixelRatio, 1, 2);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      const scale = Math.max(0.05, Math.min(1, (this.width - 20) / 720, (this.height - 20) / 560));
      this.fontSize = this.options.characterSize * Math.max(0.62, scale);
      this.cellWidth = this.fontSize * 0.68;
      this.cellHeight = this.fontSize * 1.08;
      const areaWidth = Math.max(1, Math.min(1180, this.width - 20));
      const areaHeight = Math.max(1, Math.min(840, this.height - 20));
      // Use all available desktop width for the fish's genuine path. On
      // smaller screens the single horizontal scale applies to both axes;
      // taller desktops receive only the modest additional width necessary to
      // match the reference's large central silhouette.
      const sourceScaleX = Math.min(areaWidth / FRAME_WIDTH, 2.6);
      const sourceScaleY = Math.min(areaHeight / FRAME_HEIGHT, sourceScaleX);
      this.columns = Math.max(1, Math.floor(FRAME_WIDTH * sourceScaleX / this.cellWidth));
      this.rows = Math.max(1, Math.floor(FRAME_HEIGHT * sourceScaleY / this.cellHeight));
      this.offsetX = (this.width - this.columns * this.cellWidth) / 2;
      this.offsetY = (this.height - this.rows * this.cellHeight) / 2;
      this.sampleCanvas.width = this.columns * 2;
      this.sampleCanvas.height = this.rows;
      this.sampleContext.imageSmoothingEnabled = true;
      if (this.mode === 'video' && this.video && this.video.readyState >= 2) {
        this.draw(this.video, this.bitTime);
      } else if (this.poster.complete && this.poster.naturalWidth) {
        this.draw(this.poster, 0);
      } else {
        this.clear();
      }
    }

    clear() {
      this.context.globalAlpha = 1;
      this.context.fillStyle = '#fff';
      this.context.fillRect(0, 0, this.width, this.height);
    }

    async play() {
      if (this.disposed) return false;
      if (location.protocol === 'file:') {
        this.showPoster();
        return false;
      }
      if (this.wantsPlayback && this.state === 'playing') return true;
      this.wantsPlayback = true;
      const generation = ++this.generation;
      if (!this.video) {
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.defaultMuted = true;
        this.video.playsInline = true;
        this.video.loop = true;
        this.video.preload = 'auto';
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('muted', '');
        this.video.src = videoURL;
        // Before metadata, browsers store this as the default playback start.
        // The first decoded pose therefore matches the displayed still.
        this.video.currentTime = POSTER_TIME;
        this.video.addEventListener('error', () => this.fail());
      }
      this.video.playbackRate = clamp(Number(this.options.swimmingSpeed) || 1.15, 0.25, 3);
      this.state = 'loading';
      try {
        await this.video.play();
        if (this.disposed || generation !== this.generation || !this.wantsPlayback || document.hidden) {
          if (this.video && (!this.wantsPlayback || this.disposed || document.hidden)) this.video.pause();
          return false;
        }
        this.mode = 'video';
        this.state = 'playing';
        this.lastClock = null;
        this.draw(this.video, this.bitTime);
        this.schedule();
        return true;
      } catch (_) {
        if (!this.disposed && generation === this.generation && this.wantsPlayback) this.fail();
        return false;
      }
    }

    schedule() {
      if (this.disposed || !this.wantsPlayback || this.callback !== null) return;
      const tick = (now) => {
        this.callback = null;
        if (this.disposed || !this.wantsPlayback) return;
        if (document.hidden) { this.pause(); return; }
        if (this.lastClock !== null) this.bitTime += Math.min((now - this.lastClock) / 1000, 0.1);
        this.lastClock = now;
        if (this.video.readyState >= 2) this.draw(this.video, this.bitTime);
        this.schedule();
      };
      this.usesVideoCallback = typeof this.video.requestVideoFrameCallback === 'function';
      this.callback = this.usesVideoCallback
        ? this.video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    }

    pause() {
      this.wantsPlayback = false;
      this.generation++;
      this.lastClock = null;
      if (this.video) this.video.pause();
      if (this.callback !== null) {
        if (this.usesVideoCallback && this.video) this.video.cancelVideoFrameCallback(this.callback);
        else cancelAnimationFrame(this.callback);
        this.callback = null;
      }
      if (!this.disposed && this.state !== 'poster' && this.state !== 'error') this.state = 'paused';
    }

    showPoster() {
      if (this.disposed) return;
      this.pause();
      this.mode = 'poster';
      this.state = 'poster';
      if (this.poster.complete && this.poster.naturalWidth) this.draw(this.poster, 0);
    }

    fail() {
      if (this.disposed) return;
      this.showPoster();
      this.state = 'error';
    }

    draw(source, time) {
      if (this.disposed) return;
      const width = source.videoWidth || source.naturalWidth;
      const height = source.videoHeight || source.naturalHeight;
      if (!width || !height) return;
      const columns = this.columns, rows = this.rows;
      try {
        this.sampleContext.drawImage(source, 0, 0, width / 2, height, 0, 0, columns, rows);
        this.sampleContext.drawImage(source, width / 2, 0, width / 2, height, columns, 0, columns, rows);
        const pixels = this.sampleContext.getImageData(0, 0, columns * 2, rows).data;
        this.clear();
        const context = this.context;
        context.fillStyle = this.options.color;
        context.font = `500 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            const index = (row * columns * 2 + column) * 4;
            const matte = pixels[index + columns * 4] / 255;
            if (matte < 0.035) continue;
            const luminance = pixels[index] / 255;
            const left = pixels[index - (column > 0 ? 4 : 0)] / 255;
            const right = pixels[index + (column + 1 < columns ? 4 : 0)] / 255;
            const localContrast = (left + right) * 0.5 - luminance;
            const tone = Math.pow(clamp((0.88 - luminance) / 0.58 + 0.2 * localContrast, 0, 1), 1.05);
            // A gentle floor lets real translucent fin rays remain present,
            // while the luma-derived tone makes the body folds substantially
            // denser than the highlights.
            const opacity = Math.pow(matte, 0.78) * (0.065 + 0.935 * tone);
            if (opacity < 0.022) continue;
            const seed = (Math.imul(column + 17, 374761393) ^ Math.imul(row + 31, 668265263)) >>> 0;
            const tick = Math.floor(time * (7 + (seed % 4)) + (seed % 97) / 97);
            let hash = (seed ^ Math.imul(tick + 1, 1274126177)) >>> 0;
            hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
            context.globalAlpha = opacity;
            context.fillText(((hash ^ (hash >>> 16)) & 1) ? '1' : '0',
              this.offsetX + (column + 0.5) * this.cellWidth,
              this.offsetY + (row + 0.5) * this.cellHeight);
          }
        }
        context.globalAlpha = 1;
      } catch (_) {
        // A failed video decode must not remove the still fallback.
        if (source === this.video) this.fail();
      }
    }

    dispose() {
      if (this.disposed) return;
      this.pause();
      this.disposed = true;
      this.poster.onload = null;
      if (this.video) {
        this.video.removeAttribute('src');
        this.video.load();
        this.video = null;
      }
      this.sampleCanvas.width = this.sampleCanvas.height = 0;
      this.state = 'disposed';
    }
  }

  window.BinaryFish = BinaryFish;
})();
