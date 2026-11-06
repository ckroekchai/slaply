import { apiRequest } from './api.js';
import { safeGuidelineImage } from './brand-guideline-model.js';
import { cutoutLockedPixels } from './locked-cutout.js';

async function readOriginal(source) {
  const safe=safeGuidelineImage(source);
  if(!safe)throw new Error('เปิดวัตถุดิบต้นฉบับไม่ได้');
  const image=new Image();image.decoding='async';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('อ่านภาพที่ล็อกไว้ไม่ได้ กรุณาลองอีกครั้ง'));image.src=safe;});
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  if(!canvas.width||!canvas.height)throw new Error('ภาพต้นฉบับไม่มีขนาดที่ใช้งานได้');
  if(canvas.width*canvas.height>16_000_000)return {status:'unchanged',reason:'large-image'};
  const context=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});
  if(!context)throw new Error('เตรียมภาพที่ล็อกไว้ไม่ได้');
  context.drawImage(image,0,0);
  const original=context.getImageData(0,0,canvas.width,canvas.height);
  const result=cutoutLockedPixels(original.data,canvas.width,canvas.height);
  if(result.status!=='removed')return result;
  // RGB values are copied verbatim; only the computed alpha matte changes.
  context.putImageData(new ImageData(result.pixels,result.width,result.height),0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('สร้างไฟล์ไดคัตไม่ได้ กรุณาลองอีกครั้ง');
  if(blob.size>5*1024*1024)return {status:'unchanged',reason:'derivative-too-large'};
  return {...result,blob};
}

/** Explicit Shake preparation only. No AI call and no background uploads. */
export async function prepareLockedIngredients(ingredients,{isCurrent=()=>true,request=apiRequest,prepare=readOriginal}={}) {
  const prepared=[];
  for(const item of ingredients){
    if(!isCurrent())return null;
    if(!item||!item.locked){prepared.push(item?{...item,cutoutId:undefined,cutoutBounds:undefined,cutoutStatus:undefined}:item);continue;}
    if(item.cutoutId&&item.cutoutBounds){prepared.push(item);continue;}
    const cutout=await prepare(item.originalSrc||item.originalUrl||item.src);
    if(!isCurrent())return null;
    if(cutout.status==='transparent'){
      prepared.push({...item,cutoutId:item.id,cutoutBounds:cutout.bounds,cutoutStatus:'transparent'});continue;
    }
    if(cutout.status!=='removed'){
      prepared.push({...item,cutoutStatus:'unchanged',cutoutReason:cutout.reason});continue;
    }
    const name=`${String(item.name||'ingredient').replace(/\.[^.]+$/,'')}-cutout.png`;
    const uploaded=await request('/api/uploads',{method:'POST',body:cutout.blob,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent(name)}});
    if(!isCurrent())return null;
    if(!uploaded.id||uploaded.mime!=='image/png'||uploaded.width!==cutout.width||uploaded.height!==cutout.height)throw new Error('ตรวจสอบขนาดภาพไดคัตไม่ผ่าน กรุณาลองใหม่');
    prepared.push({...item,cutoutId:uploaded.id,cutoutBounds:cutout.bounds,cutoutStatus:'removed'});
  }
  return prepared;
}
