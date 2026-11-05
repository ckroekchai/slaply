import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadFileKind, uploadValidationMessage, MAX_UPLOAD_BYTES, MAX_RECIPE_UPLOAD_BYTES, UPLOAD_ACCEPT, uploadAccept } from '../src/upload-limits.js';
import { uploadIngredient, rasterHeaderMime } from '../src/upload-ingredient.js';
import { safeGuidelineImage } from '../src/brand-guideline-model.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const file=(bytes,name,type)=>new File([bytes],name,{type});
const preview={id:'asset-id',url:'/api/assets/asset-id/preview',originalUrl:'/api/assets/asset-id',mime:'image/svg+xml',renderMime:'image/png',name:'logo.svg',bytes:200,width:2000,height:1000,sourceWidth:200,sourceHeight:100,converterVersion:'slaply-converter-2026-11-05.1',sha256:'original-hash',renderSha256:'preview-hash',renderer:'server-static-renderer'};

test('file hints accept supported MIME types and extension fallback without allowing unsupported formats',()=>{
  for(const [name,type,kind] of [['logo.SVG','', 'document'],['identity.pdf','application/octet-stream','document'],['mark.svg','image/png','document'],['brand.png','image/svg+xml','document'],['image.JPEG','','raster'],['image.webp','application/octet-stream','raster'],['asset','image/png','raster']]){
    assert.equal(uploadFileKind({name,type}),kind,name);assert.equal(uploadValidationMessage({name,type,size:1024},[],-1,{allowDocuments:true}),'',name);
  }
  for(const name of ['file.ai','file.eps','file.heic','file.gif','file.svg.exe'])assert.match(uploadValidationMessage({name,type:'',size:100},[],-1,{allowDocuments:true}),/SVG.*PDF/,name);
  assert(uploadAccept({allowDocuments:true}).includes('.svg')&&uploadAccept({allowDocuments:true}).includes('application/pdf'));
  assert.match(uploadValidationMessage({name:'empty.pdf',type:'application/pdf',size:0},[],-1,{allowDocuments:true}),/ไม่มีข้อมูล/);
});
test('SVG and PDF keep original-byte file and aggregate limits, including replacing a slot',()=>{
  for(const type of ['image/svg+xml','application/pdf']){
    const input={name:type.endsWith('pdf')?'brand.pdf':'brand.svg',type,size:MAX_UPLOAD_BYTES};
    assert.equal(uploadValidationMessage(input,[{bytes:MAX_RECIPE_UPLOAD_BYTES-MAX_UPLOAD_BYTES}],-1,{allowDocuments:true}),'');
    assert.match(uploadValidationMessage({...input,size:MAX_UPLOAD_BYTES+1},[],-1,{allowDocuments:true}),/5 MB/);
    assert.match(uploadValidationMessage(input,[{bytes:MAX_RECIPE_UPLOAD_BYTES-MAX_UPLOAD_BYTES+1}],-1,{allowDocuments:true}),/18 MB/);
    assert.equal(uploadValidationMessage(input,[{bytes:MAX_RECIPE_UPLOAD_BYTES}],0,{allowDocuments:true}),'');
  }
});
test('SVG originals upload unchanged before only the server PNG preview is decoded',async()=>{
  const original=file('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>','logo.svg','image/svg+xml'),calls=[];
  const result=await uploadIngredient(original,{allowDocuments:true,read(){throw Error('Never read SVG into an Image data URL')},sample:async source=>{calls.push(['decode',source]);return [10,20,30]},request:async(path,options)=>{calls.push(['upload',path]);const sent=options.body.get('file');assert.deepEqual(new Uint8Array(await sent.arrayBuffer()),new Uint8Array(await original.arrayBuffer()));return preview;}});
  assert.deepEqual(calls,[['upload','/api/uploads'],['decode',preview.url]]);
  assert.equal(result.src,preview.url);assert.equal(result.originalSrc,preview.originalUrl);assert.equal(result.originalUrl,preview.originalUrl);assert.equal(result.sha256,'original-hash');assert.equal(result.renderSha256,'preview-hash');assert.equal(result.mime,'image/svg+xml');assert.equal(result.renderMime,'image/png');assert.equal(result.bytes,preview.bytes);assert.equal(result.renderer,preview.renderer);assert.equal(result.sourceWidth,200);assert.equal(result.sourceHeight,100);assert.equal(result.converterVersion,preview.converterVersion);
});
test('PDF and mislabeled SVG never reach the browser original decoder',async()=>{
  for(const original of [file('%PDF-1.7\n','brand.pdf',''),file('<svg onload="alert(1)"/>','fake.png','image/png')]){
    const decoded=[];await uploadIngredient(original,{allowDocuments:true,read(){throw Error('Original document decode is forbidden')},sample:async source=>{decoded.push(source);return [0,0,0]},request:async()=>({...preview,mime:original.name.endsWith('.pdf')?'application/pdf':'image/svg+xml'})});
    assert.deepEqual(decoded,[preview.url]);
  }
});
test('a raw vector URL or mislabeled non-PNG preview is rejected before any browser decode',async()=>{
  const original=file('<svg/>','logo.svg','image/svg+xml');
  for(const response of [{...preview,url:preview.originalUrl},{...preview,renderMime:'image/svg+xml'},{...preview,url:'/api/assets/asset-id/preview?raw=1'}]){
    await assert.rejects(uploadIngredient(original,{allowDocuments:true,request:async()=>response,read(){throw Error('Unexpected read')},sample(){throw Error('Unexpected browser decode')}}),/ภาพ/);
  }
});
test('raster magic bytes preserve local decode preflight and exact original upload',async()=>{
  const original=file(png,'image.PNG','application/octet-stream'),calls=[];
  const result=await uploadIngredient(original,{read:async(value,mime)=>{assert.equal(value,original);assert.equal(mime,'image/png');calls.push('read');return 'raster-data'},sample:async source=>{assert.equal(source,'raster-data');calls.push('decode');return [1,2,3]},request:async()=>{calls.push('upload');return {id:'raster',url:'/api/assets/raster',mime:'image/png',bytes:original.size}}});
  assert.deepEqual(calls,['read','decode','upload']);assert.deepEqual(result.rgb,[1,2,3]);assert.equal(result.src,'/api/assets/raster');
  assert.equal(rasterHeaderMime(new TextEncoder().encode('<svg>')) ,null);
});
test('a superseded document upload cannot decode or publish a stale preview',async()=>{
  let current=true,sampled=false;
  const result=await uploadIngredient(file('%PDF-1.7','logo.pdf','application/pdf'),{allowDocuments:true,isCurrent:()=>current,request:async()=>{current=false;return preview},sample(){sampled=true;throw Error('Stale preview must not decode')}});
  assert.equal(result,null);assert.equal(sampled,false);
});
test('guideline image references allow only the explicit preview path and still reject raw embedded SVG/PDF',()=>{
  assert.equal(safeGuidelineImage('/api/assets/id_123-abc/preview'),'/api/assets/id_123-abc/preview');
  for(const source of ['/api/assets/id/preview/extra','/api/assets/id/anything','/api/assets/id/preview?url=https://evil.example','data:image/svg+xml;base64,PHN2Zz4=','data:application/pdf;base64,JVBERg=='])assert.equal(safeGuidelineImage(source),'');
});

