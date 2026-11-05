import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { environment,call,start,upload,png,analysis,analysisV6,origin } from './backend-harness.mjs';
import { hashBytes,validateAnalysis,validateJob,inspectImage,normalizeCustomization } from '../worker/core.mjs';

// Bundle the actual Worker class. Only the platform-provided constructor is replaced;
// .run(), provider fetches, D1 mutations, R2 writes and all validations remain real code.
const bundled=await build({entryPoints:[new URL('../worker/workflow.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',external:['node:*'],plugins:[{name:'platform-constructor',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'platform'}));build.onLoad({filter:/.*/,namespace:'platform'},()=>({contents:'export class WorkflowEntrypoint { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
const {BrandGenerationWorkflow,runBrandGeneration}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const generatedPng=new Uint8Array(readFileSync(new URL('./backend-fixtures/generated.png',import.meta.url)));
const step=()=>({calls:[],async do(name,options,callback){this.calls.push({name,options:typeof options==='function'?null:options});try{return structuredClone(await (callback||options)());}catch(error){throw new Error(error.message);}}});
const visionUsage={input_tokens:1000,input_tokens_details:{cached_tokens:100},output_tokens:500};
const imageUsage={input_tokens:200,input_tokens_details:{text_tokens:200,image_tokens:0},output_tokens:300};
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','x-request-id':'req-test'}});}
function provider({analysis=analysisV6,image=generatedPng,onImage}={}){
  const calls=[];
  return {calls,async fetch(url,options){assert.match(url,/^https:\/\/api\.openai\.com\/v1\//);const payload=JSON.parse(options.body);calls.push({url,payload});if(url.endsWith('/responses')){const count=JSON.parse(payload.input[0].content[0].text).ingredientCount;return response({output:[{content:[{type:'output_text',text:JSON.stringify({...analysis,observations:analysis.observations.slice(0,count)})}]}],usage:visionUsage});}await onImage?.();return response({data:[{b64_json:Buffer.from(image).toString('base64')}],usage:imageUsage});}};
}
async function submitted(){const ctx=environment(),cookie=await start(ctx),logo=await upload(ctx,cookie,'customer-logo.png');const result=await call(ctx,'/api/jobs',{method:'POST',cookie,body:{schemaVersion:6,idempotencyKey:crypto.randomUUID(),ingredients:[{id:logo.id,role:'logo',locked:false}],brief:{name:'ทดสอบแบรนด์',words:'ร้านงานออกแบบร่วมสมัย เรียบง่ายและอบอุ่น'}}});assert.equal(result.status,202,JSON.stringify(result.data));return {...ctx,cookie,logo,id:result.data.id};}
async function execute(ctx,stub){const old=globalThis.fetch;globalThis.fetch=stub.fetch.bind(stub);try{return await new BrandGenerationWorkflow({},ctx.env).run({payload:{jobId:ctx.id}},step());}finally{globalThis.fetch=old;}}
const stored=ctx=>ctx.sql.prepare('SELECT * FROM brand_jobs WHERE id=?').get(ctx.id);

test('vector workflow uses only a 512px vision derivative and preserves original/board metadata',async()=>{
  const ctx=await submitted(),asset=ctx.sql.prepare('SELECT * FROM brand_assets WHERE id=?').get(ctx.logo.id);
  const original=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><path d="M0 0h100v50H0z" fill="#123456"/></svg>'),digest=await hashBytes(original),renderDigest=await hashBytes(png);
  ctx.storage.set(asset.r2_key,{body:original});
  ctx.sql.prepare('UPDATE brand_assets SET mime=?,sha256=?,width=100,height=50,render_r2_key=?,render_width=2048,render_height=1024,render_mime=?,render_sha256=?,renderer_version=?,converter_version=? WHERE id=?').run('image/svg+xml',digest,'preview-key','image/png',renderDigest,'resvg-0.49.0','slaply-converter-2026-11-05.1',asset.id);
  const conversionCalls=[];
  ctx.env.ASSET_CONVERTER={async fetch(request){conversionCalls.push(request.headers.get('X-Max-Edge'));assert.deepEqual(new Uint8Array(await request.arrayBuffer()),original);assert.equal(request.headers.get('X-Source-SHA256'),digest);return new Response(png,{headers:{'Content-Type':'image/png','X-Conversion-Metadata':JSON.stringify({originalSha256:digest,originalMime:'image/svg+xml',mime:'image/png',originalPreserved:true,sha256:renderDigest,width:1,height:1,sourceWidth:100,sourceHeight:50,renderer:'resvg-0.49.0',converterVersion:'slaply-converter-2026-11-05.1'})}});}};
  const stub=provider();assert.equal((await execute(ctx,stub)).status,'ready');assert.deepEqual(conversionCalls,['512']);
  assert.equal(stub.calls[0].payload.input[0].content.find(p=>p.type==='input_image').image_url,`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  const recipe=JSON.parse(stored(ctx).recipe_json);assert.equal(recipe.logo.src,`/api/assets/${asset.id}/preview`);assert.equal(recipe.logo.originalSrc,`/api/assets/${asset.id}`);assert.equal(recipe.logo.sha256,digest);assert.equal(recipe.logo.renderSha256,renderDigest);assert.equal(recipe.logo.width,2048);assert.equal(recipe.logo.sourceWidth,100);assert.equal(recipe.logo.mime,'image/svg+xml');assert.deepEqual(ctx.storage.get(asset.r2_key).body,original);
});

test('failed vector conversion stops before any paid AI request',async()=>{
  const ctx=await submitted(),asset=ctx.sql.prepare('SELECT * FROM brand_assets WHERE id=?').get(ctx.logo.id);
  ctx.sql.prepare('UPDATE brand_assets SET mime=? WHERE id=?').run('application/pdf',asset.id);
  ctx.env.ASSET_CONVERTER={async fetch(){return Response.json({error:{code:'PDF_MULTIPAGE',message:'ใช้ PDF หน้าเดียว'}},{status:422});}};
  const stub=provider();assert.equal((await execute(ctx,stub)).status,'failed');assert.equal(stub.calls.length,0);assert.equal(stored(ctx).error_code,'PDF_MULTIPAGE');
});

test('actual Workflow.run takes one logo and brief through both providers to a complete v6 recipe',async()=>{
  const ctx=await submitted(),stub=provider(),original=ctx.storage.values().next().value.body.slice();
  const outcome=await execute(ctx,stub);assert.equal(outcome.status,'ready');assert.equal(stub.calls.length,2);
  const [vision,image]=stub.calls.map(call=>call.payload);assert.equal(vision.model,'gpt-6-luna');assert.equal(vision.store,false);assert.equal(vision.text.format.strict,true);
  assert.match(vision.instructions,/ready-to-use customer-facing brand copy/);assert.match(vision.instructions,/Never put art direction, layout instructions, workflow descriptions/);assert.match(vision.instructions,/no invented addresses, phone numbers, prices/);
  assert.equal(vision.input[0].content.find(part=>part.type==='input_image').detail,'high');assert.equal(vision.input[0].content.find(part=>part.type==='input_image').image_url,`data:image/png;base64,${Buffer.from(original).toString('base64')}`);
  assert.deepEqual({model:image.model,n:image.n,quality:image.quality,complexity:image.complexity,size:image.size},{model:'gpt-image-2.6-flare',n:1,quality:'low',complexity:'low',size:'1024x1024'});
  assert.match(image.prompt,/Visual treatment: illustration/);assert.match(image.prompt,/exactly THREE distinct brand objects/);assert.match(image.prompt,/BOTTOM RIGHT quadrant: entirely empty/);
  assert.equal(JSON.stringify(image).includes('data:image'),false,'Original is not sent for generative redraw');
  const job=stored(ctx),recipe=JSON.parse(job.recipe_json),usage=JSON.parse(job.usage_json);
  assert.equal(recipe.customization.logoBackdrop,'auto');assert.equal(recipe.schemaVersion,6);assert.equal(recipe.name,'ทดสอบแบรนด์');assert.equal(recipe.sourceName,'ทดสอบแบรนด์');assert.equal(recipe.logo.assetId,ctx.logo.id);assert.equal(recipe.logo.sha256,await hashBytes(original));assert.equal(recipe.logo.preserveOriginal,true);assert.deepEqual([recipe.logo.width,recipe.logo.height],[1,1]);
  assert.deepEqual(recipe.design,analysisV6.design);assert.deepEqual(recipe.brandSystem,analysisV6.brandSystem);assert.equal(recipe.ingredients[0].role,'logo');
  assert.deepEqual(recipe.brandObjects.map(item=>item.id),['object-1','object-2','object-3']);assert.deepEqual(recipe.customization.objectStyles,['object-1','object-2','object-3']);
  assert.equal(new Set(recipe.brandObjects.map(item=>item.src)).size,1,'One paid image contains the coordinated family');assert.equal(recipe.brandObjects[1].crop.x,.5);assert.equal(recipe.brandObjects[2].crop.y,.5);
  for(const object of analysisV6.brandSystem.objects){assert(image.prompt.includes(object.visual));assert(recipe.brandObjects.some(item=>item.name===object.name&&item.rationale===object.rationale));}
  assert.deepEqual((await call(ctx,recipe.logo.src,{cookie:ctx.cookie})).data,original);assert.equal(usage.vision.status,200);assert.equal(usage.image.status,200);assert.ok(recipe.ai.estimatedCostUSD>0);assert.equal(recipe.ai.costComplete,true);
  const save=await call(ctx,'/api/recipes',{method:'POST',cookie:ctx.cookie,body:{recipe:{...recipe,sourceName:'forged source',logo:{src:'https://fake.test/logo'},design:{template:'fake'},customization:{layout:'minimal',fontPair:'display',density:'compact',pattern:'tile',logoBackdrop:'dark',logoScale:110}}}});
  assert.equal(save.status,201);assert.equal(save.data.recipe.sourceName,'ทดสอบแบรนด์');assert.deepEqual(save.data.recipe.logo,recipe.logo);assert.deepEqual(save.data.recipe.design,recipe.design);assert.equal(save.data.recipe.customization.logoScale,110);assert.equal(save.data.recipe.customization.layout,'minimal');assert.equal(save.data.recipe.customization.logoBackdrop,'dark');assert.equal(normalizeCustomization({logoBackdrop:'light'}).logoBackdrop,'light');
});

test('new generation rejects missing, duplicated or unbranded object plans before the image call',async()=>{
  for(const change of [system=>delete system.objects,system=>system.objects.pop(),system=>system.objects[1].id=system.objects[0].id,system=>system.objects[1].name=system.objects[0].name,system=>system.objects[0].rationale='',system=>system.objects[0].colors=['not-a-palette-role']]){
    const ctx=await submitted(),invalid=structuredClone(analysisV6);change(invalid.brandSystem);const stub=provider({analysis:invalid});
    assert.equal((await execute(ctx,stub)).status,'failed');assert.equal(stub.calls.length,1);assert.equal(stored(ctx).error_code,'AI_INVALID_OUTPUT');
  }
});

test('saved object selections persist while original AI object concepts and geometry cannot be forged',async()=>{
  const ctx=await submitted();await execute(ctx,provider());const recipe=JSON.parse(stored(ctx).recipe_json);
  const response=await call(ctx,'/api/recipes',{method:'POST',cookie:ctx.cookie,body:{recipe:{...recipe,brandObjects:[{id:'object-1',src:'https://evil.test/other',crop:{x:-5,y:0,w:8,h:9}}],customization:{...recipe.customization,objectStyles:['object-2'],objectScale:115}}}});
  assert.equal(response.status,201);assert.deepEqual(response.data.recipe.brandObjects,recipe.brandObjects);assert.deepEqual(response.data.recipe.customization.objectStyles,['object-2']);assert.equal(response.data.recipe.customization.objectScale,115);
  const restored=await call(ctx,'/api/recipes',{cookie:ctx.cookie});assert.deepEqual(restored.data.recipes[0].brandObjects,recipe.brandObjects);assert.deepEqual(restored.data.recipes[0].customization.objectStyles,['object-2']);
});

test('logo role is independent of priority locks and is included in idempotency identity',async()=>{
  const ctx=environment(),cookie=await start(ctx),logo=await upload(ctx,cookie),ref=await upload(ctx,cookie);const body={schemaVersion:6,idempotencyKey:crypto.randomUUID(),ingredients:[{id:ref.id,role:'reference',locked:true},{id:logo.id,role:'logo',locked:false}],brief:{name:'ทดสอบแบรนด์',words:'ออกแบบตามโลโก้'}};
  const created=await call(ctx,'/api/jobs',{method:'POST',cookie,body});assert.equal(created.status,202);ctx.id=created.data.id;
  const conflict=await call(ctx,'/api/jobs',{method:'POST',cookie,body:{...body,ingredients:body.ingredients.map(x=>({...x,role:'reference'}))}});assert.equal(conflict.status,409);
  await execute(ctx,provider());const recipe=JSON.parse(stored(ctx).recipe_json);assert.equal(recipe.logo.assetId,logo.id);assert.equal(recipe.productImage,logo.url);assert.equal(recipe.referenceImage,ref.url);
});

test('provider 401 survives the workflow step boundary with no fallback model or image charge',async()=>{
  const ctx=await submitted(),calls=[];const result=await execute(ctx,{async fetch(url,options){calls.push(JSON.parse(options.body).model);return response({error:{code:'invalid_api_key',message:'sk-sensitive-provider-message'}},401);}});
  assert.equal(result.code,'AI_CONFIGURATION');assert.deepEqual(calls,['gpt-6-luna']);const row=stored(ctx);assert.equal(row.status,'failed');assert.equal(row.recipe_json,null);assert.equal(row.error_code,'AI_CONFIGURATION');assert.equal(JSON.stringify(row).includes('sk-sensitive'),false);
});

test('malformed structured output stops before image generation and records only safe diagnostics',async()=>{
  const ctx=await submitted(),invalid={...analysisV6,design:{...analysisV6.design,fontPair:'https://remote-font.test/secret'}},stub=provider({analysis:invalid});
  await execute(ctx,stub);const row=stored(ctx);assert.equal(row.error_code,'AI_INVALID_OUTPUT');assert.equal(stub.calls.length,1);assert.equal(row.recipe_json,null);assert.equal(JSON.parse(row.usage_json).validation.designValid,false);assert.equal(row.usage_json.includes('remote-font'),false);
});

test('truncated generated image is rejected instead of publishing an unusable board',async()=>{
  const ctx=await submitted(),stub=provider({image:png.slice(0,24)});await execute(ctx,stub);const row=stored(ctx);assert.equal(row.error_code,'AI_INVALID_IMAGE');assert.equal(row.recipe_json,null);assert.equal(ctx.sql.prepare("SELECT COUNT(*) AS n FROM brand_assets WHERE kind='generated'").get().n,0);
});

test('cancel during image generation records usage but cannot publish a stale recipe',async()=>{
  const ctx=await submitted(),stub=provider({onImage:async()=>{await call(ctx,`/api/jobs/${ctx.id}/cancel`,{method:'POST',cookie:ctx.cookie,body:{}});}});
  const result=await execute(ctx,stub),row=stored(ctx);assert.equal(result.status,'cancelled');assert.equal(row.status,'cancelled');assert.equal(row.recipe_json,null);assert.equal(JSON.parse(row.usage_json).image.status,200);assert.deepEqual((await call(ctx,ctx.logo.url,{cookie:ctx.cookie})).data,png);
});

test('an interrupted provider records unknown charge state and makes exactly one attempt',async()=>{
  const ctx=await submitted();let calls=0;await execute(ctx,{async fetch(){calls++;throw new DOMException('timeout','TimeoutError');}});const row=stored(ctx);assert.equal(calls,1);assert.equal(row.error_code,'AI_TIMEOUT');assert.equal(JSON.parse(row.usage_json).vision.mayHaveBeenCharged,true);assert.equal(row.recipe_json,null);
});

test('shared pipeline export supports explicit fetch injection without any global network access',async()=>{
  const ctx=await submitted(),stub=provider();const result=await runBrandGeneration(ctx.env,{payload:{jobId:ctx.id}},step(),{fetch:stub.fetch.bind(stub)});assert.equal(result.status,'ready');assert.equal(stub.calls.length,2);
});

test('a cached pre-v6 analysis resumes with material artwork without repeating paid vision',async()=>{
  const ctx=await submitted(),stub=provider(),durableStep=step();
  const cachedStep={async do(name,options,callback){if(name==='understand-brand-ingredients')return structuredClone(analysis);return durableStep.do(name,options,callback);}};
  const outcome=await runBrandGeneration(ctx.env,{payload:{jobId:ctx.id}},cachedStep,{fetch:stub.fetch.bind(stub)});
  assert.equal(outcome.status,'ready');assert.equal(stub.calls.length,1);assert.match(stub.calls[0].url,/\/images\/generations$/);assert.match(stub.calls[0].payload.prompt,/Selected visual treatment: material/);
  const recipe=JSON.parse(stored(ctx).recipe_json);assert.equal(recipe.schemaVersion,5);assert.equal(recipe.design,undefined);assert.equal(recipe.name,'ทดสอบแบรนด์');assert.equal(recipe.ai.promptVersion,'brand-guideline-2026-11-05.3');
});

test('logo admission and v6 schema reject invalid roles, incomplete systems and invented design values',()=>{
  const id=crypto.randomUUID(),base={schemaVersion:6,idempotencyKey:crypto.randomUUID(),ingredients:[{id,role:'logo'}],brief:{words:'Brief'}};
  assert.equal(validateJob(base).ingredients[0].role,'logo');
  for(const changed of [{...base,ingredients:[{id,role:'reference'}]},{...base,brief:{words:''}},{...base,ingredients:[{id,role:'logo'},{id:crypto.randomUUID(),role:'logo'}]},{...base,ingredients:[{id,role:'script'}]}])assert.throws(()=>validateJob(changed),error=>error.code==='INVALID_INPUT');
  assert.equal(validateAnalysis({...analysisV6,observations:[analysisV6.observations[0]]},1,'Name',6).schemaVersion,6);
  assert.throws(()=>validateAnalysis({...analysisV6,brandSystem:{...analysisV6.brandSystem,palette:analysisV6.brandSystem.palette.slice(0,4)}},2,'Name',6));
  assert.throws(()=>validateAnalysis({...analysisV6,observations:[null,null]},2,'Name',6),error=>error.code==='AI_INVALID_OUTPUT');
  assert.deepEqual(normalizeCustomization({logoScale:1000,layout:'bad',fontPair:'https://evil',logoBackdrop:'red'}),{...normalizeCustomization(),logoScale:115,layout:'auto',fontPair:'auto',logoBackdrop:'auto'});
});

test('AI-proposed original name remains trusted when the editable name is later changed',async()=>{
  const ctx=await submitted(),row=stored(ctx),input=JSON.parse(row.input_json);input.brief.name='';
  ctx.sql.prepare('UPDATE brand_jobs SET input_json=? WHERE id=?').run(JSON.stringify(input),ctx.id);
  await execute(ctx,provider());const recipe=JSON.parse(stored(ctx).recipe_json);assert.equal(recipe.name,analysisV6.proposedName);assert.equal(recipe.sourceName,analysisV6.proposedName);
  const saved=await call(ctx,'/api/recipes',{method:'POST',cookie:ctx.cookie,body:{recipe:{...recipe,name:'ชื่อที่แก้ใหม่',sourceName:'forged'}}});assert.equal(saved.status,201);assert.equal(saved.data.recipe.name,'ชื่อที่แก้ใหม่');assert.equal(saved.data.recipe.sourceName,analysisV6.proposedName);
});
