import { HttpError, MAX_UPLOAD_BYTES, MAX_JOB_UPLOAD_BYTES, SESSION_DAYS, UUID, assertMutationOrigin, cookieValue, sessionCookie, randomToken, hash, day, now, limits, models, safeName, sniffImage, validateJob, savedRecipe, publicError } from './core.mjs';

const JSON_HEADERS = { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin' };
export function json(body, status=200, extra={}) { return new Response(JSON.stringify(body), {status,headers:{...JSON_HEADERS,...extra}}); }
const notFound = () => new HttpError(404,'NOT_FOUND','ไม่พบรายการนี้ในเบราว์เซอร์ของคุณ');
const db = env => env.SLAPLY_DB;
const ipHash = request => hash(`brand-pot-ip:${request.headers.get('CF-Connecting-IP') || 'local'}`);
async function readBytes(request, maximum) {
  if (Number(request.headers.get('Content-Length')) > maximum) throw new HttpError(413,'TOO_LARGE','ข้อมูลมีขนาดใหญ่เกินไป');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks=[]; let length=0;
  try { while (true) { const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximum){await reader.cancel();throw new HttpError(413,'TOO_LARGE','ข้อมูลมีขนาดใหญ่เกินไป');}chunks.push(value); } } finally { reader.releaseLock(); }
  const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return data;
}
async function bodyJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415,'INVALID_INPUT','กรุณาส่งข้อมูลเป็น JSON');
  try { return JSON.parse(new TextDecoder().decode(await readBytes(request,32*1024))); } catch(error) { if(error instanceof HttpError)throw error;throw new HttpError(400,'INVALID_INPUT','ข้อมูล JSON ไม่ถูกต้อง'); }
}
async function session(request,env) {
  const token=cookieValue(request);if(!token)return null;
  return db(env).prepare('SELECT id, created_at, expires_at FROM brand_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token),now()).first();
}
async function ensureSession(request,env) {
  let current=await session(request,env);if(current)return {current};
  const token=randomToken(),createdAt=now(),expiresAt=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  const id=crypto.randomUUID(),ip=await ipHash(request),since=new Date(Date.now()-86400000).toISOString();
  const result=await db(env).prepare('INSERT INTO brand_sessions (id,token_hash,ip_hash,created_at,expires_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM brand_sessions WHERE ip_hash = ? AND created_at > ?) < 25').bind(id,await hash(token),ip,createdAt,expiresAt,ip,since).run();
  if(!result.meta.changes)throw new HttpError(429,'SESSION_LIMIT','เปิดเซสชันใหม่หลายครั้งเกินไป กรุณาใช้เบราว์เซอร์เดิมหรือลองภายหลัง');
  return {current:{id,created_at:createdAt,expires_at:expiresAt},cookie:sessionCookie(request,token)};
}
async function quota(request,env,current) {
  const today=day(),ip=await ipHash(request),bound=limits(env);
  const values=await db(env).prepare('SELECT SUM(CASE WHEN session_id = ? THEN 1 ELSE 0 END) AS session_used, SUM(CASE WHEN ip_hash = ? THEN 1 ELSE 0 END) AS ip_used, COUNT(*) AS global_used FROM brand_jobs WHERE day = ?').bind(current.id,ip,today).first();
  return {remaining:Math.max(0,Math.min(bound.session-(values.session_used||0),bound.ip-(values.ip_used||0),bound.global-values.global_used)),limit:bound.session,globalRemaining:Math.max(0,bound.global-values.global_used)};
}
async function sessionInfo(request,env) {
  const {current,cookie}=await ensureSession(request,env);
  const [allowance,pendingJob,latest,saved]=await Promise.all([
    quota(request,env,current),
    db(env).prepare("SELECT id,status,phase FROM brand_jobs WHERE session_id = ? AND status IN ('queued','analyzing','generating') ORDER BY created_at DESC LIMIT 1").bind(current.id).first(),
    // A trashed saved recipe must not reappear as its original generated job on reload.
    db(env).prepare("SELECT recipe_json FROM brand_jobs WHERE session_id = ? AND status = 'ready' AND NOT EXISTS (SELECT 1 FROM brand_recipes WHERE brand_recipes.job_id = brand_jobs.id AND brand_recipes.session_id = brand_jobs.session_id AND deleted_at IS NOT NULL) ORDER BY created_at DESC LIMIT 1").bind(current.id).first(),
    db(env).prepare('SELECT recipe_json, created_at FROM brand_recipes WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(current.id).first(),
  ]);
  const latestGenerated=latest?.recipe_json?JSON.parse(latest.recipe_json):null;
  const latestRecipe=saved&&(!latestGenerated||saved.created_at>=latestGenerated.createdAt)?JSON.parse(saved.recipe_json):latestGenerated;
  const activeState=pendingJob?await getJob(env,current,pendingJob.id):null;
  const activeJob=activeState&&['queued','analyzing','generating'].includes(activeState.status)?{id:activeState.id,status:activeState.status,phase:activeState.phase}:null;
  return json({...allowance,models:models(env),session:{createdAt:current.created_at,expiresAt:current.expires_at},activeJob:activeJob||null,latestRecipe},200,cookie?{'Set-Cookie':cookie}:{});
}
async function upload(request,env,current) {
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))throw new HttpError(415,'INVALID_INPUT','กรุณาอัปโหลดไฟล์รูป');
  let form;
  try { form=await new Response(await readBytes(request,MAX_UPLOAD_BYTES+64*1024),{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData(); } catch(error) { if(error instanceof HttpError)throw error;throw new HttpError(400,'INVALID_INPUT','เปิดไฟล์อัปโหลดไม่ได้'); }
  const file=form.get('file');
  if(!file || typeof file.arrayBuffer!=='function' || file.size<1 || file.size>MAX_UPLOAD_BYTES)throw new HttpError(400,'INVALID_INPUT','เลือกรูปขนาดไม่เกิน 5 MB');
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=sniffImage(bytes),id=crypto.randomUUID(),name=safeName(file.name),key=`brand-pot/originals/${current.id}/${id}`,ip=await ipHash(request),today=day();
  // One atomic INSERT guards upload volume even when clients upload concurrently.
  const inserted=await db(env).prepare(`INSERT INTO brand_assets (id,session_id,kind,r2_key,mime,bytes,original_name,state,ip_hash,day,created_at)
    SELECT ?,?,'original',?,?,?,?,'pending',?,?,?
    WHERE (SELECT COUNT(*) FROM brand_assets WHERE session_id = ? AND day = ? AND kind = 'original') < 60
      AND (SELECT COUNT(*) FROM brand_assets WHERE ip_hash = ? AND day = ? AND kind = 'original') < 120
      AND (SELECT COUNT(*) FROM brand_assets WHERE day = ? AND kind = 'original') < 1000`).bind(id,current.id,key,mime,bytes.length,name,ip,today,now(),current.id,today,ip,today,today).run();
  if(!inserted.meta.changes)throw new HttpError(429,'UPLOAD_LIMIT','ถึงขีดจำกัดอัปโหลดวันนี้แล้ว กรุณาลองใหม่พรุ่งนี้');
  try {
    await env.SLAPLY_UPLOADS.put(key,bytes,{httpMetadata:{contentType:mime},customMetadata:{assetId:id,kind:'original'}});
    await db(env).prepare("UPDATE brand_assets SET state = 'ready' WHERE id = ?").bind(id).run();
  } catch(error) {
    await db(env).prepare("UPDATE brand_assets SET state = 'failed' WHERE id = ?").bind(id).run();
    throw error;
  }
  return json({id,url:`/api/assets/${id}`,name,mime,bytes:bytes.length},201);
}
async function ownedAssets(env,current,ingredients) {
  const assets=await Promise.all(ingredients.map(item=>db(env).prepare("SELECT * FROM brand_assets WHERE id = ? AND session_id = ? AND kind = 'original' AND state = 'ready'").bind(item.id,current.id).first()));
  if(assets.some(x=>!x))throw notFound();
  if(assets.reduce((sum,asset)=>sum+asset.bytes,0)>MAX_JOB_UPLOAD_BYTES)throw new HttpError(400,'INPUT_TOTAL_TOO_LARGE','รูปในสูตรนี้รวมกันเกิน 18 MB กรุณาเลือกรูปขนาดเล็กลง');
  return assets;
}
async function ensureWorkflow(env,id) {
  if(!env.BRAND_GENERATION)return false;
  try { const instance=await env.BRAND_GENERATION.get(id);await instance.status();return true; } catch {}
  try { await env.BRAND_GENERATION.create({id,params:{jobId:id}});return true; } catch {
    // A concurrent create or a lost response can leave a real instance behind. Stable ids prevent duplicate charges.
    try { const instance=await env.BRAND_GENERATION.get(id);await instance.status();return true; } catch { return false; }
  }
}
function jobView(job) {
  return {id:job.id,status:job.status,phase:job.phase,recipe:job.recipe_json?JSON.parse(job.recipe_json):null,error:job.error_code?{code:job.error_code,message:job.error_message}:null,createdAt:job.created_at,updatedAt:job.updated_at};
}
async function createJob(request,env,current) {
  const input=validateJob(await bodyJson(request));
  const requestHash=await hash(JSON.stringify({ingredients:input.ingredients,brief:input.brief}));
  let existing=await db(env).prepare('SELECT * FROM brand_jobs WHERE session_id = ? AND request_key = ?').bind(current.id,input.idempotencyKey).first();
  if(existing){if(existing.request_hash!==requestHash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','รหัสคำขอนี้ถูกใช้กับสูตรอื่นแล้ว');if(existing.status==='queued')await ensureWorkflow(env,existing.id);return json(jobView(existing));}
  await ownedAssets(env,current,input.ingredients);
  if(!env.OPENAI_API_KEY || !env.BRAND_GENERATION)throw new HttpError(503,'AI_CONFIGURATION','ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply');
  if(env.AI_ENABLED==='false')throw new HttpError(503,'AI_PAUSED','ระบบสร้างแบรนด์พักให้บริการชั่วคราว');
  const id=crypto.randomUUID(),ip=await ipHash(request),today=day(),time=now(),bound=limits(env);
  const statements=[
    db(env).prepare(`INSERT OR IGNORE INTO brand_jobs (id,session_id,ip_hash,request_key,request_hash,status,phase,input_json,day,created_at,updated_at)
      SELECT ?,?,?,?,?,'queued','queued',?,?,?,?
      WHERE (SELECT COUNT(*) FROM brand_jobs WHERE session_id = ? AND day = ?) < ?
        AND (SELECT COUNT(*) FROM brand_jobs WHERE ip_hash = ? AND day = ?) < ?
        AND (SELECT COUNT(*) FROM brand_jobs WHERE day = ?) < ?`).bind(id,current.id,ip,input.idempotencyKey,requestHash,JSON.stringify(input),today,time,time,current.id,today,bound.session,ip,today,bound.ip,today,bound.global),
    db(env).prepare("UPDATE brand_jobs SET status = 'cancelled', phase = 'cancelled', updated_at = ? WHERE session_id = ? AND id != ? AND status IN ('queued','analyzing','generating') AND EXISTS (SELECT 1 FROM brand_jobs WHERE id = ?)").bind(time,current.id,id,id),
  ];
  // D1 batch is transactional: quota reservation and superseding earlier jobs happen together.
  const inserted=await db(env).batch(statements);
  if(!inserted[0].meta.changes){
    existing=await db(env).prepare('SELECT * FROM brand_jobs WHERE session_id = ? AND request_key = ?').bind(current.id,input.idempotencyKey).first();
    if(existing){if(existing.request_hash!==requestHash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','รหัสคำขอนี้ถูกใช้กับสูตรอื่นแล้ว');if(existing.status==='queued')await ensureWorkflow(env,existing.id);return json(jobView(existing));}
    throw new HttpError(429,'DAILY_LIMIT','ครบจำนวนรอบทดลองวันนี้แล้ว กลับมาปรุงใหม่ได้พรุ่งนี้');
  }
  if(!await ensureWorkflow(env,id))throw new HttpError(503,'JOB_START_FAILED','กำลังเชื่อมต่อระบบ AI กรุณาโหลดหน้าใหม่เพื่อติดตามรอบเดิม');
  return json({id,status:'queued',phase:'queued'},202);
}
async function getJob(env,current,id) {
  let job=await db(env).prepare('SELECT * FROM brand_jobs WHERE id = ? AND session_id = ?').bind(id,current.id).first();if(!job)throw notFound();
  if(['queued','analyzing','generating'].includes(job.status)){
    let terminal=false;
    if(job.status==='queued')await ensureWorkflow(env,job.id);
    try {const instance=await env.BRAND_GENERATION.get(job.id),state=await instance.status();terminal=['errored','terminated','complete'].includes(state.status);}catch{}
    // Protect the UI from indefinitely polling a runtime crash, terminated instance, or lost scheduler handoff.
    if(terminal||Date.now()-Date.parse(job.updated_at)>20*60*1000){
      await db(env).prepare("UPDATE brand_jobs SET status = 'failed',phase = 'failed',error_code = 'JOB_INTERRUPTED',error_message = ?,updated_at = ? WHERE id = ? AND status IN ('queued','analyzing','generating')").bind('งาน AI หยุดก่อนเสร็จ กรุณาลองปรุงใหม่',now(),job.id).run();
      job=await db(env).prepare('SELECT * FROM brand_jobs WHERE id = ? AND session_id = ?').bind(id,current.id).first();
    }
  }
  return job;
}
async function cancelJob(env,current,id) {
  await getJob(env,current,id);
  await db(env).prepare("UPDATE brand_jobs SET status = 'cancelled',phase = 'cancelled',updated_at = ? WHERE id = ? AND session_id = ? AND status IN ('queued','analyzing','generating')").bind(now(),id,current.id).run();
  // Do not terminate an in-flight provider call: record its actual usage when it returns.
  return json(jobView(await getJob(env,current,id)));
}
async function asset(env,current,id,method) {
  const record=await db(env).prepare("SELECT * FROM brand_assets WHERE id = ? AND session_id = ? AND state = 'ready'").bind(id,current.id).first();if(!record)throw notFound();
  const object=method==='HEAD'?await env.SLAPLY_UPLOADS.head(record.r2_key):await env.SLAPLY_UPLOADS.get(record.r2_key);if(!object)throw notFound();
  return new Response(method==='HEAD'?null:object.body,{headers:{'Content-Type':record.mime,'Content-Length':String(record.bytes),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cross-Origin-Resource-Policy':'same-origin'}});
}
async function saveRecipe(request,env,current) {
  const body=await bodyJson(request),supplied=body?.recipe;
  const jobId=supplied?.jobId || supplied?.id;
  if(!supplied || !UUID.test(jobId))throw new HttpError(400,'INVALID_INPUT','ข้อมูลสูตรไม่ถูกต้อง');
  const job=await getJob(env,current,jobId);
  if(job.status!=='ready'||!job.recipe_json)throw new HttpError(409,'RECIPE_NOT_READY','รอให้ปรุงเสร็จก่อนเก็บสูตร');
  const source=JSON.parse(job.recipe_json),id=crypto.randomUUID();
  // Only text/customization are editable. Client-supplied asset URLs and AI metadata are ignored.
  const version=(await db(env).prepare('SELECT COALESCE(MAX(version_number),0)+1 AS next FROM brand_recipes WHERE session_id = ? AND job_id = ?').bind(current.id,jobId).first()).next;
  const recipe=savedRecipe(source,supplied,id,version);
  const result=await db(env).prepare('INSERT OR IGNORE INTO brand_recipes (id,session_id,job_id,version_number,recipe_json,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM brand_recipes WHERE session_id = ?) < 200').bind(id,current.id,jobId,version,JSON.stringify(recipe),now(),current.id).run();
  if(!result.meta.changes)throw new HttpError(409,'SAVE_CONFLICT','บันทึกพร้อมกันหรือสูตรเต็มแล้ว กรุณาลองอีกครั้ง');
  return json({recipe,persisted:true},201);
}
function recipeView(row) {
  const recipe=JSON.parse(row.recipe_json);
  return row.deleted_at?{...recipe,trashedAt:row.deleted_at}:recipe;
}
async function trashRecipe(env,current,id,restore=false) {
  const row=await db(env).prepare('SELECT recipe_json,deleted_at FROM brand_recipes WHERE id = ? AND session_id = ?').bind(id,current.id).first();
  if(!row)throw notFound();
  if(restore){
    await db(env).prepare('UPDATE brand_recipes SET deleted_at = NULL WHERE id = ? AND session_id = ?').bind(id,current.id).run();
    return json({recipe:JSON.parse(row.recipe_json),restored:true});
  }
  // Repeated DELETE requests preserve the original trash timestamp.
  await db(env).prepare('UPDATE brand_recipes SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ? AND session_id = ?').bind(now(),id,current.id).run();
  const trashed=await db(env).prepare('SELECT recipe_json,deleted_at FROM brand_recipes WHERE id = ? AND session_id = ?').bind(id,current.id).first();
  return json({recipe:recipeView(trashed),trashed:true});
}
export async function handleApi(request,env) {
  try {
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(path==='/api/health'&&method==='GET')return json({ok:true,service:'slaply-brand-pot',version:'2026-11-04.1',paymentsEnabled:false,aiConfigured:Boolean(env.OPENAI_API_KEY&&env.BRAND_GENERATION),storageConfigured:Boolean(env.SLAPLY_DB&&env.SLAPLY_UPLOADS)});
    if(!env.SLAPLY_DB||!env.SLAPLY_UPLOADS)throw new HttpError(503,'STORAGE_CONFIGURATION','ระบบจัดเก็บยังไม่พร้อม กรุณาลองภายหลัง');
    if(request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'ORIGIN_REJECTED','กรุณาเปิด Slaply โดยตรง');
    if(!['GET','HEAD'].includes(method))assertMutationOrigin(request);
    if(path==='/api/session'&&method==='GET')return await sessionInfo(request,env);
    const current=await session(request,env);if(!current)throw new HttpError(401,'SESSION_REQUIRED','เซสชันหมดอายุ กรุณาโหลดหน้าใหม่');
    if(path==='/api/uploads'&&method==='POST')return await upload(request,env,current);
    if(path==='/api/jobs'&&method==='POST')return await createJob(request,env,current);
    const jobMatch=/^\/api\/jobs\/([0-9a-f-]+)(\/cancel)?$/.exec(path);
    if(jobMatch&&UUID.test(jobMatch[1])){
      if(method==='GET'&&!jobMatch[2]){const job=await getJob(env,current,jobMatch[1]);if(job.status==='queued')await ensureWorkflow(env,job.id);return json(jobView(job));}
      if(method==='POST'&&jobMatch[2])return await cancelJob(env,current,jobMatch[1]);
    }
    const assetMatch=/^\/api\/assets\/([0-9a-f-]+)$/.exec(path);
    if(assetMatch&&UUID.test(assetMatch[1])&&['GET','HEAD'].includes(method))return await asset(env,current,assetMatch[1],method);
    if(path==='/api/recipes'&&method==='GET'){
      const trash=url.searchParams.get('trash')==='1';
      const rows=await db(env).prepare(trash
        ?'SELECT recipe_json,deleted_at FROM brand_recipes WHERE session_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200'
        :'SELECT recipe_json,deleted_at FROM brand_recipes WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 40').bind(current.id).all();
      return json({recipes:rows.results.map(recipeView)});
    }
    if(path==='/api/recipes'&&method==='POST')return await saveRecipe(request,env,current);
    const recipeMatch=/^\/api\/recipes\/([0-9a-f-]+)(\/restore)?$/.exec(path);
    if(recipeMatch&&UUID.test(recipeMatch[1])){
      if(method==='DELETE'&&!recipeMatch[2])return await trashRecipe(env,current,recipeMatch[1]);
      if(method==='POST'&&recipeMatch[2])return await trashRecipe(env,current,recipeMatch[1],true);
    }
    throw notFound();
  } catch(error) { const safe=publicError(error);if(!(error instanceof HttpError))console.error('brand_api_failure',error?.name||'Error');return json(safe.body,safe.status); }
}
