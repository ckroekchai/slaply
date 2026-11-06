import { BOARD_FONT_CATALOG, buildBrandBoardScene, layoutBrandBoardText, renderBrandBoardSVG } from './brand-board-scene.js';
import { createBoardPDF, tagSRGBPNG } from './export-formats.js';
import { resolveLogoBackdrop } from './logo-backdrop.js';
import { brandObjects } from './brand-objects.js';

const rasterData=/^data:image\/(png|jpe?g|webp);base64,[a-z\d+/=\s]+$/i;
const originalData=/^data:(?:image\/(?:png|jpe?g|webp|svg\+xml)|application\/pdf);base64,[a-z\d+/=\s]+$/i;
const fontCache=new Map();
function dataURL(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('อ่านไฟล์สำหรับส่งออกไม่สำเร็จ'));reader.readAsDataURL(blob);
  });
}
async function localBlob(source,kind) {
  source=window.__SLAPLY_ASSETS__?.[source]||source;
  if(typeof source!=='string'||!source)throw new Error('ไม่พบไฟล์สำหรับส่งออก');
  if(source.startsWith('data:')) {
    if(kind==='image'&&!rasterData.test(source))throw new Error('รูปสำหรับส่งออกต้องเป็น PNG, JPG หรือ WebP');
    if(kind==='original'&&!originalData.test(source))throw new Error('รูปแบบไฟล์ต้นฉบับไม่ถูกต้อง');
    if(kind==='font'&&!/^data:(font\/|application\/(?:font|x-font|octet-stream))/.test(source))throw new Error('รูปแบบฟอนต์ไม่ถูกต้อง');
  }else {
    const url=new URL(source,window.location.href);
    if(url.origin!==window.location.origin||!['https:','http:','blob:'].includes(url.protocol))throw new Error('ส่งออกได้เฉพาะไฟล์ที่เก็บใน Slaply');
    source=url.href;
  }
  const response=await fetch(source,{credentials:'same-origin'});
  if(!response.ok)throw new Error(`โหลดไฟล์สำหรับส่งออกไม่สำเร็จ (${response.status})`);
  const blob=await response.blob();
  if(kind==='image'&&!/^image\/(png|jpe?g|webp)$/i.test(blob.type))throw new Error('ไฟล์ภาพสำหรับส่งออกไม่ถูกต้อง');
  if(kind==='original'&&!/^(?:image\/(?:png|jpe?g|webp|svg\+xml)|application\/pdf)$/i.test(blob.type))throw new Error('รูปแบบไฟล์ต้นฉบับไม่ถูกต้อง');
  return blob;
}
async function prepareFonts(scene) {
  if(!document.fonts||typeof FontFace==='undefined')throw new Error('เบราว์เซอร์นี้ไม่รองรับการฝังฟอนต์ กรุณาใช้เบราว์เซอร์รุ่นปัจจุบัน');
  const faces=BOARD_FONT_CATALOG.filter(face=>scene.fontFamilies.includes(face.family));
  const css=await Promise.all(faces.map(async face=>{
    if(!fontCache.has(face.src)) {
      fontCache.set(face.src,(async()=>{
        const blob=await localBlob(face.src,'font'),binary=await blob.arrayBuffer();
        const font=new FontFace(face.family,binary,{weight:String(face.weight),style:'normal'});
        await font.load();document.fonts.add(font);
        return await dataURL(blob);
      })().catch(error=>{fontCache.delete(face.src);throw error;}));
    }
    const source=await fontCache.get(face.src);
    return `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};src:url('${source}') format('${face.format}');}`;
  }));
  await document.fonts.ready;
  return css.join('\n');
}
function measureText(context) {
  return (text,node,size)=>{
    context.font=`${node.fontWeight} ${size}px "${node.fontFamily}", "${node.fontFallback||'Noto Sans Thai'}", sans-serif`;
    context.letterSpacing=`${node.letterSpacing||0}px`;
    return context.measureText(text).width;
  };
}
function imageFromSVG(svg) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('เรนเดอร์บอร์ดไม่สำเร็จ กรุณาลองอีกครั้ง'));};
    image.src=url;
  });
}
function pngBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('หน่วยความจำไม่พอสำหรับส่งออกบอร์ด')),'image/png'));
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function createObjectExport(recipe,id) {
  const object=brandObjects(recipe).find(item=>item.id===id);
  if(!object)throw new Error('ไม่พบ Brand object นี้');
  const source=await dataURL(await localBlob(object.src,'image'));
  const {x,y,w,h}=object.crop;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${x*1024} ${y*1024} ${w*1024} ${h*1024}"><image href="${escape(source)}" x="0" y="0" width="1024" height="1024"/></svg>`;
  const image=await imageFromSVG(svg),canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=canvas.getContext('2d',{colorSpace:'srgb'});if(!context)throw new Error('สร้างไฟล์ภาพไม่ได้');
  context.drawImage(image,0,0);
  return new Blob([tagSRGBPNG(await(await pngBlob(canvas)).arrayBuffer(),{dpi:300})],{type:'image/png'});
}

