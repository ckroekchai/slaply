import guidelineCSS from './brand-guideline.css?raw';
import fontCSS from './fonts.css?raw';
import { buildGuidelineModel, normalizeCustomization, renderGuidelineMarkup, renderGuidelineDetails, renderGuidelineIngredients, escapeGuidelineHTML, GUIDELINE_SIZE } from './brand-guideline-model.js';
const NOTICE = 'Slaply AI Beta brand guideline. Original ingredients are preserved separately from the AI-generated illustration. Review details before use. This is a digital art direction, not a production packaging file or trademark clearance.';
const IMAGE_DATA = /^data:image\/(?:png|jpe?g|webp|avif|gif|bmp);base64,[a-z\d+/=\s]+$/i;
const ALLOWED_MIME = /^image\/(?:png|jpe?g|webp|avif|gif|bmp)$/i;
const e = escapeGuidelineHTML;
function filename(recipe, extension) { const name=String(recipe.name||'my-brand').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').replace(/\s+/g,'-').slice(0,70)||'my-brand';return `${name}-slaply.${extension}`; }
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image encoding failed.'));
    reader.onerror = () => reject(reader.error || new Error('Image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

async function imageDataURL(source) {
  source = window.__SLAPLY_ASSETS__?.[source] || source;
  if (typeof source !== 'string' || !source) throw new Error('An image source is required.');
  if (source.startsWith('data:')) {
    if (!IMAGE_DATA.test(source)) throw new Error('Only embedded raster images can be exported.');
    return source;
  }
  const url = new URL(source, window.location.href);
  if (url.origin !== window.location.origin || !['http:', 'https:', 'file:', 'blob:'].includes(url.protocol)) {
    throw new Error('Exports only read images stored by Slaply.');
  }
  const response = await fetch(url.href, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Image could not be loaded (${response.status}).`);
  const blob = await response.blob();
  if (!ALLOWED_MIME.test(blob.type)) throw new Error('The selected asset is not a supported raster image.');
  return blobToDataURL(blob);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => image.naturalWidth && image.naturalHeight ? resolve(image) : reject(new Error('The image is empty.'));
    image.onerror = () => reject(new Error('The image could not be decoded.'));
    image.src = source;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This image is too large for this browser to export.')), 'image/png');
    } catch (error) { reject(error); }
  });
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to consume large local PNG / HTML downloads.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function segments(text) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)].map((item) => item.segment);
  }
  return text.split(/(\s+)/);
}

function wrapText(context, text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const token of segments(paragraph)) {
      if (context.measureText(line + token).width <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      if (context.measureText(token).width <= width) { line = token.trimStart(); continue; }
      // A long name or non-spaced word still remains inside the layout.
      for (const character of [...token]) {
        if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines.length ? lines : [''];
}

function fitText(context, text, width, height, maxSize, minSize, weight = 600, lineHeight = 1.06) {
  const family = '"Space Grotesk", "Noto Sans Thai", Arial, sans-serif';
  let size = maxSize;
  let lines;
  while (size >= minSize) {
    context.font = `${weight} ${size}px ${family}`;
    lines = wrapText(context, text, width);
    if (lines.length * size * lineHeight <= height) break;
    size -= 2;
  }
  // Preserve all supplied text even when it is much longer than the editor's normal limits.
  while (lines.length * size * lineHeight > height && size > 6) {
    size -= 1;
    context.font = `${weight} ${size}px ${family}`;
    lines = wrapText(context, text, width);
  }
  return { lines, size, lineHeight: size * lineHeight };
}

function drawFittedText(context, text, x, y, width, height, maxSize, minSize, weight = 600, lineHeight = 1.06) {
  const layout = fitText(context, text, width, height, maxSize, minSize, weight, lineHeight);
  context.textBaseline = 'top';
  layout.lines.forEach((line, index) => context.fillText(line, x, y + index * layout.lineHeight));
  return layout;
}


function text(context,value,x,y,width,height,size,weight=400,ink='#202442',line=1.35) {
  context.fillStyle=ink;return drawFittedText(context,String(value),x,y,width,height,size,Math.min(12,size),weight,line);
}
function contain(context,image,box,fraction=1) {
  const width=box.w*fraction,height=box.h*fraction,scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  context.drawImage(image,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);
}
async function prepareImages(model) {
  const sources=[...new Set([model.productSource,model.generatedSource,model.objectSource,...model.ingredients.map(item=>item.src)].filter(Boolean))];
  const entries=await Promise.all(sources.map(async source=>[source,await imageDataURL(source)]));
  return new Map(entries);
}
async function guidelineCanvas(model, embedded) {
  if(document.fonts?.ready)await document.fonts.ready;
  const loaded=new Map(await Promise.all([...embedded].map(async([src,data])=>[src,await loadImage(data)])));
  const canvas=document.createElement('canvas');canvas.width=GUIDELINE_SIZE.width;canvas.height=GUIDELINE_SIZE.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot create the brand artwork.');
  const c=model.colors,r=model.layout;
  context.fillStyle=c.paper;context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  const ellipse=(x,y,w,h,fill,rotation=0,opacity=1,blur=0)=>{
    context.save();context.translate(x+w/2,y+h/2);context.rotate(rotation*Math.PI/180);context.globalAlpha=opacity;if(blur)context.filter=`blur(${blur}px)`;context.fillStyle=fill;context.beginPath();context.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);context.fill();context.restore();
  };
  ellipse(752,313.6,1008,795.2,c.halo,0,.42);
  ellipse(704,436.8,768,548.8,c.stage,-18);
  ellipse(720,918.4,576,39.2,c.ink,0,.09,12.8);
  if(loaded.has(model.generatedSource)){context.save();context.filter=model.objectFilter;contain(context,loaded.get(model.generatedSource),r.generated,model.objectFraction);context.restore();}
  const sprite=loaded.get(model.objectSource);
  const drawObject=object=>{
    if(!sprite)return;
    const cell=sprite.naturalWidth/3;
    context.save();context.translate(object.x,object.y);context.rotate(object.rotation*Math.PI/180);context.filter=model.objectFilter;context.globalAlpha=object.opacity;
    context.drawImage(sprite,object.family.position*cell,0,cell,sprite.naturalHeight,-object.size/2,-object.size/2,object.size,object.size);context.restore();
  };
  model.objects.slice(0,2).forEach(drawObject);
  context.save();context.letterSpacing='1.92px';text(context,'A BRAND OF YOUR OWN.',64,48,900,28,15.04,600,c.ink,1.25);context.letterSpacing='2.08px';
  context.font='400 12.96px "Space Grotesk", "Noto Sans Thai", Arial, sans-serif';context.fillStyle=c.ink;context.textBaseline='top';context.textAlign='right';context.fillText('SLAPLY STUDIO',1536,50);context.restore();
  context.save();
  let nameSize=model.fonts.name;
  context.font=`700 ${nameSize}px "Space Grotesk", "Noto Sans Thai", Arial, sans-serif`;context.letterSpacing=`${nameSize*-.065}px`;
  while(context.measureText(model.name).width>r.identity.w&&nameSize>6){nameSize-=1;context.font=`700 ${nameSize}px "Space Grotesk", "Noto Sans Thai", Arial, sans-serif`;context.letterSpacing=`${nameSize*-.065}px`;}
  context.fillStyle=c.ink;context.textBaseline='top';context.fillText(model.name,r.identity.x,r.identity.y+(r.identity.h-nameSize*1.15)/2);context.restore();
  text(context,model.description,r.description.x,r.description.y,r.description.w,r.description.h,model.fonts.description,400,c.ink,1.4);
  if(loaded.has(model.productSource))contain(context,loaded.get(model.productSource),r.product);
  model.objects.slice(2).forEach(drawObject);
  ellipse(70,1029,24,24,c.ink);
  text(context,model.keywords.join(' / '),110,1030,1060,40,19.2,500,c.ink,1.35);
  context.save();context.font='400 13.12px "Space Grotesk", "Noto Sans Thai", Arial, sans-serif';context.letterSpacing='.4px';context.fillStyle=c.ink;context.textBaseline='top';context.textAlign='right';context.fillText('Made with Slaply',1536,1042);context.restore();
  return canvas;
}

async function embeddedFonts() {
  // Use the font rules already loaded by this prototype, including the data URLs
  // supplied by its standalone HTML build. Never fetch a remote font provider.
  const found=[];
  const inspect=sheet=>{let rules;try{rules=sheet.cssRules;}catch{return;}for(const rule of rules||[]){if(rule.type===5&&/Space Grotesk|Noto Sans Thai/.test(rule.cssText))found.push(rule.cssText);else if(rule.styleSheet)inspect(rule.styleSheet);}};
  for(const sheet of document.styleSheets)inspect(sheet);
  let css=found.length?found.join('\n'):fontCSS;
  const urls=[...new Set([...css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(m=>m[1]))];
  const replacements=await Promise.all(urls.map(async source=>{
    const mapped=window.__SLAPLY_ASSETS__?.[source]||source;
    if(mapped.startsWith('data:'))return[source,mapped];
    const url=new URL(mapped,window.location.href);
    if(url.origin!==window.location.origin||!['http:','https:','file:','blob:'].includes(url.protocol))throw new Error('The guideline font is not a local asset.');
    const response=await fetch(url.href,{credentials:'same-origin'});if(!response.ok)throw new Error('The local guideline font could not be loaded.');return[source,await blobToDataURL(await response.blob())];
  }));
  for(const[source,data]of replacements)css=css.split(source).join(data);
  return css;
}
async function standaloneHTML(model,embedded) {
  const fonts=await embeddedFonts();
  const resolve=source=>embedded.get(source)||source;
  const markup=renderGuidelineMarkup(model,resolve);
  const details=renderGuidelineDetails(model),ingredients=renderGuidelineIngredients(model,resolve);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${e(model.name)} — Brand Guideline</title><style>${fonts}\n${guidelineCSS}\nhtml,body{margin:0;padding:0;background:${model.colors.paper}}body{padding:24px;font-family:"Space Grotesk","Noto Sans Thai",Arial,sans-serif}.export-board{max-width:1600px;margin:auto}.export-details{padding:16px 40px 0}.export-notice{max-width:1600px;margin:20px auto 0;color:${model.colors.muted};font-size:11px;line-height:1.7}.export-notice strong{color:${model.colors.ink}}@media(max-width:700px){body{padding:0}.export-notice{padding:0 22px 20px}}@media print{body{padding:0}.export-notice{margin:12px 20px}.guide-board{break-inside:avoid}}</style></head><body><main class="export-board"><div class="brand-guideline">${markup}</div><div class="export-details">${details}${ingredients}</div></main><p class="export-notice"><strong>Slaply brand guideline · ${GUIDELINE_SIZE.width} × ${GUIDELINE_SIZE.height} composition</strong><br>${e(NOTICE)} Original images and fonts are embedded. This downloaded file opens offline and does not contact an AI provider.</p></body></html>`;
}

/** Download the current, customized guideline with embedded original and generated assets. */
export async function exportBrand(recipe,mood,type) {
  if(!recipe||!mood)throw new Error('A brand recipe and direction are required.');
  if(type==='asset'){if(!recipe.generatedImage)throw new Error('สูตรนี้ยังไม่มีภาพ AI');const data=await imageDataURL(recipe.generatedImage);const blob=await(await fetch(data)).blob();download(blob,filename(recipe,'png').replace('-slaply.png','-slaply-ai.png'));return;}
  const model=buildGuidelineModel(recipe,mood),embedded=await prepareImages(model);
  if(type==='json'){
    const exportedRecipe={...recipe,format:'brand-artwork',customization:normalizeCustomization(recipe.customization)};
    if(recipe.generatedImage)exportedRecipe.generatedImage=embedded.get(recipe.generatedImage)||await imageDataURL(recipe.generatedImage);
    if(recipe.image)exportedRecipe.image=embedded.get(recipe.image)||await imageDataURL(recipe.image);
    if(recipe.productImage)exportedRecipe.productImage=embedded.get(recipe.productImage)||await imageDataURL(recipe.productImage);
    if(recipe.referenceImage)exportedRecipe.referenceImage=embedded.get(recipe.referenceImage)||await imageDataURL(recipe.referenceImage);
    if(Array.isArray(recipe.ingredients))exportedRecipe.ingredients=await Promise.all(recipe.ingredients.slice(0,6).map(async item=>item?{...item,locked:Boolean(item.locked),src:embedded.get(item.src)||await imageDataURL(item.src)}:null));
    const {image,...visualDirection}=mood;
    const payload={schema:'slaply.brand-recipe.v5',createdAt:new Date().toISOString(),prototype:false,notice:NOTICE,recipe:exportedRecipe,visualDirection,guideline:{generatedImage:embedded.get(model.generatedSource)||null,size:model.size,colors:model.colors,palette:model.palette,typography:model.typography,keywords:model.keywords,objects:{styles:model.objectStyles,families:model.objectFamilies.map(family=>family.label),style:model.objectStyle,family:model.objectFamily?.label||null,source:embedded.get(model.objectSource),columns:3,selectedColumns:model.objectFamilies.map(family=>family.position),selectedColumn:model.objectFamily?.position??null,instances:model.objects,filter:model.objectFilter}}};
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),filename(recipe,'json'));return;
  }
  if(type==='png'){download(await canvasBlob(await guidelineCanvas(model,embedded)),filename(recipe,'png'));return;}
  if(type==='html'){download(new Blob([await standaloneHTML(model,embedded)],{type:'text/html;charset=utf-8'}),filename(recipe,'html'));return;}
  throw new Error(`Unsupported export format: ${String(type)}`);
}
