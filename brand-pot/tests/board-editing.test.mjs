import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandBoardScene, layoutBrandBoardText } from '../src/brand-board-scene.js';
import { savedRecipe } from '../worker/core.mjs';

const source={schemaVersion:6,id:'generated-job',name:'Original & Co.',sourceName:'Original & Co.',brief:{name:'Original & Co.'},words:'warm',concept:{title:'A clear identity',summary:'A useful direction'},logo:{src:'/api/assets/original-logo',width:500,height:500,preserveOriginal:true},design:{template:'editorial',fontPair:'grotesk'},brandSystem:{typography:{headingSample:'Original & Co. everyday',bodySample:'Welcome to Original & Co.'},applications:[{kind:'social',headline:'Original & Co.',body:'Discover Original & Co.'},{kind:'business-card',headline:'Original & Co.',body:'Original & Co. studio'}]}};
const copyIds=['typography-specimen','typography-body-sample','social-headline','social-body','business-card-headline','business-card-body'];

test('renamed identity propagates literally through suggested copy without editing the original logo',()=>{
  const edited={...source,name:'New $& <brand>'},scene=buildBrandBoardScene(edited);
  for(const id of copyIds){const node=scene.nodes.find(n=>n.id===id);assert(node.text.includes(edited.name),id);assert(!node.text.includes(source.sourceName),id);}
  for(const node of scene.nodes.filter(n=>n.sourceRole==='logo')){assert.equal(node.assetRef,source.logo.src);assert.equal(node.preserveOriginal,true);assert.equal(node.adjustment,undefined);}
  assert.equal(source.name,'Original & Co.');
});
test('AI-proposed names use the trusted source snapshot when the original brief name was empty',()=>{
  const generated={...source,brief:{name:''},sourceName:source.name},edited={...generated,name:'Edited name',sourceName:'forged source'},saved=savedRecipe(generated,edited,'saved-version',2);
  assert.equal(saved.sourceName,source.name);assert.equal(saved.brief.name,'');assert.equal(saved.name,'Edited name');
  const scene=buildBrandBoardScene(saved);
  for(const id of copyIds)assert(scene.nodes.find(n=>n.id===id).text.includes('Edited name'),id);
});
test('a v6 recipe without sourceName can still rename exact original brief copy',()=>{
  const scene=buildBrandBoardScene({...source,sourceName:undefined,name:'Another name'});
  assert.equal(scene.nodes.find(n=>n.id==='social-headline').text,'Another name');
});
test('valid multiline edited summaries fit their own modules without dropping non-whitespace text',()=>{
  const summary=Array(100).fill('ข้อความ').join('\n');assert(summary.length<=1000);
  for(const template of ['editorial','expressive','minimal']){
    const scene=layoutBrandBoardText(buildBrandBoardScene({...source,concept:{title:'Title',summary},design:{template,fontPair:'grotesk'}}));
    const node=scene.nodes.find(n=>n.id==='concept-summary');
    assert.equal(node.lines.map(line=>line.text).join('').replace(/\s/g,''),summary.replace(/\s/g,''));
    assert(node.computedFontSize>=8);assert(node.lines.at(-1).y<=node.bounds.y+node.bounds.h,template);
  }
});
test('intentional specimen breaks remain when they fit but excessive breaks reflow instead of overflowing',()=>{
  const short=layoutBrandBoardText(buildBrandBoardScene(source)).nodes.find(n=>n.id==='typography-specimen');
  assert(short.lines.some(line=>line.text==='Aa กข'));
  const headingSample=Array(60).fill('Aa').join('\n'),scene=layoutBrandBoardText(buildBrandBoardScene({...source,brandSystem:{...source.brandSystem,typography:{headingSample,bodySample:'Details'}}}));
  const node=scene.nodes.find(n=>n.id==='typography-specimen');
  assert.equal(node.lines.map(line=>line.text).join('').replace(/\s/g,''),('Aa กข'+headingSample).replace(/\s/g,''));
  assert(node.lines.at(-1).y<=node.bounds.y+node.bounds.h);assert(node.computedFontSize>=8);
});
