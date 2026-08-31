/* Original footage, with glyph particles at the two held endpoint poses.
   The third packed anatomy plane is intentionally unused. */
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
        swimmingSpeed: 1.15, fishSize: 1280, transitionDuration: 1 }, options);
      this.fineCanvas = document.createElement('canvas');
      this.fineContext = this.fineCanvas.getContext('2d', { willReadFrequently: true });
      this.decodedCanvas = document.createElement('canvas');
      this.decodedContext = this.decodedCanvas.getContext('2d');
      this.openingCanvas = document.createElement('canvas');
      this.outgoingFrameCanvas = document.createElement('canvas');
      this.openingSeekPending = false;
      this.openingGlyphs = [];
      this.nextParticleId = 0;
      this.mode = this.state = this.phase = 'poster';
      this.disposed = this.wantsPlayback = this.hasDecodedFrame = this.restarting = false;
      this.generation = this.passCount = this.bitTime = this.mediaTime = this.poseRevision = 0;
      this.transitionElapsed = this.transitionProgress = this.particleCount = 0;
      this.particles = [];
      this.decodedTime = null;
      this.video = this.callback = this.lastClock = this.loadTimer = this.videoFrame = null;
      this.cancelSeek = null;
      this.poster = new Image();
      this.poster.onload = () => { if (!this.disposed && this.mode === 'poster') this.renderCurrent(); };
      this.poster.src = data.poster;
      this.resize(canvas.clientWidth || 1200, canvas.clientHeight || 800, window.devicePixelRatio || 1);
    }

    swimRate() { return clamp(Number(this.options.swimmingSpeed) || 1.15, .25, 3); }
    transitionDuration() { return clamp(Number(this.options.transitionDuration) || 1, .05, 10); }
    frameAt(t) { return clamp(Math.floor(t * data.fps + 1e-5), 0, data.frameCount - 1); }
    sceneAt() { return 0; }

    resize(width, height, pixelRatio = 1) {
      if (this.disposed) return;
      const exploding = this.phase === 'exploding';
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.pixelRatio = clamp(pixelRatio, 1, 2);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.fontSize = this.options.characterSize;
      this.cellWidth = this.fontSize * .62; this.cellHeight = this.fontSize * 1.02;
      this.targetFish = Math.min(this.options.fishSize, this.width * .90);
      this.layoutRevision = (this.layoutRevision || 0)+1;
      // Particle positions live in source space, so resizing preserves their
      // identity and progress without remapping them through a screen offset.
      if (exploding) this.particleCount = this.particles.length;
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

    layout(poster = false) {
      const box = (poster && data.posterBounds) || data.scenes[0].bounds;
      const pad = Math.max(4, Math.max(box[2]-box[0], box[3]-box[1])*.04);
      const x0 = clamp(box[0]-pad, 0, data.width-1), y0 = clamp(box[1]-pad, 0, data.height-1);
      const x1 = clamp(box[2]+pad, x0+1, data.width), y1 = clamp(box[3]+pad, y0+1, data.height);
      const srcW = x1-x0, srcH = y1-y0;
      const scale = Math.min(this.targetFish/srcW, this.height*.80/srcH);
      const firstFish = data.frameBounds[0];
      const originX = this.width+24-firstFish[0]*scale, originY = (this.height-srcH*scale)/2;
      this.sceneIndex = 0;
      this.sceneBounds = [x0,y0,x1,y1];
      this.swimmingBounds = { left: originX, top: originY,
        right: originX+srcW*scale, bottom: originY+srcH*scale };
      this.position = { x: originX, y: originY, phase: this.phase };
      return { x0,y0,srcW,srcH,scale,originX,originY };
    }

    screenPose(pose,poster = false) {
      const l = this.layout(poster);
      return {x:l.originX+(pose.x-l.x0)*l.scale,
        y:l.originY+(pose.y-l.y0)*l.scale,alpha:pose.alpha,seed:pose.seed};
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
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const i = (row*cols*2+col)*4;
        const matte = pixels[i+cols*4]/255;
        if (matte < .018) continue;
        const opacity = Math.pow(matte,.42)*(.40+.60*(1-pixels[i]/255*.50));
        if (opacity < .04) continue;
        const seed = (Math.imul(col+17,374761393)^Math.imul(row+31,668265263))>>>0;
        glyphs.push({ targetX: l.x0+(col+.5)*l.srcW/cols,
          targetY: l.y0+(row+.5)*l.srcH/rows, opacity, seed });
      }
      return glyphs;
    }

    captureParticles() {
      const glyphs = this.sampleGlyphs(this.decodedCanvas);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const p of glyphs) {
        left = Math.min(left,p.targetX); right = Math.max(right,p.targetX);
        top = Math.min(top,p.targetY); bottom = Math.max(bottom,p.targetY);
      }
      const cx = (left+right)/2, cy = (top+bottom)/2;
      this.particleFishWidth = Number.isFinite(right-left) ? right-left : 1;
      this.particles = glyphs.map(p => {
        const r = ((Math.imul(p.seed^0x85ebca6b,1597334677)>>>0)%65536)/65535;
        const s = ((Math.imul(p.seed^0xc2b2ae35,3812015801)>>>0)%65536)/65535;
        const angle = Math.atan2(p.targetY-cy,p.targetX-cx)+(s-.5)*.8;
        const distance = this.particleFishWidth*.5*(.4+.6*r);
        const dx = Math.cos(angle)*distance, dy = Math.sin(angle)*distance;
        const id = ++this.nextParticleId;
        return Object.assign(p,{ id,rootId:id, dx,dy,sourceX:p.targetX+dx,sourceY:p.targetY+dy,
          fadeStart:.58+.20*s, fadeEnd:.88+.12*r, entryDelay:.08*s, entryEnd:.15+.13*r });
      });
      this.particleCount = this.particles.length;
    }

    particlePose(p, progress = this.transitionProgress, phase = this.phase) {
      const q = clamp(progress,0,1);
      if (phase === 'swimming') return p.destinationX !== undefined
        ? {x:p.destinationX,y:p.destinationY,alpha:p.targetOpacityShare,seed:p.targetSeed}
        : {x:p.targetX,y:p.targetY,alpha:p.opacity,seed:p.seed};
      if (phase === 'exploding') {
        const u = clamp((q-(p.burstSegmentStart || 0))/(1-(p.burstSegmentStart || 0)),0,1);
        const e = 1-Math.pow(1-u,3);
        const fade = 1-clamp((q-p.fadeStart)/(p.fadeEnd-p.fadeStart),0,1);
        return { x:p.burstStartX+(p.burstEndX-p.burstStartX)*e,
          y:p.burstStartY+(p.burstEndY-p.burstStartY)*e,
          alpha:p.currentOpacity*fade, seed:p.segmentSeed };
      }
      return {x:p.targetX,y:p.targetY,alpha:p.opacity,seed:p.seed};
    }

    constrainPoint(x,y) {
      const l = this.layout();
      const marginY = this.cellHeight/2+1;
      // Horizontal coordinates may intentionally be outside the viewport.
      // Only the vertical path is constrained during offscreen travel.
      return { x,
        y:clamp(y,l.y0+(marginY-l.originY)/l.scale,l.y0+(this.height-marginY-l.originY)/l.scale) };
    }

    burstEndpoint(x,y,dx,dy,seed) {
      const l = this.layout();
      const marginX = this.cellWidth/2+1, marginY = this.cellHeight/2+1;
      const left = l.x0+(marginX-l.originX)/l.scale;
      const top = l.y0+(marginY-l.originY)/l.scale, bottom = l.y0+(this.height-marginY-l.originY)/l.scale;
      const tx = dx < 0 ? (left-x)/dx : Infinity;
      const ty = dy > 0 ? (bottom-y)/dy : dy < 0 ? (top-y)/dy : Infinity;
      const room = Math.max(0,Math.min(tx,ty));
      // Compress the distance along its original ray. Varied soft capacity
      // prevents unrelated particles from piling onto a clamped screen edge.
      const capacity = room*(.58+.30*(seed%101)/100);
      const factor = Number.isFinite(capacity) ? capacity/(1+capacity) : 1;
      return {x:x+dx*factor,y:y+dy*factor};
    }

    particleVelocity(p) {
      if (this.phase === 'waiting-opening') return {vx:0,vy:0};
      const q = this.transitionProgress, next = Math.min(1,q+.0001);
      if (next === q) return {vx:0,vy:0};
      const a = this.particlePose(p,q), b = this.particlePose(p,next);
      const dt = (next-q)*this.transitionDuration();
      return {vx:(b.x-a.x)/dt,vy:(b.y-a.y)/dt};
    }

    spatialKey(x,y) {
      let a = clamp(Math.floor(x/data.width*1023),0,1023), b = clamp(Math.floor(y/data.height*1023),0,1023);
      let result = 0;
      for (let bit = 0; bit < 10; bit++) result |= ((a>>bit)&1)<<(bit*2) | ((b>>bit)&1)<<(bit*2+1);
      return result;
    }

    mapOpeningTargets(poses) {
      this.openingGlyphs = this.sampleGlyphs(this.openingCanvas);
      const originalCount = this.particles.length;
      const copies = new Array(originalCount).fill(1);
      for (let i = originalCount; i < this.openingGlyphs.length; i++) copies[(i-originalCount)%originalCount]++;
      const initialParticles = this.particles.slice();
      for (let i = 0; i < originalCount; i++) {
        const original = initialParticles[i], pose = poses[i];
        const share = 1-Math.pow(1-pose.alpha,1/copies[i]);
        original.currentOpacity = share; original.segmentSeed = pose.seed;
        original.currentX = pose.x; original.currentY = pose.y;
        original.currentVx = pose.vx || 0; original.currentVy = pose.vy || 0;
        for (let n = 1; n < copies[i]; n++) {
          const child = { ...original,id:++this.nextParticleId,rootId:original.rootId,parentId:original.id };
          this.particles.push(child);
        }
      }
      const ordered = this.particles.slice().sort((a,b) =>
        this.spatialKey(a.currentX,a.currentY)-this.spatialKey(b.currentX,b.currentY) || a.id-b.id);
      const targets = this.openingGlyphs.map((g,index) => ({...g,index})).sort((a,b) =>
        this.spatialKey(a.targetX,a.targetY)-this.spatialKey(b.targetX,b.targetY));
      const groups = targets.map(() => []);
      for (let i = 0; i < ordered.length; i++) groups[Math.floor(i*targets.length/ordered.length)].push(ordered[i]);
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i], group = groups[i];
        for (const p of group) {
          p.groupId = target.index; p.groupSize = group.length;
          p.destinationX = target.targetX; p.destinationY = target.targetY;
          p.targetSeed = target.seed; p.targetOpacity = target.opacity;
          p.targetOpacityShare = 1-Math.pow(1-target.opacity,1/group.length);
        }
      }
      this.particleCount = this.particles.length;
    }

    setReformPaths(poses, segmentStart = 0) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i], pose = poses[i] || {x:p.currentX,y:p.currentY,
          alpha:p.currentOpacity,seed:p.segmentSeed,vx:p.currentVx,vy:p.currentVy};
        p.pathStartX = pose.x; p.pathStartY = pose.y;
        p.currentOpacity = pose.alpha; p.segmentSeed = pose.seed;
        const remaining = (1-segmentStart)*this.transitionDuration();
        const tangent = this.constrainPoint(pose.x+(pose.vx || 0)*remaining/4,pose.y+(pose.vy || 0)*remaining/4);
        p.control1X = tangent.x; p.control1Y = tangent.y;
        const dx = p.destinationX-pose.x, dy = p.destinationY-pose.y;
        const bend = ((p.id%101)/100-.5)*.45;
        const control = this.constrainPoint((pose.x+p.destinationX)*.5-dy*bend,(pose.y+p.destinationY)*.5+dx*bend);
        p.control2X = control.x; p.control2Y = control.y;
        p.reformSegmentStart = segmentStart;
      }
    }

    resizeConnectedParticles(poses,old,oldWidth,oldHeight) {
      const l = this.layout();
      const remap = point => this.constrainPoint(
        l.x0+(((old.originX+old.translationX+(point.x-old.x0)*old.scale)/oldWidth)*this.width-l.originX-l.translationX)/l.scale,
        l.y0+(((old.originY+(point.y-old.y0)*old.scale)/oldHeight)*this.height-l.originY)/l.scale);
      const factorX = old.scale/l.scale*this.width/oldWidth, factorY = old.scale/l.scale*this.height/oldHeight;
      const mapped = poses.map(p => ({...p,...remap(p),vx:p.vx*factorX,vy:p.vy*factorY}));
      const ends = this.particles.map(p => remap({x:p.burstEndX,y:p.burstEndY}));
      this.mapOpeningTargets(mapped);
      if (this.phase === 'reforming') this.setReformPaths([],this.transitionProgress);
      else for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const pose = {x:p.currentX,y:p.currentY};
        const end = ends[i] || this.burstEndpoint(pose.x,pose.y,p.dx*.12,p.dy*.12,p.id);
        p.burstStartX = pose.x; p.burstStartY = pose.y;
        p.burstEndX = end.x; p.burstEndY = end.y; p.burstSegmentStart = this.transitionProgress;
        p.driftX = (p.driftX || 0)*factorX; p.driftY = (p.driftY || 0)*factorY;
        const sway = (1-Math.cos(this.waitElapsed*1.1))*.5;
        p.waitX = pose.x-(p.driftX || 0)*sway; p.waitY = pose.y-(p.driftY || 0)*sway;
      }
    }

    paintGlyphs(glyphs, particles = false, poster = false) {
      this.clear();
      const l = this.layout(poster), ctx = this.context;
      ctx.fillStyle = this.options.color;
      ctx.font = `500 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      const connected = particles;
      const entries = connected ? new Map() : null;
      const paint = (pose,seed) => {
        if (pose.alpha < (connected?.0001:.04)) return;
        const x = l.originX+(pose.x-l.x0)*l.scale, y = l.originY+(pose.y-l.y0)*l.scale;
        const tick = Math.floor((poster?0:this.bitTime)*(1.6+seed%2*.4)+seed%97/97);
        let hash = (seed^Math.imul(tick+1,1274126177))>>>0;
        hash = Math.imul(hash^hash>>>13,1274126177);
        ctx.globalAlpha = pose.alpha;
        ctx.fillText(((hash^hash>>>16)&1)?'1':'0',x,y);
        this.drawnGlyphs++;
        if (x+this.cellWidth/2 > 0 && x-this.cellWidth/2 < this.width
            && y+this.cellHeight/2 > 0 && y-this.cellHeight/2 < this.height) this.visibleGlyphs++;
        left = Math.min(left,x-this.cellWidth/2); right = Math.max(right,x+this.cellWidth/2);
        top = Math.min(top,y-this.cellHeight/2); bottom = Math.max(bottom,y+this.cellHeight/2);
      };
      for (const p of glyphs) {
        const pose = particles ? this.particlePose(p) : { x:p.targetX,y:p.targetY,alpha:p.opacity,seed:p.seed };
        if (!connected) paint(pose,pose.seed);
        else {
          // Split descendants and merged destinations can coincide exactly.
          // Composite their opacity once, keeping antialiased glyph edges clean.
          const key = `${Math.round(pose.x*10000)},${Math.round(pose.y*10000)},${pose.seed}`;
          const previous = entries.get(key);
          if (previous) {
            const weight = previous.weight+pose.alpha;
            previous.x = (previous.x*previous.weight+pose.x*pose.alpha)/weight;
            previous.y = (previous.y*previous.weight+pose.y*pose.alpha)/weight;
            previous.weight = weight;
            previous.alpha = 1-(1-previous.alpha)*(1-pose.alpha);
          } else entries.set(key,{...pose,weight:pose.alpha});
        }
      }
      if (entries) for (const pose of entries.values()) paint(pose,pose.seed);
      ctx.globalAlpha = 1;
      if (this.drawnGlyphs) this.bounds = { left,top,right,bottom };
    }

    renderCurrent() {
      if (this.disposed) return;
      try {
        if (this.mode === 'poster') {
          if (this.poster.complete && this.poster.naturalWidth) this.paintGlyphs(this.sampleGlyphs(this.poster,true),false,true);
          else this.clear();
        } else if (this.phase === 'exploding') {
          this.paintGlyphs(this.particles,true);
        } else if (this.phase === 'swimming' && this.hasDecodedFrame) {
          if (this.glyphCacheRevision !== this.poseRevision || this.glyphCacheLayout !== this.layoutRevision) {
            this.glyphCache = this.sampleGlyphs(this.decodedCanvas);
            this.glyphCacheRevision = this.poseRevision; this.glyphCacheLayout = this.layoutRevision;
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
        if (!this.disposed && this.wantsPlayback && this.phase === 'swimming') this.finishSwimming();
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

    // A paused seek must finish before any assembly begins. seeked establishes
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
          if (!valid()) { finish(false); return; }
          if (video.seeking || video.readyState < 2) return;
          if (this.frameAt(timestamp) !== this.frameAt(target)) return;
          video.pause();
          if (this.acceptFrame(target)) finish(true);
        };
        const paintedFallback = () => {
          if (done || !valid()) return;
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

    async loadOpening() {
      const generation = this.generation;
      this.phase = 'loading';
      this.clear();
      const ready = await this.decodeHeldFrame(0);
      if (generation !== this.generation || !this.wantsPlayback || this.disposed) return false;
      if (!ready) { this.fail(); return false; }
      return this.startSwimming();
    }

    beginTransition(phase) {
      this.video.pause(); this.cancelDecode();
      this.captureParticles();
      if (phase === 'exploding') {
        this.copyFrame(this.decodedCanvas,this.outgoingFrameCanvas);
        for (const p of this.particles) {
          const end = this.burstEndpoint(p.targetX,p.targetY,p.dx,p.dy,p.seed);
          p.burstStartX = p.targetX; p.burstStartY = p.targetY;
          p.burstEndX = end.x; p.burstEndY = end.y; p.burstSegmentStart = 0;
          p.currentOpacity = p.opacity; p.segmentSeed = p.seed;
        }
      }
      this.phase = phase;
      this.transitionElapsed = this.transitionProgress = 0;
      this.lastClock = null;
      this.state = 'playing'; this.mode = 'video';
      this.renderCurrent(); this.schedule();
    }

    copyFrame(source,destination) {
      destination.width = source.width; destination.height = source.height;
      destination.getContext('2d').drawImage(source,0,0);
    }

    finishBurst() {
      // Do not seek until every outgoing digit has faded. The next frame-zero
      // fish is decoded while the canvas is intentionally blank.
      this.passCount++;
      this.particles = []; this.particleCount = 0;
      this.loadOpening();
    }

    async startSwimming() {
      const generation = this.generation, video = this.video;
      this.handoffFrame = null; this.handoffGlyphs = null;
      this.phase = 'swimming'; this.state = 'playing';
      video.playbackRate = this.swimRate();
      this.scheduleDecode();
      try {
        await video.play();
        if (generation !== this.generation || !this.wantsPlayback || this.disposed) {
          if (!this.wantsPlayback || this.disposed) video.pause();
          return false;
        }
        this.scheduleDecode(); this.schedule();
        return true;
      } catch (_) {
        if (generation === this.generation && this.wantsPlayback && !this.disposed) this.fail();
        return false;
      }
    }

    async finishSwimming() {
      const generation = this.generation;
      this.video.pause(); this.cancelDecode();
      const last = (data.frameCount-1)/data.fps;
      // A final RVFC can lag the ended event. Seek and snapshot the actual last
      // source frame when needed, never an arbitrary penultimate pose.
      if (this.frameAt(this.decodedTime) !== data.frameCount-1) {
        const ready = await this.decodeHeldFrame(last);
        if (generation !== this.generation || !this.wantsPlayback || this.disposed) return;
        if (!ready) { this.fail(); return; }
      }
      this.beginTransition('exploding');
    }

    async play() {
      if (this.disposed) return false;
      if (location.protocol === 'file:') { this.showPoster(); return false; }
      if (this.wantsPlayback) return true;
      this.wantsPlayback = true; this.generation++;
      if (!this.video) this.createVideo();
      this.mode = 'video'; this.state = 'playing'; this.lastClock = null;
      if (this.phase === 'exploding') {
        this.schedule(); return true;
      }
      if (this.phase === 'swimming') {
        if (this.video.ended) { this.finishSwimming(); this.schedule(); return true; }
        return this.startSwimming();
      }
      return this.loadOpening();
    }

    schedule() {
      if (!this.wantsPlayback || this.disposed || this.callback !== null || this.state !== 'playing') return;
      this.callback = requestAnimationFrame(now => {
        this.callback = null;
        if (!this.wantsPlayback || this.disposed) return;
        if (document.hidden) { this.pause(); return; }
        const dt = this.lastClock === null ? 0 : Math.max(0,(now-this.lastClock)/1000);
        this.lastClock = now; this.bitTime += dt;
        if (this.phase === 'exploding') {
          this.transitionElapsed = Math.min(this.transitionDuration(),this.transitionElapsed+dt);
          this.transitionProgress = this.transitionElapsed/this.transitionDuration();
          this.renderCurrent();
          if (this.transitionProgress >= 1) this.finishBurst();
        } else if (this.phase === 'swimming') {
          if (!this.video.requestVideoFrameCallback && !this.video.seeking && !this.video.paused) {
            this.acceptFrame(this.video.currentTime);
          }
          this.renderCurrent();
        }
        this.schedule();
      });
    }

    stopFrame() {
      if (this.callback !== null) cancelAnimationFrame(this.callback);
      this.callback = this.lastClock = null;
      this.cancelDecode();
    }

    pause() {
      this.wantsPlayback = false; this.generation++;
      if (this.video) this.video.pause();
      if (this.cancelSeek) this.cancelSeek();
      this.openingSeekPending = false;
      this.stopFrame();
      if (!this.disposed && this.state !== 'poster' && this.state !== 'error') this.state = 'paused';
    }

    showPoster() {
      if (this.disposed) return;
      this.pause(); this.mode = this.state = this.phase = 'poster';
      this.renderCurrent();
    }

    fail() {
      if (this.disposed) return;
      this.showPoster(); this.state = 'error';
    }

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
      this.openingCanvas.width = this.openingCanvas.height = 0;
      this.outgoingFrameCanvas.width = this.outgoingFrameCanvas.height = 0;
      this.particles = []; this.particleCount = 0;
      this.openingGlyphs = []; this.handoffGlyphs = null;
      this.glyphCache = null;
      this.clear(); this.state = 'disposed';
    }
  }
  window.BinaryFish = BinaryFish;
})();
