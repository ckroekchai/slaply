import React, { useEffect, useMemo, useState } from 'react';
import { asset } from './assets.js';
import { buildGuidelineModel, renderGuidelineMarkup, renderGuidelineDetails, renderObjectSprite } from './brand-guideline-model.js';
import { buildBrandBoardScene, layoutBrandBoardText, renderBrandBoardSVG, boardFontCSS, BOARD_FONT_CATALOG } from './brand-board-scene.js';
import { inspectLogoSource } from './logo-backdrop.js';
import { brandObjects } from './brand-objects.js';
import './brand-guideline.css';
import './brand-board.css';

function BrandBoard({ recipe, mood }) {
  const [fontRevision, setFontRevision] = useState(0), [zoom, setZoom] = useState('fit');
  const [backdrop,setBackdrop] = useState({source:null,value:null,error:false});
  const logoSource=recipe.logo?.src||recipe.ingredients?.find(item=>item?.role==='logo')?.src,backdropMode=recipe.customization?.logoBackdrop||'auto';
  const scene = useMemo(() => buildBrandBoardScene(recipe, mood, {logoBackdrop:backdrop.source===logoSource?backdrop.value:undefined}), [recipe, mood, logoSource, backdrop]);
  useEffect(()=>{
    let alive=true;
    if(logoSource)inspectLogoSource(logoSource).then(info=>{if(alive)setBackdrop({source:logoSource,value:info.backdrop,warning:info.warning,error:false})}).catch(()=>{if(alive)setBackdrop({source:logoSource,value:'light',error:true})});
    return()=>{alive=false};
  },[logoSource]);
  const familyKey = scene.fontFamilies.join('|');
  useEffect(() => {
    let alive = true;
    if (document.fonts) Promise.all(BOARD_FONT_CATALOG.filter(font => scene.fontFamilies.includes(font.family)).map(font => document.fonts.load(`${String(font.weight).split(' ')[0]} 32px "${font.family}"`, 'Aa กข'))).then(() => document.fonts.ready).then(() => { if (alive) setFontRevision(value => value + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [familyKey]);
  const markup = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d');
    const measured = context ? layoutBrandBoardText(scene, (text, node, size) => {
      context.font = `${node.fontWeight} ${size}px "${node.fontFamily}", "${node.fontFallback || 'Noto Sans Thai'}", sans-serif`;
      context.letterSpacing = `${node.letterSpacing || 0}px`;
      return context.measureText(text).width;
    }) : scene;
    return renderBrandBoardSVG(measured, { resolveAsset: asset });
  }, [scene, fontRevision]);
  return <section className="brand-board" aria-label="Brand Guideline Board">
    <style>{boardFontCSS(asset)}</style>
    <div className="brand-board-toolbar"><span>BRAND GUIDELINE BOARD <small>2400 × 1800</small></span><div aria-label="ขนาดการแสดงบอร์ด"><button className={zoom === 'fit' ? 'selected' : ''} aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>ดูทั้งบอร์ด</button><button className={zoom === 'detail' ? 'selected' : ''} aria-pressed={zoom === 'detail'} onClick={() => setZoom('detail')}>ขยายดู</button></div></div>
    <div className={`brand-board-viewport ${zoom === 'detail' ? 'is-zoomed' : ''}`} tabIndex={zoom === 'detail' ? 0 : undefined} aria-label="บอร์ดแบรนด์ เลื่อนดูได้เมื่อขยาย"><div className="brand-board-scene" dangerouslySetInnerHTML={{ __html: markup }}/></div>
    <p className="brand-board-caption">แนวทางสี ตัวอักษร และการใช้งานที่เสนอสำหรับแบรนด์ · โลโก้ใช้ไฟล์ต้นฉบับของคุณ{backdropMode==='auto'&&backdrop.source===logoSource&&backdrop.error?' · อ่านสีโลโก้ไม่ได้ เลือกพื้นหลังสว่างหรือเข้มจากแถบปรับแต่งได้':null}</p>
    {backdrop.source===logoSource&&backdrop.warning&&<p className="logo-quality-hint logo-quality-hint--board" role="status">{backdrop.warning}</p>}
  </section>;
}
export default function BrandGuideline({ recipe, mood }) {
  const markup = useMemo(() => Number(recipe.schemaVersion) >= 6 ? '' : renderGuidelineMarkup(buildGuidelineModel(recipe, mood), asset), [recipe, mood]);
  return Number(recipe.schemaVersion) >= 6 ? <BrandBoard recipe={recipe} mood={mood}/> : <div className="brand-guideline" dangerouslySetInnerHTML={{ __html: markup }} />;
}
export function GuidelineDetails({ recipe, mood }) {
  const markup = useMemo(() => Number(recipe.schemaVersion) >= 6 ? '' : renderGuidelineDetails(buildGuidelineModel(recipe, mood)), [recipe, mood]);
  return Number(recipe.schemaVersion) >= 6 ? null : <div className="brand-guideline-details" dangerouslySetInnerHTML={{ __html: markup }} />;
}
export function BrandObjectPreview({ style = 'bloom', className = '' }) {
  const markup = useMemo(() => renderObjectSprite(style, asset), [style]);
  return <span className={`guide-object-preview ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
export function GeneratedObjectPicker({recipe,customization,onToggle}) {
  const objects=brandObjects(recipe);
  if(!objects.length)return null;
  return <fieldset className="generated-object-picker"><legend>Brand objects · 3 แบบของคุณ</legend><p>เลือกใช้ในแพตเทิร์นและภาพตัวอย่าง</p><div>{objects.map(object=><button type="button" key={object.id} aria-label={`ใช้ ${object.name}`} aria-pressed={customization.objectStyles.includes(object.id)} className={customization.objectStyles.includes(object.id)?'selected':''} onClick={()=>onToggle(object.id)} title={object.rationale}><svg viewBox={`${object.crop.x*1024} ${object.crop.y*1024} 512 512`} role="img" aria-label={object.name}><image href={asset(object.src)} x="0" y="0" width="1024" height="1024"/></svg><span>{object.name}</span><small>{object.rationale}</small></button>)}</div></fieldset>;
}
