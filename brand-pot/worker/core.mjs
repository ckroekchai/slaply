import { inspectImage } from './image-validation.mjs';
import { modelPolicy, summarizeUsage } from './model-policy.mjs';
export const PROMPT_VERSION = 'brand-guideline-2026-11-05.2';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_JOB_UPLOAD_BYTES = 18 * 1024 * 1024;
export const SESSION_DAYS = 90;
export const ACTIVE_STATUSES = ['queued', 'analyzing', 'generating'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const now = () => new Date().toISOString();
export const day = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function boundedInteger(value, fallback, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}
export function limits(env) {
  return {
    session: boundedInteger(env.DAILY_SESSION_LIMIT, 5, 100),
    ip: boundedInteger(env.DAILY_IP_LIMIT, 10, 200),
    global: boundedInteger(env.DAILY_GLOBAL_LIMIT, 40, 1000),
  };
}
export function models(env) { const policy=modelPolicy(env); return {text:policy.text,image:policy.image}; }
export function assertMutationOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new HttpError(403, 'ORIGIN_REJECTED', 'คำขอนี้ไม่ได้มาจากหน้า Slaply กรุณาเปิดเว็บแล้วลองใหม่');
  }
}
export function cookieName(request) { return new URL(request.url).protocol === 'https:' ? '__Host-slaply_session' : 'slaply_session'; }
export function cookieValue(request) {
  const name = cookieName(request);
  const value = request.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function sessionCookie(request, token) {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function randomToken() { const b = crypto.getRandomValues(new Uint8Array(32)); return [...b].map(v => v.toString(16).padStart(2, '0')).join(''); }
export function safeName(name) { return String(name || 'ingredient').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 120) || 'ingredient'; }
export function sniffImage(bytes) { return inspectImage(bytes).mime; }
export { inspectImage };
export async function hashBytes(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function cleanText(value, maximum, field) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, 'INVALID_INPUT', `${field}ไม่ถูกต้อง`);
  return value.trim();
}
export function validateJob(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_INPUT', 'ข้อมูลสูตรไม่ถูกต้อง');
  if (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey)) throw new HttpError(400, 'INVALID_INPUT', 'รหัสคำขอไม่ถูกต้อง กรุณาลองใหม่');
  if (body.schemaVersion !== undefined && body.schemaVersion !== 6) throw new HttpError(400,'INVALID_INPUT','รุ่นข้อมูลสูตรไม่รองรับ กรุณาโหลดหน้าใหม่');
  if (!Array.isArray(body.ingredients) || body.ingredients.length < 1 || body.ingredients.length > 6) throw new HttpError(400, 'INVALID_INPUT', 'ใส่โลโก้พร้อมบรีฟ หรือวัตถุดิบ 2–6 อย่าง');
  const ingredients = body.ingredients.map(item => {
    if (!item || !UUID.test(item.id) || (item.locked !== undefined && typeof item.locked !== 'boolean') || (item.role !== undefined && !['logo','product','reference'].includes(item.role))) throw new HttpError(400, 'INVALID_INPUT', 'ข้อมูลวัตถุดิบไม่ถูกต้อง');
    return { id: item.id, role:item.role||'reference', locked: Boolean(item.locked) };
  });
  const brief={name:cleanText(body.brief?.name??'',80,'ชื่อแบรนด์'),words:cleanText(body.brief?.words??'',1000,'คำบรรยาย')};
  for(const field of ['category','audience','offering','constraints'])if(body.brief?.[field]!==undefined)brief[field]=cleanText(body.brief[field],field==='constraints'?600:240,'ข้อมูลแบรนด์');
  const logos=ingredients.filter(item=>item.role==='logo');
  if(logos.length>1)throw new HttpError(400,'INVALID_INPUT','เลือกโลโก้หลักได้หนึ่งไฟล์ต่อสูตร');
  if(ingredients.length===1&&(!logos.length||!brief.words))throw new HttpError(400,'INVALID_INPUT','ใส่โลโก้พร้อมคำบรรยายแบรนด์ หรือเพิ่มวัตถุดิบอย่างน้อย 2 อย่าง');
  if (new Set(ingredients.map(x => x.id)).size !== ingredients.length) throw new HttpError(400, 'INVALID_INPUT', 'วัตถุดิบแต่ละช่องต้องเป็นการอัปโหลดแยกกัน');
  return { schemaVersion:6,idempotencyKey: body.idempotencyKey, ingredients, brief };
}
export function normalizeCustomization(input = {}) {
  input=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const clamp = (key, lo, hi, fallback) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.min(hi, Math.max(lo, input[key])) : fallback;
  const objectStyles = Array.isArray(input.objectStyles) ? ['bloom','orbit','ribbon'].filter(v => input.objectStyles.includes(v)) : ['bloom'];
  const board={};
  for(const [key,values] of Object.entries({layout:['auto','editorial','expressive','minimal'],fontPair:['auto','grotesk','editorial-serif','display'],density:['auto','airy','balanced','compact'],pattern:['auto','repeat','stripe','tile'],logoBackdrop:['auto','light','dark']}))if(Object.hasOwn(input,key))board[key]=values.includes(input[key])?input[key]:values[0];
  if(Object.hasOwn(input,'logoScale'))board.logoScale=clamp('logoScale',70,115,100);
  return { ...board,textScale: clamp('textScale',75,125,100), objectScale: clamp('objectScale',50,150,100), objectStyles, objectStyle: objectStyles[0] || null, hue: clamp('hue',-180,180,0), brightness: clamp('brightness',50,150,100), saturation: clamp('saturation',0,180,100) };
}
export function savedRecipe(source, supplied, id, version) {
  const concept={title:cleanText(supplied.concept?.title??source.concept.title,120,'ชื่อแนวคิด'),summary:cleanText(supplied.concept?.summary??source.concept.summary,1000,'คำอธิบายแนวคิด')};
  return { ...source, id, jobId: source.jobId || source.id, version, savedAt: now(), name: cleanText(supplied.name ?? source.name, 80, 'ชื่อแบรนด์'), words: cleanText(supplied.words ?? source.words, 1000, 'คำบรรยาย'), concept, customization: normalizeCustomization(supplied.customization || source.customization) };
}
const string = { type: 'string' };
export const ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    proposedName: string, concept: { type:'object', additionalProperties:false, properties:{title:string,summary:string}, required:['title','summary'] },
    mood: { type:'string', enum:['fresh','bold','luxe'] },
    palette: { type:'array',items:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},minItems:3,maxItems:3 },
    paper: {type:'string',pattern:'^#[0-9A-Fa-f]{6}$'}, ink: {type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},
    keywords: {type:'array',items:string,minItems:3,maxItems:3}, audience:string, promise:string,
    observations: {type:'array',items:{type:'object',additionalProperties:false,properties:{ingredientIndex:{type:'integer'},observed:string,inspiration:string},required:['ingredientIndex','observed','inspiration']},minItems:1,maxItems:6},
    imagePrompt:string,
  },
  required:['proposedName','concept','mood','palette','paper','ink','keywords','audience','promise','observations','imagePrompt'],
};
export const DESIGN_ENUMS=Object.freeze({template:['editorial','expressive','minimal'],fontPair:['grotesk','editorial-serif','display'],imageStyle:['graphic','illustration','collage','material'],density:['airy','balanced','compact']});
const objectSchema=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const enumSchema=values=>({type:'string',enum:values});
const paletteRoles=['primary','secondary','accent','paper','ink'];
ANALYSIS_SCHEMA.properties.schemaVersion={type:'integer',enum:[6]};
ANALYSIS_SCHEMA.properties.design=objectSchema(Object.fromEntries(Object.entries(DESIGN_ENUMS).map(([key,values])=>[key,enumSchema(values)])));
ANALYSIS_SCHEMA.properties.brandSystem=objectSchema({
  palette:{type:'array',minItems:5,maxItems:5,items:objectSchema({role:enumSchema(paletteRoles),hex:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},name:string})},
  typography:objectSchema({headingSample:string,bodySample:string}),
  pattern:objectSchema({kind:enumSchema(['repeat','stripe','tile'])}),
  applications:{type:'array',minItems:2,maxItems:2,items:objectSchema({kind:enumSchema(['social','business-card']),headline:string,body:string})},
});
ANALYSIS_SCHEMA.required.push('schemaVersion','design','brandSystem');
export function validateBrandSystem(data) {
  const bad=()=>{throw new HttpError(502,'AI_INVALID_OUTPUT','AI ส่งรายละเอียด Brand Guideline ไม่ครบ กรุณาลองใหม่');};
  const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  if(data.schemaVersion!==6||!data.design||Object.entries(DESIGN_ENUMS).some(([key,values])=>!values.includes(data.design[key])))bad();
  const system=data.brandSystem;
  if(!system||!Array.isArray(system.palette)||system.palette.length!==5||new Set(system.palette.map(x=>x?.role)).size!==5||system.palette.some(x=>!x||!paletteRoles.includes(x.role)||!/^#[a-f0-9]{6}$/i.test(x.hex)||!text(x.name,60)))bad();
  if(!system.typography||!text(system.typography.headingSample,100)||!text(system.typography.bodySample,320)||!['repeat','stripe','tile'].includes(system.pattern?.kind))bad();
  if(!Array.isArray(system.applications)||system.applications.length!==2||new Set(system.applications.map(x=>x?.kind)).size!==2||system.applications.some(x=>!x||!['social','business-card'].includes(x.kind)||!text(x.headline,100)||!text(x.body,320)))bad();
  const color=role=>system.palette.find(x=>x.role===role).hex.toUpperCase();
  if(['primary','secondary','accent'].some((role,i)=>color(role)!==data.palette[i].toUpperCase())||color('paper')!==data.paper.toUpperCase()||color('ink')!==data.ink.toUpperCase())bad();
  return data;
}
export function validateAnalysis(data, count, suppliedName = '', schemaVersion = 5) {
  const bad = () => { throw new HttpError(502, 'AI_INVALID_OUTPUT', 'AI ส่งผลลัพธ์ไม่ครบ กรุณาลองปรุงใหม่'); };
  if (!data || typeof data !== 'object') bad();
  // A supplied name is authoritative; the model should not be forced to invent another.
  if (typeof data.proposedName !== 'string' || data.proposedName.length > 80 || (!String(suppliedName).trim() && !data.proposedName.trim())) bad();
  for (const [key,max] of [['audience',180],['promise',240],['imagePrompt',3000]]) if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > max) bad();
  if (!data.concept || typeof data.concept.title !== 'string' || !data.concept.title.trim() || data.concept.title.length > 100 || typeof data.concept.summary !== 'string' || !data.concept.summary.trim() || data.concept.summary.length > 600) bad();
  if (!['fresh','bold','luxe'].includes(data.mood) || !Array.isArray(data.palette) || data.palette.length !== 3 || [...data.palette,data.paper,data.ink].some(v=>!/^#[a-f0-9]{6}$/i.test(v))) bad();
  if (!Array.isArray(data.keywords) || data.keywords.length !== 3 || data.keywords.some(v=>typeof v!=='string'||!v.trim()||v.length>32)) bad();
  if (!Array.isArray(data.observations) || data.observations.length !== count || new Set(data.observations.map(x=>x?.ingredientIndex)).size !== count || data.observations.some(x=>!x||!Number.isInteger(x.ingredientIndex)||x.ingredientIndex<1||x.ingredientIndex>count||typeof x.observed!=='string'||!x.observed.trim()||x.observed.length>300||typeof x.inspiration!=='string'||!x.inspiration.trim()||x.inspiration.length>300)) bad();
  if(schemaVersion===6)validateBrandSystem(data);
  return data;
}
export function analysisDiagnostics(data, count, suppliedName = '') {
  const type = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const text = value => ({ type:type(value), length:typeof value==='string'?value.length:null, empty:typeof value==='string'?!value.trim():null });
  const validColor = value => typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
  return {
    schemaVersion:data?.schemaVersion===6?6:null,designValid:Boolean(data?.design)&&Object.entries(DESIGN_ENUMS).every(([key,values])=>values.includes(data.design[key])),brandSystemPresent:Boolean(data?.brandSystem),brandPaletteCount:Array.isArray(data?.brandSystem?.palette)?data.brandSystem.palette.length:null,applicationCount:Array.isArray(data?.brandSystem?.applications)?data.brandSystem.applications.length:null,expectedIngredientCount:count, suppliedNamePresent:Boolean(String(suppliedName).trim()), outputType:type(data),
    fields:Object.fromEntries(['proposedName','audience','promise','imagePrompt'].map(key=>[key,text(data?.[key])])),
    concept:{type:type(data?.concept),title:text(data?.concept?.title),summary:text(data?.concept?.summary)},
    moodValid:['fresh','bold','luxe'].includes(data?.mood),
    palette:{type:type(data?.palette),count:Array.isArray(data?.palette)?data.palette.length:null,colorsValid:Array.isArray(data?.palette)?data.palette.map(validColor):null,paperValid:validColor(data?.paper),inkValid:validColor(data?.ink)},
    keywords:{type:type(data?.keywords),count:Array.isArray(data?.keywords)?data.keywords.length:null,items:Array.isArray(data?.keywords)?data.keywords.map(text):null},
    observations:{type:type(data?.observations),count:Array.isArray(data?.observations)?data.observations.length:null,uniqueIndexCount:Array.isArray(data?.observations)?new Set(data.observations.map(x=>x?.ingredientIndex)).size:null,items:Array.isArray(data?.observations)?data.observations.map(x=>({indexValid:Number.isInteger(x?.ingredientIndex)&&x.ingredientIndex>=1&&x.ingredientIndex<=count,observed:text(x?.observed),inspiration:text(x?.inspiration)})):null},
  };
}
export function buildRecipe(job, analysis, assets, imageId, env) {
  const input = JSON.parse(job.input_json);
  const ingredients = input.ingredients.map((item,index)=>{
    const asset=assets[index],originalSrc=`/api/assets/${item.id}`,converted=Boolean(asset.render_r2_key);
    return {id:item.id,src:converted?`${originalSrc}/preview`:originalSrc,originalSrc,originalUrl:originalSrc,name:asset.original_name,bytes:asset.bytes,mime:asset.mime,width:(converted?asset.render_width:asset.width)??null,height:(converted?asset.render_height:asset.height)??null,sourceWidth:asset.width??null,sourceHeight:asset.height??null,sha256:asset.sha256??null,...(converted?{renderMime:asset.render_mime,renderSha256:asset.render_sha256,renderer:asset.renderer_version,converterVersion:asset.converter_version}:{}),role:item.role||'reference',locked:item.locked,observation:analysis.observations.find(o=>o.ingredientIndex===index+1)?.observed};
  });
  const logoIngredient=ingredients.find(x=>x.role==='logo');
  const primary=ingredients.find(x=>x.role==='product')||logoIngredient||ingredients.find(x=>x.locked)||ingredients[0];
  const reference=ingredients.find(x=>x.role==='reference'&&x!==primary)||ingredients.find(x=>x!==primary)||primary;
  const policy=input.modelPolicy||modelPolicy(env),usage=summarizeUsage(job.usage_json?JSON.parse(job.usage_json):{});
  const logo=logoIngredient?{...Object.fromEntries(['src','originalSrc','originalUrl','width','height','sourceWidth','sourceHeight','sha256','mime','renderMime','renderSha256','renderer','converterVersion'].filter(key=>logoIngredient[key]!==undefined).map(key=>[key,logoIngredient[key]])),assetId:logoIngredient.id,preserveOriginal:true}:null;
  const v6=analysis.schemaVersion===6;
  const result={schemaVersion:v6?6:5,id:job.id,jobId:job.id,version:1,sourceName:input.brief.name || analysis.proposedName,name:input.brief.name || analysis.proposedName,words:input.brief.words || analysis.concept.summary,brief:input.brief,concept:analysis.concept,mood:analysis.mood,palette:analysis.palette,paper:analysis.paper,ink:analysis.ink,keywords:analysis.keywords,audience:analysis.audience,promise:analysis.promise,observations:analysis.observations,image:primary.src,productImage:primary.src,referenceImage:reference.src,referenceColor:analysis.palette[0],generatedImage:`/api/assets/${imageId}`,logo,ingredients,locked:ingredients.some(x=>x.locked),strength:64,format:'guideline',customization:normalizeCustomization(v6?{objectStyles:[],layout:'auto',fontPair:'auto',density:'auto',pattern:'auto',logoBackdrop:'auto',logoScale:100}:{objectStyles:[]}),createdAt:now(),ai:{textModel:policy.text,imageModel:policy.image,policy,promptVersion:PROMPT_VERSION,generatedAt:now(),status:'generated',originalsPreserved:true,...usage}};
  if(v6){result.design=analysis.design;result.brandSystem=analysis.brandSystem;result.palette=['primary','secondary','accent'].map(role=>analysis.brandSystem.palette.find(color=>color.role===role).hex);result.paper=analysis.brandSystem.palette.find(color=>color.role==='paper').hex;result.ink=analysis.brandSystem.palette.find(color=>color.role==='ink').hex;result.referenceColor=result.palette[0];}
  return result;
}
export function publicError(error) {
  if(error?.code==='AI_CONFIGURATION')return {status:503,body:{error:{code:'AI_CONFIGURATION',message:'ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply'}}};
  return error instanceof HttpError ? { status:error.status, body:{error:{code:error.code,message:error.message}} } : {status:500,body:{error:{code:'INTERNAL_ERROR',message:'ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง'}}};
}
export function providerError(status, code) {
  if (status === 401 || status === 403) return new HttpError(503,'AI_CONFIGURATION','ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply');
  if (status === 429) return new HttpError(503,'AI_BUSY','ระบบ AI ถึงขีดจำกัดชั่วคราว กรุณาลองภายหลัง');
  if (String(code).includes('moderation') || String(code).includes('content_policy')) return new HttpError(422,'AI_REFUSAL','AI ไม่สามารถสร้างจากวัตถุดิบนี้ได้ กรุณาเปลี่ยนรูปหรือคำบรรยาย');
  return new HttpError(502,'AI_PROVIDER_ERROR','สร้างผลลัพธ์ไม่สำเร็จ กรุณาลองอีกครั้ง');
}
