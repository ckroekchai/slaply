import test from 'node:test';
import assert from 'node:assert/strict';
import {cutoutLockedPixels} from '../src/locked-cutout.js';
import {prepareLockedIngredients} from '../src/prepare-locked-ingredients.js';

function fixture(w=100,h=100){const p=new Uint8ClampedArray(w*h*4);for(let i=0;i<p.length;i+=4)p.set([255,255,255,255],i);for(let y=30;y<70;y++)for(let x=30;x<70;x++)p.set([245,90,40,255],(y*w+x)*4);return p;}
test('locked flat-background cutout keeps source dimensions, RGB and foreground intact',()=>{
  const pixels=fixture(),copy=new Uint8ClampedArray(pixels),r=cutoutLockedPixels(pixels,100,100);
  assert.equal(r.status,'removed');assert.deepEqual(pixels,copy);assert.equal(r.pixels.length,pixels.length);assert.equal(r.pixels[3],0);
  for(let i=0;i<pixels.length;i+=4)assert.deepEqual([...r.pixels.slice(i,i+3)],[...pixels.slice(i,i+3)]);
  assert.deepEqual([...r.pixels.slice((50*100+50)*4,(50*100+50)*4+4)],[245,90,40,255]);
  assert(r.bounds.w<.5&&r.bounds.h<.5);assert.deepEqual([r.width,r.height],[100,100]);
});
test('transparent originals stay byte-exact with fitted bounds',()=>{const p=fixture();for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(x<30||x>=70||y<30||y>=70)p[(y*100+x)*4+3]=0;const r=cutoutLockedPixels(p,100,100);assert.equal(r.status,'transparent');assert.equal(r.pixels,p);assert(r.bounds.w<.5);});
test('complex edge backgrounds and blank images are retained rather than erased',()=>{const p=fixture();for(let x=0;x<100;x++)p.set([x*2,20,180,255],x*4);assert.equal(cutoutLockedPixels(p,100,100).status,'unchanged');const blank=new Uint8ClampedArray(100*100*4).fill(255);assert.equal(cutoutLockedPixels(blank,100,100).status,'unchanged');});
test('white enclosed foreground and marks touching the image edge are not automatically erased',()=>{const p=fixture();for(let y=40;y<60;y++)for(let x=40;x<60;x++)p.set([255,255,255,255],(y*100+x)*4);const r=cutoutLockedPixels(p,100,100);assert.equal(r.pixels[(50*100+50)*4+3],255);});
test('preparation uploads only locked changed derivatives and leaves original URLs intact',async()=>{const items=[{id:'a',src:'/api/assets/a',name:'Logo.png',locked:true},{id:'b',src:'/api/assets/b',locked:false},null];let uploads=0;const r=await prepareLockedIngredients(items,{prepare:async()=>({status:'removed',width:100,height:100,bounds:{x:.2,y:.2,w:.6,h:.6},blob:new Blob(['png'],{type:'image/png'})}),request:async(path,options)=>{uploads++;assert.equal(path,'/api/uploads');assert.equal(options.headers['Content-Type'],'image/png');return{id:'derived',mime:'image/png',width:100,height:100}}});assert.equal(uploads,1);assert.equal(r[0].cutoutId,'derived');assert.equal(r[0].src,items[0].src);assert.equal(r[0].id,'a');assert.equal(r[1].cutoutId,undefined);assert.equal(items[0].cutoutId,undefined);});
test('stale preparation cannot start an upload',async()=>{let current=true,calls=0;const r=await prepareLockedIngredients([{id:'a',src:'/api/assets/a',locked:true}],{isCurrent:()=>current,prepare:async()=>{current=false;return{status:'removed'}},request:async()=>{calls++}});assert.equal(r,null);assert.equal(calls,0);});
test('existing transparency reuses source without an upload',async()=>{let uploads=0;const r=await prepareLockedIngredients([{id:'a',src:'/api/assets/a',locked:true}],{prepare:async()=>({status:'transparent',bounds:{x:.1,y:.1,w:.8,h:.8}}),request:async()=>{uploads++}});assert.equal(uploads,0);assert.equal(r[0].cutoutId,'a');});
