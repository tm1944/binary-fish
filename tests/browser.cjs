// With Playwright/Chromium installed, start the local server and run this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = process.env.CHECK_OUTPUT || '/tmp/original-fish-check';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[],errors=[],parity=[];
 try {
  const context=await browser.newContext({deviceScaleFactor:2});
   await context.addInitScript(()=>{
    let Constructor;window.restartChecks=[];
    Object.defineProperty(window,'BinaryFish',{configurable:true,get:()=>Constructor,set:Value=>{
     Constructor=class extends Value {
      constructor(...args){super(...args);window.testFish=this;}
      // Each reformation starts a fresh loop with the burst fully gone:
      // the last painted frame holds zero visible glyphs at this point.
      // The initial formation (from the poster) is not a restart.
      startForm(...args){
       const reformed=this.phase==='exploding';
       const formed=super.startForm(...args);
       if(formed&&reformed)window.restartChecks.push({pass:this.passCount,visible:this.visibleGlyphs});
       return formed;
      }
     };
    }});
   });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[1440,900],[2560,1440],[768,1024],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.goto(url);
   await page.waitForFunction(()=>testFish.phase==='swimming'&&testFish.visibleGlyphs>0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.evaluate(()=>testFish.video.playbackRate),1.15);
   assert.equal(await page.locator('h1').count(),1);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');
   await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
   const perf=await page.evaluate(()=>new Promise(resolve=>{
    let previous;const intervals=[];
    function tick(now){if(previous!==undefined)intervals.push(now-previous);previous=now;
     if(intervals.length<100)return requestAnimationFrame(tick);
     resolve({fps:Math.round(100000/intervals.reduce((a,b)=>a+b,0)),renderMs:+testFish.frameCost.toFixed(2),visibleGlyphs:testFish.visibleGlyphs});
    }requestAnimationFrame(tick);
   }));
   assert.ok(perf.fps>=30,`At least 30 fps at ${width}x${height}`);results.push({width,height,...perf});
   await page.evaluate(()=>{testFish.pause();window.scrollTo({top:0,behavior:'instant'});});
   await page.screenshot({path:path.join(output,`page-${width}x${height}.png`),fullPage:true});
   const pos=await page.evaluate(()=>({...testFish.position}));
   await page.locator('#contact').scrollIntoViewIfNeeded();
   assert.deepEqual(await page.evaluate(()=>({...testFish.position})),pos);
   assert.equal(await page.locator('#fish').evaluate(c=>getComputedStyle(c).pointerEvents),'none');
  }
  // Compare source samples and actual canvas pixels with the frozen old renderer.
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  await page.waitForFunction(()=>testFish.hasDecodedFrame);
  await page.addScriptTag({path:path.join(__dirname,'fixtures/original-glyph-reference.js')});
  for(const frame of [0,60,140,210,298,334]){
   const comparison=await page.evaluate(async frame=>{
     const f=testFish;f.pause();f.wantsPlayback=true;f.generation++;f.phase='inspection';
     if(!await f.decodeHeldFrame(frame/BinaryFishData.fps))throw Error('Frame decode failed');
     f.wantsPlayback=false;f.phase='paused';f.mode='video';f.bitTime=2.125;f.effect=null;
    const reference=new OriginalGlyphReference(),canvas=document.createElement('canvas');
    canvas.width=f.canvas.width;canvas.height=f.canvas.height;// Inherit the same font-synthesis and smoothing CSS as the visible canvas.
    canvas.style.display='none';document.body.append(canvas);
    const fine=document.createElement('canvas');
    Object.assign(reference,{width:f.width,height:f.height,options:f.options,fontSize:f.fontSize,
     cellWidth:f.cellWidth,cellHeight:f.cellHeight,bitTime:f.bitTime,
     fineCanvas:fine,fineContext:fine.getContext('2d',{willReadFrequently:true}),context:canvas.getContext('2d'),
     layout:()=>({...f.layout(),originX:80,originY:80})});
    reference.context.setTransform(f.pixelRatio,0,0,f.pixelRatio,0,0);
     const originalLayout=f.layout.bind(f);
     // Pin the sampled origin so both painters draw at the same place. The
     // particle effect is nulled above, so paint transforms match as well.
     f.layout=()=>({...originalLayout(),originX:80,originY:80});
    const actual=f.sampleGlyphs(f.decodedCanvas),expected=reference.sampleGlyphs(f.decodedCanvas);
    const samplesMatch=JSON.stringify(actual)===JSON.stringify(expected);
    f.paintGlyphs(actual);reference.paintGlyphs(expected);
    const a=f.context.getImageData(0,0,canvas.width,canvas.height).data;
    const b=reference.context.getImageData(0,0,canvas.width,canvas.height).data;
    let differentBytes=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])differentBytes++;
    canvas.remove();f.layout=originalLayout;f.renderCurrent();
    return {frame,samplesMatch,differentBytes,glyphs:actual.length};
   },frame);
   assert.equal(comparison.samplesMatch,true);assert.equal(comparison.differentBytes,0);parity.push(comparison);
  }
   // Observe three actual explode/reconstruct loops at normal speed and
   // validate every reformation starts from a fully exploded canvas.
   await page.goto(url);
   await page.waitForFunction(()=>testFish.passCount>=3&&window.restartChecks.length>=3,null,{timeout:75000});
   const restarts=await page.evaluate(()=>window.restartChecks);
   assert.ok(restarts.length>=3);assert.ok(restarts.every(r=>r.visible===0));
  assert.equal(await page.evaluate(()=>testFish.state),'playing');
  await page.locator('#motion-toggle').click();assert.equal(await page.evaluate(()=>testFish.state),'paused');
  const paused=await page.evaluate(()=>({time:testFish.video.currentTime,bits:testFish.bitTime,pixels:testFish.canvas.toDataURL()}));
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>({time:testFish.video.currentTime,bits:testFish.bitTime,pixels:testFish.canvas.toDataURL()})),paused);
  await page.locator('#motion-toggle').click();await page.waitForFunction(()=>testFish.state==='playing');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>testFish.state==='poster'&&testFish.visibleGlyphs>0);
  assert.equal(await page.locator('#motion-toggle').isDisabled(),true);
  const poster=await page.locator('#fish').evaluate(c=>c.toDataURL());await page.waitForTimeout(100);
  assert.equal(await page.locator('#fish').evaluate(c=>c.toDataURL()),poster);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>testFish.phase==='swimming');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>testFish.state),'paused');
  const media=await page.evaluate(()=>testFish.video.currentTime);await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>testFish.video.currentTime),media);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>testFish.state==='playing');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.evaluate(()=>testFish.state),'paused');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>testFish.state==='playing');
  for(const href of await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href'))))assert.equal(await page.locator(href).count(),1);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
  assert.equal(await page.evaluate(()=>testFish.state),'disposed');
  await page.goto('file://'+path.resolve(__dirname,'../index.html'));
  await page.waitForFunction(()=>testFish.state==='poster'&&testFish.visibleGlyphs>0);
  await page.route('**/*.mp4',route=>route.abort());await page.goto(url);
  await page.waitForFunction(()=>testFish.state==='error'&&testFish.visibleGlyphs>0);
  assert.equal(await page.locator('#projects').isVisible(),true);
  await page.unroute('**/*.mp4');
  // Decoder fallback for browsers without requestVideoFrameCallback.
  await context.addInitScript(()=>{HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;});
  await page.goto(url);await page.waitForFunction(()=>testFish.phase==='swimming'&&testFish.visibleGlyphs>0);
  const first=await page.evaluate(()=>testFish.decodedTime);await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>testFish.decodedTime)>first);
  const noJS=await browser.newContext({javaScriptEnabled:false});const staticPage=await noJS.newPage();await staticPage.goto(url);
  assert.equal(await staticPage.locator('#projects').isVisible(),true);assert.equal(await staticPage.locator('#motion-toggle').isHidden(),true);await noJS.close();
  const fallback=await browser.newContext();await fallback.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  const fallbackPage=await fallback.newPage();await fallbackPage.goto(url);
  assert.equal(await fallbackPage.locator('#fish').isHidden(),true);assert.equal(await fallbackPage.locator('#motion-toggle').isHidden(),true);await fallback.close();
  assert.deepEqual(errors,[]);
  const report={results,parity,restarts,errors};fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
   console.log('Passed two-tone parity, three live explode/reconstruct loops, responsive layout, motion controls, lifecycle events, original poster fallbacks, and decoder fallback.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
