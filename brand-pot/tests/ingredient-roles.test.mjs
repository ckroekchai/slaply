import test from 'node:test';
import assert from 'node:assert/strict';
import { canCookIngredients, assignIngredientRole, uploadIngredientRole, ingredientSlotLabel, recipeBrief } from '../src/ingredient-roles.js';
import { createKitchenJobs, kitchenStatus } from '../src/kitchen-jobs.js';
import { normalizeCustomization, DEFAULT_BOARD_CUSTOMIZATION } from '../src/brand-guideline-model.js';
import { buildBrandBoardScene } from '../src/brand-board-scene.js';
import { isRecipeSaved } from '../src/recipe-state.js';
import { validateJob } from '../worker/core.mjs';

test('every new generation needs three ingredients regardless of locks, legacy roles or brief', () => {
  assert.equal(canCookIngredients([{id:'a',role:'logo'}],{words:'   '}),false);
  assert.equal(canCookIngredients([{id:'a',role:'logo',locked:true},null],{words:'อบอุ่น น่าเชื่อถือ'}),false);
  assert.equal(canCookIngredients([{id:'a',role:'product'}],{words:'อบอุ่น'}),false);
  assert.equal(canCookIngredients([null,{id:'a'},{id:'b'}],{}),false);
  assert.equal(canCookIngredients([null,{id:'a'},{id:'b'},{id:'c'}],{}),true);
  assert.equal(canCookIngredients(Array.from({length:7},(_,id)=>({id}))),false);
  assert.equal(canCookIngredients([],{}),false);
});
test('moving the logo role never duplicates logos, mutates source bytes or changes priority locks', () => {
  const before=[{id:'a',src:'original-a',role:'logo',locked:true},null,{id:'b',src:'original-b',role:'product',locked:false}],snapshot=structuredClone(before);
  const next=assignIngredientRole(before,2,'logo');
  assert.equal(next[0].role,'reference');assert.equal(next[2].role,'logo');assert.equal(next[0].locked,true);assert.equal(next[2].locked,false);
  assert.deepEqual(before,snapshot);assert.equal(next[0].src,'original-a');assert.equal(next[2].src,'original-b');
  assert.equal(assignIngredientRole(before,1,'logo'),before);assert.equal(assignIngredientRole(before,0,'made-up'),before);
});
test('new uploads never infer a logo from slot position and both leading slots are main ingredients', () => {
  assert.equal(uploadIngredientRole([],0),'reference');assert.equal(uploadIngredientRole([],2),'reference');
  assert.equal(uploadIngredientRole([{role:'product'}],0),'reference');
  assert.equal(uploadIngredientRole([null,{role:'logo'}],0),'reference');
  assert.equal(ingredientSlotLabel(0),'วัตถุดิบหลัก');assert.equal(ingredientSlotLabel(1),'วัตถุดิบหลัก');assert.equal(ingredientSlotLabel(2),'ปรุงรส');
});
test('explicit job submission carries preservation locks and chef notes without manual type hints', async () => {
  let scheduled,submitted;
  const runner=createKitchenJobs({clock:{setTimeout(fn){scheduled=fn;return 1},clearTimeout(){}},makeKey:()=> 'one-logo',onState(){},onComplete(){},request:async(path,options)=>{
    if(path==='/api/jobs'){submitted=JSON.parse(options.body);return{id:'ready'}}return{status:'completed',recipe:{id:'ready'}};
  }});
  const cutoutBounds={x:.1,y:.2,w:.7,h:.5};
  runner.start({ingredients:[{id:'source',role:'logo',locked:true,notes:'รักษาตัวอักษรเดิม',cutoutId:'cutout',cutoutStatus:'removed',cutoutBounds},{id:'second',role:'product'},{id:'third'}],brief:{words:'เน้นความเรียบง่าย',chefNotes:'กลุ่มวัยทำงาน'}});await scheduled();
  assert.deepEqual(submitted.ingredients,[{id:'source',locked:true,notes:'รักษาตัวอักษรเดิม',cutoutId:'cutout',cutoutStatus:'removed',cutoutBounds},{id:'second',locked:false},{id:'third',locked:false}]);assert.equal(submitted.brief.words,'เน้นความเรียบง่าย');assert.equal(submitted.brief.chefNotes,'กลุ่มวัยทำงาน');
});

