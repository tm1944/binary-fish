// Renderer math independent of media decoding. Browser checks exercise video.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/source.json')));
const context = {setTransform(){},clearRect(){},drawImage(){},fillText(){},
  getImageData(){return {data:new Uint8ClampedArray(400000)};}};
const canvas = {clientWidth:1440,clientHeight:900,width:0,height:0,getContext:()=>context};
const scope = {window:{BinaryFishData:data,devicePixelRatio:1},
  document:{currentScript:null,createElement:()=>({width:0,height:0,getContext:()=>context})},
  location:{href:'http://localhost/'},URL,Image:class{},clearTimeout,setTimeout,
  cancelAnimationFrame(){},requestAnimationFrame(){return 0;}};
vm.runInNewContext(fs.readFileSync(path.join(root,'fish.js'),'utf8'),scope);
assert.equal(data.frameCount,335);
assert.equal(data.fps,24000/1001);
assert.ok(Math.abs(data.duration-335/(24000/1001))<1e-5);
assert.equal(data.sourceFrameStart,0);
assert.equal(data.sourceFrameEndInclusive,334);
assert.equal(data.packedChannels,3);
assert.equal(data.packedWidth,data.width*3);
assert.equal(data.scenes.length,1);
assert.equal(data.transitions.length,0);

const fish = new scope.window.BinaryFish(canvas);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
for(const rate of [.5,1.15,2]){
  fish.options.swimmingSpeed=rate;
  near(fish.transitionDuration(),1);
}
fish.options.transitionDuration=1.5; near(fish.transitionDuration(),1.5);
fish.options.transitionDuration=1;
assert.equal(Object.hasOwn(fish.options,'horizontalOffsetRatio'),false);
assert.equal(Object.hasOwn(fish.options,'entranceDuration'),false);

const particle={targetX:100,targetY:80,opacity:.8,id:1,seed:77,currentOpacity:.8,
  segmentSeed:77,burstStartX:100,burstStartY:80,burstEndX:140,burstEndY:110,
  fadeStart:.6,fadeEnd:.98};
const start=fish.particlePose(particle,0,'exploding');
const half=fish.particlePose(particle,.5,'exploding');
const late=fish.particlePose(particle,.8,'exploding');
const end=fish.particlePose(particle,1,'exploding');
near(start.x,100); near(start.y,80); near(start.alpha,.8);
near(end.x,140); near(end.y,110); near(end.alpha,0);
assert.ok(half.x-start.x > end.x-half.x,'Particles decelerate during the burst');
near(half.alpha,.8); assert.ok(late.alpha>0 && late.alpha<.8);

for(const [width,height] of [[1440,900],[2560,1440],[768,1024],[390,844],[320,568],[844,390]]){
  fish.resize(width,height,2);
  assert.equal(fish.fontSize,6);
  near(fish.targetFish,Math.min(1280,width*.90));
  const layout=fish.layout();
  const [x0,y0,x1,y1]=data.scenes[0].bounds;
  const [firstLeft]=data.frameBounds[0];
  const scale=Math.min(fish.targetFish/layout.srcW,height*.80/layout.srcH);
  near(layout.scale,scale);
  near(layout.originX+firstLeft*layout.scale,width+24);
  assert.ok(layout.originY>=0);
  assert.ok(layout.originY+layout.srcH*layout.scale<=height+1e-8);
  fish.phase='swimming'; const swimming=fish.layout();
  fish.phase='exploding'; const exploding=fish.layout();
  near(swimming.originX,exploding.originX);
  near(swimming.originY,exploding.originY);
  assert.ok(x0>=0&&y0>=0&&x1<=data.width&&y1<=data.height&&x1>x0&&y1>y0);
}
fish.dispose();
assert.equal(fish.state,'disposed');
console.log('Passed source selection, independent timing, fading burst, and static natural first-frame anchor at six viewport sizes.');
