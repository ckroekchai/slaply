export const PROMPT_VERSION = 'brand-pot-2026-11-04.1';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
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
export function models(env) { return { text: env.OPENAI_BRAND_MODEL || 'gpt-5.4-mini', image: env.OPENAI_IMAGE_MODEL || 'gpt-image-2' }; }
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
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dimensions = (width,height) => {
    if (!width || !height || width * height > 40_000_000) throw new HttpError(400, 'INVALID_IMAGE', 'รูปนี้มีขนาดพิกเซลใหญ่เกินไป (สูงสุด 40 ล้านพิกเซล)');
  };
  if (b.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)) {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    dimensions(width,height);
    return 'image/png';
  }
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) {
    let offset=2;
    while(offset+4<b.length){
      if(b[offset++]!==255)break;
      while(b[offset]===255)offset++;
      const marker=b[offset++];if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      const length=(b[offset]<<8)|b[offset+1];if(length<2||offset+length>b.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){dimensions((b[offset+5]<<8)|b[offset+6],(b[offset+3]<<8)|b[offset+4]);return 'image/jpeg';}
      offset+=length;
    }
    throw new HttpError(400,'INVALID_IMAGE','อ่านขนาดรูป JPG ไม่ได้ กรุณาเลือกไฟล์อื่น');
  }
  if (b.length >= 30 && new TextDecoder().decode(b.slice(0,4)) === 'RIFF' && new TextDecoder().decode(b.slice(8,12)) === 'WEBP') {
    const kind=new TextDecoder().decode(b.slice(12,16));
    if(kind==='VP8X'){dimensions(1+b[24]+(b[25]<<8)+(b[26]<<16),1+b[27]+(b[28]<<8)+(b[29]<<16));return 'image/webp';}
    if(kind==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42){dimensions(((b[27]<<8)|b[26])&16383,((b[29]<<8)|b[28])&16383);return 'image/webp';}
    if(kind==='VP8L'&&b[20]===47){const bits=new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(21,true);dimensions((bits&16383)+1,((bits>>>14)&16383)+1);return 'image/webp';}
    throw new HttpError(400,'INVALID_IMAGE','อ่านขนาดรูป WebP ไม่ได้ กรุณาเลือกไฟล์อื่น');
  }
  throw new HttpError(400, 'INVALID_IMAGE', 'รองรับรูป JPG, PNG และ WebP เท่านั้น');
}
function cleanText(value, maximum, field) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, 'INVALID_INPUT', `${field}ไม่ถูกต้อง`);
  return value.trim();
}
export function validateJob(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_INPUT', 'ข้อมูลสูตรไม่ถูกต้อง');
  if (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey)) throw new HttpError(400, 'INVALID_INPUT', 'รหัสคำขอไม่ถูกต้อง กรุณาลองใหม่');
  if (!Array.isArray(body.ingredients) || body.ingredients.length < 2 || body.ingredients.length > 6) throw new HttpError(400, 'INVALID_INPUT', 'ใส่วัตถุดิบอย่างน้อย 2 และไม่เกิน 6 อย่าง');
  const ingredients = body.ingredients.map(item => {
    if (!item || !UUID.test(item.id) || (item.locked !== undefined && typeof item.locked !== 'boolean')) throw new HttpError(400, 'INVALID_INPUT', 'ข้อมูลวัตถุดิบไม่ถูกต้อง');
    return { id: item.id, locked: Boolean(item.locked) };
  });
  if (new Set(ingredients.map(x => x.id)).size !== ingredients.length) throw new HttpError(400, 'INVALID_INPUT', 'วัตถุดิบแต่ละช่องต้องเป็นการอัปโหลดแยกกัน');
  return { idempotencyKey: body.idempotencyKey, ingredients, brief: { name: cleanText(body.brief?.name ?? '', 80, 'ชื่อแบรนด์'), words: cleanText(body.brief?.words ?? '', 1000, 'คำบรรยาย') } };
}
export function normalizeCustomization(input = {}) {
  const clamp = (key, lo, hi, fallback) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.min(hi, Math.max(lo, input[key])) : fallback;
  const objectStyles = Array.isArray(input.objectStyles) ? ['bloom','orbit','ribbon'].filter(v => input.objectStyles.includes(v)) : ['bloom'];
  return { textScale: clamp('textScale',75,125,100), objectScale: clamp('objectScale',50,150,100), objectStyles, objectStyle: objectStyles[0] || null, hue: clamp('hue',-180,180,0), brightness: clamp('brightness',50,150,100), saturation: clamp('saturation',0,180,100) };
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
    observations: {type:'array',items:{type:'object',additionalProperties:false,properties:{ingredientIndex:{type:'integer'},observed:string,inspiration:string},required:['ingredientIndex','observed','inspiration']},minItems:2,maxItems:6},
    imagePrompt:string,
  },
  required:['proposedName','concept','mood','palette','paper','ink','keywords','audience','promise','observations','imagePrompt'],
};
export function validateAnalysis(data, count, suppliedName = '') {
  const bad = () => { throw new HttpError(502, 'AI_INVALID_OUTPUT', 'AI ส่งผลลัพธ์ไม่ครบ กรุณาลองปรุงใหม่'); };
  if (!data || typeof data !== 'object') bad();
  // A supplied name is authoritative; the model should not be forced to invent another.
  if (typeof data.proposedName !== 'string' || data.proposedName.length > 80 || (!String(suppliedName).trim() && !data.proposedName.trim())) bad();
  for (const [key,max] of [['audience',180],['promise',240],['imagePrompt',3000]]) if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > max) bad();
  if (!data.concept || typeof data.concept.title !== 'string' || !data.concept.title.trim() || data.concept.title.length > 100 || typeof data.concept.summary !== 'string' || !data.concept.summary.trim() || data.concept.summary.length > 600) bad();
  if (!['fresh','bold','luxe'].includes(data.mood) || !Array.isArray(data.palette) || data.palette.length !== 3 || [...data.palette,data.paper,data.ink].some(v=>!/^#[a-f0-9]{6}$/i.test(v))) bad();
  if (!Array.isArray(data.keywords) || data.keywords.length !== 3 || data.keywords.some(v=>typeof v!=='string'||!v.trim()||v.length>32)) bad();
  if (!Array.isArray(data.observations) || data.observations.length !== count || new Set(data.observations.map(x=>x.ingredientIndex)).size !== count || data.observations.some(x=>!Number.isInteger(x.ingredientIndex)||x.ingredientIndex<1||x.ingredientIndex>count||typeof x.observed!=='string'||x.observed.length>300||typeof x.inspiration!=='string'||x.inspiration.length>300)) bad();
  return data;
}
export function analysisDiagnostics(data, count, suppliedName = '') {
  const type = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const text = value => ({ type:type(value), length:typeof value==='string'?value.length:null, empty:typeof value==='string'?!value.trim():null });
  const validColor = value => typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
  return {
    expectedIngredientCount:count, suppliedNamePresent:Boolean(String(suppliedName).trim()), outputType:type(data),
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
  const ingredients = input.ingredients.map((item,index)=>({id:item.id,src:`/api/assets/${item.id}`,name:assets[index].original_name,locked:item.locked,observation:analysis.observations.find(o=>o.ingredientIndex===index+1)?.observed}));
  const primary = ingredients.find(x=>x.locked) || ingredients[0];
  const reference = ingredients.find(x=>x!==primary) || primary;
  return { id:job.id,jobId:job.id,version:1,name:input.brief.name || analysis.proposedName,words:input.brief.words || analysis.concept.summary,concept:analysis.concept,mood:analysis.mood,palette:analysis.palette,paper:analysis.paper,ink:analysis.ink,keywords:analysis.keywords,audience:analysis.audience,promise:analysis.promise,observations:analysis.observations,image:primary.src,productImage:primary.src,referenceImage:reference.src,referenceColor:analysis.palette[0],generatedImage:`/api/assets/${imageId}`,ingredients,locked:ingredients.some(x=>x.locked),strength:64,format:'guideline',customization:normalizeCustomization({objectStyles:[{fresh:'bloom',bold:'orbit',luxe:'ribbon'}[analysis.mood]]}),createdAt:now(),ai:{textModel:models(env).text,imageModel:models(env).image,promptVersion:PROMPT_VERSION,generatedAt:now(),status:'generated',originalsPreserved:true} };
}
export function publicError(error) {
  return error instanceof HttpError ? { status:error.status, body:{error:{code:error.code,message:error.message}} } : {status:500,body:{error:{code:'INTERNAL_ERROR',message:'ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง'}}};
}
export function providerError(status, code) {
  if (status === 401 || status === 403) return new HttpError(503,'AI_CONFIGURATION','ระบบ AI ยังไม่พร้อมให้บริการ กรุณาติดต่อ Slaply');
  if (status === 429) return new HttpError(503,'AI_BUSY','ระบบ AI ถึงขีดจำกัดชั่วคราว กรุณาลองภายหลัง');
  if (String(code).includes('moderation') || String(code).includes('content_policy')) return new HttpError(422,'AI_REFUSAL','AI ไม่สามารถสร้างจากวัตถุดิบนี้ได้ กรุณาเปลี่ยนรูปหรือคำบรรยาย');
  return new HttpError(502,'AI_PROVIDER_ERROR','สร้างผลลัพธ์ไม่สำเร็จ กรุณาลองอีกครั้ง');
}
