import { DOMParser } from '@xmldom/xmldom';
import {reject,dimensions,MAX_BYTES} from './errors.mjs';
const elements=new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','linearGradient','radialGradient','stop','clipPath','title','desc']);
const attributes=new Set(['id','width','height','viewBox','preserveAspectRatio','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','fx','fy','fr','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','transform','gradientTransform','gradientUnits','spreadMethod','offset','stop-color','stop-opacity','clip-path','clip-rule','clipPathUnits','style','version']);
const styles=new Set(['fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','stop-color','stop-opacity','clip-path','clip-rule']);
export function inspectSvg(bytes,maxEdge=2048){
  if(bytes.length>MAX_BYTES)reject('INPUT_TOO_LARGE','ไฟล์ต้องไม่เกิน 5 MB');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('INVALID_SVG','SVG ต้องเป็น UTF-8');}
  if(/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)/i.test(text))reject('UNSUPPORTED_SVG','SVG ต้องไม่มี DTD, entity หรือ processing instruction');
  let doc;try{doc=new DOMParser({onError:()=>{throw new Error('Invalid XML');}}).parseFromString(text,'image/svg+xml');}catch{reject('INVALID_SVG','ไม่สามารถอ่าน XML ของ SVG ได้');}
  const root=doc.documentElement;if(!root||root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg')reject('INVALID_SVG','ไม่พบ SVG root ที่ถูกต้อง');
  let count=0,pathBytes=0;const ids=new Map(),links=[];
  function checkValue(name,value){
    if(/(?:https?:|data:|file:|javascript:|@import|[\\<>])/i.test(value))reject('UNSUPPORTED_SVG','SVG ต้องไม่มีไฟล์ภายนอกหรือเนื้อหาแบบทำงานได้');
    if(/url\s*\(/i.test(value)){if(!['fill','stroke','clip-path'].includes(name)||!/^url\(#[A-Za-z_][\w.-]*\)$/.test(value))reject('UNSUPPORTED_SVG','รองรับเฉพาะการอ้างอิง gradient/clip ภายในไฟล์');links.push({id:value.slice(5,-1),property:name});}
    // resvg does not resolve CSS variables or modern computed paint functions.
    // Reject them instead of accepting an opaque black fallback as a conversion.
    if(/(?:var|calc|color|color-mix|lab|lch|oklab|oklch)\s*\(/i.test(value)||/\b(?:context-fill|context-stroke)\b/.test(value))reject('UNSUPPORTED_SVG','กรุณาใช้ค่าสีและขนาดโดยตรงใน SVG แทนตัวแปรหรือค่าคำนวณ');
  }
  function walk(node,depth=0,inClip=false){
    if(node.nodeType!==1)return;
    if(++count>4096||depth>32)reject('SVG_COMPLEXITY','SVG ซับซ้อนเกินขอบเขตที่รองรับ');
    if(!elements.has(node.localName)||node.namespaceURI!=='http://www.w3.org/2000/svg'||(node!==root&&node.localName==='svg'))reject('UNSUPPORTED_SVG',node.localName==='text'?'แปลงข้อความใน SVG เป็นเส้น outline ก่อนอัปโหลด':'SVG มีองค์ประกอบที่ยังไม่รองรับ กรุณาส่งเป็น static outlined SVG');
    for(const attr of Array.from(node.attributes)){
      if(attr.name==='xmlns'&&attr.value==='http://www.w3.org/2000/svg')continue;
      if(attr.name==='xmlns:xlink'&&attr.value==='http://www.w3.org/1999/xlink')continue;
      if(attr.namespaceURI||!attributes.has(attr.name))reject('UNSUPPORTED_SVG','SVG มี attribute ที่ยังไม่รองรับ');
      if(attr.name==='id'){if(!/^[A-Za-z_][\w.-]*$/.test(attr.value)||ids.has(attr.value))reject('INVALID_SVG','SVG มี id ไม่ถูกต้องหรือซ้ำกัน');ids.set(attr.value,node.localName);}
      if(attr.name==='clip-path'&&inClip)reject('UNSUPPORTED_SVG','ไม่รองรับ clip ซ้อนกัน');
      if(attr.name==='d'||attr.name==='points'){pathBytes+=attr.value.length;if(pathBytes>256_000)reject('SVG_COMPLEXITY','เส้นใน SVG ซับซ้อนเกินขอบเขตที่รองรับ');}
      if(attr.name==='style'){
        for(const declaration of attr.value.split(';').filter(x=>x.trim())){const match=declaration.match(/^\s*([a-z-]+)\s*:\s*([^;]+)\s*$/);if(!match||!styles.has(match[1])||(inClip&&match[1]==='clip-path'))reject('UNSUPPORTED_SVG','SVG มี style ที่ยังไม่รองรับ');checkValue(match[1],match[2].trim());}
      }else checkValue(attr.name,attr.value);
    }
    for(const child of Array.from(node.childNodes))walk(child,depth+1,inClip||node.localName==='clipPath');
  }
  walk(root);if(links.some(({id})=>!ids.has(id)))reject('INVALID_SVG','SVG อ้างอิงองค์ประกอบที่ไม่มีในไฟล์');
  if(links.some(({id,property})=>property==='clip-path'?ids.get(id)!=='clipPath':!['linearGradient','radialGradient'].includes(ids.get(id))))reject('UNSUPPORTED_SVG','SVG ต้องอ้างอิง gradient หรือ clipPath ที่ตรงชนิด');
  const vb=root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const parseLength=value=>/^\d+(?:\.\d+)?(?:px)?$/.test(value||'')?Number(value.replace(/px$/,'')):NaN;
  const hasWidth=root.hasAttribute('width'),hasHeight=root.hasAttribute('height');
  if(hasWidth!==hasHeight)reject('INVALID_DIMENSIONS','SVG ต้องระบุ width และ height คู่กัน');
  if(root.hasAttribute('viewBox')&&(!vb||vb.length!==4||vb.some(x=>!Number.isFinite(x))||vb[2]<=0||vb[3]<=0))reject('INVALID_DIMENSIONS','viewBox ไม่ถูกต้อง');
  const width=hasWidth?parseLength(root.getAttribute('width')):vb?.[2],height=hasHeight?parseLength(root.getAttribute('height')):vb?.[3];
  return {...dimensions(width,height,maxEdge),elementCount:count};
}
