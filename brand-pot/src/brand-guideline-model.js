import { BRAND_OBJECT_IDS } from '../shared/brand-objects.mjs';
export const GUIDELINE_SIZE = Object.freeze({ width: 1600, height: 1120 });
export const DEFAULT_CUSTOMIZATION = Object.freeze({ textScale: 100, objectScale: 100, objectStyles: Object.freeze(['bloom']), objectStyle: 'bloom', hue: 0, brightness: 100, saturation: 100 });
export const DEFAULT_BOARD_CUSTOMIZATION = Object.freeze({ ...DEFAULT_CUSTOMIZATION, boardVariant:'ai', layout: 'auto', fontPair: 'auto', density: 'auto', pattern: 'auto', logoBackdrop: 'auto', logoScale: 100 });
export const BRAND_OBJECTS_ASSET = '/assets/brand-objects.png';
export const BRAND_OBJECTS = Object.freeze([
  { id: 'bloom', label: 'Bloom', description: 'Soft, playful energy', position: 0, src: BRAND_OBJECTS_ASSET },
  { id: 'orbit', label: 'Orbit', description: 'Bold, magnetic motion', position: 1, src: BRAND_OBJECTS_ASSET },
  { id: 'ribbon', label: 'Ribbon', description: 'Fluid, expressive form', position: 2, src: BRAND_OBJECTS_ASSET },
]);
export const GUIDELINE_LAYOUT = Object.freeze({
  header: { x: 64, y: 48, w: 1472, h: 28 },
  identity: { x: 58, y: 112, w: 1484, h: 268 },
  description: { x: 72, y: 417, w: 444, h: 108 },
  product: { x: 620, y: 393, w: 760, h: 580 },
  generated: { x: 535, y: 350, w: 1065, h: 665 },
  signature: { x: 70, y: 1018, w: 1100, h: 46 },
  footer: { x: 1250, y: 1042, w: 286, h: 24 },
});

