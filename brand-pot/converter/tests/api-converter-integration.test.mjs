import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {PDFDocument,rgb} from 'pdf-lib';
import sharp from 'sharp';
import {environment,call,start} from '../../tests/backend-harness.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('actual upload API crosses the private workerd converter boundary and preserves sources without AI work',{timeout:20_000},async()=>{
  const dir=new URL('../dist/',import.meta.url).pathname;
  let externalRequests=0,conversionRequests=0,workflowAttempts=0;
  const denyOutbound=()=>{externalRequests++;throw new Error('External networking is forbidden in this integration test');};
  const runtime=new Miniflare({workers:[
    {name:'converter',modules:[{type:'ESModule',path:dir+'index.js'},{type:'CompiledWasm',path:dir+'resvg.wasm'},{type:'CompiledWasm',path:dir+'pdfium.wasm'}],compatibilityDate:'2026-04-01',outboundService:denyOutbound},
    {name:'binding-client',modules:true,script:'export default {fetch(request,env){return env.ASSET_CONVERTER.fetch(request)}}',compatibilityDate:'2026-04-01',serviceBindings:{ASSET_CONVERTER:{name:'converter',entrypoint:'AssetConverter'}},outboundService:denyOutbound},
  ]});
  let ctx;
  try{
    const bindingClient=await runtime.getWorker('binding-client');
    ctx=environment({ENABLE_DOCUMENT_UPLOADS:'true',AI_ENABLED:'false',OPENAI_API_KEY:'',BRAND_GENERATION:{async create(){workflowAttempts++;throw new Error('AI workflows are forbidden in an upload test');}},ASSET_CONVERTER:{async fetch(request){
      conversionRequests++;
      // Node's native Request and Miniflare's Fetcher use different Web API realms.
      // Bridge transport fields unchanged; the private named entrypoint runs in workerd.
      return bindingClient.fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:new Uint8Array(await request.arrayBuffer())});
    }}});
    const owner=await start(ctx),other=await start(ctx),quotaBefore=(await call(ctx,'/api/session',{cookie:owner})).data;assert.equal(quotaBefore.uploads.documents,true);
    const svg=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>');
    const document=await PDFDocument.create(),page=document.addPage([200,100]);page.drawRectangle({x:0,y:0,width:100,height:100,color:rgb(0,0,1)});
    const pdf=await document.save();
    for(const [source,mime,name,color,renderer] of [[svg,'image/svg+xml','outlined-logo.svg',[255,0,0,255],'resvg-0.49.0'],[pdf,'application/pdf','single-page-logo.pdf',[0,0,255,255],'pdfium-2.15.1']]){
      const immutableCopy=source.slice(),form=new FormData();form.set('file',new Blob([source],{type:mime}),name);
      // This invokes actual worker/api.mjs, including multipart validation, quota
      // reservation, convertArtwork verification, R2 writes and D1 ready transition.
      const upload=await call(ctx,'/api/uploads',{method:'POST',cookie:owner,body:form});assert.equal(upload.status,201,JSON.stringify(upload.data));
      const asset=upload.data,row=ctx.sql.prepare('SELECT * FROM brand_assets WHERE id=?').get(asset.id);
      assert.equal(row.state,'ready');assert.equal(asset.originalUrl,`/api/assets/${asset.id}`);assert.equal(asset.url,`${asset.originalUrl}/preview`);assert.equal(asset.mime,mime);assert.equal(asset.renderer,renderer);
      assert.equal(asset.originalSha256,sha(immutableCopy));assert.equal(row.sha256,sha(immutableCopy));assert.deepEqual(source,immutableCopy);assert.deepEqual(ctx.storage.get(row.r2_key).body,immutableCopy);assert.notEqual(row.r2_key,row.render_r2_key);
      assert.deepEqual([row.width,row.height,asset.sourceWidth,asset.sourceHeight],[200,100,200,100]);assert.deepEqual([row.render_width,row.render_height,asset.width,asset.height],[2048,1024,2048,1024]);

      const original=await call(ctx,asset.originalUrl,{cookie:owner});assert.equal(original.status,200);assert.deepEqual(original.data,immutableCopy);assert.equal(original.response.headers.get('Content-Type'),mime);assert.match(original.response.headers.get('Content-Disposition'),/^attachment/);assert.match(original.response.headers.get('Content-Security-Policy'),/sandbox/);
      const preview=await call(ctx,asset.url,{cookie:owner});assert.equal(preview.status,200);assert.equal(preview.response.headers.get('Content-Type'),'image/png');assert.equal(preview.response.headers.get('Content-Disposition'),'inline');assert.equal(sha(preview.data),asset.renderSha256);assert.equal(sha(preview.data),row.render_sha256);assert.equal(preview.data.length,row.render_bytes);
      const decoded=await sharp(preview.data).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([decoded.info.width,decoded.info.height],[2048,1024]);assert.deepEqual([...decoded.data.subarray(0,4)],color);assert.equal(decoded.data[1500*4+3],0,'Unpainted source area remains transparent');
      for(const url of [asset.originalUrl,asset.url])assert.equal((await call(ctx,url,{cookie:other})).status,404);
    }
    const quotaAfter=(await call(ctx,'/api/session',{cookie:owner})).data;
    for(const key of ['remaining','limit','globalRemaining'])assert.equal(quotaAfter[key],quotaBefore[key]);
    assert.equal(quotaAfter.activeJob,null);assert.equal(quotaAfter.latestRecipe,null);assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,0);assert.equal(ctx.sql.prepare("SELECT COUNT(*) AS n FROM brand_assets WHERE state='ready'").get().n,2);assert.equal(ctx.storage.size,4);
    assert.equal(conversionRequests,2);assert.equal(workflowAttempts,0);assert.equal(externalRequests,0);
  }finally{ctx?.sql.close();await runtime.dispose();}
});
