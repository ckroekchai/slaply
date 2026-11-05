import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,call,start,png} from './backend-harness.mjs';
import {hashBytes,day,now} from '../worker/core.mjs';

const svg=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0H100V100H0Z" fill="#123456"/></svg>');
const pdf=new TextEncoder().encode('%PDF-1.7\nSynthetic converter-binding fixture: document parsing is covered by real-workerd converter tests.');
async function uploadArtwork(ctx,cookie,bytes=svg,mime='image/svg+xml',name='โลโก้.svg'){
  const form=new FormData();form.set('file',new Blob([bytes],{type:mime}),name);return call(ctx,'/api/uploads',{method:'POST',cookie,body:form});
}
function converter(ctx,{fail=false,invalidHash=false,before}={}){
  let calls=0;
  ctx.env.ENABLE_DOCUMENT_UPLOADS='true';
  ctx.env.ASSET_CONVERTER={async fetch(request){calls++;const bytes=new Uint8Array(await request.arrayBuffer()),digest=await hashBytes(bytes),mime=request.headers.get('Content-Type');
    assert.equal(request.url,'https://converter.internal/convert');assert.equal(request.headers.get('X-Source-SHA256'),digest);assert.equal(request.headers.get('X-Max-Edge'),'2048');
    const row=ctx.sql.prepare("SELECT * FROM brand_assets WHERE state='pending' ORDER BY created_at DESC LIMIT 1").get();assert.ok(row,'Upload quota is reserved before converter execution');assert.deepEqual(ctx.storage.get(row.r2_key).body,bytes,'Exact original is stored before conversion');await before?.(row,bytes);
    if(fail)return Response.json({error:{code:'PDF_MULTIPAGE',message:'กรุณาส่ง PDF โลโก้เพียงหน้าเดียว'}},{status:422});
    const metadata={width:1,height:1,sourceWidth:100,sourceHeight:100,renderer:mime==='application/pdf'?'pdfium-2.15.1':'resvg-0.49.0',converterVersion:'slaply-converter-2026-11-05.1',mime:'image/png',originalMime:mime,originalSha256:digest,sha256:invalidHash?'0'.repeat(64):await hashBytes(png),originalPreserved:true,...mime==='application/pdf'?{pageIndex:0,pageCount:1}:{}};
    return new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(png.length),'X-Conversion-Metadata':JSON.stringify(metadata)}});
  }};return {get calls(){return calls;}};
}
const jobBody=id=>({schemaVersion:6,idempotencyKey:crypto.randomUUID(),ingredients:[{id,role:'logo',locked:false}],brief:{name:'ทดสอบโลโก้',words:'แบรนด์ร่วมสมัย'}});

test('document uploads are disabled by default and need both an explicit flag and converter binding',async()=>{
  for(const scenario of ['default','flag-only','binding-only','false-with-binding','boolean-true']){
    const ctx=environment(),cookie=await start(ctx);let conversions=0;
    if(['flag-only','boolean-true'].includes(scenario))ctx.env.ENABLE_DOCUMENT_UPLOADS=scenario==='boolean-true'?true:'true';
    if(['binding-only','false-with-binding','boolean-true'].includes(scenario))ctx.env.ASSET_CONVERTER={fetch(){conversions++;throw new Error('Disabled converter must never run');}};
    if(scenario==='false-with-binding')ctx.env.ENABLE_DOCUMENT_UPLOADS='false';
    const before=(await call(ctx,'/api/session',{cookie})).data;assert.deepEqual(before.uploads,{documents:false});
    for(const [bytes,mime,name] of [[svg,'image/svg+xml','logo.svg'],[pdf,'application/pdf','logo.pdf']]){const result=await uploadArtwork(ctx,cookie,bytes,mime,name);assert.equal(result.status,400,scenario);assert.equal(result.data.error.code,'DOCUMENT_UPLOADS_DISABLED');assert.match(result.data.error.message,/JPG, PNG และ WebP/);}
    assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_assets').get().n,0);assert.equal(ctx.storage.size,0);assert.equal(conversions,0);assert.equal((await call(ctx,'/api/session',{cookie})).data.remaining,before.remaining);
  }
  const enabled=environment(),cookie=await start(enabled);converter(enabled);assert.deepEqual((await call(enabled,'/api/session',{cookie})).data.uploads,{documents:true});
});

