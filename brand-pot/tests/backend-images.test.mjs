import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectImage,hashBytes } from '../worker/core.mjs';
import { environment,call,start } from './backend-harness.mjs';

const fixtures=Object.fromEntries(['png','jpeg','webp'].map(format=>[format,new Uint8Array(readFileSync(new URL(`./backend-fixtures/static.${format}`,import.meta.url)))]));
function crc(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
function chunk(name,bytes){const value=new Uint8Array(bytes.length+12),view=new DataView(value.buffer);view.setUint32(0,bytes.length);value.set(new TextEncoder().encode(name),4);value.set(bytes,8);view.setUint32(value.length-4,crc(value.subarray(4,value.length-4)));return value;}
const join=(...arrays)=>{const data=new Uint8Array(arrays.reduce((sum,b)=>sum+b.length,0));let at=0;for(const b of arrays){data.set(b,at);at+=b.length;}return data;};

test('static PNG, JPEG and transparent WebP preserve exact bytes, trusted dimensions, hash and MIME',async()=>{
  const ctx=environment(),cookie=await start(ctx);
  for(const [format,bytes] of Object.entries(fixtures)){
    assert.deepEqual(inspectImage(bytes),{mime:`image/${format}`,width:7,height:3});
    const form=new FormData();form.set('file',new Blob([bytes],{type:'text/plain'}),`customer.${format}`);
    const result=await call(ctx,'/api/uploads',{method:'POST',cookie,body:form});assert.equal(result.status,201);assert.equal(result.data.sha256,await hashBytes(bytes));assert.deepEqual([result.data.width,result.data.height],[7,3]);assert.equal(result.data.mime,`image/${format}`);
    assert.deepEqual((await call(ctx,result.data.url,{cookie})).data,bytes);
    const stored=ctx.sql.prepare('SELECT width,height,sha256 FROM brand_assets WHERE id=?').get(result.data.id);assert.equal(stored.sha256,result.data.sha256);
  }
});
test('truncation, header-only images, corrupt CRC and oversized dimensions fail structural validation',()=>{
  for(const bytes of Object.values(fixtures))for(const end of [12,24,bytes.length-1])assert.throws(()=>inspectImage(bytes.slice(0,end)),error=>error.code==='INVALID_IMAGE');
  const corrupt=fixtures.png.slice();corrupt[corrupt.length-5]^=1;assert.throws(()=>inspectImage(corrupt));
  const huge=fixtures.png.slice();new DataView(huge.buffer).setUint32(16,100000);new DataView(huge.buffer).setUint32(20,100000);new DataView(huge.buffer).setUint32(29,crc(huge.subarray(12,29)));assert.throws(()=>inspectImage(huge),/40/);
  const header=fixtures.png.slice(0,24);assert.throws(()=>inspectImage(header));
});
test('animated PNG and WebP are rejected explicitly instead of silently freezing a frame',()=>{
  const apng=join(fixtures.png.slice(0,33),chunk('acTL',new Uint8Array([0,0,0,2,0,0,0,0])),fixtures.png.slice(33));assert.throws(()=>inspectImage(apng),/ภาพนิ่ง/);
  const animated=fixtures.webp.slice();assert.equal(String.fromCharCode(...animated.slice(12,16)),'VP8X');animated[20]|=2;assert.throws(()=>inspectImage(animated),/ภาพนิ่ง/);
});
test('unsupported vector/document/phone-image formats fail clearly without storing uploads',async()=>{
  const ctx=environment(),cookie=await start(ctx);
  for(const content of ['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>','%PDF-1.7','GIF89a','....ftypheic']){
    const form=new FormData();form.set('file',new Blob([content],{type:'image/png'}),'disguised.png');const result=await call(ctx,'/api/uploads',{method:'POST',cookie,body:form});assert.equal(result.status,400);assert.equal(result.data.error.code,'INVALID_IMAGE');
  }
  assert.equal(ctx.storage.size,0);assert.equal(ctx.sql.prepare('SELECT COUNT(*) AS n FROM brand_assets').get().n,0);
});
