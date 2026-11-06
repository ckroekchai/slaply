import { PDFDocument, PDFName } from 'pdf-lib';

// Little CMS built-in sRGB profile: its copyright tag permits unrestricted use.
// Assign this only to pixels rendered by an explicitly sRGB canvas.
const SRGB_PROFILE = 'AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oACwAFAAwANQAwYWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAA fQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c'.replace(/\s/g, '');
const signature = new Uint8Array([137,80,78,71,13,10,26,10]);
const ascii = new TextEncoder();
const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
function join(parts) {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = ascii.encode(name), result = new Uint8Array(data.length+12), view = new DataView(result.buffer);
  view.setUint32(0,data.length); result.set(type,4); result.set(data,8);
  view.setUint32(result.length-4,crc32(result.subarray(4,result.length-4)));
  return result;
}

/** Attach explicit sRGB and physical-resolution metadata without recompressing pixels. */
export function tagSRGBPNG(input, {dpi=300}={}) {
  const data=bytes(input), parts=[signature];
  if (data.length<45 || !signature.every((value,i)=>data[i]===value)) throw new Error('A valid PNG is required.');
  if (!Number.isFinite(dpi) || dpi<72 || dpi>1200) throw new Error('Invalid export resolution.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  let offset=8, header=false, image=false, end=false;
  while(offset<data.length) {
    if(offset+12>data.length)throw new Error('Truncated PNG chunk.');
    const length=view.getUint32(offset), next=offset+length+12;
    if(next>data.length)throw new Error('Truncated PNG chunk.');
    const name=String.fromCharCode(...data.subarray(offset+4,offset+8));
    if(crc32(data.subarray(offset+4,next-4))!==view.getUint32(next-4))throw new Error('PNG checksum failed.');
    if(!header&&name!=='IHDR')throw new Error('Missing PNG header.');
    if(name==='IHDR') {
      if(header||length!==13)throw new Error('Invalid PNG header.');
      header=true; parts.push(data.subarray(offset,next));
      parts.push(chunk('sRGB',new Uint8Array([0])));
      const physical=new Uint8Array(9), pv=new DataView(physical.buffer), ppm=Math.round(dpi/0.0254);
      pv.setUint32(0,ppm);pv.setUint32(4,ppm);physical[8]=1;
      parts.push(chunk('pHYs',physical));
    } else if(!['sRGB','gAMA','cHRM','iCCP','pHYs'].includes(name))parts.push(data.subarray(offset,next));
    if(name==='IDAT')image=true;
    offset=next;
    if(name==='IEND'){if(length!==0||offset!==data.length)throw new Error('Invalid PNG ending.');end=true;break;}
  }
  if(!image||!end)throw new Error('Incomplete PNG.');
  return join(parts);
}

/** Single-page, lossless RGB PDF: the same raster used by PNG, with an sRGB ICC profile. */
export async function createBoardPDF(png, {width,height,title='Brand guideline',dpi=300}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>9600||height>9600)throw new Error('Invalid board dimensions.');
  const data=tagSRGBPNG(png,{dpi}), header=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(header.getUint32(16)!==width||header.getUint32(20)!==height)throw new Error('PNG dimensions do not match the board.');
  const pdf=await PDFDocument.create();
  pdf.setTitle(String(title));pdf.setCreator('Slaply Brand Pot');pdf.setProducer('Slaply lossless sRGB board exporter');
  pdf.setSubject('Digital sRGB brand guideline board. Raster PDF, not editable vector artwork.');
  const image=await pdf.embedPng(data);
  const page=pdf.addPage([width*72/dpi,height*72/dpi]);
  page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
  await pdf.flush();
  const profile=Uint8Array.from(atob(SRGB_PROFILE),c=>c.charCodeAt(0));
  const profileRef=pdf.context.register(pdf.context.flateStream(profile,{N:3,Alternate:'DeviceRGB'}));
  const imageStream=pdf.context.lookup(image.ref);
  imageStream.dict.set(PDFName.of('ColorSpace'),pdf.context.obj([PDFName.of('ICCBased'),profileRef]));
  imageStream.dict.set(PDFName.of('Interpolate'),pdf.context.obj(false));
  return pdf.save();
}
