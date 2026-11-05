import { LOGO_BACKDROPS } from './logo-backdrop.js';
import { brandObjects } from './brand-objects.js';
import { adjustBrandColor, normalizeCustomization, readableInk, safeGuidelineImage, escapeGuidelineHTML } from './brand-guideline-model.js';

export const BOARD_SIZE = Object.freeze({ width: 2400, height: 1800 });
export const BOARD_TEMPLATES = Object.freeze([
  { id: 'editorial', label: 'Editorial', description: 'สมดุลแบบนิตยสาร' },
  { id: 'expressive', label: 'Expressive', description: 'จังหวะชัด มีพลัง' },
  { id: 'minimal', label: 'Minimal', description: 'เรียบ โปร่ง มีพื้นที่' },
]);
export const BOARD_FONT_PAIRS = Object.freeze([
  { id: 'grotesk', label: 'Grotesk', heading: 'Space Grotesk', body: 'Noto Sans Thai', headingFallback: 'Noto Sans Thai' },
  { id: 'editorial-serif', label: 'Editorial Serif', headingWeight: 400, heading: 'DM Serif Display', body: 'Noto Sans Thai', headingFallback: 'Noto Serif Thai' },
  { id: 'display', label: 'Display', heading: 'Kanit', body: 'Noto Sans Thai', headingFallback: 'Noto Sans Thai' },
]);
export const BOARD_FONT_CATALOG = Object.freeze([
  { family: 'Space Grotesk', weight: 400, src: '/assets/fonts/space-0.ttf', format: 'truetype' },
  { family: 'Space Grotesk', weight: 500, src: '/assets/fonts/space-1.ttf', format: 'truetype' },
  { family: 'Space Grotesk', weight: 600, src: '/assets/fonts/space-2.ttf', format: 'truetype' },
  { family: 'Space Grotesk', weight: 700, src: '/assets/fonts/space-3.ttf', format: 'truetype' },
  { family: 'Noto Sans Thai', weight: 400, src: '/assets/fonts/thai-0.ttf', format: 'truetype' },
  { family: 'Noto Sans Thai', weight: 500, src: '/assets/fonts/thai-1.ttf', format: 'truetype' },
  { family: 'Noto Sans Thai', weight: 600, src: '/assets/fonts/thai-2.ttf', format: 'truetype' },
  { family: 'Noto Sans Thai', weight: 700, src: '/assets/fonts/thai-3.ttf', format: 'truetype' },
  { family: 'DM Serif Display', weight: 400, src: '/assets/fonts/dm-serif-display-regular.ttf', format: 'truetype' },
  { family: 'Noto Serif Thai', weight: '100 900', src: '/assets/fonts/noto-serif-thai-variable.ttf', format: 'truetype' },
  { family: 'Kanit', weight: 400, src: '/assets/fonts/kanit-regular.ttf', format: 'truetype' },
  { family: 'Kanit', weight: 600, src: '/assets/fonts/kanit-semibold.ttf', format: 'truetype' },
]);
export const boardFontCSS = (resolve = src => src) => BOARD_FONT_CATALOG.map(font => `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:swap;src:url('${resolve(font.src)}') format('${font.format}');}`).join('\n');

const enumValue = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const clamp = (value, lo, hi, fallback) => Number.isFinite(Number(value)) ? Math.max(lo, Math.min(hi, Number(value))) : fallback;
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
const hex = (value, fallback) => /^#[a-f0-9]{6}$/i.test(value || '') ? value.toUpperCase() : fallback;
const rect = (x, y, w, h) => ({ x, y, w, h });
const inset = (r, amount) => rect(r.x + amount, r.y + amount, r.w - amount * 2, r.h - amount * 2);
const ROLES = ['primary', 'secondary', 'accent', 'paper', 'ink'];
const LAYOUTS = {
  editorial: { logo: rect(64,144,1392,680), artwork: rect(1484,144,852,680), concept: rect(64,852,620,350), palette: rect(712,852,744,350), typography: rect(1484,852,852,350), pattern: rect(64,1230,620,506), social: rect(712,1230,744,506), card: rect(1484,1230,852,506) },
  expressive: { logo: rect(64,144,852,674), typography: rect(944,144,1392,330), palette: rect(944,502,1392,316), artwork: rect(64,846,852,890), concept: rect(944,846,660,360), pattern: rect(1632,846,704,360), social: rect(944,1234,660,502), card: rect(1632,1234,704,502) },
  minimal: { logo: rect(64,144,714,704), concept: rect(64,876,714,352), palette: rect(64,1256,714,480), typography: rect(806,144,1530,332), artwork: rect(806,504,752,724), pattern: rect(1586,504,750,724), social: rect(806,1256,752,480), card: rect(1586,1256,750,480) },
};