test('document capability defaults off in file hints and validation until explicitly enabled',()=>{
  assert.equal(uploadAccept(),UPLOAD_ACCEPT);assert.equal(uploadAccept({allowDocuments:false}),UPLOAD_ACCEPT);assert.equal(uploadAccept({allowDocuments:'true'}),UPLOAD_ACCEPT);
  assert(!UPLOAD_ACCEPT.includes('.svg')&&!UPLOAD_ACCEPT.includes('pdf'));
  for(const name of ['logo.svg','brand.PDF']){const document={name,type:'',size:100};assert.match(uploadValidationMessage(document),/รองรับเฉพาะ JPG/);assert.match(uploadValidationMessage(document,[],-1,{allowDocuments:false}),/รองรับเฉพาะ JPG/);assert.equal(uploadValidationMessage(document,[],-1,{allowDocuments:true}),'');}
  assert.equal(uploadValidationMessage({name:'photo.PNG',type:'',size:100}),'');
});
test('disabled document uploads reject originals and disguised documents before any API or image decode',async()=>{
  let requests=0,reads=0,samples=0;
  const options={request:async()=>{requests++;return preview},read:async()=>{reads++;return ''},sample:async()=>{samples++;return [0,0,0]}};
  for(const original of [file('<svg/>','logo.svg','image/svg+xml'),file('%PDF-1.7','brand.pdf','application/pdf'),file('<svg/>','disguised.png','image/png')]){
    await assert.rejects(uploadIngredient(original,options),/รองรับเฉพาะ JPG/);
    await assert.rejects(uploadIngredient(original,{...options,allowDocuments:false}),/รองรับเฉพาะ JPG/);
  }
  assert.equal(requests,0);assert.equal(reads,0);assert.equal(samples,0);
});