const clamp = (value, min, max, fallback) => {
  const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  return numeric && Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
};
export function normalizeCustomization(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  // An explicit list (including []) wins over the legacy single-family field.
  const selected = Array.isArray(value.objectStyles) ? value.objectStyles : [value.objectStyle || 'bloom'];
  const objectStyles = [...BRAND_OBJECTS.map(item=>item.id),...BRAND_OBJECT_IDS].filter(id=>selected.includes(id));
  if (!Array.isArray(value.objectStyles) && !objectStyles.length) objectStyles.push('bloom');
  return {
    ...('boardVariant' in value?{boardVariant:['ai','minimal','professional','creative'].includes(value.boardVariant)?value.boardVariant:'ai'}:{}),
    textScale: clamp(value.textScale, 75, 125, 100),
    objectScale: clamp(value.objectScale, 50, 150, 100),
    objectStyles,
    objectStyle: objectStyles[0] || null,
    hue: clamp(value.hue, -180, 180, 0),
    brightness: clamp(value.brightness, 50, 150, 100),
    saturation: clamp(value.saturation, 0, 180, 100),
    ...Object.fromEntries(Object.entries({ layout: ['auto','editorial','expressive','minimal'], fontPair: ['auto','grotesk','editorial-serif','display'], density: ['auto','airy','balanced','compact'], pattern: ['auto','repeat','stripe','tile'], logoBackdrop: ['auto','light','dark'] }).filter(([key]) => key in value).map(([key, choices]) => [key, choices.includes(value[key]) ? value[key] : choices[0]])),
    ...('logoScale' in value ? { logoScale: clamp(value.logoScale, 70, 115, 100) } : {}),
  };
}
function rgb(value, fallback = [200, 234, 213]) {
  const text = String(value || '').trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text);
  if (hex) { const h = hex[1].length === 3 ? [...hex[1]].map(x => x+x).join('') : hex[1]; return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); }
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
  return match ? match.slice(1,4).map(v => clamp(v,0,255,0)) : [...fallback];
}
export const colorHex = value => '#' + rgb(value).map(v => Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
function hexFromRGB(value) { return '#' + value.map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
export function mixColors(a,b,amount=.5) { const left=rgb(a),right=rgb(b);return hexFromRGB(left.map((v,i)=>v*(1-amount)+right[i]*amount)); }
function hslFromRGB(value) {
  const [r,g,b]=value.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;}
  return [(h+360)%360,s,l];
}
function rgbFromHSL(h,s,l) { const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return v.map(n=>(n+m)*255); }
export function adjustBrandColor(value, settings = DEFAULT_CUSTOMIZATION) {
  const c=normalizeCustomization(settings),[h,s,l]=hslFromRGB(rgb(value));
  return hexFromRGB(rgbFromHSL((h+c.hue+360)%360,Math.min(1,s*c.saturation/100),l).map(v=>v*c.brightness/100));
}
function luminance(color) { const v=rgb(color).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]; }
export function readableInk(background, preferred='#202442') {
  const bg=luminance(background), contrast=color=>{const fg=luminance(color);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)};
  if(contrast(preferred)>=4.5)return colorHex(preferred);
  const candidates=['#202442','#FFF9EE'];
  const passing=candidates.filter(color=>contrast(color)>=4.5).sort((a,b)=>contrast(b)-contrast(a));
  if(passing.length)return passing[0];
  return contrast('#000000')>=contrast('#FFFFFF')?'#000000':'#FFFFFF';
}
export function escapeGuidelineHTML(value) { return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
export function safeGuidelineImage(value) { const s=typeof value==='string'?value:'';return /^(?:\/assets\/[\w./-]+|\/api\/assets\/[a-z\d_-]+(?:\/preview)?|data:image\/(?:png|jpe?g|webp|avif|gif|bmp);base64,[a-z\d+/=\s]+|blob:[^\s]+)$/i.test(s)?s:''; }
function getKeywords(words, mood) {
  const parts=String(words||'').split(/[.,;!?·\n]+|\s{2,}/).map(s=>s.trim()).filter(Boolean);
  let wordsList=parts.length>=2?parts:String(words||'').split(/\s+/).filter(Boolean);
  wordsList=wordsList.filter(s=>s.length<=26).slice(0,3);
  const fallback=mood.id==='luxe'?['Thoughtful','Refined','Distinctive']:mood.id==='bold'?['Confident','Expressive','Unexpected']:['Fresh','Playful','Approachable'];
  for(const word of fallback){if(wordsList.length>=3)break;if(!wordsList.includes(word))wordsList.push(word);}
  return wordsList;
}
function fittedSize(text, width, height, preferred, min=16) {
  const units=[...String(text)].reduce((n,char)=>n+(/\s/.test(char)?.3:/[\u0E00-\u0E7F]/.test(char)?.8:.57),0);
  let size=preferred;
  while(size>min && Math.max(1,Math.ceil(units*size/width))*size*1.4>height)size-=1;
  return size;
}
export function buildGuidelineModel(recipe = {}, mood = {}) {
  const customization=normalizeCustomization(recipe.customization),factor=customization.textScale/100;
  const sourcePaper=recipe.paper||recipe.referenceColor||mood.paper||'#C8EAD5';
  const paper=adjustBrandColor(mixColors(sourcePaper,'#FFF9EE',.73),customization);
  const ink=readableInk(paper,adjustBrandColor(recipe.ink||mood.ink||'#202442',customization));
  const aiPalette=Array.isArray(recipe.palette)?recipe.palette.map(item=>typeof item==='string'?item:item?.color).filter(value=>/^#[0-9a-f]{6}$/i.test(value)).slice(0,3):[];
  const paletteSeeds=aiPalette.length===3?aiPalette:[recipe.referenceColor||mood.palette?.[0]||'#A7DCBF',mood.palette?.[1]||'#FFC3A2',mood.palette?.[2]||'#214C35'];
  const primary=adjustBrandColor(paletteSeeds[0],customization),accent=adjustBrandColor(paletteSeeds[1],customization);
  const colors={paper,ink,muted:readableInk(paper,mixColors(ink,paper,.32)),line:mixColors(ink,paper,.83),surface:mixColors(paper,'#FFFFFF',.38),primary,accent,chip:mixColors(accent,paper,.62),stage:mixColors(primary,paper,.58),halo:mixColors(accent,paper,.55)};
  const ingredients=(Array.isArray(recipe.ingredients)?recipe.ingredients.slice(0,6):[{src:recipe.productImage,name:'Product',locked:true},{src:recipe.referenceImage,name:'Reference'}]).flatMap((item,index)=>item&&safeGuidelineImage(item.src)?[{...item,src:safeGuidelineImage(item.src),slot:index+1,name:String(item.name||`Ingredient ${index+1}`),locked:Boolean(item.locked),primary:item.src===recipe.productImage}]:[]);
  const productSource=safeGuidelineImage(recipe.productImage)||ingredients.find(item=>item.locked)?.src||ingredients[0]?.src||'';
  const name=String(recipe.name||'YOUR BRAND').trim()||'YOUR BRAND';
  const units=[...name].reduce((n,char)=>n+(/\s/.test(char)?.28:/[\u0E00-\u0E7F]/.test(char)?.69:.55),0);
  const nameSize=Math.min(238*factor,1450/Math.max(units,1));
  const objectFamilies=customization.objectStyles.map(style=>BRAND_OBJECTS.find(item=>item.id===style));
  const objectFamily=objectFamilies[0]||null;
  const placements=[
    {x:305,y:763,size:588,rotation:-19,opacity:1},
    {x:1405,y:449,size:254,rotation:19,opacity:1},
    {x:1490,y:925,size:210,rotation:-30,opacity:1},
  ];
  const objects=objectFamilies.length?placements.map((item,index)=>{
    // With two families, the second occupies both smaller positions for balance.
    const family=objectFamilies[Math.min(index,objectFamilies.length-1)];
    return {...item,size:item.size*customization.objectScale/100,style:family.id,family};
  }):[];
  const description=String(recipe.words||'Thoughtfully made. Distinctly you.');
  const voiceCopy=String(recipe.promise||recipe.concept?.summary||mood.tagline?.replace(/\n/g,' ')||'A clear point of view. A feeling people remember.');
  return {
    version:5,size:GUIDELINE_SIZE,layout:GUIDELINE_LAYOUT,customization,colors,name,productSource,generatedSource:safeGuidelineImage(recipe.generatedImage),
    description,voiceCopy,keywords:Array.isArray(recipe.keywords)&&recipe.keywords.length?recipe.keywords.map(String).slice(0,3):getKeywords(recipe.words,mood),ingredients,priorityCount:ingredients.filter(item=>item.locked).length,
    moodTitle:String(mood.title||'Your brand direction'),audience:String(recipe.audience||'Your people'),
    palette:[...paletteSeeds.map((seed,index)=>({color:adjustBrandColor(seed,customization),label:['Primary','Accent','Depth'][index]})),{color:paper,label:'Paper'},{color:ink,label:'Ink'}],
    typography:{display:'Space Grotesk',body:'Noto Sans Thai',specimen:'Aa กข',heading:'Make it yours.',bodySample:'Simple words. A distinct point of view.'},
    fonts:{name:nameSize,description:fittedSize(description,444,108,30*factor),label:16*factor,body:23*factor,voice:fittedSize(voiceCopy,600,100,27*factor),typeSpecimen:94*factor,typeHeading:28*factor},
    objectStyles:customization.objectStyles,objectStyle:customization.objectStyle,objectFamilies,objectFamily,objectSource:BRAND_OBJECTS_ASSET,objects,
    objectFilter:`hue-rotate(${customization.hue}deg) saturate(${customization.saturation/100}) brightness(${customization.brightness/100})`,
    objectFraction:customization.objectScale/100,
  };
}
const e=escapeGuidelineHTML;
const at=r=>`left:${r.x/16}%;top:${r.y/11.2}%;width:${r.w/16}%;height:${r.h/11.2}%;`;
const cqw=n=>`${n/16}cqw`;
export function guidelineVariables(model) {
  return Object.entries(model.colors).map(([key,value])=>`--guide-${key}:${value}`).join(';')+`;--guide-text-factor:${model.customization.textScale/100};`;
}
export function renderObjectSprite(style='bloom',resolveAsset=source=>source,className='') {
  const family=BRAND_OBJECTS.find(item=>item.id===style)||BRAND_OBJECTS[0];
  return `<span class="guide-object-sprite ${e(className)}" role="img" aria-label="${family.label} brand object"><img src="${e(resolveAsset(family.src))}" alt="" style="left:-${family.position*100}%" draggable="false"></span>`;
}
export function renderGuidelineMarkup(model,resolveAsset=source=>source) {
  const m=model,r=m.layout;
  return `<article class="guide-board" style="${guidelineVariables(m)}" aria-label="${e(m.name)} brand artwork">
    <div class="guide-scene-halo" aria-hidden="true"></div><div class="guide-scene-stage" aria-hidden="true"></div><div class="guide-scene-shadow" aria-hidden="true"></div>
    ${m.generatedSource?`<figure class="guide-generated-image guide-positioned" style="${at(r.generated)}transform:scale(${m.objectFraction});filter:${m.objectFilter}"><img src="${e(resolveAsset(m.generatedSource))}" alt="${e(m.name)} AI brand illustration"></figure>`:''}
    <div class="guide-topline guide-positioned" style="${at(r.header)}"><strong>A BRAND OF YOUR OWN.</strong><span>SLAPLY STUDIO</span></div>
    <div class="guide-title-wrap guide-positioned" style="${at(r.identity)}"><h2 class="guide-name" style="font-size:${cqw(m.fonts.name)}">${e(m.name)}</h2></div>
    ${m.objects.map((object,index)=>`<div class="guide-art-object guide-positioned guide-art-object-${index}" aria-hidden="true" style="${at({x:object.x-object.size/2,y:object.y-object.size/2,w:object.size,h:object.size})}transform:rotate(${object.rotation}deg);filter:${m.objectFilter};opacity:${object.opacity}">${renderObjectSprite(object.style,resolveAsset)}</div>`).join('')}
    <p class="guide-art-description guide-positioned" style="${at(r.description)}font-size:${cqw(m.fonts.description)}">${e(m.description)}</p>
    <figure class="guide-art-product guide-positioned" style="${at(r.product)}">${m.productSource?`<img src="${e(resolveAsset(m.productSource))}" alt="${e(m.name)} product direction" draggable="false">`:''}</figure>
    <div class="guide-art-signature guide-positioned" style="${at(r.signature)}"><span class="guide-signature-dot" aria-hidden="true"></span><p>${m.keywords.map(e).join(' / ')}</p></div>
    <div class="guide-art-credit guide-positioned" style="${at(r.footer)}">Made with Slaply</div>
  </article>`;
}
export function renderGuidelineDetails(model) {
  const m=model;
  return `<div class="guide-details" style="${guidelineVariables(m)}">
    <section class="guide-detail-palette"><h3>Color story</h3><div class="guide-detail-swatches">${m.palette.map(item=>`<div><i style="background:${item.color}"></i><strong>${item.color}</strong><span>${e(item.label)}</span></div>`).join('')}</div></section>
    <section class="guide-detail-type"><h3>Typography</h3><div class="guide-detail-specimen">${e(m.typography.specimen)}</div><p>${e(m.typography.display)}<br><span>${e(m.typography.body)}</span></p></section>
    <section class="guide-detail-voice"><h3>Brand personality</h3><div class="guide-detail-keywords">${m.keywords.map(word=>`<span>${e(word)}</span>`).join('')}</div><p>${e(m.voiceCopy)}</p><small>${m.objectFamilies.length?`${m.objectFamilies.map(family=>e(family.label)).join(' + ')} objects${m.objectFamilies.length===1?` · ${e(m.objectFamilies[0].description)}`:''}`:'Pure composition · no decorative objects'}</small></section>
  </div>`;
}
export function renderGuidelineIngredients(model,resolveAsset=source=>source) {
  return `<section class="guide-sources" style="${guidelineVariables(model)}"><div class="guide-sources-heading"><h3>Your ingredients</h3><span>${model.ingredients.length} images${model.priorityCount?` · ${model.priorityCount} locked focus`:''}</span></div><div class="guide-source-grid">${model.ingredients.map(item=>`<figure><div class="guide-source-photo"><img src="${e(resolveAsset(item.src))}" alt="${e(item.name)}">${item.locked?'<span>★ Locked focus</span>':''}</div><figcaption>${e(item.name)}</figcaption></figure>`).join('')}</div></section>`;
}
