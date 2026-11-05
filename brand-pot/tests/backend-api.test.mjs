import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.mjs';
import { MAX_UPLOAD_BYTES,MAX_JOB_UPLOAD_BYTES,sniffImage,validateJob,validateAnalysis,analysisDiagnostics,savedRecipe,sessionCookie,buildRecipe,providerError,hash,day,now } from '../worker/core.mjs';
import { captureStageFailure, publicJobFailure } from '../worker/failures.mjs';

import {origin,png,environment,call,start,upload,inputs,requestBody,analysis,completedRecipe} from './backend-harness.mjs';

test('session cookie is opaque, HttpOnly, secure, isolated, and not in JSON',async()=>{
  const ctx=environment(),a=await call(ctx,'/api/session'),b=await call(ctx,'/api/session');
  assert.notEqual(a.cookie,b.cookie);assert.match(a.response.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);assert.match(a.response.headers.get('Set-Cookie'),/; Secure/);
  assert.equal(JSON.stringify(a.data).includes(a.cookie.split('=')[1]),false);assert.equal(a.data.remaining,5);assert.equal(a.data.activeJob,null);
  assert.equal((await call(ctx,'/api/recipes')).status,401);
  assert.equal(sessionCookie(new Request('http://localhost:8787'), 'abc').startsWith('slaply_session='),true);
});
test('cross-site reads and mutations rejected before storage or workflow work',async()=>{
  const ctx=environment(),cookie=await start(ctx);
  const bad=await handleApi(new Request(origin+'/api/jobs',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'}),ctx.env);
  assert.equal(bad.status,403);assert.equal((await bad.json()).error.code,'ORIGIN_REJECTED');
  assert.equal((await call(ctx,'/api/session',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);assert.equal(ctx.created,0);
});
test('immutable upload bytes remain exact and owner isolation covers GET/HEAD',async()=>{
  const ctx=environment(),owner=await start(ctx),other=await start(ctx),asset=await upload(ctx,owner);
  const own=await call(ctx,asset.url,{cookie:owner});assert.deepEqual(own.data,png);assert.equal(own.response.headers.get('Cache-Control'),'private, no-store');
  assert.equal((await call(ctx,asset.url,{cookie:other})).status,404);assert.equal((await call(ctx,asset.url,{cookie:other,method:'HEAD'})).status,404);
  assert.equal((await call(ctx,asset.url,{cookie:owner,method:'POST',body:{}})).status,404);
});
test('non-image payload and deceptive declared MIME are rejected',async()=>{
  const ctx=environment(),cookie=await start(ctx),form=new FormData();form.set('file',new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/png'}),'evil.png');
  assert.equal((await call(ctx,'/api/uploads',{method:'POST',cookie,body:form})).status,400);assert.equal(ctx.storage.size,0);
});
test('idempotency replay starts one workflow and mismatched content conflicts',async()=>{
  const ctx=environment(),cookie=await start(ctx),body=requestBody(await inputs(ctx,cookie));
  const first=await call(ctx,'/api/jobs',{method:'POST',cookie,body}),same=await call(ctx,'/api/jobs',{method:'POST',cookie,body});
  assert.equal(first.status,202);assert.equal(same.data.id,first.data.id);assert.equal(ctx.created,1);
  const mismatch=await call(ctx,'/api/jobs',{method:'POST',cookie,body:{...body,brief:{...body.brief,name:'different'}}});assert.equal(mismatch.status,409);assert.equal(mismatch.data.error.code,'IDEMPOTENCY_CONFLICT');
});
test('lost workflow start recovers on same idempotency key without another quota reservation',async()=>{
  const ctx=environment(),cookie=await start(ctx),body=requestBody(await inputs(ctx,cookie));
  const create=ctx.env.BRAND_GENERATION.create;ctx.env.BRAND_GENERATION.create=async()=>{throw new Error('Temporary outage');};
  const first=await call(ctx,'/api/jobs',{method:'POST',cookie,body});assert.equal(first.status,503);assert.equal(ctx.sql.prepare('SELECT count(*) AS n FROM brand_jobs').get().n,1);
  ctx.env.BRAND_GENERATION.create=create;
  const retry=await call(ctx,'/api/jobs',{method:'POST',cookie,body});assert.equal(retry.status,200);assert.equal(ctx.created,1);assert.equal(ctx.sql.prepare('SELECT count(*) AS n FROM brand_jobs').get().n,1);
});
test('concurrent requests cannot exceed atomic global quota and supersede only on admission',async()=>{
  const ctx=environment({DAILY_GLOBAL_LIMIT:'2'}),cookie=await start(ctx),base=await inputs(ctx,cookie);
  const results=await Promise.all(Array.from({length:8},()=>call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(base)})));
  assert.equal(results.filter(r=>r.status===202).length,2);assert.equal(results.filter(r=>r.status===429).length,6);assert.equal(ctx.created,2);
  assert.equal(ctx.sql.prepare("SELECT count(*) AS n FROM brand_jobs WHERE status='queued'").get().n,1);assert.equal(ctx.sql.prepare("SELECT count(*) AS n FROM brand_jobs WHERE status='cancelled'").get().n,1);
});
test('cross-owner job inputs, reads, cancellation and saves return 404',async()=>{
  const ctx=environment(),cookie=await start(ctx),other=await start(ctx),base=await inputs(ctx,cookie),created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(base)}),id=created.data.id;
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:other,body:requestBody(base)})).status,404);
  assert.equal((await call(ctx,`/api/jobs/${id}`,{cookie:other})).status,404);
  assert.equal((await call(ctx,`/api/jobs/${id}/cancel`,{method:'POST',cookie:other,body:{}})).status,404);
  assert.equal((await call(ctx,'/api/recipes',{method:'POST',cookie:other,body:{recipe:{id}}})).status,404);
});
test('malformed and overlarge aggregate inputs do not spend quota',async()=>{
  const ctx=environment(),cookie=await start(ctx),base=await inputs(ctx,cookie);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody({...base,ingredients:[base.ingredients[0]]})})).status,400);
  for(let i=0;i<2;i++){const extra=await upload(ctx,cookie,`extra-${i}.png`);base.ingredients.push({id:extra.id,locked:false});}
  ctx.sql.prepare('UPDATE brand_assets SET bytes = ?').run(5*1024*1024);
  const result=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(base)});assert.equal(result.data.error.code,'INPUT_TOTAL_TOO_LARGE');assert.equal(ctx.sql.prepare('SELECT count(*) AS n FROM brand_jobs').get().n,0);assert.equal(ctx.created,0);
});
test('aggregate admission accepts exactly 18 MiB and rejects one byte over before another quota reservation',async()=>{
  assert.equal(MAX_UPLOAD_BYTES,5*1024*1024);assert.equal(MAX_JOB_UPLOAD_BYTES,18*1024*1024);
  const ctx=environment(),cookie=await start(ctx),base=await inputs(ctx,cookie);
  for(let i=0;i<2;i++){const extra=await upload(ctx,cookie,`extra-${i}.png`);base.ingredients.push({id:extra.id,locked:false});}
  const sizes=[5,5,5,3].map(v=>v*1024*1024);
  base.ingredients.forEach((item,index)=>ctx.sql.prepare('UPDATE brand_assets SET bytes=? WHERE id=?').run(sizes[index],item.id));
  const exact=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(base)});assert.equal(exact.status,202);
  ctx.sql.prepare('UPDATE brand_assets SET bytes=bytes+1 WHERE id=?').run(base.ingredients[3].id);
  const over=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(base)});assert.equal(over.status,400);assert.equal(over.data.error.code,'INPUT_TOTAL_TOO_LARGE');assert.match(over.data.error.message,/18 MB/);
  assert.equal(ctx.sql.prepare('SELECT count(*) AS n FROM brand_jobs').get().n,1);assert.equal(ctx.created,1);
});
test('runtime termination becomes a recoverable failed job rather than polling forever',async()=>{
  const ctx=environment(),cookie=await start(ctx),created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(await inputs(ctx,cookie))});
  ctx.instances.set(created.data.id,{status:'errored'});
  const result=await call(ctx,`/api/jobs/${created.data.id}`,{cookie});assert.equal(result.data.status,'failed');assert.equal(result.data.error.code,'JOB_INTERRUPTED');
  assert.equal((await call(ctx,'/api/session',{cookie})).data.activeJob,null);
});
test('cancel is idempotent and a completed job cannot be cancelled retroactively',async()=>{
  const ctx=environment(),cookie=await start(ctx),created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(await inputs(ctx,cookie))}),path=`/api/jobs/${created.data.id}/cancel`;
  assert.equal((await call(ctx,path,{method:'POST',cookie,body:{}})).data.status,'cancelled');assert.equal((await call(ctx,path,{method:'POST',cookie,body:{}})).data.status,'cancelled');
  ctx.sql.prepare("UPDATE brand_jobs SET status='ready'").run();assert.equal((await call(ctx,path,{method:'POST',cookie,body:{}})).data.status,'ready');
});
test('saved version persists edits and ignores forged image/AI fields; session restores saved state',async()=>{
  const ctx=environment(),cookie=await start(ctx),created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(await inputs(ctx,cookie))}),job=ctx.sql.prepare('SELECT * FROM brand_jobs WHERE id=?').get(created.data.id),assets=ctx.sql.prepare('SELECT * FROM brand_assets ORDER BY created_at').all();
  const recipe=buildRecipe(job,analysis,assets,crypto.randomUUID(),ctx.env);ctx.sql.prepare("UPDATE brand_jobs SET status='ready',phase='ready',recipe_json=? WHERE id=?").run(JSON.stringify(recipe),job.id);
  assert.equal(recipe.ingredients[0].bytes,png.length);
  const save=await call(ctx,'/api/recipes',{method:'POST',cookie,body:{recipe:{...recipe,name:'แก้ชื่อ',concept:{title:'แก้แนวคิด',summary:'คำอธิบายใหม่'},generatedImage:'https://evil.test/x',ai:{status:'fake'},customization:{hue:18,objectStyles:[]}}}});
  assert.equal(save.status,201);assert.equal(save.data.recipe.generatedImage,recipe.generatedImage);assert.equal(save.data.recipe.ai.status,'generated');assert.equal(save.data.recipe.concept.title,'แก้แนวคิด');assert.equal(save.data.recipe.name,'แก้ชื่อ');assert.deepEqual(save.data.recipe.customization.objectStyles,[]);
  assert.equal((await call(ctx,'/api/session',{cookie})).data.latestRecipe.name,'แก้ชื่อ');assert.equal((await call(ctx,'/api/recipes',{cookie})).data.recipes.length,1);
});
test('recipe trash is reversible and never deletes original assets or jobs',async()=>{
  const ctx=environment(),cookie=await start(ctx),recipe=await completedRecipe(ctx,cookie),path=`/api/recipes/${recipe.id}`;
  const before={assets:ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_assets').get().n,jobs:ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,objects:ctx.storage.size};
  const removed=await call(ctx,path,{method:'DELETE',cookie});assert.equal(removed.status,200);assert.equal(removed.data.trashed,true);assert.equal(removed.data.recipe.id,recipe.id);assert.equal(removed.data.recipe.jobId,recipe.jobId);assert.match(removed.data.recipe.trashedAt,/^\d{4}-/);
  assert.deepEqual((await call(ctx,'/api/recipes',{cookie})).data.recipes,[]);
  const trash=(await call(ctx,'/api/recipes?trash=1',{cookie})).data.recipes;assert.equal(trash.length,1);assert.equal(trash[0].id,recipe.id);
  assert.equal((await call(ctx,'/api/session',{cookie})).data.latestRecipe,null,'Trashed recipe must not reappear as its source generation');
  assert.equal((await call(ctx,`/api/jobs/${recipe.jobId}`,{cookie})).data.status,'ready');assert.deepEqual((await call(ctx,recipe.ingredients[0].src,{cookie})).data,png);
  assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_assets').get().n,before.assets);assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,before.jobs);assert.equal(ctx.storage.size,before.objects);
  const repeated=await call(ctx,path,{method:'DELETE',cookie});assert.equal(repeated.data.recipe.trashedAt,removed.data.recipe.trashedAt);
  const restored=await call(ctx,path+'/restore',{method:'POST',cookie,body:{}});assert.equal(restored.status,200);assert.equal(restored.data.restored,true);assert.deepEqual(restored.data.recipe,recipe);
  assert.equal((await call(ctx,'/api/recipes',{cookie})).data.recipes[0].id,recipe.id);assert.deepEqual((await call(ctx,'/api/recipes?trash=1',{cookie})).data.recipes,[]);assert.equal((await call(ctx,'/api/session',{cookie})).data.latestRecipe.name,'สูตรที่บันทึก');
  assert.equal((await call(ctx,path+'/restore',{method:'POST',cookie,body:{}})).status,200);
});
test('trash and restore enforce ownership and origin without exposing other sessions',async()=>{
  const ctx=environment(),owner=await start(ctx),other=await start(ctx),recipe=await completedRecipe(ctx,owner),path=`/api/recipes/${recipe.id}`;
  assert.equal((await call(ctx,path,{method:'DELETE',cookie:other})).status,404);assert.equal((await call(ctx,path+'/restore',{method:'POST',cookie:other,body:{}})).status,404);
  assert.equal((await call(ctx,`/api/recipes/${crypto.randomUUID()}`,{method:'DELETE',cookie:owner})).status,404);assert.equal((await call(ctx,`/api/recipes/${crypto.randomUUID()}/restore`,{method:'POST',cookie:owner,body:{}})).status,404);
  assert.equal((await call(ctx,`/api/recipes/${recipe.jobId}`,{method:'DELETE',cookie:owner})).status,404,'Saved recipe ids, not job ids, are deletable');
  const crossSite=await handleApi(new Request(origin+path,{method:'DELETE',headers:{Cookie:owner,Origin:'https://evil.test'}}),ctx.env);assert.equal(crossSite.status,403);
  await call(ctx,path,{method:'DELETE',cookie:owner});assert.deepEqual((await call(ctx,'/api/recipes?trash=1',{cookie:other})).data.recipes,[]);assert.equal((await call(ctx,path+'/restore',{method:'POST',cookie:other,body:{}})).status,404);
  assert.equal((await call(ctx,'/api/recipes?trash=1')).status,401);
});
test('payments are inactive and health never exposes credentials',async()=>{
  const ctx=environment(),cookie=await start(ctx);
  for(const path of ['/api/create-payment','/api/payment-webhook','/api/admin-unlock'])assert.equal((await call(ctx,path,{method:'POST',cookie,body:{}})).status,404);
  const health=await call(ctx,'/api/health');assert.equal(health.data.paymentsEnabled,false);assert.equal(JSON.stringify(health.data).includes('test-key'),false);
});
test('schema, image and recipe validators enforce meaningful boundaries',()=>{
  assert.equal(sniffImage(png),'image/png');
  const large=png.slice();new DataView(large.buffer).setUint32(16,50000);new DataView(large.buffer).setUint32(20,50000);assert.throws(()=>sniffImage(large),error=>error.code==='INVALID_IMAGE');
  assert.throws(()=>sniffImage(Uint8Array.from([255,216,255,0])),/JPG/);
  assert.throws(()=>validateJob({ingredients:[],idempotencyKey:'a'}));
  assert.deepEqual(validateAnalysis(analysis,2),analysis);assert.throws(()=>validateAnalysis({...analysis,palette:['red']},2));assert.throws(()=>validateAnalysis({...analysis,observations:[analysis.observations[0],analysis.observations[0]]},2));
  assert.equal(providerError(401,'').code,'AI_CONFIGURATION');assert.equal(providerError(429,'').code,'AI_BUSY');
});
test('provider authentication error survives Workflow exception serialization without leaking raw messages',async()=>{
  const ctx=environment(),cookie=await start(ctx),created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(await inputs(ctx,cookie))}),id=created.data.id;
  let thrown;
  try { await captureStageFailure(ctx.env,id,async()=>{throw providerError(401,'invalid_api_key');}); } catch(error) {thrown=error;}
  // Emulate the Workflow boundary retaining only generic Error name/message.
  const serialized = new Error(thrown.message);
  assert.equal(serialized.code,undefined);
  const persisted=ctx.sql.prepare('SELECT * FROM brand_jobs WHERE id=?').get(id);
  const failure=publicJobFailure(serialized,persisted);
  assert.equal(failure.code,'AI_CONFIGURATION');assert.equal(failure.message,'ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply');
  assert.equal(persisted.error_code,'AI_CONFIGURATION');
  assert.equal(publicJobFailure(new Error('raw sk-secret-test provider details')).code,'AI_JOB_FAILED');
  assert.equal(JSON.stringify(publicJobFailure({code:'AI_CONFIGURATION',message:'raw sk-secret-test'}, {error_code:'AI_CONFIGURATION',error_message:'raw sk-secret-test'})).includes('sk-secret'),false);
  assert.equal(publicJobFailure({code:'__proto__'}).code,'AI_JOB_FAILED');
});
test('a supplied brand name allows an empty AI name suggestion without fabricating output',()=>{
  const noSuggestion={...analysis,proposedName:''};
  assert.equal(validateAnalysis(noSuggestion,2,'ชื่อเดิม').proposedName,'');
  assert.throws(()=>validateAnalysis(noSuggestion,2,''));
  assert.throws(()=>validateAnalysis({...analysis,proposedName:null},2,'ชื่อเดิม'));
  assert.throws(()=>validateAnalysis({...noSuggestion,imagePrompt:''},2,'ชื่อเดิม'));
});
test('validation diagnostics record structure without model text or user names',()=>{
  const modelText='sensitive model output';
  const diagnostics=analysisDiagnostics({...analysis,proposedName:'',concept:{title:modelText,summary:modelText},imagePrompt:modelText,observations:[{ingredientIndex:1,observed:modelText,inspiration:modelText}]},2,'private user brand');
  assert.equal(diagnostics.fields.proposedName.empty,true);assert.equal(diagnostics.fields.imagePrompt.length,modelText.length);assert.equal(diagnostics.observations.count,1);assert.equal(diagnostics.expectedIngredientCount,2);
  assert.equal(JSON.stringify(diagnostics).includes(modelText),false);assert.equal(JSON.stringify(diagnostics).includes('private user brand'),false);
});

test('idempotency of pre-v6 requests survives the new role normalization',async()=>{
  const ctx=environment(),cookie=await start(ctx),body=requestBody(await inputs(ctx,cookie));
  const first=await call(ctx,'/api/jobs',{method:'POST',cookie,body});
  const legacyHash=await hash(JSON.stringify({ingredients:body.ingredients,brief:body.brief}));
  ctx.sql.prepare('UPDATE brand_jobs SET request_hash=?,input_json=? WHERE id=?').run(legacyHash,JSON.stringify(body),first.data.id);
  const replay=await call(ctx,'/api/jobs',{method:'POST',cookie,body});assert.equal(replay.status,200);assert.equal(replay.data.id,first.data.id);assert.equal(ctx.created,1);
  const changed=await call(ctx,'/api/jobs',{method:'POST',cookie,body:{...body,ingredients:body.ingredients.map((item,i)=>({...item,role:i===0?'logo':'reference'}))}});assert.equal(changed.status,409);
});