test('locked-cutout browser payload passes the real Worker admission contract', async () => {
  let scheduled, accepted;
  const runner = createKitchenJobs({
    clock: { setTimeout(fn) { scheduled = fn; return 1; }, clearTimeout() {} },
    makeKey: () => 'browser-cutout-contract-v7', onState() {}, onComplete() {},
    onError(error) { throw error; },
    request: async (path, options) => {
      if (path === '/api/jobs') { accepted = validateJob(JSON.parse(options.body)); return { id: 'ready' }; }
      return { status: 'completed', recipe: { id: 'ready' } };
    },
  });
  runner.start({ ingredients: [
    { id: '00000000-0000-4000-8000-000000000001', locked: true, cutoutId: '00000000-0000-4000-8000-000000000004', cutoutStatus: 'removed', cutoutBounds: { x: .1, y: .2, w: .7, h: .5 } },
    { id: '00000000-0000-4000-8000-000000000002' },
    { id: '00000000-0000-4000-8000-000000000003' },
  ], brief: { chefNotes: 'Keep the existing letterforms' } });
  await scheduled();
  assert.equal(accepted.ingredients[0].cutoutStatus, 'removed');
  assert.equal(accepted.ingredients[0].role, 'auto');
  assert.equal(accepted.brief.chefNotes, 'Keep the existing letterforms');
});
test('status requires three ingredients and explicit Shake without hiding an active job', () => {
  assert.match(kitchenStatus({count:1,job:{phase:'idle'},hasLogo:true,hasBrief:false}),/อีก 2 อย่าง/);
  assert.match(kitchenStatus({count:2,job:{phase:'idle'}}),/อีก 1 อย่าง/);
  assert.match(kitchenStatus({count:3,job:{phase:'idle'}}),/กด Shake/);
  assert.match(kitchenStatus({count:1,job:{phase:'cooking',step:'generating'},hasLogo:true,hasBrief:false}),/กำลังสร้างภาพ/);
});
test('board variant and size edits survive normalization and mark a saved recipe dirty', () => {
  const saved={id:'saved',jobId:'job',schemaVersion:6,name:'Brand',words:'สงบ',customization:{...DEFAULT_BOARD_CUSTOMIZATION},logo:{src:'/api/assets/logo',width:500,height:500},design:{template:'editorial',fontPair:'grotesk'},brandSystem:{}};
  const edited={...saved,customization:{...saved.customization,boardVariant:'minimal',logoBackdrop:'dark',logoScale:115,textScale:110,objectScale:125}};
  assert.deepEqual(normalizeCustomization(edited.customization),edited.customization);
  assert.equal(isRecipeSaved(saved,[saved]),true);assert.equal(isRecipeSaved(edited,[saved]),false);
  const scene=buildBrandBoardScene(edited);assert.equal(scene.templateId,'minimal');
  assert.equal(scene.nodes.find(node=>node.id==='logo-panel').fill,'#171A24');
  const logo=scene.nodes.find(node=>node.id==='identity-logo');assert.equal(logo.assetRef,saved.logo.src);assert.equal(logo.preserveOriginal,true);assert.equal(logo.adjustment,undefined);
});

test('restoring a saved recipe retains chef context and supplied brand name',()=>{
  assert.deepEqual(recipeBrief({name:'ชื่อใหม่',words:'เรียบง่าย',brief:{name:'เดิม',words:'เดิม',chefNotes:'ไม่ใช้สีชมพู',audience:'วัยทำงาน'}}),{name:'ชื่อใหม่',words:'เรียบง่าย',chefNotes:'ไม่ใช้สีชมพู',audience:'วัยทำงาน'});
});
test('legacy customization shape stays stable and malformed board values are bounded', () => {
  assert.equal('layout' in normalizeCustomization({}),false);
  const settings=normalizeCustomization({layout:'<script>',fontPair:'made-up',logoBackdrop:'red',logoScale:900});
  assert.equal(settings.layout,'auto');assert.equal(settings.fontPair,'auto');assert.equal(settings.logoBackdrop,'auto');assert.equal(settings.logoScale,115);
});
