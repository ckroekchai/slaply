#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const runStartedAt = new Date().toISOString();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const mode = arg('mode') || 'smoke';
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8788');
assert(['http:', 'https:'].includes(base.protocol), 'BASE_URL must be HTTP(S)');
assert(base.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use HTTPS for non-local evaluation');
assert(['smoke', 'generate', 'cancel', 'limit'].includes(mode), 'mode is smoke, generate, cancel, or limit');
if (mode !== 'smoke') assert.equal(process.env.RUN_PAID_EVAL, '1', 'Paid modes require RUN_PAID_EVAL=1; each accepted new job may incur OpenAI charges');
const cases = JSON.parse(await readFile(path.join(root, 'evals/cases.json'), 'utf8'));
const chosen = cases.find(item => item.id === (arg('case') || 'thai_beverage'));
assert(chosen, 'Unknown --case');
const fixtures = {
  beverage: path.join(root, 'public/assets/poko-product.png'),
  fresh: path.join(root, 'public/assets/poko-fresh.png'),
  bold: path.join(root, 'public/assets/poko-bold.png'),
  luxe: path.join(root, 'public/assets/poko-luxe.png'),
  food: process.env.EVAL_FOOD_IMAGE,
  skincare: process.env.EVAL_SKINCARE_IMAGE,
};
const results = [];
const record = (name, detail = {}) => { results.push({ name, passed: true, ...detail }); console.log(`PASS ${name}`); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS || 600000);
class Client {
  cookie = '';
  async call(route, {method = 'GET', body, headers = {}, raw = false} = {}) {
    const url = new URL(route, base);
    assert.equal(url.origin, base.origin, 'Evaluation never sends session cookies off-origin');
    const requestHeaders = { Origin: base.origin, ...headers };
    if (this.cookie) requestHeaders.Cookie = this.cookie;
    if (body && !(body instanceof FormData)) { requestHeaders['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const res = await fetch(url, {method, headers: requestHeaders, body, signal: AbortSignal.timeout(30000), redirect: 'error'});
    const cookies = res.headers.getSetCookie?.() || [];
    if (cookies.length) this.cookie = cookies.map(value => value.split(';')[0]).join('; ');
    const data = raw ? new Uint8Array(await res.arrayBuffer()) : await res.json().catch(() => null);
    return {status: res.status, headers: res.headers, data};
  }
}
const owner = new Client(), stranger = new Client();
const expectStatus = (response, codes, label) => assert(codes.includes(response.status), `${label}: expected ${codes}, received ${response.status} (${response.data?.error?.code || 'no error code'})`);
const upload = async key => {
  assert(fixtures[key], `Missing ${key} fixture. Set EVAL_${key.toUpperCase()}_IMAGE to an owned representative raster; do not substitute unrelated product imagery.`);
  const bytes = await readFile(fixtures[key]);
  const extension = path.extname(fixtures[key]).toLowerCase();
  const mime = extension === '.webp' ? 'image/webp' : ['.jpg','.jpeg'].includes(extension) ? 'image/jpeg' : 'image/png';
  const form = new FormData(); form.append('file', new Blob([bytes], {type:mime}), `eval-${key}${extension}`);
  const res = await owner.call('/api/uploads', {method:'POST', body:form});
  expectStatus(res, [200,201], `upload ${key}`); assert(res.data.id && res.data.url, 'Upload returns id and protected URL');
  return {...res.data, bytes};
};
async function poll(id) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await owner.call(`/api/jobs/${id}`); expectStatus(res, [200], 'job polling');
    if (['ready','failed','cancelled'].includes(res.data.status)) return res.data;
    await new Promise(resolve => setTimeout(resolve, 1800));
  }
  throw new Error(`Job ${id} did not reach a terminal state within ${timeoutMs} ms; it may still be running`);
}
async function main() {
  const [homepage, ...sessions] = await Promise.all([owner.call('/',{raw:true}),owner.call('/api/session'), stranger.call('/api/session')]);
  expectStatus(homepage,[200],'homepage'); assert(/text\/html/i.test(homepage.headers.get('content-type')||''),'Homepage returns HTML'); assert(/Slaply/i.test(new TextDecoder().decode(homepage.data)),'Homepage identifies Slaply'); record('Brand Pot homepage serves');
  sessions.forEach(res => expectStatus(res,[200],'session')); assert(owner.cookie && stranger.cookie && owner.cookie !== stranger.cookie, 'Separate clients receive separate sessions');
  const cookieHeader = sessions[0].headers.get('set-cookie') || '';
  assert(/HttpOnly/i.test(cookieHeader) && /SameSite=/i.test(cookieHeader), 'Cookie must be HttpOnly with SameSite');
  if (base.protocol === 'https:') assert(/Secure/i.test(cookieHeader), 'Production cookie must be Secure');
  record('isolated sessions and cookie security');
  const originalCookie=owner.cookie; const repeatSession=await owner.call('/api/session'); expectStatus(repeatSession,[200],'repeat session'); assert.equal(owner.cookie,originalCookie,'Existing cookie remains stable');
  for(const snapshot of [sessions[0].data,repeatSession.data]){assert(Number.isInteger(snapshot.remaining)&&snapshot.remaining>=0&&snapshot.remaining<=snapshot.limit,'Session quota is bounded');assert(Number.isInteger(snapshot.globalRemaining)&&snapshot.globalRemaining>=0&&snapshot.remaining<=snapshot.globalRemaining,'Remaining reflects global cap');} record('existing session and bounded quota survive reload');
  const rejection = await owner.call('/api/jobs', {method:'POST', body:{}, headers:{Origin:'https://untrusted.invalid'}});
  expectStatus(rejection,[403],'cross-origin mutation'); record('cross-origin mutation blocked');
  const invalid = await owner.call('/api/jobs', {method:'POST',body:{idempotencyKey:randomUUID(),ingredients:[],brief:{name:'QA'}}});
  expectStatus(invalid,[400],'empty inputs'); record('invalid job rejected before AI');
  const disguised = new FormData(); disguised.append('file',new Blob(['not an image'],{type:'image/png'}),'fake.png');
  const spoof = await owner.call('/api/uploads',{method:'POST',body:disguised}); expectStatus(spoof,[400,415],'image signature'); record('spoofed image rejected');
  const inputs = await Promise.all(chosen.fixtures.map(upload));
  const original = await owner.call(inputs[0].url,{raw:true}); expectStatus(original,[200],'original access'); assert.equal(digest(original.data),digest(inputs[0].bytes)); record('original upload bytes preserved');
  const denied = await stranger.call(inputs[0].url,{raw:true}); expectStatus(denied,[404],'cross-owner asset'); record('cross-owner asset blocked');
  const stolenInputs = await stranger.call('/api/jobs',{method:'POST',body:{idempotencyKey:randomUUID(),ingredients:inputs.map(({id})=>({id,locked:false})),brief:chosen.brief}}); expectStatus(stolenInputs,[404],'cross-owner input use'); record('cross-owner inputs cannot start AI');
  const inventedSave = await stranger.call('/api/recipes',{method:'POST',body:{recipe:{id:randomUUID(),name:'Not my recipe',ingredients:inputs.map(({id})=>({id}))}}});
  expectStatus(inventedSave,[400,404],'unowned recipe save'); record('unowned recipe cannot be saved');
  if (mode === 'smoke') return;
  if (mode === 'limit') {
    // This test is intentionally bounded: use a dedicated preview configured with one job per session.
    assert.equal(process.env.EVAL_LIMIT_TEST, '1', 'Limit test also requires EVAL_LIMIT_TEST=1 and a dedicated preview');
    assert.equal(sessions[0].data.limit, 1, 'Limit test requires DAILY_SESSION_LIMIT=1; refusing to consume a normal user quota');
  }
  const body = {idempotencyKey:randomUUID(),ingredients:inputs.map((item,i)=>({id:item.id,locked:chosen.locked[i]||false})),brief:chosen.brief};
  const submitted = await owner.call('/api/jobs',{method:'POST',body}); expectStatus(submitted,[200,201,202],'job submit'); assert(submitted.data.id);
  const id = submitted.data.id; record('real AI job submitted',{jobId:id});
  const duplicate = await owner.call('/api/jobs',{method:'POST',body}); expectStatus(duplicate,[200,201,202],'idempotent submit'); assert.equal(duplicate.data.id,id); record('same request reuses job');
  const altered = await owner.call('/api/jobs',{method:'POST',body:{...body,brief:{...body.brief,name:'Different request'}}}); expectStatus(altered,[409],'idempotency conflict'); record('idempotency key cannot change request');
  const crossJob = await stranger.call(`/api/jobs/${id}`); expectStatus(crossJob,[404],'cross-owner job'); record('cross-owner job blocked');
  if (mode === 'limit') {
    const second = await owner.call('/api/jobs',{method:'POST',body:{...body,idempotencyKey:randomUUID()}}); expectStatus(second,[429],'quota admission'); record('server quota blocks another accepted job');
  }
  if (mode === 'cancel' || mode === 'limit') {
    const cancelled = await owner.call(`/api/jobs/${id}/cancel`,{method:'POST',body:{}}); expectStatus(cancelled,[200,202],'cancel');
    const terminal = await poll(id); assert.equal(terminal.status,'cancelled'); assert(!terminal.recipe,'Cancelled job never publishes recipe'); record('cancelled job does not publish'); return;
  }
  const terminal = await poll(id); assert.equal(terminal.status,'ready',`AI terminal failure: ${terminal.error?.code || terminal.error?.message || terminal.status}`);
  const recipe = terminal.recipe; assert(recipe && recipe.concept?.title && recipe.concept?.summary && recipe.generatedImage,'Real recipe contains concept and generated art');
  assert.equal(recipe.name,chosen.brief.name,'Supplied brand name is exact'); assert.equal(recipe.ingredients.filter(Boolean).length,inputs.length);
  const serialized = JSON.stringify(recipe); assert(!/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(serialized),'No API credential in recipe'); assert(!/<script[\s>]/i.test(serialized),'No script content in recipe');
  const art = await owner.call(recipe.generatedImage,{raw:true}); expectStatus(art,[200],'generated art'); assert(art.data.length>1000,'Generated image has content'); assert(!inputs.some(item=>digest(item.bytes)===digest(art.data)),'Generated art differs from original inputs'); record('real generated art and exact recipe');
  const stolenSave = await stranger.call('/api/recipes',{method:'POST',body:{recipe}}); expectStatus(stolenSave,[404],'cross-owner ready recipe save'); record('cross-owner result cannot be saved');
  const saved = await owner.call('/api/recipes',{method:'POST',body:{recipe}}); expectStatus(saved,[200,201],'save recipe');
  const savedId=saved.data.recipe?.id; assert(savedId,'Save returns a versioned recipe');
  const list = await owner.call('/api/recipes'); expectStatus(list,[200],'reload recipe'); assert(Array.isArray(list.data.recipes) && list.data.recipes.some(item=>item.id===savedId),'Saved recipe reloads');
  const privateList = await stranger.call('/api/recipes'); expectStatus(privateList,[200],'private recipe list'); assert(!privateList.data.recipes.some(item=>item.id===savedId),'Stranger cannot list recipe'); record('saved recipe persists and stays private');
  results.push({name:'human visual review',passed:null,checks:chosen.humanChecks,jobId:id});
}
let failure;
try { await main(); } catch (error) { failure=error.message; results.push({name:'evaluation failure',passed:false,message:failure}); console.error(`FAIL ${failure}`); process.exitCode=1; }
const report={schemaVersion:1,startedAt:runStartedAt,finishedAt:new Date().toISOString(),base:base.origin,mode,case:chosen.id,paidOptIn:process.env.RUN_PAID_EVAL==='1',results,passed:!failure,humanReviewRequired:mode==='generate'};
const destination = arg('out');
if (destination) { await mkdir(path.dirname(path.resolve(destination)),{recursive:true}); await writeFile(destination,JSON.stringify(report,null,2)+'\n'); console.log(`Report: ${path.resolve(destination)}`); }
console.log(JSON.stringify({passed:report.passed,checks:results.length,humanReviewRequired:report.humanReviewRequired}));
