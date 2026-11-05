import test from 'node:test';
import assert from 'node:assert/strict';
import { canCookIngredients, assignIngredientRole, uploadIngredientRole } from '../src/ingredient-roles.js';
import { createKitchenJobs, kitchenStatus } from '../src/kitchen-jobs.js';
import { normalizeCustomization, DEFAULT_BOARD_CUSTOMIZATION } from '../src/brand-guideline-model.js';
import { buildBrandBoardScene } from '../src/brand-board-scene.js';
import { isRecipeSaved } from '../src/recipe-state.js';

test('one original logo requires a meaningful brief while legacy multi-image recipes remain cookable', () => {
  assert.equal(canCookIngredients([{id:'a',role:'logo'}],{words:'   '}),false);
  assert.equal(canCookIngredients([{id:'a',role:'logo'},null],{words:'อบอุ่น น่าเชื่อถือ'}),true);
  assert.equal(canCookIngredients([{id:'a',role:'product'}],{words:'อบอุ่น'}),false);
  assert.equal(canCookIngredients([null,{id:'a'},{id:'b'}],{}),true);
  assert.equal(canCookIngredients([],{}),false);
});
test('moving the logo role never duplicates logos, mutates source bytes or changes priority locks', () => {
  const before=[{id:'a',src:'original-a',role:'logo',locked:true},null,{id:'b',src:'original-b',role:'product',locked:false}],snapshot=structuredClone(before);
  const next=assignIngredientRole(before,2,'logo');
  assert.equal(next[0].role,'reference');assert.equal(next[2].role,'logo');assert.equal(next[0].locked,true);assert.equal(next[2].locked,false);
  assert.deepEqual(before,snapshot);assert.equal(next[0].src,'original-a');assert.equal(next[2].src,'original-b');
  assert.equal(assignIngredientRole(before,1,'logo'),before);assert.equal(assignIngredientRole(before,0,'made-up'),before);
});
test('replacing an ingredient keeps its selected role, and only the unclaimed first slot defaults to logo', () => {
  assert.equal(uploadIngredientRole([],0),'logo');assert.equal(uploadIngredientRole([],2),'reference');
  assert.equal(uploadIngredientRole([{role:'product'}],0),'product');
  assert.equal(uploadIngredientRole([null,{role:'logo'}],0),'reference');
});
test('job submission carries explicit logo and product roles independently of priority locks', async () => {
  let scheduled,submitted;
  const runner=createKitchenJobs({clock:{setTimeout(fn){scheduled=fn;return 1},clearTimeout(){}},makeKey:()=> 'one-logo',onState(){},onComplete(){},request:async(path,options)=>{
    if(path==='/api/jobs'){submitted=JSON.parse(options.body);return{id:'ready'}}return{status:'completed',recipe:{id:'ready'}};
  }});
  runner.start({ingredients:[{id:'source',role:'logo',locked:false}],brief:{words:'เน้นความเรียบง่าย'}});await scheduled();
  assert.deepEqual(submitted.ingredients,[{id:'source',role:'logo',locked:false}]);assert.equal(submitted.brief.words,'เน้นความเรียบง่าย');
});
test('single logo status explains the next meaningful action without hiding an active job', () => {
  assert.match(kitchenStatus({count:1,job:{phase:'idle'},hasLogo:true,hasBrief:false}),/เติมคำบรรยาย/);
  assert.match(kitchenStatus({count:1,job:{phase:'idle'},hasLogo:true,hasBrief:true}),/กด Shake/);
  assert.match(kitchenStatus({count:1,job:{phase:'cooking',step:'generating'},hasLogo:true,hasBrief:false}),/กำลังสร้างภาพ/);
});
test('board edits survive normalization, drive the scene, and mark a confirmed saved recipe dirty', () => {
  const saved={id:'saved',jobId:'job',schemaVersion:6,name:'Brand',words:'สงบ',customization:{...DEFAULT_BOARD_CUSTOMIZATION},logo:{src:'/api/assets/logo',width:500,height:500},design:{template:'editorial',fontPair:'grotesk'},brandSystem:{}};
  const edited={...saved,customization:{...saved.customization,layout:'minimal',fontPair:'editorial-serif',logoBackdrop:'dark',logoScale:115,pattern:'stripe',density:'airy'}};
  assert.deepEqual(normalizeCustomization(edited.customization),edited.customization);
  assert.equal(isRecipeSaved(saved,[saved]),true);assert.equal(isRecipeSaved(edited,[saved]),false);
  const scene=buildBrandBoardScene(edited);assert.equal(scene.templateId,'minimal');assert.equal(scene.fontPairId,'editorial-serif');assert.equal(scene.patternKind,'stripe');assert.equal(scene.density,'airy');
  assert.equal(scene.nodes.find(node=>node.id==='logo-panel').fill,'#171A24');
  const logo=scene.nodes.find(node=>node.id==='identity-logo');assert.equal(logo.assetRef,saved.logo.src);assert.equal(logo.preserveOriginal,true);assert.equal(logo.adjustment,undefined);
  assert(scene.fontFamilies.includes('DM Serif Display'));assert(scene.fontFamilies.includes('Noto Serif Thai'));
});
test('legacy customization shape stays stable and malformed board values are bounded', () => {
  assert.equal('layout' in normalizeCustomization({}),false);
  const settings=normalizeCustomization({layout:'<script>',fontPair:'made-up',logoBackdrop:'red',logoScale:900});
  assert.equal(settings.layout,'auto');assert.equal(settings.fontPair,'auto');assert.equal(settings.logoBackdrop,'auto');assert.equal(settings.logoScale,115);
});
