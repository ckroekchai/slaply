import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { handleApi } from '../worker/api.mjs';
import {buildRecipe} from '../worker/core.mjs';
const origin='https://slaply.co';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64'));
function environment(extra={}){
  const sql=new DatabaseSync(':memory:');
  for(const migration of readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
  function prepared(query,params=[]){return {bind(...values){return prepared(query,values);},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){const result=sql.prepare(query).run(...params);return {meta:{changes:Number(result.changes)}};},query,params};}
  const storage=new Map(),instances=new Map();let created=0;
  const env={SLAPLY_DB:{prepare:prepared,async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>({meta:{changes:Number(sql.prepare(s.query).run(...s.params).changes)}}));sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}},SLAPLY_UPLOADS:{async put(key,bytes,options){storage.set(key,{body:bytes,...options});},async get(key){const object=storage.get(key);return object?{...object,async arrayBuffer(){return object.body.slice().buffer;}}:null;},async head(key){return storage.get(key)||null;}},OPENAI_API_KEY:'test-key-never-used',BRAND_GENERATION:{async create({id}){if(instances.has(id))throw new Error('Already exists');created++;instances.set(id,{status:'queued'});return {id};},async get(id){return {async status(){if(!instances.has(id))throw new Error('Not found');return instances.get(id);}};}},...extra};
  return {env,sql,storage,instances,get created(){return created;}};
}
async function call(ctx,path,{method='GET',cookie,body,headers={}}={}){
  const h={'CF-Connecting-IP':'203.0.113.12',...headers};if(cookie)h.Cookie=cookie;
  if(method!=='GET'&&method!=='HEAD')h.Origin=origin;
  if(body&&!(body instanceof FormData)&&!(body instanceof Blob)&&!ArrayBuffer.isView(body)&&!(body instanceof ArrayBuffer)&&!(body instanceof ReadableStream)){h['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await handleApi(new Request(origin+path,{method,headers:h,body}),ctx.env);
  const contentType=response.headers.get('Content-Type')||'';
  const data=contentType.startsWith('application/json')?await response.json():new Uint8Array(await response.arrayBuffer());
  return {response,data,status:response.status,cookie:response.headers.get('Set-Cookie')?.split(';')[0]};
}
async function start(ctx){const result=await call(ctx,'/api/session');assert.equal(result.status,200);return result.cookie;}
async function upload(ctx,cookie,name='ingredient.png'){const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),name);const r=await call(ctx,'/api/uploads',{method:'POST',cookie,body:form});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
async function inputs(ctx,cookie){const [a,b,c]=await Promise.all([upload(ctx,cookie,'first.png'),upload(ctx,cookie,'second.png'),upload(ctx,cookie,'third.png')]);return {ingredients:[{id:a.id,locked:true},{id:b.id,locked:false},{id:c.id,locked:false}],brief:{name:'ทดสอบแบรนด์',words:'สดใส เรียบง่าย'}};}
const requestBody=base=>({...base,idempotencyKey:crypto.randomUUID()});
const analysis={proposedName:'Test',concept:{title:'สดใสในทุกวัน',summary:'แนวคิดจากสีและรูปทรงในภาพ'},mood:'fresh',palette:['#558844','#EEAA66','#223344'],paper:'#FFF9EE',ink:'#202442',keywords:['สดใส','เรียบง่าย','สนุก'],audience:'ผู้ชมที่ผู้ใช้ระบุ',promise:'ออกแบบให้สื่อสารชัดเจน',observations:[{ingredientIndex:1,observed:'รูปทรงสีเขียว',inspiration:'รูปทรงโค้ง'},{ingredientIndex:2,observed:'สีส้ม',inspiration:'จุดเน้นสีส้ม'}],imagePrompt:'Original abstract forms in green and orange.'};
async function completedRecipe(ctx,cookie){
  const created=await call(ctx,'/api/jobs',{method:'POST',cookie,body:requestBody(await inputs(ctx,cookie))});
  const job=ctx.sql.prepare('SELECT * FROM brand_jobs WHERE id=?').get(created.data.id),assets=ctx.sql.prepare('SELECT * FROM brand_assets WHERE session_id=? ORDER BY created_at').all(job.session_id);
  const recipe=buildRecipe(job,analysis,assets,crypto.randomUUID(),ctx.env);
  ctx.sql.prepare("UPDATE brand_jobs SET status='ready',phase='ready',recipe_json=? WHERE id=?").run(JSON.stringify(recipe),job.id);
  const saved=await call(ctx,'/api/recipes',{method:'POST',cookie,body:{recipe:{...recipe,name:'สูตรที่บันทึก',customization:{hue:18,objectStyles:[]}}}});
  assert.equal(saved.status,201);return saved.data.recipe;
}


export {origin,png,environment,call,start,upload,inputs,requestBody,analysis,completedRecipe};
export const analysisV6={...analysis,schemaVersion:6,design:{template:'editorial',fontPair:'editorial-serif',imageStyle:'illustration',density:'airy'},brandSystem:{palette:[{role:'primary',hex:analysis.palette[0],name:'Leaf'},{role:'secondary',hex:analysis.palette[1],name:'Apricot'},{role:'accent',hex:analysis.palette[2],name:'Slate'},{role:'paper',hex:analysis.paper,name:'Paper'},{role:'ink',hex:analysis.ink,name:'Ink'}],typography:{headingSample:'ทดสอบแบรนด์',bodySample:'แนวคิดที่ออกแบบจากบรีฟ'},pattern:{kind:'stripe'},applications:[{kind:'social',headline:'ทดสอบแบรนด์',body:'พบกับแนวคิดของแบรนด์'},{kind:'business-card',headline:'ทดสอบแบรนด์',body:'จุดเริ่มต้นของบทสนทนา'}]}};

analysisV6.brandSystem.objects=[{id:'object-1',name:'ใบไม้พับ',rationale:'รูปทรงใบไม้สื่อความอบอุ่นและการเริ่มต้น',visual:'A single folded leaf with a clean rounded silhouette',colors:['primary']},{id:'object-2',name:'ซุ้มโค้ง',rationale:'เส้นโค้งเปิดรับบทสนทนาอย่างเป็นกันเอง',visual:'A single soft architectural arch with a rounded top',colors:['secondary','accent']},{id:'object-3',name:'หยดแสง',rationale:'หยดเล็กเป็นจุดเน้นที่สนุกแต่เรียบง่าย',visual:'A single asymmetrical teardrop with a small curved tip',colors:['accent']}];

analysisV6.observations=[{...analysis.observations[0],role:'logo'},{...analysis.observations[1],role:'reference'},{ingredientIndex:3,role:'product',observed:'สินค้าสีอบอุ่น',inspiration:'พื้นผิวที่เป็นกันเอง'}];
analysisV6.identity={ingredientIndex:1,visual:'A unique open arch symbol with a small rounded leaf-shaped counter, in the brand palette',rationale:'เครื่องหมายใหม่ที่สื่อถึงการเปิดรับและความอบอุ่น'};
