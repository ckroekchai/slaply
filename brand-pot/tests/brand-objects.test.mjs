import test from 'node:test';
import assert from 'node:assert/strict';
import { brandObjects } from '../src/brand-objects.js';
import { buildBrandBoardScene,renderBrandBoardSVG,layoutBrandBoardText } from '../src/brand-board-scene.js';
import { normalizeCustomization } from '../src/brand-guideline-model.js';
import { BRAND_OBJECT_IDS,BRAND_OBJECT_CROPS } from '../shared/brand-objects.mjs';
import { analysisV6 } from './backend-harness.mjs';

const recipe=()=>({...structuredClone(analysisV6),name:'ร้านทดลอง',generatedImage:'/api/assets/generated_atlas',logo:{src:'/api/assets/original_logo'},brandObjects:analysisV6.brandSystem.objects.map(item=>({...item,src:'https://untrusted.test/replacement',crop:{x:-8,y:0,w:10,h:3}})),customization:{layout:'auto',pattern:'repeat',objectStyles:[...BRAND_OBJECT_IDS]}});
test('three independent brand objects have app-owned atlas geometry and one safe image source',()=>{
  const input=recipe(),objects=brandObjects(input);
  assert.equal(objects.length,3);assert.deepEqual(objects.map(x=>x.crop),BRAND_OBJECT_CROPS);assert(objects.every(x=>x.src===input.generatedImage));
  assert.deepEqual(brandObjects({...input,generatedImage:'https://untrusted.test/file.png'}),[]);assert.deepEqual(brandObjects({...input,brandObjects:input.brandObjects.slice(1)}),[]);
  assert.deepEqual(normalizeCustomization({objectStyles:BRAND_OBJECT_IDS}).objectStyles,BRAND_OBJECT_IDS);
});
test('all layouts document all three objects with their own names and reasons without clipping logos',()=>{
  for(const template of ['editorial','expressive','minimal']){
    const input=recipe();input.customization.layout=template;const scene=layoutBrandBoardText(buildBrandBoardScene(input)),svg=renderBrandBoardSVG(scene);
    for(const object of input.brandObjects){
      const node=scene.nodes.find(item=>item.id===`brand-${object.id}`);assert.equal(node.sourceRole,'brand-object');assert.equal(node.objectId,object.id);assert(svg.includes(object.name));
      const description=scene.nodes.find(item=>item.id===`brand-${object.id}-rationale`);assert.equal(description.lines.map(item=>item.text).join('').replace(/\s/g,''),object.rationale.replace(/\s/g,''));
      assert(description.lines.at(-1).y<=description.bounds.y+description.bounds.h+.01);
    }
    assert.equal(scene.brandObjects.length,3);assert(svg.includes('viewBox="512 0 512 512"'));assert(svg.includes('viewBox="0 512 512 512"'));
    for(const node of scene.nodes.filter(item=>item.sourceRole==='logo')){assert.equal(node.preserveOriginal,true);assert(!node.sourceCrop&&!node.adjustment);}
    for(const node of scene.nodes){const {x,y,w,h}=node.bounds;assert(x>=0&&y>=0&&w>=0&&h>=0&&x+w<=2400.01&&y+h<=1800.01,node.id);}
  }
});
test('object selections control the pattern and social art while keeping the full family available',()=>{
  const input=recipe();input.customization.objectStyles=['object-3'];input.customization.objectScale=70;
  const scene=buildBrandBoardScene(input),decorative=scene.nodes.filter(item=>item.sourceRole==='brand-object'&&!item.id.startsWith('brand-object-'));
  assert(decorative.length>1);assert(decorative.every(item=>item.objectId==='object-3'));assert.equal(scene.brandObjects.length,3);
  const larger=buildBrandBoardScene({...input,customization:{...input.customization,objectScale:130}});assert(larger.nodes.find(x=>x.id==='social-artwork').bounds.w>scene.nodes.find(x=>x.id==='social-artwork').bounds.w);
  input.customization.objectStyles=[];const empty=buildBrandBoardScene(input);assert(!empty.nodes.some(item=>item.id==='social-artwork'));assert.equal(empty.nodes.filter(item=>/^brand-object-[123]$/.test(item.id)).length,3);
});
