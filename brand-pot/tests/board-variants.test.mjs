import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_VARIANTS, buildBrandBoardScene, renderBrandBoardSVG } from '../src/brand-board-scene.js';
import { normalizeCustomization } from '../src/brand-guideline-model.js';
import { analysisV6 } from './backend-harness.mjs';

const source='/api/assets/board_identity';
const recipe=()=>({...structuredClone(analysisV6),name:'THE CONSIDERED BRAND',generatedImage:'/api/assets/board_atlas',brandObjects:structuredClone(analysisV6.brandSystem.objects),logo:{src:source,width:1600,height:900,preserveOriginal:true},customization:{objectStyles:['object-1','object-2','object-3']}});
const logos=scene=>scene.nodes.filter(item=>item.type==='image'&&item.sourceRole==='logo');

test('four fixed directions preserve complete modules, content and user edits without a new recipe',()=>{
  const input=recipe(),before=structuredClone(input);
  const scenes=BOARD_VARIANTS.map(({id})=>buildBrandBoardScene({...input,customization:{...input.customization,boardVariant:id}}));
  assert.deepEqual(BOARD_VARIANTS.map(item=>item.id),['ai','minimal','professional','creative']);
  for(const scene of scenes){
    const panels=['logo','concept','artwork','typography','palette','pattern','application-social','application-business-card'].map(id=>scene.nodes.find(node=>node.id===id+'-panel'));
    assert(panels.every(Boolean),'Every direction retains all eight guideline modules');
    for(let a=0;a<panels.length;a++)for(let b=a+1;b<panels.length;b++){
      const x=panels[a].bounds,y=panels[b].bounds;
      assert(x.x+x.w<=y.x||y.x+y.w<=x.x||x.y+x.h<=y.y||y.y+y.h<=x.y,`${scene.variantId}: ${panels[a].id} cannot overlap ${panels[b].id}`);
    }
    assert.equal(scene.nodes.find(node=>node.id==='concept-summary').text,input.concept.summary);
    assert.equal(scene.brandObjects.length,3);
    assert.equal(logos(scene).length,3,'Identity, social application and business card each carry the same identity');
  }
  assert.equal(new Set(scenes.map(scene=>JSON.stringify(scene.layout))).size,4);
  assert(scenes[0].backgroundGradient,'AI direction has a concept-art atmosphere');
  assert.equal(scenes[1].nodes.find(node=>node.id==='concept-panel').fill,scenes[1].nodes.find(node=>node.id==='board-paper').fill,'Minimal uses open space rather than colored cards');
  assert(scenes[2].nodes.find(node=>node.id==='header-rule').strokeWidth===2,'Professional has a disciplined document rule');
  assert(scenes[3].nodes.some(node=>node.id==='creative-header'),'Creative has a distinct campaign-scale title band');
  assert.deepEqual(input,before,'Changing direction does not mutate the source recipe');
});

test('variant normalization is safe and legacy recipes open the AI recommendation',()=>{
  assert.equal(buildBrandBoardScene(recipe()).variantId,'ai');
  for(const {id} of BOARD_VARIANTS)assert.equal(normalizeCustomization({boardVariant:id}).boardVariant,id);
  assert.equal(normalizeCustomization({boardVariant:'untrusted-layout'}).boardVariant,'ai');
});

test('new logos use only the logo atlas cell in every placement and every direction',()=>{
  for(const {id} of BOARD_VARIANTS){
    const input=recipe();input.logo={src:input.generatedImage,generated:true,width:1024,height:1024,crop:{x:.5,y:.5,w:.5,h:.5}};
    input.customization={...input.customization,boardVariant:id,hue:25,saturation:90,brightness:110};
    const scene=buildBrandBoardScene(input),svg=renderBrandBoardSVG(scene);
    for(const node of logos(scene)){
      assert.equal(node.assetRef,input.generatedImage);assert.equal(node.preserveOriginal,false);
      assert.deepEqual(node.sourceCrop,input.logo.crop);assert.deepEqual(node.adjustment,{hue:25,saturation:90,brightness:110});
      assert(svg.includes(`data-node-id="${node.id}" data-source-role="logo"`));
      const viewport=new RegExp(`<svg data-node-id="${node.id}"[^>]*`).exec(svg)?.[0];
      const width=Number(/\bwidth="([\d.]+)"/.exec(viewport)?.[1]),height=Number(/\bheight="([\d.]+)"/.exec(viewport)?.[1]);
      assert.equal(width,height,'A square source crop must use a square viewport, so letterbox gutters cannot reveal adjacent atlas objects');
      assert(width<=Math.min(node.bounds.w,node.bounds.h)+.001);
    }
    assert.equal((svg.match(/viewBox="512 512 512 512"/g)||[]).length,3,'The fourth cell is only used for the three logo placements');
    assert.equal(scene.nodes.filter(node=>/^brand-object-[123]$/.test(node.id)).length,3,'Logo generation cannot remove any of the three original objects');
  }
});

test('locked cutout fits visible bounds at source aspect ratio and keeps original colors',()=>{
  const input=recipe();input.logo={...input.logo,cutout:true,contentBounds:{x:.2,y:.1,w:.6,h:.7}};input.customization={hue:80,saturation:40,brightness:65};
  const scene=buildBrandBoardScene(input),svg=renderBrandBoardSVG(scene);
  for(const node of logos(scene)){
    assert.equal(node.preserveOriginal,true);assert.equal(node.assetRef,source);assert.equal(node.allowSourceCrop,true);
    assert.deepEqual(node.sourceCrop,input.logo.contentBounds);assert.equal(node.cropWidth,1600);assert.equal(node.cropHeight,900);assert(!node.adjustment);
    assert(!svg.includes(`id="adjust-${node.id}"`),'Locked originals cannot receive a hue/brightness filter');
  }
  assert.equal((svg.match(/viewBox="320 90 960 630"/g)||[]).length,3);
  for(const bounds of [{x:-.2,y:0,w:.8,h:1},{x:0,y:0,w:1.2,h:1},{x:0,y:0,w:0,h:1},{x:0,y:0,w:NaN,h:1}]){
    const invalid=buildBrandBoardScene({...input,logo:{...input.logo,contentBounds:bounds}});
    assert(logos(invalid).every(node=>!node.sourceCrop),'Invalid source bounds fall back to the complete source');
  }
  const unchanged=buildBrandBoardScene({...input,logo:{...input.logo,cutout:false}});
  assert(logos(unchanged).every(node=>!node.sourceCrop),'A normal locked original cannot opt into cropping merely by carrying bounds');
});
