import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,MAX_UPLOAD_BYTES,MAX_JOB_UPLOAD_BYTES} from '../worker/core.mjs';
import {environment,call,start,upload,inputs,requestBody,png} from './backend-harness.mjs';

async function sessionId(ctx,cookie) {
  return ctx.sql.prepare('SELECT id FROM brand_sessions WHERE token_hash = ?').get(await hash(cookie.split('=')[1])).id;
}
async function entitle(ctx,cookie,value=1) {
  ctx.sql.prepare('UPDATE brand_sessions SET unlimited_trial = ? WHERE id = ?').run(value,await sessionId(ctx,cookie));
}
function duplicateAssets(ctx,assetId,count) {
  const insert=ctx.sql.prepare(`INSERT INTO brand_assets (id,session_id,kind,r2_key,mime,bytes,original_name,state,ip_hash,day,created_at)
    SELECT ?,session_id,kind,?,mime,bytes,original_name,state,ip_hash,day,created_at FROM brand_assets WHERE id = ?`);
  for(let i=0;i<count;i++){const id=crypto.randomUUID();insert.run(id,`test-only/${id}`,assetId);}
}

test('private entitlement bypasses every generation allowance without spending public allowance',async()=>{
  const ctx=environment({DAILY_SESSION_LIMIT:'1',DAILY_IP_LIMIT:'1',DAILY_GLOBAL_LIMIT:'1'}),owner=await start(ctx),publicCookie=await start(ctx);
  assert.equal((await call(ctx,'/api/session',{cookie:owner})).data.unlimited,false);
  await entitle(ctx,owner);
  const base=await inputs(ctx,owner),firstBody=requestBody(base);
  const first=await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:firstBody});assert.equal(first.status,202);
  for(let i=0;i<6;i++)assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(base)})).status,202);
  const info=(await call(ctx,'/api/session',{cookie:owner})).data;
  assert.deepEqual([info.unlimited,info.remaining,info.limit,info.globalRemaining],[true,null,null,null]);
  const ordinary=(await call(ctx,'/api/session',{cookie:publicCookie})).data;
  assert.deepEqual([ordinary.unlimited,ordinary.remaining,ordinary.globalRemaining],[false,1,1]);
  const publicBody=requestBody(await inputs(ctx,publicCookie));
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:publicCookie,body:publicBody})).status,202);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:publicCookie,body:requestBody(publicBody)})).status,429);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(base)})).status,202,'Owner remains admitted after public global/IP limits are exhausted');
  const replay=await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:firstBody});
  assert.equal(replay.data.id,first.data.id);assert.equal(ctx.created,9,'Retries never create additional workflows');
  assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_jobs').get().n,9,'All admitted work remains recorded');
  await entitle(ctx,owner,0);
  const revoked=(await call(ctx,'/api/session',{cookie:owner})).data;
  assert.equal(revoked.unlimited,false);assert.equal(revoked.remaining,0);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(base)})).status,429);
});

test('unlimited upload volume is isolated from public limits and retains file validation',async()=>{
  const ctx=environment(),owner=await start(ctx),publicCookie=await start(ctx);await entitle(ctx,owner);
  const ownerAsset=await upload(ctx,owner);duplicateAssets(ctx,ownerAsset.id,1000);
  const publicAsset=await upload(ctx,publicCookie);
  assert.ok(publicAsset.id,'Owner uploads cannot exhaust public session/IP/global budgets');
  duplicateAssets(ctx,publicAsset.id,1000);
  const raw={method:'POST',body:png,headers:{'Content-Type':'image/png','X-File-Name':'extra.png'}};
  const limited=await call(ctx,'/api/uploads',{...raw,cookie:publicCookie});assert.equal(limited.status,429);assert.equal(limited.data.error.code,'UPLOAD_LIMIT');
  assert.equal((await call(ctx,'/api/uploads',{...raw,cookie:owner})).status,201,'Owner can upload beyond exhausted session, IP and global budgets');
  assert.equal((await call(ctx,'/api/uploads',{...raw,cookie:owner,headers:{...raw.headers,'Content-Length':String(MAX_UPLOAD_BYTES+1)}})).status,413);
  assert.equal((await call(ctx,'/api/uploads',{...raw,cookie:owner,body:new TextEncoder().encode('not an image')})).status,400);
});

test('clients cannot grant or inherit unlimited testing with request fields or forged cookies',async()=>{
  const ctx=environment({DAILY_SESSION_LIMIT:'1',DAILY_IP_LIMIT:'1',DAILY_GLOBAL_LIMIT:'1'}),owner=await start(ctx),publicCookie=await start(ctx);await entitle(ctx,owner);
  const ownerId=await sessionId(ctx,owner),base=await inputs(ctx,publicCookie);
  const forged={...requestBody(base),unlimited:true,unlimited_trial:1,sessionId:ownerId};
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:publicCookie,body:forged})).status,202);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:publicCookie,body:{...forged,idempotencyKey:crypto.randomUUID()}})).status,429);
  const info=(await call(ctx,'/api/session?unlimited=true&unlimited_trial=1',{cookie:publicCookie,headers:{'X-Unlimited-Trial':'1','X-Session-Id':ownerId}})).data;
  assert.equal(info.unlimited,false);assert.equal(info.remaining,0);
  const fakeToken=await call(ctx,'/api/session',{cookie:`${owner.split('=')[0]}=${ownerId}`});
  assert.equal(fakeToken.status,200);assert.equal(fakeToken.data.unlimited,false,'Session ID is not an authentication cookie');
  assert.equal((await call(ctx,'/api/session',{method:'POST',cookie:publicCookie,body:{unlimited_trial:1}})).status,404);
  assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_sessions WHERE unlimited_trial = 1').get().n,1);
});

test('unlimited admission still validates ingredients, owner access and operational pause',async()=>{
  const ctx=environment(),owner=await start(ctx),other=await start(ctx);await entitle(ctx,owner);
  const base=await inputs(ctx,owner),foreign=await inputs(ctx,other);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody({...base,ingredients:base.ingredients.slice(0,2)})})).status,400);
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(foreign)})).status,404);
  const extra=await upload(ctx,owner);const aggregate={...base,ingredients:[...base.ingredients,{id:extra.id,locked:false}]};
  ctx.sql.prepare('UPDATE brand_assets SET bytes = ? WHERE session_id = ?').run(MAX_JOB_UPLOAD_BYTES/4+1,await sessionId(ctx,owner));
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(aggregate)})).data.error.code,'INPUT_TOTAL_TOO_LARGE');
  ctx.sql.prepare('UPDATE brand_assets SET bytes = ? WHERE session_id = ?').run(png.length,await sessionId(ctx,owner));
  ctx.env.AI_ENABLED='false';
  assert.equal((await call(ctx,'/api/jobs',{method:'POST',cookie:owner,body:requestBody(base)})).data.error.code,'AI_PAUSED');
  assert.equal(ctx.created,0);
});
