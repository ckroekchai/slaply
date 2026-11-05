import { asset } from './assets.js';
import { safeGuidelineImage } from './brand-guideline-model.js';

export const LOGO_BACKDROPS = Object.freeze({ light: '#FFFFFF', dark: '#171A24' });
const rgb = { light: [255,255,255], dark: [23,26,36] };
const linear = value => { const unit=value/255;return unit<=.04045?unit/12.92:((unit+.055)/1.055)**2.4; };
const luminance = ([r,g,b]) => .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
const contrast = (a,b) => (Math.max(a,b)+.05)/(Math.min(a,b)+.05);

function dominantBorderColor(pixels,{width,height}={}) {
  const count=pixels.length/4;
  const dimensional=Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width*height===count;
  const edge=dimensional?Math.max(1,Math.round(Math.min(width,height)*.04)):0,buckets=new Map();
  for(let pixel=0;pixel<count;pixel++){
    if(dimensional){const x=pixel%width,y=Math.floor(pixel/width);if(x>=edge&&x<width-edge&&y>=edge&&y<height-edge)continue;}
    const offset=pixel*4,alpha=pixels[offset+3]/255;if(!alpha)continue;
    const key=(pixels[offset]>>5)*64+(pixels[offset+1]>>5)*8+(pixels[offset+2]>>5);
    const bucket=buckets.get(key)||{weight:0,channels:[0,0,0]};bucket.weight+=alpha;
    for(let channel=0;channel<3;channel++)bucket.channels[channel]+=pixels[offset+channel]*alpha;
    buckets.set(key,bucket);
  }
  const dominant=[...buckets.values()].sort((a,b)=>b.weight-a.weight)[0];if(!dominant)return [255,255,255];
  return dominant.channels.map(value=>value/dominant.weight);

}

/** Inspect pixels only. The source image is never rewritten, cropped, or recolored. */
export function chooseLogoBackdrop(pixels, {width,height} = {}) {
  if(!pixels || pixels.length%4)throw new Error('Expected original RGBA pixels.');
  const count=pixels.length/4;
  let coverage=0;for(let offset=3;offset<pixels.length;offset+=4)coverage+=pixels[offset]/255;
  if(!coverage)return 'light';
  if(coverage/count>=.99){
    // An opaque upload already includes its own background. Match its edge
    // instead of mistaking a large white canvas for a white foreground mark.
    const color=dominantBorderColor(pixels,{width,height});
    const distance=key=>rgb[key].reduce((sum,value,index)=>sum+(value-color[index])**2,0);
    return distance('dark')<distance('light')?'dark':'light';
  }
  const scores={light:0,dark:0},backgroundLuma={light:luminance(rgb.light),dark:luminance(rgb.dark)};
  for(let offset=0;offset<pixels.length;offset+=4){
    const alpha=pixels[offset+3]/255;if(!alpha)continue;
    for(const key of ['light','dark']){
      const composite=rgb[key].map((channel,index)=>pixels[offset+index]*alpha+channel*(1-alpha));
      scores[key]+=alpha*Math.log(contrast(luminance(composite),backgroundLuma[key]));
    }
  }
  return scores.dark>scores.light?'dark':'light';
}

export const LOGO_QUALITY_HINT = 'โลโก้ต้นฉบับสีอ่อนบนพื้นขาว ลองอัปโหลดโลโก้พื้นโปร่งใสหรือเวอร์ชันที่เห็นชัดขึ้น เพื่อให้ใช้งานได้ดีขึ้น';
/** An advisory for the web editor only; it never changes the exported identity. */
export function inspectLogoPixels(pixels,dimensions={}) {
  const backdrop=chooseLogoBackdrop(pixels,dimensions),count=pixels.length/4;
  let coverage=0;for(let i=3;i<pixels.length;i+=4)coverage+=pixels[i]/255;
  const opaque=Boolean(count&&coverage/count>=.99);
  if(!opaque)return {backdrop,opaque,lowContrast:false,warning:null};
  const background=dominantBorderColor(pixels,dimensions),backgroundLuma=luminance(background);
  if(backgroundLuma<.8)return {backdrop,opaque,lowContrast:false,warning:null};
  const foreground=[];
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]<250)continue;
    const ratio=contrast(luminance([pixels[i],pixels[i+1],pixels[i+2]]),backgroundLuma);
    // Ignore near-background compression noise and evaluate actual visible marks.
    if(ratio>1.10)foreground.push(ratio);
  }
  foreground.sort((a,b)=>a-b);
  const strongContrast=foreground.length?foreground[Math.min(foreground.length-1,Math.floor(foreground.length*.95))]:1;
  const lowContrast=strongContrast<2;
  return {backdrop,opaque,lowContrast,warning:lowContrast?LOGO_QUALITY_HINT:null};
}

const cache=new Map(),emptyInspection={backdrop:'light',opaque:false,lowContrast:false,warning:null};
const emptyEntry={inspection:Promise.resolve(emptyInspection),backdrop:Promise.resolve('light')};
function inspectionEntry(source) {
  if(!source)return emptyEntry;
  const resolved=safeGuidelineImage(asset(source));
  if(!resolved)throw new Error('อ่านสีโลโก้ต้นฉบับไม่ได้');
  if(cache.has(resolved))return cache.get(resolved);
  const inspection=new Promise((resolve,reject)=>{
    const image=new window.Image();image.decoding='async';
    image.onerror=()=>reject(new Error('เปิดโลโก้ต้นฉบับเพื่อเลือกพื้นหลังไม่ได้'));
    image.onload=()=>{
      try{
        if(!image.naturalWidth||!image.naturalHeight)throw new Error('ไฟล์โลโก้ไม่มีขนาดภาพ');
        // A bounded analysis sample avoids allocating another full-size original.
        const scale=Math.min(1,256/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});
        if(!context)throw new Error('อ่านสีโลโก้ต้นฉบับไม่ได้');
        context.drawImage(image,0,0,canvas.width,canvas.height);
        resolve(inspectLogoPixels(context.getImageData(0,0,canvas.width,canvas.height).data,{width:canvas.width,height:canvas.height}));
      }catch(error){reject(error);}
    };
    image.src=resolved;
  }).catch(error=>{cache.delete(resolved);throw error;});
  const entry={inspection};cache.set(resolved,entry);if(cache.size>32)cache.delete(cache.keys().next().value);
  return entry;
}
/** Browser/UI and exports share one decoded-pixel inspection, with no paid call. */
export function inspectLogoSource(source) {
  try{return inspectionEntry(source).inspection;}catch(error){return Promise.reject(error);}
}
export function resolveLogoBackdrop(source) {
  try{const entry=inspectionEntry(source);return entry.backdrop||(entry.backdrop=entry.inspection.then(info=>info.backdrop));}catch(error){return Promise.reject(error);}
}