/** Designer-owned geometry; model output supplies only bounded tokens and copy. */
export function buildBrandBoardScene(recipe = {}, mood = {}, options = {}) {
  const c = normalizeCustomization(recipe.customization), design = recipe.design || {}, system = recipe.brandSystem || {};
  const templateId = enumValue(c.layout === 'auto' ? design.template : c.layout, BOARD_TEMPLATES.map(x => x.id), enumValue(design.template, BOARD_TEMPLATES.map(x => x.id), 'editorial'));
  const fontPairId = enumValue(c.fontPair === 'auto' ? design.fontPair : c.fontPair, BOARD_FONT_PAIRS.map(x => x.id), enumValue(design.fontPair, BOARD_FONT_PAIRS.map(x => x.id), 'grotesk'));
  const pair = BOARD_FONT_PAIRS.find(x => x.id === fontPairId);
  const density = enumValue(c.density === 'auto' ? design.density : c.density, ['airy','balanced','compact'], enumValue(design.density, ['airy','balanced','compact'], 'balanced'));
  const patternKind = enumValue(c.pattern === 'auto' ? system.pattern?.kind : c.pattern, ['repeat','stripe','tile'], enumValue(system.pattern?.kind, ['repeat','stripe','tile'], 'repeat'));
  const seeds = { primary: recipe.palette?.[0] || '#3D654E', secondary: recipe.palette?.[1] || '#EADBC3', accent: recipe.palette?.[2] || '#C96B49', paper: recipe.paper || '#FAF6ED', ink: recipe.ink || '#172B25' };
  const palette = ROLES.map(role => { const entry = system.palette?.find?.(item => item.role === role); return { role, name: clean(entry?.name) || role, hex: adjustBrandColor(hex(entry?.hex, hex(seeds[role], '#202442')), c) }; });
  const colors = Object.fromEntries(palette.map(item => [item.role, item.hex]));
  const layout = LAYOUTS[templateId], pad = density === 'airy' ? 48 : density === 'compact' ? 32 : 40;
  const radius = templateId === 'expressive' ? 24 : templateId === 'minimal' ? 0 : 3;
  const nodes = [], assets = new Map(); let z = 0;
  const add = node => { nodes.push({ z: z++, ...node }); return node; };
  const box = (id, bounds, fill, extra = {}) => add({ id, type: 'rect', bounds, fill, radius, ...extra });
  const txt = (id, text, bounds, size = 30, extra = {}) => add({ id, type: 'text', text: extra.preserveLineBreaks ? clean(text) : clean(text).replace(/\s+/g,' '), bounds, fontFamily: pair.body, fontFallback: 'sans-serif', fontWeight: 400, fontSize: size * c.textScale / 100, minFontSize: 16, lineHeight: 1.45, fill: colors.ink, align: 'left', verticalAlign: 'top', ...extra });
  const image = (id, src, bounds, sourceRole = 'generated', extra = {}) => {
    src = safeGuidelineImage(src); if (!src) return;
    const preserveOriginal = sourceRole === 'logo';
    assets.set(src, { src, sourceRole, preserveOriginal });
    return add({ id, type: 'image', bounds, assetRef: src, sourceRole, fit: 'contain', preserveOriginal, ...(preserveOriginal ? { originalWidth: Number(recipe.logo?.width) || null, originalHeight: Number(recipe.logo?.height) || null } : { adjustment: { hue: c.hue, saturation: c.saturation, brightness: c.brightness } }), ...extra });
  };
  const label = (id, title, r, fill = colors.ink) => txt(id, title, rect(r.x + pad, r.y + 25, r.w - pad * 2, 27), 20, { fontFamily: 'Space Grotesk', fontWeight: 600, letterSpacing: 2.4, fill });
  const logoSource = safeGuidelineImage(recipe.logo?.src || recipe.ingredients?.find(item => item?.role === 'logo')?.src);
  const artSource = safeGuidelineImage(recipe.generatedImage);
  const objects=brandObjects(recipe),selectedObjects=objects.filter(item=>c.objectStyles.includes(item.id));
  const objectImage=(id,object,bounds,scale=1)=>{
    const size=Math.min(bounds.w,bounds.h)*scale;
    return image(id,object.src,rect(bounds.x+(bounds.w-size)/2,bounds.y+(bounds.h-size)/2,size,size),'brand-object',{sourceCrop:object.crop,objectId:object.id});
  };
  const name = clean(recipe.name) || 'YOUR BRAND';
  // Source identity is server-owned and remains fixed when saved text is edited.
  const sourceName = clean(recipe.sourceName || recipe.brief?.name);
  const renamedCopy = value => { const text=clean(value);return sourceName && sourceName!==name ? text.split(sourceName).join(name) : text; };
  const concept = recipe.concept || { title: name, summary: recipe.words || '' };
  const logoBackdropMode = ['light','dark'].includes(c.logoBackdrop) ? c.logoBackdrop : options.logoBackdrop === 'dark' ? 'dark' : 'light';
  const logoBackdrop = LOGO_BACKDROPS[logoBackdropMode];
  const sourceLogo = (id, bounds) => {
    if (logoSource) image(id, logoSource, bounds, 'logo');
    else txt(id + '-wordmark', name, bounds, 90, { fontFamily: pair.heading, fontFallback: pair.headingFallback, fontWeight: pair.headingWeight || 600, align: 'center', verticalAlign: 'middle', fill: readableInk(logoBackdrop, colors.ink), lineHeight: 1.15 });
  };
  box('board-paper', rect(0,0,2400,1800), colors.paper, { radius: 0 });
  txt('board-name', name, rect(64,55,1400,47), 28, { fontFamily: pair.heading, fontFallback: pair.headingFallback, fontWeight: pair.headingWeight || 600, fill: readableInk(colors.paper,colors.ink) });
  txt('board-title', 'BRAND GUIDELINE', rect(1570,58,766,40), 20, { fontFamily:'Space Grotesk',fontWeight:500,align:'right',letterSpacing:3,fill:readableInk(colors.paper,colors.ink) });
  add({ id:'header-rule',type:'line',bounds:rect(64,116,2272,0),stroke:colors.ink,strokeWidth:1,opacity:.2 });

  // Logo is always the original complete image. No crop, recolor, perspective,
  // global artwork filters, or image-generation replacement is applied here.
  box('logo-panel', layout.logo, logoBackdrop, { radius, stroke: colors.ink, strokeOpacity: .12 });
  label('logo-label', logoSource ? 'ORIGINAL LOGO' : 'BRAND IDENTITY', layout.logo, readableInk(logoBackdrop,colors.ink));
  const logoBox = inset(rect(layout.logo.x,layout.logo.y+68,layout.logo.w,layout.logo.h-140),pad+20);
  const logoScale = clamp(c.logoScale,70,115,100)/100;
  const scaledLogo = rect(logoBox.x + logoBox.w*(1-logoScale)/2,logoBox.y + logoBox.h*(1-logoScale)/2,logoBox.w*logoScale,logoBox.h*logoScale);
  sourceLogo('identity-logo', scaledLogo);
  txt('logo-caption', logoSource ? 'โลโก้ต้นฉบับของคุณ' : clean(concept.title), rect(layout.logo.x+pad,layout.logo.y+layout.logo.h-55,layout.logo.w-pad*2,30), 20, { align:'center',fill:readableInk(logoBackdrop,colors.ink) });

  // The complete family is documented even when only a subset is selected for
  // applications. Generated objects never replace or overlap the original logo.
  box('artwork-panel',layout.artwork,objects.length?colors.paper:colors.secondary,{stroke:colors.ink,strokeOpacity:.12});
  label('artwork-label',objects.length?'BRAND OBJECTS / 01—03':'VISUAL DIRECTION',layout.artwork,readableInk(objects.length?colors.paper:colors.secondary,colors.ink));
  if(objects.length){
    const area=inset(rect(layout.artwork.x,layout.artwork.y+80,layout.artwork.w,layout.artwork.h-108),24),vertical=templateId==='expressive';
    objects.forEach((object,index)=>{
      const cell=vertical?rect(area.x,area.y+index*area.h/3,area.w,area.h/3):rect(area.x+index*area.w/3,area.y,area.w/3,area.h);
      const size=vertical?Math.min(cell.h-20,cell.w*.36):cell.w-16;
      const picture=vertical?rect(cell.x,cell.y+8,size,size):rect(cell.x+8,cell.y+Math.max(0,(cell.h-size-150)/2),size,size);
      objectImage(`brand-${object.id}`,object,picture);
      const tx=vertical?cell.x+size+22:cell.x+8,ty=vertical?cell.y+32:picture.y+size+20,tw=vertical?cell.w-size-30:cell.w-16;
      txt(`brand-${object.id}-name`,object.name,rect(tx,ty,tw,55),27,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,minFontSize:17,fill:readableInk(colors.paper,colors.ink)});
      txt(`brand-${object.id}-rationale`,object.rationale,rect(tx,ty+60,tw,vertical?cell.h-108:100),19,{minFontSize:13,fill:readableInk(colors.paper,colors.ink)});
    });
  }else if (artSource) image('artwork-main',artSource,inset(rect(layout.artwork.x,layout.artwork.y+65,layout.artwork.w,layout.artwork.h-110),24));
  else txt('artwork-direction',clean(recipe.words)||clean(concept.title),inset(layout.artwork,pad+20),68,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,verticalAlign:'middle',fill:readableInk(colors.secondary,colors.ink)});

  box('concept-panel',layout.concept,templateId==='expressive'?colors.primary:colors.paper,{stroke:colors.ink,strokeOpacity:.15});
  const conceptInk=readableInk(templateId==='expressive'?colors.primary:colors.paper,colors.ink);
  label('concept-label','THE IDEA',layout.concept,conceptInk);
  txt('concept-title',concept.title,rect(layout.concept.x+pad,layout.concept.y+72,layout.concept.w-pad*2,92),37,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,lineHeight:1.3,fill:conceptInk,minFontSize:24});
  txt('concept-summary',concept.summary||recipe.words,rect(layout.concept.x+pad,layout.concept.y+180,layout.concept.w-pad*2,layout.concept.h-205),24,{fill:conceptInk,minFontSize:16,lineHeight:1.5});

  box('palette-panel',layout.palette,colors.paper,{stroke:colors.ink,strokeOpacity:.15});
  label('palette-label','SUGGESTED PALETTE',layout.palette,readableInk(colors.paper,colors.ink));
  const pw=(layout.palette.w-pad*2-12*4)/5,py=layout.palette.y+80,ph=layout.palette.h-160;
  palette.forEach((color,index)=>{
    const x=layout.palette.x+pad+index*(pw+12);
    box('palette-'+color.role,rect(x,py,pw,ph),color.hex,{radius:templateId==='expressive'?12:0,paletteRole:color.role,stroke:colors.ink,strokeOpacity:.08});
    txt('palette-hex-'+color.role,color.hex,rect(x,py+ph+13,pw,25),20,{fontFamily:'Space Grotesk',fontWeight:600,lineHeight:1.2,minFontSize:14,fill:readableInk(colors.paper,colors.ink)});
    txt('palette-name-'+color.role,color.role,rect(x,py+ph+39,pw,22),16,{fontFamily:'Space Grotesk',lineHeight:1.2,minFontSize:12,fill:readableInk(colors.paper,colors.ink)});
  });

  box('typography-panel',layout.typography,templateId==='expressive'?colors.ink:colors.paper,{stroke:colors.ink,strokeOpacity:.15});
  const typeInk=templateId==='expressive'?readableInk(colors.ink,colors.paper):readableInk(colors.paper,colors.ink);
  label('typography-label','SUGGESTED TYPOGRAPHY',layout.typography,typeInk);
  const tw=layout.typography.w-pad*2;
  txt('typography-specimen',['Aa กข', renamedCopy(system.typography?.headingSample)].filter(Boolean).join('\n'),rect(layout.typography.x+pad,layout.typography.y+80,tw*.48,layout.typography.h-125),108,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,minFontSize:32,lineHeight:1.08,fill:typeInk,verticalAlign:'middle',preserveLineBreaks:true});
  txt('typography-heading-font',fontPairId === 'editorial-serif' ? 'DM Serif Display / Noto Serif Thai' : pair.heading,rect(layout.typography.x+pad+tw*.52,layout.typography.y+85,tw*.48,55),28,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,minFontSize:20,fill:typeInk});
  txt('typography-body-font',pair.body,rect(layout.typography.x+pad+tw*.52,layout.typography.y+145,tw*.48,32),20,{fontFamily:pair.body,fontWeight:500,fill:typeInk});
  txt('typography-body-sample',renamedCopy(system.typography?.bodySample)||recipe.words||'รายละเอียดเล็ก ๆ ที่ทำให้แบรนด์เป็นคุณ',rect(layout.typography.x+pad+tw*.52,layout.typography.y+195,tw*.48,layout.typography.h-220),22,{minFontSize:16,lineHeight:1.5,fill:typeInk});

  const pattern = (r,prefix='pattern') => {
    const content=inset(rect(r.x,r.y+65,r.w,r.h-85),24);
    if(patternKind==='stripe'||!artSource||(objects.length&&!selectedObjects.length)){
      const stripeColors=[colors.primary,colors.secondary,colors.accent,colors.paper,colors.ink];
      const count=templateId==='expressive'?7:5,w=content.w/count;
      for(let index=0;index<count;index++)box(`${prefix}-stripe-${index}`,rect(content.x+index*w,content.y,w,content.h),stripeColors[index%5],{radius:0});
    }else{
      const cols=patternKind==='tile'?3:2,rows=r.h>550?3:2,gap=patternKind==='tile'?12:24;
      const w=(content.w-gap*(cols-1))/cols,h=(content.h-gap*(rows-1))/rows;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const bounds=rect(content.x+col*(w+gap),content.y+row*(h+gap),w,h),id=`${prefix}-image-${row}-${col}`;
        if(selectedObjects.length)objectImage(id,selectedObjects[(row*cols+col)%selectedObjects.length],bounds,Math.min(1,c.objectScale/130));else image(id,artSource,bounds);
      }
    }
  };
  box('pattern-panel',layout.pattern,colors.secondary);label('pattern-label','PATTERN & RHYTHM',layout.pattern,readableInk(colors.secondary,colors.ink));pattern(layout.pattern);

  const app = (kind,r) => {
    const source=system.applications?.find?.(item=>item.kind===kind)||{};
    box(`application-${kind}-panel`,r,kind==='social'?colors.primary:colors.secondary);
    label(`application-${kind}-label`,kind==='social'?'SOCIAL APPLICATION':'BUSINESS CARD',r,readableInk(kind==='social'?colors.primary:colors.secondary,colors.ink));
    const inner=inset(rect(r.x,r.y+70,r.w,r.h-94),28);
    if(kind==='social'){
      const left=rect(inner.x,inner.y,inner.w*.49,inner.h);
      const logoR=rect(left.x,left.y,Math.min(left.w*.85,220),85);
      box('social-logo-backdrop',logoR,logoBackdrop,{radius:0});sourceLogo('social-logo',inset(logoR,10));
      txt('social-headline',renamedCopy(source.headline)||name,rect(left.x,left.y+110,left.w,inner.h-156),43,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,lineHeight:1.2,minFontSize:24,fill:readableInk(colors.primary,colors.ink)});
      txt('social-body',renamedCopy(source.body)||recipe.keywords?.join(' · ')||'',rect(left.x,left.y+inner.h-40,inner.w,38),19,{fill:readableInk(colors.primary,colors.ink),minFontSize:14});
      const artBounds=rect(inner.x+inner.w*.54,inner.y+12,inner.w*.46,inner.h-65);
      if(selectedObjects.length)objectImage('social-artwork',selectedObjects[0],artBounds,Math.min(1,c.objectScale/130));
      else if(artSource&&!objects.length)image('social-artwork',artSource,artBounds);
    }else{
      const card=rect(inner.x+inner.w*.05,inner.y+4,inner.w*.9,inner.h-8);
      box('business-card-face',card,logoBackdrop,{radius:3});
      sourceLogo('business-card-logo',rect(card.x+card.w*.12,card.y+card.h*.11,card.w*.76,card.h*.48));
      const ink=readableInk(logoBackdrop,colors.ink);
      txt('business-card-headline',renamedCopy(source.headline)||name,rect(card.x+26,card.y+card.h*.67,card.w-52,42),24,{fontFamily:pair.heading,fontFallback:pair.headingFallback,fontWeight:pair.headingWeight||600,align:'center',fill:ink});
      txt('business-card-body',renamedCopy(source.body)||recipe.promise||'',rect(card.x+30,card.y+card.h*.82,card.w-60,card.h*.14),17,{minFontSize:12,align:'center',fill:ink});
    }
  };
  app('social',layout.social);app('business-card',layout.card);
  txt('board-footer','MADE WITH SLAPLY',rect(64,1757,1200,25),16,{fontFamily:'Space Grotesk',letterSpacing:2,fill:readableInk(colors.paper,colors.ink)});
  txt('board-footer-type',`${templateId.toUpperCase()} / ${fontPairId.toUpperCase()}`,rect(1390,1757,946,25),16,{fontFamily:'Space Grotesk',align:'right',letterSpacing:1,fill:readableInk(colors.paper,colors.ink)});
  return {version:6,size:BOARD_SIZE,templateId,fontPairId,density,patternKind,logoBackdrop:logoBackdropMode,name,colors,palette,layout,brandObjects:objects.map(({id,name,rationale,crop})=>({id,name,rationale,crop})),fontFamilies:[...new Set(['Space Grotesk',pair.heading,pair.body,pair.headingFallback])],assets:[...assets.values()],nodes};
}