/** Returns a real file independently of download UI; all formats share the same scene. */
export async function createBoardExport(recipe,mood,type) {
  if(!['png','pdf','html','json'].includes(type))throw new Error('ไม่รองรับรูปแบบส่งออกนี้');
  const logoSource=recipe.logo?.src||recipe.ingredients?.find(item=>item?.role==='logo')?.src;
  const mode=recipe.customization?.logoBackdrop;
  const logoBackdrop=['light','dark'].includes(mode)?mode:await resolveLogoBackdrop(logoSource);
  const baseScene=buildBrandBoardScene(recipe,mood,{logoBackdrop}),assets=new Map();
  await Promise.all(baseScene.assets.map(async asset=>assets.set(asset.src,await dataURL(await localBlob(asset.src,'image')))));
  const fontCSS=await prepareFonts(baseScene);
  const canvas=document.createElement('canvas');canvas.width=baseScene.size.width;canvas.height=baseScene.size.height;
  const context=canvas.getContext('2d',{colorSpace:'srgb'});
  if(!context)throw new Error('เบราว์เซอร์นี้ไม่สามารถสร้างบอร์ดได้');
  const scene=layoutBrandBoardText(baseScene,measureText(context));
  const svg=renderBrandBoardSVG(scene,{resolveAsset:src=>assets.get(src),fontCSS});
  if(type==='json') {
    const embeddedSource=async src=>src?(assets.get(src)||await dataURL(await localBlob(src,'image'))):src;
    const originals=new Map();
    const embedItem=async item=>{
      if(!item)return null;
      const result={...item,src:await embeddedSource(item.src)};
      const original=item.originalSrc||item.originalUrl||item.src;
      if(!originals.has(original))originals.set(original,original===item.src?Promise.resolve(result.src):localBlob(original,'original').then(dataURL));
      // Original documents are encoded only as data in JSON, never embedded in HTML/SVG.
      result.originalSrc=await originals.get(original);result.originalUrl=result.originalSrc;
      return result;
    };
    const embedded={...recipe,logo:await embedItem(recipe.logo)};
    for(const key of ['generatedImage','image','productImage','referenceImage'])if(recipe[key])embedded[key]=await embeddedSource(recipe[key]);
    if(recipe.brandObjects)embedded.brandObjects=brandObjects(recipe).map(object=>({...object,src:embedded.generatedImage}));
    embedded.ingredients=await Promise.all((recipe.ingredients||[]).map(embedItem));
    const result={schema:'slaply.brand-recipe.v6',createdAt:new Date().toISOString(),recipe:embedded,guideline:{size:scene.size,template:scene.templateId,boardVariant:scene.variantId,fontPair:scene.fontPairId,palette:scene.palette,colorSpace:'sRGB',dpi:300}};
    return {blob:new Blob([JSON.stringify(result,null,2)],{type:'application/json;charset=utf-8'}),scene};
  }
  if(type==='html') {
    const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(scene.name)} — Brand guideline</title><style>html,body{margin:0;background:${scene.colors.paper}}main{max-width:2400px;margin:auto}svg{display:block;width:100%;height:auto}p{font:12px system-ui;padding:16px 3%;color:#333}@media print{@page{size:8in 6in;margin:0}p{display:none}}</style></head><body><main>${svg}</main><p>Slaply · 2400 × 1800 · sRGB · ภาพโลโก้และฟอนต์ฝังอยู่ในไฟล์นี้ เปิดได้โดยไม่เชื่อมต่ออินเทอร์เน็ต · ไฟล์ SVG/PDF ต้นฉบับเก็บแยกในสูตร JSON</p></body></html>`;
    return {blob:new Blob([html],{type:'text/html;charset=utf-8'}),scene};
  }
  const image=await imageFromSVG(svg);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);
  const png=tagSRGBPNG(await(await pngBlob(canvas)).arrayBuffer(),{dpi:300});
  const blob=type==='pdf'?new Blob([await createBoardPDF(png,{...scene.size,title:scene.name,dpi:300})],{type:'application/pdf'}):new Blob([png],{type:'image/png'});
  return {blob,scene};
}
