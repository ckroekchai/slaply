import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLogoBackdrop, resolveLogoBackdrop, inspectLogoPixels, LOGO_BACKDROPS } from '../src/logo-backdrop.js';
import { buildBrandBoardScene } from '../src/brand-board-scene.js';
import { normalizeCustomization, DEFAULT_BOARD_CUSTOMIZATION } from '../src/brand-guideline-model.js';

test('transparent cream and white logo pixels choose a dark backdrop, while dark pixels choose light',()=>{
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([248,239,214,255,255,255,255,0])),'dark');
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([255,255,255,120,255,255,255,0])),'dark');
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([23,26,36,255,0,0,0,0])),'light');
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([0,0,0,96,255,255,255,0])),'light');
});
test('invisible background RGB cannot outweigh the visible logo and no pixels are edited',()=>{
  const pixels=new Uint8ClampedArray(4004);for(let i=0;i<4000;i+=4)pixels.set([0,0,0,0],i);pixels.set([255,244,210,255],4000);
  const before=pixels.slice();assert.equal(chooseLogoBackdrop(pixels),'dark');assert.deepEqual(pixels,before);
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([255,255,255,0])),'light');
});
test('auto scene uses the shared pixel decision, while explicit overrides remain authoritative',()=>{
  const recipe={schemaVersion:6,name:'Brand',logo:{src:'/api/assets/logo',width:100,height:100},customization:{...DEFAULT_BOARD_CUSTOMIZATION}};
  assert.equal(normalizeCustomization(recipe.customization).logoBackdrop,'auto');
  for(const boardVariant of ['ai','minimal','professional','creative']){
    const automatic=buildBrandBoardScene({...recipe,customization:{...recipe.customization,boardVariant}}, {}, {logoBackdrop:'dark'});
    const explicit=buildBrandBoardScene({...recipe,customization:{...recipe.customization,boardVariant,logoBackdrop:'light'}}, {}, {logoBackdrop:'dark'});
    for(const [scene,color] of [[automatic,LOGO_BACKDROPS.dark],[explicit,LOGO_BACKDROPS.light]])for(const node of scene.nodes.filter(n=>n.sourceRole==='logo')){
      assert.equal(node.assetRef,recipe.logo.src);assert.equal(node.adjustment,undefined);assert.equal(node.fit,'contain');
      const r=node.bounds,behind=scene.nodes.slice(0,scene.nodes.indexOf(node)).filter(n=>n.type==='rect'&&n.bounds.x<=r.x&&n.bounds.y<=r.y&&n.bounds.x+n.bounds.w>=r.x+r.w&&n.bounds.y+n.bounds.h>=r.y+r.h).at(-1);
      assert.equal(behind?.fill,color,`${boardVariant}: actual backdrop behind ${node.id} honors source contrast`);
    }
  }
});
test('browser pixel analysis is bounded and cached while preserving the requested source and aspect ratio',async()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document,draws=[];let loads=0;
  class Image {naturalWidth=2000;naturalHeight=1000;set src(value){this.source=value;loads++;queueMicrotask(()=>this.onload());}}
  globalThis.window={Image};
  globalThis.document={createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(type,options){assert.equal(options.colorSpace,'srgb');return {drawImage(image,x,y,w,h){draws.push({source:image.source,x,y,w,h})},getImageData(){return {data:new Uint8ClampedArray([255,240,220,255,0,0,0,0])}}}}}}};
  try{
    const source='/api/assets/unique-logo-backdrop-test';const first=resolveLogoBackdrop(source),second=resolveLogoBackdrop(source);assert.equal(first,second);assert.equal(await first,'dark');assert.equal(loads,1);
    assert.deepEqual(draws,[{source,x:0,y:0,w:256,h:128}]);
  }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('opaque logos match their existing border background rather than invert the whole canvas',()=>{
  const image=(border,inside)=>{const data=new Uint8ClampedArray(20*20*4);for(let y=0;y<20;y++)for(let x=0;x<20;x++)data.set([...(x===0||y===0||x===19||y===19?border:inside),255],(y*20+x)*4);return data;};
  // The opposite-colored interior dominates the image area; only the edge
  // indicates which already-present canvas should meet the board backdrop.
  assert.equal(chooseLogoBackdrop(image([255,255,255],[0,0,0]),{width:20,height:20}),'light');
  assert.equal(chooseLogoBackdrop(image([0,0,0],[255,255,255]),{width:20,height:20}),'dark');
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([255,255,255,255])),'light');
  assert.equal(chooseLogoBackdrop(new Uint8ClampedArray([0,0,0,255])),'dark');
  const nearOpaque=image([255,255,255],[0,0,0]);nearOpaque[3]=0;assert.equal(chooseLogoBackdrop(nearOpaque,{width:20,height:20}),'light');
});

test('a pale opaque mark gets a nonblocking quality hint while transparent and crisp originals stay quiet',()=>{
  const width=80,height=80,paint=(mark,alpha=255)=>{const pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const shade=252+(x+y)%4;pixels.set([shade,shade,shade,alpha],(y*width+x)*4);}for(let y=34;y<46;y++)for(let x=25;x<55;x++)pixels.set([...mark,255],(y*width+x)*4);return pixels;};
  const pale=paint([214,223,240]),before=pale.slice(),hint=inspectLogoPixels(pale,{width,height});
  assert.equal(hint.backdrop,'light');assert.equal(hint.lowContrast,true);assert.match(hint.warning,/พื้นโปร่งใส/);assert.deepEqual(pale,before);
  const crisp=inspectLogoPixels(paint([10,10,10]),{width,height});assert.equal(crisp.lowContrast,false);assert.equal(crisp.warning,null);
  const transparent=inspectLogoPixels(paint([255,242,216],0),{width,height});assert.equal(transparent.backdrop,'dark');assert.equal(transparent.warning,null);
});
test('JPEG-like near-white background noise cannot hide a small high-contrast mark',()=>{
  const width=80,height=80,pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<pixels.length;i+=4){const shade=248+(i/4)%8;pixels.set([shade,shade,shade,255],i);}
  for(let y=38;y<42;y++)for(let x=38;x<42;x++)pixels.set([0,0,0,255],(y*width+x)*4);
  assert.equal(inspectLogoPixels(pixels,{width,height}).warning,null);
});