test('default raster uploads succeed while document capability remains false',async()=>{
  const ctx=environment(),cookie=await start(ctx);assert.equal((await call(ctx,'/api/session',{cookie})).data.uploads.documents,false);const result=await uploadArtwork(ctx,cookie,png,'image/png','logo.png');assert.equal(result.status,201);assert.equal(result.data.mime,'image/png');assert.equal(ctx.storage.size,1);
});

test('vector uploads reserve quota then store unchanged source and verified PNG as distinct R2 objects',async()=>{
  for(const [bytes,mime,name] of [[svg,'image/svg+xml','โลโก้.svg'],[pdf,'application/pdf','logo.pdf']]){
    const ctx=environment(),cookie=await start(ctx),stub=converter(ctx),before=bytes.slice(),result=await uploadArtwork(ctx,cookie,bytes,mime,name);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(stub.calls,1);assert.deepEqual(bytes,before);
    const record=ctx.sql.prepare('SELECT * FROM brand_assets WHERE id=?').get(result.data.id);assert.equal(record.state,'ready');assert.equal(record.mime,mime);assert.equal(record.bytes,bytes.length);assert.equal(record.sha256,await hashBytes(bytes));assert.notEqual(record.r2_key,record.render_r2_key);assert.deepEqual(ctx.storage.get(record.r2_key).body,bytes);assert.deepEqual(ctx.storage.get(record.render_r2_key).body,png);assert.equal(record.render_mime,'image/png');assert.equal(record.render_bytes,png.length);assert.equal(record.render_sha256,await hashBytes(png));
    assert.equal(result.data.url,`/api/assets/${record.id}/preview`);assert.equal(result.data.originalUrl,`/api/assets/${record.id}`);assert.equal(result.data.originalMime,mime);assert.equal(result.data.originalSha256,record.sha256);assert.equal(result.data.renderer,record.renderer_version);assert.deepEqual([result.data.width,result.data.height,result.data.sourceWidth,result.data.sourceHeight],[1,1,100,100]);
    assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,0,'Upload does not spend an AI generation');
  }
});

test('source documents download as sandboxed attachments; preview is owner-only inline PNG including HEAD',async()=>{
  const ctx=environment(),owner=await start(ctx),other=await start(ctx);converter(ctx);const uploaded=await uploadArtwork(ctx,owner),{originalUrl,url}=uploaded.data;
  const original=await call(ctx,originalUrl,{cookie:owner}),preview=await call(ctx,url,{cookie:owner});assert.deepEqual(original.data,svg);assert.equal(original.response.headers.get('Content-Type'),'image/svg+xml');assert.match(original.response.headers.get('Content-Disposition'),/^attachment; filename\*=UTF-8''/);assert.match(original.response.headers.get('Content-Security-Policy'),/sandbox; default-src 'none'/);assert.equal(original.response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(original.response.headers.get('X-Frame-Options'),'DENY');
  assert.deepEqual(preview.data,png);assert.equal(preview.response.headers.get('Content-Type'),'image/png');assert.equal(preview.response.headers.get('Content-Disposition'),'inline');assert.equal(preview.response.headers.get('Cross-Origin-Resource-Policy'),'same-origin');
  const head=await call(ctx,url,{method:'HEAD',cookie:owner});assert.equal(head.status,200);assert.equal(head.data.length,0);assert.equal(Number(head.response.headers.get('Content-Length')),png.length);
  for(const path of [originalUrl,url]){assert.equal((await call(ctx,path,{cookie:other})).status,404);assert.equal((await call(ctx,path,{method:'HEAD',cookie:other})).status,404);assert.equal((await call(ctx,path)).status,401);}
});

test('failed conversion remains private, retains its reserved upload, and spends no AI quota',async()=>{
  const ctx=environment(),cookie=await start(ctx),stub=converter(ctx,{fail:true}),before=(await call(ctx,'/api/session',{cookie})).data.remaining;
  const result=await uploadArtwork(ctx,cookie,pdf,'application/pdf','multi.pdf');assert.equal(result.status,422);assert.equal(result.data.error.code,'PDF_MULTIPAGE');assert.equal(stub.calls,1);const row=ctx.sql.prepare('SELECT * FROM brand_assets').get();assert.equal(row.state,'failed');assert.equal(row.render_r2_key,null);assert.deepEqual(ctx.storage.get(row.r2_key).body,pdf);
  for(const path of [`/api/assets/${row.id}`,`/api/assets/${row.id}/preview`])assert.equal((await call(ctx,path,{cookie})).status,404);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie,body:jobBody(row.id)})).status,404);assert.equal((await call(ctx,'/api/session',{cookie})).data.remaining,before);assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,0);
});

