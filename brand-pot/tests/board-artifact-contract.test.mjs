import test from 'node:test';
import assert from 'node:assert/strict';
import { logoRenderPlan, assertCutoutPixels, logoReferenceMarkup } from '../evals/board-logo-contract.mjs';

const bounds={x:80,y:80,w:200,h:160};
test('artifact checker requires explicit source permission for generated and cutout crops',()=>{
  const crop={x:.5,y:.5,w:.5,h:.5},node={fit:'contain',preserveOriginal:false,sourceCrop:crop,allowSourceCrop:true,cropWidth:1024,cropHeight:1024,adjustment:{hue:0,saturation:100,brightness:100},bounds};
  assert.throws(()=>logoRenderPlan(node,{}, {width:1024,height:1024}));
  const plan=logoRenderPlan(node,{generated:true,crop},{width:1024,height:1024});
  assert.deepEqual(plan.sourceRect,{left:512,top:512,width:512,height:512});
  assert(logoReferenceMarkup(node,plan,'data:image/png;base64,AA==').includes('viewBox="512 512 512 512"'));
  assert.throws(()=>logoRenderPlan({...node,sourceCrop:{x:0,y:0,w:.5,h:.5}},{generated:true,crop},{width:1024,height:1024}));
  const cutout={...node,preserveOriginal:true,adjustment:undefined,cropWidth:1600,cropHeight:900},metadata={cutout:true,contentBounds:crop};
  assert.equal(logoRenderPlan(cutout,metadata,{width:1600,height:900}).mode,'cutout');
  assert.throws(()=>logoRenderPlan({...cutout,adjustment:{hue:25,saturation:100,brightness:100}},metadata,{width:1600,height:900}));
  assert.throws(()=>logoRenderPlan(cutout,{contentBounds:crop},{width:1600,height:900}));
});

test('artifact checker detects foreground edits, dimension loss and invented cutout pixels',()=>{
  const info={width:2,height:1,channels:4},original={info,data:Buffer.from([255,255,255,255,28,63,45,255])},cutout={info,data:Buffer.from([255,255,255,0,28,63,45,255])};
  assert.deepEqual(assertCutoutPixels(original,cutout),{width:2,height:1,visiblePixels:1,opaquePixels:1,alphaChanges:1});
  assert.throws(()=>assertCutoutPixels(original,{info:{...info,width:1},data:cutout.data}));
  assert.throws(()=>assertCutoutPixels(original,{info,data:Buffer.from([255,255,255,0,29,63,45,255])}));
  assert.throws(()=>assertCutoutPixels({...original,data:Buffer.from([255,255,255,0,28,63,45,255])},{info,data:original.data}));
});
