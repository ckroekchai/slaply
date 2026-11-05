import { apiRequest } from './api.js';
import { uploadFileKind, uploadValidationMessage, DOCUMENT_UPLOAD_DISABLED_MESSAGE } from './upload-limits.js';
import { safeGuidelineImage } from './brand-guideline-model.js';

export function rasterHeaderMime(bytes) {
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'image/webp';
  return null;
}
function readRaster(file,mime) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('เปิดไฟล์รูปนี้ไม่ได้'));reader.readAsDataURL(file.slice(0,file.size,mime));});
}
function sampleImage(source) {
  return new Promise((resolve,reject)=>{
    const image=new window.Image();image.onerror=()=>reject(new Error('เปิดภาพตัวอย่างไม่ได้ กรุณาลองอัปโหลดอีกครั้ง'));
    image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');if(!context)throw new Error('อ่านสีภาพไม่ได้');context.fillStyle='#fff9ee';context.fillRect(0,0,1,1);context.drawImage(image,0,0,1,1);resolve([...context.getImageData(0,0,1,1).data].slice(0,3));}catch(error){reject(error)}};
    image.src=source;
  });
}

/** SVG/PDF originals are sent unchanged and are never decoded by the browser. */
export async function uploadIngredient(file,{request=apiRequest,read=readRaster,sample=sampleImage,isCurrent=()=>true,allowDocuments=false}={}) {
  const validation=uploadValidationMessage(file,[],-1,{allowDocuments});if(validation)throw new Error(validation);
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const rasterMime=rasterHeaderMime(header),localRaster=uploadFileKind(file)==='raster'&&Boolean(rasterMime);
  if(!localRaster&&allowDocuments!==true)throw new Error(DOCUMENT_UPLOAD_DISABLED_MESSAGE);
  let rgb;
  if(localRaster){const source=await read(file,rasterMime);if(!isCurrent())return null;rgb=await sample(source);}
  if(!isCurrent())return null;
  const body=new FormData();body.append('file',file);
  const uploaded=await request('/api/uploads',{method:'POST',body});
  if(!isCurrent())return null;
  const source=safeGuidelineImage(uploaded.url||uploaded.src);
  const serverDocument=['image/svg+xml','application/pdf'].includes(uploaded.mime);
  if(!source||!uploaded.id)throw new Error('ระบบยังไม่ส่งภาพตัวอย่างที่ใช้งานได้');
  if(!localRaster||serverDocument){
    if(uploaded.renderMime!=='image/png'||source!==`/api/assets/${uploaded.id}/preview`)throw new Error('ระบบยังไม่ส่งภาพ PNG ตัวอย่างของไฟล์นี้');
    rgb=await sample(source);
  }
  if(!isCurrent())return null;
  const metadata=Object.fromEntries(['mime','width','height','sourceWidth','sourceHeight','sha256','originalUrl','renderMime','renderSha256','renderer','converterVersion'].filter(key=>uploaded[key]!==undefined).map(key=>[key,uploaded[key]]));
  return {id:uploaded.id,src:source,name:uploaded.name||file.name,bytes:uploaded.bytes??file.size,rgb:uploaded.rgb||rgb,...metadata,originalSrc:uploaded.originalUrl||source};
}