const graphemes = text => typeof Intl.Segmenter==='function' ? [...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(text)].map(x=>x.segment) : [...text];
const closingPunctuation = text => /^[,.;:!?%…\)\]\}”’]+$/.test(text);
const attachPunctuation = segments => segments.reduce((parts,part)=>{ if(parts.length&&closingPunctuation(part))parts[parts.length-1]+=part;else parts.push(part);return parts; },[]);
const words = text => attachPunctuation(typeof Intl.Segmenter==='function' ? [...new Intl.Segmenter('th',{granularity:'word'}).segment(text)].map(x=>x.segment) : text.split(/(\s+)/));
const estimatedMeasure = (text,node,size) => graphemes(text).reduce((width,char)=>width+(/\s/.test(char)?.28:/[\u0E00-\u0E7F]/.test(char)?.65:.55)*size,0) + Math.max(0,graphemes(text).length-1)*(node.letterSpacing||0);
const measured = (measure,text,node,size) => { const value=measure(text,node,size);return typeof value==='number'?value:Number(value?.width)||0; };
function wrap(text,width,node,size,measure) {
  const lines=[];
  for(const paragraph of text.split('\n')){
    let line='';
    for(const part of words(paragraph)){
      if(measured(measure,line+part,node,size)<=width){line+=part;continue}
      if(line.trim()){lines.push(line.trimEnd());line=''}
      if(measured(measure,part,node,size)<=width){line=part.trimStart();continue}
      for(const char of attachPunctuation(graphemes(part))){if(line&&measured(measure,line+char,node,size)>width){lines.push(line);line=''}line+=char}
    }
    lines.push(line.trimEnd());
  }
  return lines.length?lines:[''];
}
/** measure(text,node,fontSize) must use the same installed font families in UI/export. */
export function layoutBrandBoardText(scene,measure=estimatedMeasure) {
  return {...scene,nodes:scene.nodes.map(node=>{
    if(node.type!=='text')return {...node};
    let content=node.text,size=node.fontSize,lines=wrap(content,node.bounds.w,node,size,measure),height=lines.length*size*node.lineHeight;
    const fitTo = minimum => { while(height>node.bounds.h&&size>minimum){size=Math.max(minimum,size-1);lines=wrap(content,node.bounds.w,node,size,measure);height=lines.length*size*node.lineHeight} };
    fitTo(Math.min(size,node.minFontSize));
    // Retain designed specimen breaks while they fit. Excess hard breaks are
    // whitespace, never a reason to paint text over neighboring modules.
    if(height>node.bounds.h&&/\s/.test(content)){
      content=content.replace(/\s+/g,' ');size=node.fontSize;lines=wrap(content,node.bounds.w,node,size,measure);height=lines.length*size*node.lineHeight;
      fitTo(Math.min(size,node.minFontSize));
    }
    fitTo(8);
    const top=node.bounds.y+(node.verticalAlign==='middle'?Math.max(0,(node.bounds.h-height)/2):0);
    return {...node,computedFontSize:size,lines:lines.map((text,index)=>({text,x:node.bounds.x+(node.align==='center'?node.bounds.w/2:node.align==='right'?node.bounds.w:0),y:top+size+index*size*node.lineHeight}))};
  })};
}

