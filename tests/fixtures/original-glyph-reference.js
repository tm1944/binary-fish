// Frozen sampler and painter from the original video renderer.
// Updated once, alongside fish.js, for the two-tone marking render: cells
// brighter than stripeLuma sample as stripe glyphs and paint in stripeColor.
// This reference intentionally retains the old code for rendering parity tests.
(() => {
const data = window.BinaryFishData;
window.OriginalGlyphReference = class {
    stripeThreshold() {
      const v = Number(this.options.stripeLuma);
      return Number.isFinite(v) ? Math.max(0, Math.min(255, v)) : 155;
    }

    clear() {
      this.context.globalAlpha = 1;
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawnGlyphs = 0;
      this.visibleGlyphs = 0;
      this.bounds = { left: this.width / 2, top: this.height / 2,
        right: this.width / 2, bottom: this.height / 2 };
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

    paintGlyphs(glyphs, particles = false, poster = false) {
      this.clear();
      const l = this.layout(poster), ctx = this.context;
      ctx.font = `500 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      const connected = particles;
      const entries = connected ? new Map() : null;
      const paint = (pose,seed) => {
        if (pose.alpha < (connected?.0001:.04)) return;
        ctx.fillStyle = pose.stripe ? this.options.stripeColor : this.options.color;
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
        const pose = particles ? this.particlePose(p) : { x:p.targetX,y:p.targetY,alpha:p.opacity,seed:p.seed,stripe:p.stripe };
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

};
})();
