export class ConversionError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
export function reject(code,message){throw new ConversionError(code,message);}
export const MAX_BYTES=5*1024*1024;
export const MAX_PIXELS=4_000_000;
export function dimensions(width,height,maxEdge=2048){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>1_000_000||height>1_000_000)reject('INVALID_DIMENSIONS','ขนาดหน้าของไฟล์ไม่ถูกต้อง');
  const scale=Math.min(maxEdge/Math.max(width,height),Math.sqrt(MAX_PIXELS/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),sourceWidth:width,sourceHeight:height};
}
