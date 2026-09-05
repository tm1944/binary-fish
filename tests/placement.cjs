const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const data = JSON.parse(fs.readFileSync(path.join(root,'assets/source.json')));
const context = {setTransform(){},clearRect(){},drawImage(){},fillText(){}};
const canvas = {clientWidth:1440,clientHeight:900,getContext:()=>context};
const scope = {window:{BinaryFishData:data,devicePixelRatio:1},
  document:{currentScript:null,createElement:()=>({getContext:()=>context})},
  location:{href:'http://localhost/'},URL,Image:class{},clearTimeout,setTimeout,
  performance:{now:()=>0},cancelAnimationFrame(){},requestAnimationFrame(){return 0;}};
vm.runInNewContext(fs.readFileSync(path.join(root,'fish.js'),'utf8'),scope);
const fish = new scope.window.BinaryFish(canvas);
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
assert.equal(fish.swimRate(),1.15);
assert.equal(data.frameCount,335);
assert.equal(fish.stripeThreshold(),155);
const span = [[1440,900],[2560,1440],[768,1024],[390,844],[320,568],[844,390]];
let frames=0;
// The fish plays the recording 1:1: layout must map each recorded center to
// the fixed stage, with uniform scale preserving every pairwise displacement.
for(const [width,height] of span){
  fish.resize(width,height,3);
  assert.equal(fish.fontSize,6);assert.equal(fish.pixelRatio,2);
  const scale=fish.scale;
  fish.mode='video';fish.effect=null;
  for(let frame=0;frame<data.frameCount;frame+=7){
    fish.decodedTime=fish.mediaTime=frame/data.fps;
    const l=fish.layout();
    near(l.scale,scale);
    for(const value of Object.values(l))assert.ok(Number.isFinite(value));
    const b=data.frameBounds[frame];
    const anchor={x:(b[0]+b[2])/2,y:(b[1]+b[3])/2};
    const recorded=fish.recordedCenter(frame/data.fps);
    near(recorded.x,anchor.x);near(recorded.y,anchor.y);
    const stage=fish.stagePoint();
    near(l.originX+(anchor.x-l.x0)*l.scale,stage.x);
    near(l.originY+(anchor.y-l.y0)*l.scale,stage.y);
    const x=x=>l.originX+(x-l.x0)*l.scale,y=y=>l.originY+(y-l.y0)*l.scale;
    near(x(b[2])-x(b[0]),(b[2]-b[0])*scale);
    near(y(b[3])-y(b[1]),(b[3]-b[1])*scale);
    frames++;
  }
  // Fractional clocks interpolate the recorded center continuously.
  for(let frame=1;frame<334;frame+=11){
    const a=fish.recordedCenter(frame/data.fps),b=fish.recordedCenter((frame+.0001)/data.fps);
    assert.ok(Math.abs(a.x-b.x)<.05&&Math.abs(a.y-b.y)<.05);
  }
  // Burst/form endpoints are exact: p=0/1 restores the pose, p=1/0 hides it.
  fish.decodedTime=fish.mediaTime=200/data.fps;
  const b=data.frameBounds[200];
  const glyphs=[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]],[(b[0]+b[2])/2,(b[1]+b[3])/2]]
    .map(([targetX,targetY])=>({targetX,targetY,opacity:.8,seed:42}));
  fish.effect=null;fish.paintGlyphs(glyphs);
  const base=JSON.stringify(fish.bounds);
  assert.ok(fish.visibleGlyphs>0,`Swimming pose is visible at ${width}x${height}`);
  fish.effect={kind:'burst',p:0,cx:200,cy:150};fish.paintGlyphs(glyphs);
  assert.equal(JSON.stringify(fish.bounds),base,'Burst starts exactly on the pose');
  fish.effect={kind:'burst',p:.5,cx:200,cy:150};fish.paintGlyphs(glyphs);
  const mid=JSON.stringify(fish.bounds);
  fish.paintGlyphs(glyphs);
  assert.equal(JSON.stringify(fish.bounds),mid,'Burst is deterministic per seed');
  assert.ok((fish.bounds.right-fish.bounds.left)>0,'Burst spreads while fading');
  fish.effect={kind:'burst',p:1,cx:200,cy:150};fish.paintGlyphs(glyphs);
  assert.equal(fish.visibleGlyphs,0,`Explosion clears fully at ${width}x${height}`);
  fish.effect={kind:'form',p:0,cx:200,cy:150};fish.paintGlyphs(glyphs);
  assert.equal(fish.visibleGlyphs,0,'Formation starts invisible');
  fish.effect={kind:'form',p:1,cx:200,cy:150};fish.paintGlyphs(glyphs);
  assert.equal(JSON.stringify(fish.bounds),base,'Formation lands exactly on the pose');
  assert.ok(fish.visibleGlyphs>0,`Reconstructed pose is visible at ${width}x${height}`);
  fish.effect=null;
  // Guards: explosion only fires while swimming; formation needs staged glyphs.
  fish.phase='poster';
  fish.beginExplode();
  assert.equal(fish.phase,'poster','beginExplode ignores non-swimming phases');
  fish.phase='swimming';fish.glyphCache=glyphs;
  fish.beginExplode();
  assert.equal(fish.phase,'exploding');
  assert.equal(fish.burstGlyphs.length,glyphs.length);
  assert.deepEqual(JSON.parse(JSON.stringify(fish.effect.kind)),'burst');
  assert.equal(fish.startForm(),false,'startForm refuses without staged glyphs');
  assert.equal(fish.phase,'exploding');
  fish.openGlyphs=glyphs;
  assert.equal(fish.startForm(),true);
  assert.equal(fish.phase,'forming');
  assert.equal(fish.passCount,1);
  fish.passCount=0;fish.effect=null;fish.burstGlyphs=fish.openGlyphs=null;
  // The effect never affects the poster still.
  fish.mode='poster';fish.phase='poster';
  fish.effect={kind:'burst',p:.5,cx:0,cy:0};
  const l=fish.layout(true),pb=data.posterFishBounds;
  assert.ok(l.originX+(pb[2]-l.x0)*l.scale>0);
  assert.ok(l.originX+(pb[0]-l.x0)*l.scale<width);
  fish.paintGlyphs(glyphs.map(g=>({...g})),true);
  assert.ok(fish.visibleGlyphs>0,'Poster paints through an armed effect');
  fish.effect=null;
}
// Stripe classification honors its option and clamps.
assert.equal(new scope.window.BinaryFish(canvas,{stripeLuma:200}).stripeThreshold(),200);
assert.equal(new scope.window.BinaryFish(canvas,{stripeLuma:9999}).stripeThreshold(),255);
assert.equal(new scope.window.BinaryFish(canvas,{stripeLuma:'nope'}).stripeThreshold(),155);
// Pause freezes the fx clock; phases only advance through their driver.
fish.resize(1440,900);
fish.mode='video';fish.phase='exploding';fish.state='playing';fish.fxClock=3;
fish.pause();
assert.equal(fish.state,'paused');
assert.equal(fish.fxClock,3);
fish.dispose();fish.dispose();fish.resize(10,10);fish.showPoster();
assert.equal(fish.state,'disposed');
assert.equal(Object.hasOwn(fish,'model'),false);
console.log(`Passed ${frames} recorded-pose placements across six viewports, burst/form endpoints and guards, stripe options, poster placement, and cleanup.`);
