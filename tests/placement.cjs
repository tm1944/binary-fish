// Real renderer math; browser checks additionally exercise decoded media.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/source.json')));
const context = {setTransform(){},clearRect(){},drawImage(){},
  getImageData(){return {data:new Uint8ClampedArray(400000)};}};
const canvas = {clientWidth:1440,clientHeight:900,getContext:()=>context};
const scope = {window:{BinaryFishData:data,devicePixelRatio:1},
  document:{currentScript:null,createElement:()=>({getContext:()=>context})},
  location:{href:'http://localhost/'},URL,Image:class{},clearTimeout,cancelAnimationFrame(){}};
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
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
for(const rate of [.5,1.15,2]){
  fish.options.swimmingSpeed=rate;
  near(fish.transitionDuration(),1);
}
fish.options.transitionDuration=1.5;
near(fish.transitionDuration(),1.5);
fish.options.transitionDuration=1;
const particle={targetX:100,targetY:80,dx:40,dy:30,opacity:.8,
  entryDelay:.02,entryEnd:.2,fadeStart:.6,fadeEnd:.98};
const explodeStart=fish.particlePose(particle,0,'exploding');
const explodeEnd=fish.particlePose(particle,1,'exploding');
near(explodeStart.x,100);near(explodeStart.y,80);near(explodeStart.alpha,.8);
near(explodeEnd.x,140);near(explodeEnd.y,110);near(explodeEnd.alpha,0);
const assembleStart=fish.particlePose(particle,0,'assembling');
const assembleEnd=fish.particlePose(particle,1,'assembling');
near(assembleStart.x,140);near(assembleStart.y,110);near(assembleStart.alpha,0);
near(assembleEnd.x,100);near(assembleEnd.y,80);near(assembleEnd.alpha,.8);
const quarter=fish.particlePose(particle,.25,'exploding');
const half=fish.particlePose(particle,.5,'exploding');
assert.ok(quarter.x-explodeStart.x>half.x-quarter.x,'Particles must decelerate');
near(half.alpha,.8); // Dispersion precedes the late transparency change.
assert.ok(fish.particlePose(particle,.8,'exploding').alpha<.8);
fish.options.swimmingSpeed=1.15;
for(const [width,height]of [[1440,900],[2560,1440],[768,1024],[390,844],[320,568],[844,390]]){
  fish.resize(width,height,2);
  assert.equal(fish.fontSize,6);
  near(fish.targetFish,Math.min(1280,width*.90));
  for(const s of data.scenes){
    const [x0,y0,x1,y1]=s.bounds;
    assert.ok(x0>=0&&y0>=0&&x1<=data.width&&y1<=data.height&&x1>x0&&y1>y0);
    fish.layout();
    assert.ok(fish.position.x>=0&&fish.position.y>=0);
    const [a,b,c,d]=fish.sceneBounds;
    const scale=Math.min(fish.targetFish/(c-a),height*.80/(d-b));
    assert.ok(fish.position.x+(c-a)*scale<=width);
    assert.ok(fish.position.y+(d-b)*scale<=height);
    near(fish.swimmingBounds.right-fish.swimmingBounds.left,(c-a)*scale);
    assert.ok((c-a)*scale<=Math.min(1280,width*.90)+1e-8);
    assert.ok((d-b)*scale<=height*.80+1e-8);
  }
}
fish.dispose();
assert.equal(fish.state,'disposed');
console.log('Passed full clownfish selection, particle endpoints and deceleration, independent duration, and six viewport layouts.');
