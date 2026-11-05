import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {PDFDocument,StandardFonts,rgb,degrees,PDFName,PDFDict,PDFNumber} from 'pdf-lib';
import sharp from 'sharp';
import {inspectSvg} from '../svg-validation.mjs';
const utf8=x=>new TextEncoder().encode(x),hash=x=>createHash('sha256').update(x).digest('hex');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>';
let mf,outbound=0;
before(()=>{const dir=new URL('../dist/',import.meta.url).pathname;mf=new Miniflare({modules:[{type:'ESModule',path:dir+'worker.js'},{type:'CompiledWasm',path:dir+'pdfium.wasm'},{type:'CompiledWasm',path:dir+'resvg.wasm'}],compatibilityDate:'2026-04-01',outboundService:()=>{outbound++;throw new Error('Outbound networking forbidden');}});});
after(async()=>{await mf?.dispose();assert.equal(outbound,0,'No network call may occur during conversion');});
async function convert(body,mime='image/svg+xml',expected){const started=performance.now();const response=await mf.dispatchFetch('http://converter.local/',{method:'POST',body,headers:{'content-type':mime,...expected?{'x-source-sha256':expected}:{}}});return {response,ms:performance.now()-started,metadata:JSON.parse(response.headers.get('x-conversion-metadata')||'null')};}
async function makePdf({pages=1,text=false,rotate=false,crop=false}={}){const doc=await PDFDocument.create();for(let i=0;i<pages;i++){const page=doc.addPage([200,100]);page.drawRectangle({x:0,y:0,width:100,height:100,color:rgb(0,0,1)});if(text)page.drawText('UNEMBEDDED',{x:10,y:30,size:12,font:await doc.embedFont(StandardFonts.Helvetica)});if(rotate)page.setRotation(degrees(90));if(crop)page.setCropBox(0,0,100,100);}return doc.save();}
test('real workerd resvg preserves original and returns deterministic fully decodable alpha PNG',async()=>{
  const bytes=utf8(svg),source=bytes.slice(),a=await convert(bytes),b=await convert(bytes);assert.equal(a.response.status,200);const png=new Uint8Array(await a.response.arrayBuffer());assert.equal(a.metadata.sha256,hash(png));assert.equal(a.metadata.originalSha256,hash(source));assert.deepEqual(bytes,source);assert.equal(a.metadata.sha256,b.metadata.sha256);
  const image=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([image.info.width,image.info.height],[2048,1024]);assert.deepEqual([...image.data.subarray(0,4)],[255,0,0,255]);assert.equal(image.data[(1500*4)+3],0);assert.ok(a.metadata.linearMemoryBytes<=64*1024*1024);assert.ok(a.ms<5000);console.log('SVG local workerd',JSON.stringify({wallMs:Math.round(a.ms),wasmHeapBytes:a.metadata.linearMemoryBytes}));
});
test('real workerd PDFium renders single-page vectors to RGBA without Canvas or network',async()=>{
  const bytes=await makePdf(),original=bytes.slice(),result=await convert(bytes,'application/pdf');assert.equal(result.response.status,200,await result.response.clone().text());const png=new Uint8Array(await result.response.arrayBuffer());const image=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([image.info.width,image.info.height],[2048,1024]);assert.deepEqual([...image.data.subarray(0,4)],[0,0,255,255]);assert.equal(image.data[1500*4+3],0);assert.equal(result.metadata.originalSha256,hash(original));assert.deepEqual(bytes,original);assert.equal(result.metadata.sha256,hash(png));assert.ok(result.metadata.linearMemoryBytes<=48*1024*1024);assert.ok(result.ms<5000);console.log('PDF local workerd',JSON.stringify({wallMs:Math.round(result.ms),wasmHeapBytes:result.metadata.linearMemoryBytes}));
});
test('SVG rejects executable, external, text, unsupported and excessive structures before render',async()=>{
  for(const content of ['<script>alert(1)</script>','<text>Logo</text>','<foreignObject/>','<image href="https://example.com/logo.png"/>','<use href="#x"/>','<rect width="1" height="1" onload="alert(1)"/>','<rect style="fill:url(https://example.com/a)"/>','<style>@import "https://example.com";</style>']){
    const result=await convert(utf8(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">${content}</svg>`));assert.equal(result.response.status,422);assert.equal((await result.response.json()).code,'UNSUPPORTED_SVG');
  }
  for(const content of ['<!DOCTYPE svg [<!ENTITY x "bad">]>'+svg,svg.replace('width="200"','width="0"'),svg.replace('</svg>','<g>'.repeat(40)+'</g>'.repeat(40)+'</svg>')])assert.equal((await convert(utf8(content))).response.status,422);
  for(const outline of ['<path d="M 0 0 L invalid"/>','<path d="M0 0L10 10" transform="skewX(bad)"/>']){const result=await convert(utf8(svg.replace('</svg>',outline+'</svg>')));assert.equal(result.response.status,422);assert.equal((await result.response.json()).code,'SVG_RENDER_FAILED');}
});
test('SVG rejects paint and geometry that would otherwise silently become black or disappear',async()=>{
  const rejected=[
    '<rect width="100" height="100" fill="var(--brand, #ff0000)"/>',
    '<rect width="100" height="100" style="fill:var(--brand, #ff0000)"/>',
    '<rect width="100" height="100" fill="bogusColor"/>',
    '<rect width="100" height="100" fill="#ffzz00"/>',
    '<rect width="100" height="100" style="fill:#ff0000;opacity:invalid"/>',
    '<rect width="invalid" height="100" fill="red"/>',
    '<circle cx="50" cy="50" r="-4" fill="red"/>',
    '<polygon points="0,0 100,0 nope" fill="red"/>',
    '<polygon points="0,0 100,0 100" fill="red"/>',
    '<path d="M0 50L100 50" stroke="red" stroke-width="10" stroke-dasharray="2 bad"/>',
    '<path d="M0 50L100 50" stroke="red" stroke-linecap="unsupported"/>',
    '<defs><linearGradient id="g"><stop offset="0" stop-color="invalid"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>',
    '<defs><rect id="g" width="10" height="10"/></defs><rect width="100" height="100" fill="url(#g)"/>',
  ];
  for(const content of rejected){
    const result=await convert(utf8(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">${content}</svg>`));
    assert.equal(result.response.status,422,`Must reject rather than lose artwork: ${content}`);
    assert.ok(['SVG_RENDER_FAILED','UNSUPPORTED_SVG'].includes((await result.response.json()).code));
  }
});
test('SVG supported gradient, explicit colors, alpha and stroke still preserve decoded pixels',async()=>{
  const content='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><defs><linearGradient id="blue"><stop offset="0%" stop-color="#0000ff"/><stop offset="100%" style="stop-color:rgb(0,0,255);stop-opacity:1"/></linearGradient></defs><rect width="100" height="100" style="fill:#ff0000;opacity:0.5"/><rect x="100" width="100" height="100" fill="url(#blue)"/><polyline points="20,50 80,50" fill="none" stroke="lime" stroke-width="10" stroke-linecap="round" stroke-linejoin="bevel"/></svg>';
  const result=await convert(utf8(content));assert.equal(result.response.status,200,await result.response.clone().text());
  const image=await sharp(new Uint8Array(await result.response.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pixel=(x,y)=>[...image.data.subarray((y*image.info.width+x)*4,(y*image.info.width+x)*4+4)];
  assert.deepEqual(pixel(100,100),[255,0,0,128]);
  assert.deepEqual(pixel(1500,100),[0,0,255,255]);
  assert.deepEqual(pixel(500,512),[0,255,0,255]);
});
test('input hash, size and format limits reject before converters run',async()=>{
  assert.equal((await (await convert(utf8(svg),'image/svg+xml','0'.repeat(64))).response.json()).code,'SOURCE_MISMATCH');
  assert.equal((await (await convert(new Uint8Array(5*1024*1024+1))).response.json()).code,'INPUT_TOO_LARGE');
  assert.equal((await (await convert(utf8(svg),'application/pdf')).response.json()).code,'INVALID_PDF');
  const square=inspectSvg(utf8(svg.replace('height="100"','height="200"')));assert.equal(square.width*square.height,4_000_000);
});
test('both precompiled WASM memories reject growth beyond the configured bound inside workerd',async()=>{
  const response=await mf.dispatchFetch('http://converter.local/test-memory-caps');assert.equal(response.status,200);assert.deepEqual(await response.json(),{svg:true,pdf:true});
});
test('PDF multipage and unembedded fonts fail explicitly without a substitute render',async()=>{
  for(const [bytes,code] of [[await makePdf({pages:17}),'PDF_MULTIPAGE'],[await makePdf({text:true}),'PDF_MISSING_FONT'],[readFileSync(new URL('./fixtures/encrypted.pdf',import.meta.url)),'PDF_ENCRYPTED']]){const result=await convert(bytes,'application/pdf');assert.equal(result.response.status,422);assert.equal((await result.response.json()).code,code);}
});
test('PDF page rotation and CropBox are respected',async()=>{
  const rotated=await convert(await makePdf({rotate:true}),'application/pdf');assert.equal(rotated.response.status,200);assert.deepEqual([rotated.metadata.width,rotated.metadata.height],[1024,2048]);
  const cropped=await convert(await makePdf({crop:true}),'application/pdf');assert.equal(cropped.response.status,200);assert.deepEqual([cropped.metadata.width,cropped.metadata.height],[2000,2000]);
});
test('production converter has no public HTTP route or credentials',async()=>{
  const dir=new URL('../dist/',import.meta.url).pathname,privateMf=new Miniflare({workers:[{name:'converter',modules:[{type:'ESModule',path:dir+'index.js'},{type:'CompiledWasm',path:dir+'pdfium.wasm'},{type:'CompiledWasm',path:dir+'resvg.wasm'}],compatibilityDate:'2026-04-01'},{name:'client',modules:true,script:'export default {fetch(r,e){return e.CONVERTER.fetch(r)}}',compatibilityDate:'2026-04-01',serviceBindings:{CONVERTER:{name:'converter',entrypoint:'AssetConverter'}}}]});
  try{
    const publicWorker=await privateMf.getWorker('converter'),privateClient=await privateMf.getWorker('client');
    const response=await publicWorker.fetch('http://converter.local/convert',{method:'POST',body:svg});assert.equal(response.status,404);
    const missingHash=await privateClient.fetch('http://converter.internal/convert',{method:'POST',body:svg,headers:{'content-type':'image/svg+xml'}});assert.equal(missingHash.status,400);assert.equal((await missingHash.json()).error.code,'INVALID_INPUT');
    const actual=await privateClient.fetch('http://converter.internal/convert',{method:'POST',body:svg,headers:{'content-type':'image/svg+xml','x-source-sha256':hash(utf8(svg))}});assert.equal(actual.status,200);assert.equal(JSON.parse(actual.headers.get('x-conversion-metadata')).originalSha256,hash(utf8(svg)));assert.equal((await sharp(new Uint8Array(await actual.arrayBuffer())).metadata()).format,'png');
    for(const [body,mime] of [[utf8(svg),'image/svg+xml'],[await makePdf(),'application/pdf']]){const small=await privateClient.fetch('http://converter.internal/convert',{method:'POST',body,headers:{'content-type':mime,'x-source-sha256':hash(body),'x-max-edge':'512'}});assert.equal(small.status,200);const metadata=JSON.parse(small.headers.get('x-conversion-metadata'));assert.deepEqual([metadata.width,metadata.height],[512,256]);assert.equal(metadata.originalSha256,hash(body));assert.ok((await small.arrayBuffer()).byteLength<=1_100_000);}
    const invalidEdge=await privateClient.fetch('http://converter.internal/convert',{method:'POST',body:svg,headers:{'content-type':'image/svg+xml','x-source-sha256':hash(utf8(svg)),'x-max-edge':'8192'}});assert.equal(invalidEdge.status,400);
    const over=await privateClient.fetch('http://converter.internal/convert',{method:'POST',body:new Uint8Array(5*1024*1024+1),headers:{'content-type':'image/svg+xml','x-source-sha256':'0'.repeat(64)}});assert.equal(over.status,413);
  }finally{await privateMf.dispose();}
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.deepEqual(config.routes,[]);assert.equal(config.limits.cpu_ms,1000);assert.equal(config.vars,undefined);
});
test('optional private reference PDF is rejected as multipage without changing its source',{skip:!process.env.SLAPLY_PRIVATE_REFERENCE_PDF},async()=>{
  const bytes=readFileSync(process.env.SLAPLY_PRIVATE_REFERENCE_PDF),before=hash(bytes),result=await convert(bytes,'application/pdf');assert.equal(result.response.status,422);assert.equal((await result.response.json()).code,'PDF_MULTIPAGE');assert.equal(hash(readFileSync(process.env.SLAPLY_PRIVATE_REFERENCE_PDF)),before);
});
test('optional private one-page copy with embedded fonts renders without modifying the reference',{skip:!process.env.SLAPLY_PRIVATE_REFERENCE_PDF},async()=>{
  const original=readFileSync(process.env.SLAPLY_PRIVATE_REFERENCE_PDF),before=hash(original),source=await PDFDocument.load(original),copy=await PDFDocument.create();copy.addPage((await copy.copyPages(source,[0]))[0]);
  const result=await convert(await copy.save(),'application/pdf');assert.equal(result.response.status,200,await result.response.clone().text());const png=new Uint8Array(await result.response.arrayBuffer()),decoded=await sharp(png).raw().toBuffer({resolveWithObject:true});assert.ok(decoded.info.width*decoded.info.height<=4_000_000);assert.equal(hash(readFileSync(process.env.SLAPLY_PRIVATE_REFERENCE_PDF)),before);console.log('Private one-page local proof',JSON.stringify({wallMs:Math.round(result.ms),wasmHeapBytes:result.metadata.linearMemoryBytes,width:result.metadata.width,height:result.metadata.height}));
});
