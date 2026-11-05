import {WorkerEntrypoint} from 'cloudflare:workers';
import {convertOriginal} from './render.mjs';
import {ConversionError,MAX_BYTES} from './errors.mjs';
let busy=false;
export class AssetConverter extends WorkerEntrypoint {
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/convert')return new Response('Not found',{status:404});
    if(busy)return Response.json({error:{code:'CONVERTER_BUSY',message:'ระบบกำลังแปลงไฟล์ กรุณาลองอีกครั้ง'}},{status:503});
    busy=true;
    try{
      const mime=request.headers.get('content-type'),expectedSha256=request.headers.get('x-source-sha256'),edge=request.headers.get('x-max-edge');
      if(!['image/svg+xml','application/pdf'].includes(mime)||!/[a-f0-9]{64}/.test(expectedSha256||'')||expectedSha256.length!==64)throw new ConversionError('INVALID_INPUT','ชนิดไฟล์หรือรหัสต้นฉบับไม่ถูกต้อง');
      if(edge!==null&&!['512','2048'].includes(edge))throw new ConversionError('INVALID_INPUT','ขนาดภาพตัวอย่างไม่รองรับ');
      if(Number(request.headers.get('content-length'))>MAX_BYTES)throw new ConversionError('INPUT_TOO_LARGE','ไฟล์ต้องไม่เกิน 5 MB');
      const reader=request.body?.getReader(),chunks=[];let length=0;
      if(reader)while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw new ConversionError('INPUT_TOO_LARGE','ไฟล์ต้องไม่เกิน 5 MB');}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const {png,...metadata}=await convertOriginal({bytes,mime,expectedSha256,maxEdge:edge===null?2048:Number(edge)});
      return new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(png.length),'X-Conversion-Metadata':JSON.stringify(metadata),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }catch(error){const known=error instanceof ConversionError,code=known?error.code:'CONVERSION_FAILED';return Response.json({error:{code,message:known?error.message:'ไม่สามารถแปลงไฟล์นี้ได้'}},{status:code==='INPUT_TOO_LARGE'?413:code==='INVALID_INPUT'?400:422});}
    finally{busy=false;}
  }
}
export default {fetch(){return new Response('Not found',{status:404});}};