const e=escapeGuidelineHTML;
const n=value=>Math.round(Number(value)*1000)/1000;
function imageFilter(node) { const a=node.adjustment;return a&&!node.preserveOriginal&&(a.hue!==0||a.saturation!==100||a.brightness!==100); }
export function renderBrandBoardSVG(input,{resolveAsset=src=>src,fontCSS='',measureText}={}) {
  const scene=measureText?layoutBrandBoardText(input,measureText):input.nodes.every(node=>node.type!=='text'||node.lines)?input:layoutBrandBoardText(input);
  const filters=scene.nodes.filter(imageFilter).map(node=>`<filter id="adjust-${e(node.id)}" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${n(node.adjustment.hue)}"/><feColorMatrix type="saturate" values="${n(node.adjustment.saturation/100)}"/><feComponentTransfer><feFuncR type="linear" slope="${n(node.adjustment.brightness/100)}"/><feFuncG type="linear" slope="${n(node.adjustment.brightness/100)}"/><feFuncB type="linear" slope="${n(node.adjustment.brightness/100)}"/></feComponentTransfer></filter>`).join('');
  const rendered=scene.nodes.map(node=>{
    const b=node.bounds,id=`data-node-id="${e(node.id)}"`;
    if(node.type==='rect')return `<rect ${id} x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(node.radius||0)}" fill="${e(node.fill)}"${node.stroke?` stroke="${e(node.stroke)}" stroke-opacity="${node.strokeOpacity??1}"`:''}/>`;
    if(node.type==='line')return `<line ${id} x1="${n(b.x)}" y1="${n(b.y)}" x2="${n(b.x+b.w)}" y2="${n(b.y+b.h)}" stroke="${e(node.stroke)}" stroke-width="${node.strokeWidth||1}" opacity="${node.opacity??1}"/>`;
    if(node.type==='circle')return `<ellipse ${id} cx="${n(b.x+b.w/2)}" cy="${n(b.y+b.h/2)}" rx="${n(b.w/2)}" ry="${n(b.h/2)}" fill="${e(node.fill)}"/>`;
    if(node.type==='image'){
      const filter=imageFilter(node)?` filter="url(#adjust-${e(node.id)})"`:'';
      if(node.sourceCrop&&!node.preserveOriginal){const crop=node.sourceCrop;return `<svg ${id} data-source-role="${e(node.sourceRole)}" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" viewBox="${n(crop.x*1024)} ${n(crop.y*1024)} ${n(crop.w*1024)} ${n(crop.h*1024)}" overflow="hidden" preserveAspectRatio="xMidYMid meet"><image x="0" y="0" width="1024" height="1024" href="${e(resolveAsset(node.assetRef))}"${filter}/></svg>`;}
      return `<image ${id} data-source-role="${e(node.sourceRole)}" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" href="${e(resolveAsset(node.assetRef))}" preserveAspectRatio="xMidYMid meet"${filter}/>`;
    }
    if(node.type==='text')return `<text ${id} font-family="${e(node.fontFamily)}, ${e(node.fontFallback||'sans-serif')}" font-weight="${node.fontWeight}" font-size="${n(node.computedFontSize||node.fontSize)}" fill="${e(node.fill)}" text-anchor="${node.align==='center'?'middle':node.align==='right'?'end':'start'}"${node.letterSpacing?` letter-spacing="${node.letterSpacing}"`:''}>${node.lines.map(line=>`<tspan x="${n(line.x)}" y="${n(line.y)}">${e(line.text)}</tspan>`).join('')}</text>`;
    return '';
  }).join('');
  // fontCSS is trusted bundled @font-face content supplied by the export/UI code.
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${scene.size.width}" height="${scene.size.height}" viewBox="0 0 ${scene.size.width} ${scene.size.height}" role="img" aria-label="${e(scene.name)} brand guideline board"><title>${e(scene.name)} — Brand Guideline</title><defs><style>${String(fontCSS).replace(/<\/style/gi,'&lt;/style')}</style>${filters}</defs>${rendered}</svg>`;
}
