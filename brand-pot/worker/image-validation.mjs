import { HttpError } from './core.mjs';

const fail = message => { throw new HttpError(400,'INVALID_IMAGE',message||'ไฟล์รูปไม่สมบูรณ์ กรุณาเลือก PNG, JPG หรือ WebP ภาพนิ่งที่เปิดได้'); };
const animated = () => fail('รองรับภาพนิ่งเท่านั้น กรุณาส่งโลโก้หรือรูปภาพเป็น PNG, JPG หรือ WebP ภาพนิ่ง');
const MAX_PIXELS=40_000_000;
function dimensions(width,height) {
  if (!width || !height || width*height>MAX_PIXELS) fail('รูปนี้มีขนาดพิกเซลใหญ่เกินไป (สูงสุด 40 ล้านพิกเซล)');
  return {width,height};
}
function crc32(bytes,start,end) {
  let crc=0xffffffff;
  for(let i=start;i<end;i++){crc^=bytes[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
const ascii=(bytes,start,length)=>String.fromCharCode(...bytes.subarray(start,start+length));
function png(b,view) {
  let offset=8,info,seenData=false,seenEnd=false,endedData=false;
  while(offset+12<=b.length){
    const length=view.getUint32(offset),type=ascii(b,offset+4,4),end=offset+12+length;
    if(end>b.length||!/^[A-Za-z]{4}$/.test(type)||view.getUint32(offset+8+length)!==crc32(b,offset+4,offset+8+length))fail();
    if(!info&&type!=='IHDR')fail();
    if(['acTL','fcTL','fdAT'].includes(type))animated();
    if(type==='IHDR'){
      if(info||length!==13)fail();
      info=dimensions(view.getUint32(offset+8),view.getUint32(offset+12));
      const depth=b[offset+16],color=b[offset+17],allowed={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if(!allowed[color]?.includes(depth)||b[offset+18]!==0||b[offset+19]!==0||b[offset+20]>1)fail();
    }else if(type==='IDAT'){
      if(endedData||length===0&&!seenData)fail();
      seenData=true;
    }else if(type==='IEND'){
      if(length!==0||!seenData||end!==b.length)fail();seenEnd=true;
    }else{
      if(seenData)endedData=true;
      if(type[0]===type[0].toUpperCase()&&!['PLTE'].includes(type))fail();
    }
    offset=end;
  }
  if(!info||!seenEnd||offset!==b.length)fail();
  return {mime:'image/png',...info};
}
function jpeg(b) {
  let offset=2,info,scans=0,entropy=0;
  while(offset<b.length){
    if(b[offset++]!==255)fail('ไฟล์ JPG ไม่สมบูรณ์ กรุณาเลือกไฟล์อื่น');
    while(b[offset]===255)offset++;
    const marker=b[offset++];
    if(marker===217){if(!info||!scans||!entropy||offset!==b.length)fail();return {mime:'image/jpeg',...info};}
    if(marker===0||marker===216||marker===1||(marker>=208&&marker<=215))fail();
    if(offset+2>b.length)fail();
    const length=(b[offset]<<8)|b[offset+1],end=offset+length;
    if(length<2||end>b.length)fail();
    if([192,193,194].includes(marker)){
      if(info||length<8||b[offset+2]!==8)fail();
      info=dimensions((b[offset+5]<<8)|b[offset+6],(b[offset+3]<<8)|b[offset+4]);
      const components=b[offset+7];if(![1,3,4].includes(components)||length!==8+3*components)fail();
    }else if([195,197,198,199,201,202,203,205,206,207].includes(marker))fail('รูปแบบ JPG นี้ยังไม่รองรับ กรุณาส่งออกเป็น PNG หรือ JPG มาตรฐาน');
    offset=end;
    if(marker===218){
      if(!info||length<6)fail();scans++;
      while(offset<b.length){
        if(b[offset]!==255){entropy++;offset++;continue;}
        if(b[offset+1]===0||(b[offset+1]>=208&&b[offset+1]<=215)){entropy++;offset+=2;continue;}
        break;
      }
    }
  }
  fail('ไฟล์ JPG ไม่สมบูรณ์ กรุณาเลือกไฟล์อื่น');
}
function webp(b,view) {
  if(b.length<30||view.getUint32(4,true)+8!==b.length)fail();
  let offset=12,canvas,frame;
  while(offset+8<=b.length){
    const kind=ascii(b,offset,4),length=view.getUint32(offset+4,true),start=offset+8,end=start+length;
    if(end>b.length||end+(length%2)>b.length)fail();
    if(['ANIM','ANMF'].includes(kind))animated();
    if(kind==='VP8X'){
      if(canvas||frame||offset!==12||length!==10)fail();
      if(b[start]&2)animated();
      if((b[start]&0xc1)||b[start+1]||b[start+2]||b[start+3])fail();
      canvas=dimensions(1+b[start+4]+(b[start+5]<<8)+(b[start+6]<<16),1+b[start+7]+(b[start+8]<<8)+(b[start+9]<<16));
    }else if(kind==='VP8 '){
      if(frame||length<=10||(b[start]&1)||b[start+3]!==157||b[start+4]!==1||b[start+5]!==42)fail();
      const partition=((b[start+2]<<16)|(b[start+1]<<8)|b[start])>>>5;if(partition+3>length)fail();
      frame=dimensions(((b[start+7]<<8)|b[start+6])&16383,((b[start+9]<<8)|b[start+8])&16383);
    }else if(kind==='VP8L'){
      if(frame||length<=5||b[start]!==47)fail();
      const bits=view.getUint32(start+1,true);if(bits>>>29)fail();
      frame=dimensions((bits&16383)+1,((bits>>>14)&16383)+1);
    }
    offset=end+(length%2);
  }
  if(!frame||offset!==b.length||(canvas&&(canvas.width!==frame.width||canvas.height!==frame.height)))fail();
  return {mime:'image/webp',...frame};
}
/** Bounded container validation, not a complete codec decode. Original bytes are never rewritten. */
export function inspectImage(value) {
  const b=value instanceof Uint8Array?value:new Uint8Array(value),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return png(b,view);
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return jpeg(b);
  if(b.length>=12&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP')return webp(b,view);
  fail('รองรับไฟล์ PNG, JPG และ WebP ภาพนิ่งเท่านั้น ยังไม่รองรับ SVG, PDF, HEIC และ GIF');
}