test('forged conversion metadata and failed derivative storage never mark a source ready',async()=>{
  for(const kind of ['hash','storage']){
    const ctx=environment(),cookie=await start(ctx);converter(ctx,{invalidHash:kind==='hash'});if(kind==='storage'){const put=ctx.env.SLAPLY_UPLOADS.put;ctx.env.SLAPLY_UPLOADS.put=async(key,...args)=>{if(key.includes('/previews/'))throw new Error('storage unavailable');return put(key,...args);};}
    const result=await uploadArtwork(ctx,cookie);assert.equal(result.status,kind==='hash'?502:500);const row=ctx.sql.prepare('SELECT * FROM brand_assets').get();assert.equal(row.state,'failed');assert.equal(row.render_r2_key,null);assert.equal(ctx.storage.size,1);assert.deepEqual(ctx.storage.get(row.r2_key).body,svg);assert.equal(ctx.created,0);
  }
});

test('concurrent final upload slot admits only one converter call and counts failed reservations',async()=>{
  const ctx=environment(),cookie=await start(ctx),sessionId=ctx.sql.prepare('SELECT id FROM brand_sessions').get().id;
  const insert=ctx.sql.prepare("INSERT INTO brand_assets(id,session_id,kind,r2_key,mime,bytes,original_name,state,ip_hash,day,created_at) VALUES(?,?,'original',?,'image/svg+xml',1,'failed.svg','failed','seed',?,?)");
  for(let i=0;i<59;i++){const id=crypto.randomUUID();insert.run(id,sessionId,`seed/${id}`,day(),now());}
  const stub=converter(ctx),results=await Promise.all([uploadArtwork(ctx,cookie),uploadArtwork(ctx,cookie)]);assert.deepEqual(results.map(x=>x.status).sort(),[201,429]);assert.equal(stub.calls,1);assert.equal(ctx.sql.prepare("SELECT COUNT(*) AS n FROM brand_assets WHERE kind='original'").get().n,60);
});

test('ready vectors enter jobs without raster inspection and cannot cross session ownership',async()=>{
  const ctx=environment(),cookie=await start(ctx),other=await start(ctx);converter(ctx);const uploaded=await uploadArtwork(ctx,cookie),id=uploaded.data.id;
  const job=await call(ctx,'/api/jobs',{method:'POST',cookie,body:jobBody(id)});assert.equal(job.status,202,JSON.stringify(job.data));assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:other,body:jobBody(id)})).status,404);
  ctx.sql.prepare('UPDATE brand_assets SET render_sha256=NULL WHERE id=?').run(id);assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie,body:jobBody(id)})).status,404,'Incomplete vector metadata cannot be backfilled by pretending it is a raster');
});

test('raster magic retains its existing inline URL without calling the converter',async()=>{
  const ctx=environment(),cookie=await start(ctx),stub=converter(ctx),result=await uploadArtwork(ctx,cookie,png,'application/pdf','mislabelled.pdf');assert.equal(result.status,201);assert.equal(result.data.mime,'image/png');assert.equal(result.data.url,result.data.originalUrl);assert.equal(stub.calls,0);const asset=await call(ctx,result.data.url,{cookie});assert.equal(asset.response.headers.get('Content-Disposition'),'inline');assert.deepEqual(asset.data,png);assert.equal((await call(ctx,result.data.url+'/preview',{cookie})).status,404);
});
