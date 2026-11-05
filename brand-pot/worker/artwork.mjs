import { HttpError, inspectImage, hashBytes } from './core.mjs';

export const VECTOR_MIMES = new Set(['image/svg+xml','application/pdf']);
const shaPattern=/^[a-f0-9]{64}$/;

/** Raster magic wins; document formats require an explicit matching file type. */
export function identifyArtwork(bytes, file={}) {
  try { return {...inspectImage(bytes),vector:false}; } catch(error) {
    const declared=String(file.type||'').toLowerCase(),name=String(file.name||'').toLowerCase();
    const generic=!declared||['application/octet-stream','binary/octet-stream'].includes(declared);
    const mime=declared==='image/svg+xml'||generic&&name.endsWith('.svg')?'image/svg+xml':declared==='application/pdf'||generic&&name.endsWith('.pdf')?'application/pdf':null;
    if(!mime)throw error;
    const head=new TextDecoder().decode(bytes.subarray(0,4096)).replace(/^\uFEFF/,'').trimStart();
    if(mime==='application/pdf'&&!head.startsWith('%PDF-'))throw new HttpError(400,'INVALID_DOCUMENT','ไฟล์นี้ไม่ใช่ PDF ที่อ่านได้');
    if(mime==='image/svg+xml'&&!/^(?:<\?xml\b|<!--|<svg\b)/i.test(head))throw new HttpError(400,'INVALID_DOCUMENT','ไฟล์นี้ไม่ใช่ SVG ที่อ่านได้');
    return {mime,vector:true};
  }
}

/** Read only a bounded, verified PNG from the private converter Service Binding. */
export async function convertArtwork(env,bytes,mime,originalSha256,{maxEdge=2048}={}) {
  if(!VECTOR_MIMES.has(mime)||!shaPattern.test(originalSha256)||![512,2048].includes(maxEdge))throw new HttpError(400,'INVALID_DOCUMENT','ข้อมูลไฟล์ต้นฉบับไม่ถูกต้อง');
  if(!env.ASSET_CONVERTER?.fetch)throw new HttpError(503,'CONVERTER_UNAVAILABLE','ระบบเตรียมไฟล์ SVG/PDF ยังไม่พร้อม กรุณาลองภายหลัง');
  let response;
  try { response=await env.ASSET_CONVERTER.fetch(new Request('https://converter.internal/convert',{method:'POST',headers:{'Content-Type':mime,'X-Source-SHA256':originalSha256,'X-Max-Edge':String(maxEdge)},body:bytes,signal:AbortSignal.timeout(20000)})); }
  catch { throw new HttpError(503,'CONVERTER_UNAVAILABLE','เตรียมไฟล์นี้ไม่สำเร็จ กรุณาลองใหม่หรือใช้ PNG'); }
  if(!response.ok) {
    let error;try{error=(await response.json()).error;}catch{}
    const code=/^[A-Z_]{2,60}$/.test(error?.code||'')?error.code:'CONVERSION_FAILED';
    const message=typeof error?.message==='string'&&error.message.length<=300?error.message:'ไม่สามารถเตรียมไฟล์นี้ได้ กรุณาใช้ SVG แบบ outline หรือ PDF หน้าเดียว';
    throw new HttpError([400,413,422,503].includes(response.status)?response.status:502,code,message);
  }
  let metadata;try{metadata=JSON.parse(response.headers.get('X-Conversion-Metadata'));}catch{}
  if(!metadata||metadata.originalSha256!==originalSha256||metadata.originalMime!==mime||metadata.mime!=='image/png'||!metadata.originalPreserved||!shaPattern.test(metadata.sha256||'')||!Number.isInteger(metadata.width)||!Number.isInteger(metadata.height)||metadata.width<1||metadata.height<1||metadata.width>maxEdge||metadata.height>maxEdge||metadata.width*metadata.height>4_000_000||!Number.isFinite(metadata.sourceWidth)||!Number.isFinite(metadata.sourceHeight)||metadata.sourceWidth<=0||metadata.sourceHeight<=0||!/^resvg-[\d.]+$|^pdfium-[\d.]+$/.test(metadata.renderer||'')||!/^slaply-converter-[\d.-]+$/.test(metadata.converterVersion||'')||(mime==='application/pdf'&&(metadata.pageCount!==1||metadata.pageIndex!==0)))throw new HttpError(502,'INVALID_CONVERSION','ข้อมูลภาพตัวอย่างไม่ตรงกับต้นฉบับ กรุณาลองใหม่');
  const maximum=18*1024*1024;
  if(response.headers.get('Content-Type')!=='image/png'||Number(response.headers.get('Content-Length'))>maximum)throw new HttpError(502,'INVALID_CONVERSION','ภาพตัวอย่างมีขนาดหรือชนิดไม่ถูกต้อง');
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'INVALID_CONVERSION','ไม่พบภาพตัวอย่าง');
  const chunks=[];let length=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximum){await reader.cancel();throw new HttpError(502,'INVALID_CONVERSION','ภาพตัวอย่างใหญ่เกินไป');}chunks.push(value);} }finally{reader.releaseLock();}
  const png=new Uint8Array(length);let offset=0;for(const chunk of chunks){png.set(chunk,offset);offset+=chunk.byteLength;}
  let image;try{image=inspectImage(png);}catch{throw new HttpError(502,'INVALID_CONVERSION','ภาพตัวอย่างไม่สมบูรณ์');}
  if(image.mime!=='image/png'||image.width!==metadata.width||image.height!==metadata.height||await hashBytes(png)!==metadata.sha256)throw new HttpError(502,'INVALID_CONVERSION','ภาพตัวอย่างไม่ตรงกับข้อมูลต้นฉบับ');
  return {png,metadata};
}
