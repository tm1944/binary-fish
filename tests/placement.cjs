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
assert.equal(data.portalSeconds,1.2);
assert.equal(data.portalFeather,.15);
assert.equal(data.scenes.length,1);
assert.equal(data.transitions.length,0);
const fish = new scope.window.BinaryFish(canvas);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
for(const rate of [.5,1.15,2]){
  fish.options.swimmingSpeed=rate;
  const transition=1.2*rate;
  const last=(data.frameCount-1)/data.fps;
  for(let time=transition;time<last-transition;time+=.1){
    assert.equal(fish.sceneAt(time),0);
    const state=fish.portalAt(time);
    for(const anatomy of [0,.25,.5,.75,1])near(fish.portalOpacity(anatomy,state),1);
  }
  for(const anatomy of [0,.25,.5,.75,1]){
    near(fish.portalOpacity(anatomy,fish.portalAt(0)),0);
    near(fish.portalOpacity(anatomy,fish.portalAt(last)),0);
    near(fish.portalOpacity(anatomy,fish.portalAt(data.duration)),0);
  }
  const incoming=fish.portalAt(transition/2);
  assert.ok(fish.portalOpacity(.1,incoming)>.9,'Head must emerge first');
  assert.ok(fish.portalOpacity(.9,incoming)<.1,'Trailing fins must remain hidden');
  const outgoing=fish.portalAt(last-transition/2);
  assert.ok(fish.portalOpacity(.1,outgoing)<.1,'Head must disappear first');
  assert.ok(fish.portalOpacity(.9,outgoing)>.9,'Trailing fins must leave last');
  assert.ok(fish.portalOpacity(.5,incoming)>0&&fish.portalOpacity(.5,incoming)<1,'Boundary must be soft');
}
fish.options.swimmingSpeed=1.15;
for(const [width,height]of [[1440,900],[2560,1440],[768,1024],[390,844],[320,568],[844,390]]){
  fish.resize(width,height,2);
  assert.equal(fish.fontSize,6);
  near(fish.targetFish,Math.min(1280,width*.90));
  for(const s of data.scenes){
    const [x0,y0,x1,y1]=s.bounds;
    assert.ok(x0>=0&&y0>=0&&x1<=data.width&&y1<=data.height&&x1>x0&&y1>y0);
    fish.draw({width:data.packedWidth,height:data.height},0,(s.start+s.end)/2);
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
console.log('Passed full clownfish selection, spatial portal ordering at three rates, stable framing, and six viewport layouts.');
