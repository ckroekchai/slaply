import resvgModule from './resvg.wasm';
import pdfiumModule from './pdfium.wasm';
import {init} from '@embedpdf/pdfium';
import {inspectSvg} from './svg-validation.mjs';
import {ConversionError,reject,dimensions,MAX_BYTES} from './errors.mjs';
import {encodePng} from './png.mjs';
export const CONVERTER_VERSION='slaply-converter-2026-11-05.2';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
function renderSvg(bytes,maxEdge){
  const size=inspectSvg(bytes,maxEdge),instance=new WebAssembly.Instance(resvgModule,{}),api=instance.exports,ptr=api.alloc(bytes.length);
  try{new Uint8Array(api.memory.buffer,ptr,bytes.length).set(bytes);const status=api.render(ptr,bytes.length,size.width,size.height);if(status)reject('SVG_RENDER_FAILED','ไม่สามารถแปลง SVG นี้ได้');const png=new Uint8Array(api.memory.buffer,api.output_ptr(),api.output_len()).slice();return {...size,png,renderer:'resvg-0.49.0',linearMemoryBytes:api.memory.buffer.byteLength};}finally{api.dealloc(ptr,bytes.length);}
}
async function renderPdf(bytes,maxEdge){
  const p=await init({instantiateWasm(imports,receive){const instance=new WebAssembly.Instance(pdfiumModule,imports);receive(instance);return instance.exports;},print:()=>{},printErr:()=>{},locateFile:()=>{throw new Error('Network loading is disabled');}});
  p.PDFiumExt_Init();let doc=0,page=0,bitmap=0;const api=p.pdfium,ptr=api.wasmExports.malloc(bytes.length);
  try{
    api.HEAPU8.set(bytes,ptr);doc=p.FPDF_LoadMemDocument(ptr,bytes.length,0);
    if(!doc)reject(p.FPDF_GetLastError()===4?'PDF_ENCRYPTED':'INVALID_PDF',p.FPDF_GetLastError()===4?'PDF ที่มีรหัสผ่านยังไม่รองรับ':'ไม่สามารถอ่านไฟล์ PDF นี้ได้');
    if(p.FPDF_GetSecurityHandlerRevision(doc)>=0)reject('PDF_ENCRYPTED','PDF ที่เข้ารหัสยังไม่รองรับ');
    const pages=p.FPDF_GetPageCount(doc);if(pages!==1)reject('PDF_MULTIPAGE','กรุณาส่ง PDF โลโก้เพียงหน้าเดียว');
    if(p.FPDF_GetFormType(doc)!==0||p.FPDFDoc_GetJavaScriptActionCount(doc)>0||p.FPDFDoc_GetAttachmentCount(doc)>0)reject('UNSUPPORTED_PDF','รองรับเฉพาะ PDF งานภาพแบบ static ที่ไม่มีฟอร์ม สคริปต์ หรือไฟล์แนบ');
    page=p.FPDF_LoadPage(doc,0);if(!page)reject('INVALID_PDF','ไม่สามารถอ่านหน้า PDF ได้');
    if(p.FPDFPage_GetAnnotCount(page)>0)reject('UNSUPPORTED_PDF','PDF มี annotation กรุณาส่งงานภาพที่ flatten แล้ว');
    let objects=0;
    function checkObjects(container,isForm=false,depth=0){
      if(depth>16)reject('PDF_COMPLEXITY','PDF ซับซ้อนเกินขอบเขตที่รองรับ');
      const count=isForm?p.FPDFFormObj_CountObjects(container):p.FPDFPage_CountObjects(container);
      if(count<0||(objects+=count)>4096)reject('PDF_COMPLEXITY','PDF ซับซ้อนเกินขอบเขตที่รองรับ');
      for(let i=0;i<count;i++){const object=isForm?p.FPDFFormObj_GetObject(container,i):p.FPDFPage_GetObject(container,i),type=p.FPDFPageObj_GetType(object);
        if(type===1){const font=p.FPDFTextObj_GetFont(object);if(!font||p.FPDFFont_GetIsEmbedded(font)!==1)reject('PDF_MISSING_FONT','กรุณาฝังฟอนต์หรือแปลงข้อความเป็น outline ใน PDF');}
        if(type===5)checkObjects(object,true,depth+1);
      }
    }
    checkObjects(page);
    const size=dimensions(p.FPDF_GetPageWidthF(page),p.FPDF_GetPageHeightF(page),maxEdge);
    bitmap=p.FPDFBitmap_Create(size.width,size.height,1);if(!bitmap)reject('CONVERSION_MEMORY','ไฟล์ใช้หน่วยความจำมากเกินขอบเขต');
    p.FPDFBitmap_FillRect(bitmap,0,0,size.width,size.height,0x00000000);
    p.FPDF_RenderPageBitmap(bitmap,page,0,0,size.width,size.height,0,16);
    const buffer=p.FPDFBitmap_GetBuffer(bitmap),stride=p.FPDFBitmap_GetStride(bitmap);if(stride!==size.width*4)reject('PDF_RENDER_FAILED','รูปแบบภาพ PDF ไม่รองรับ');
    const rgba=api.HEAPU8.subarray(buffer,buffer+stride*size.height),png=encodePng(rgba,size.width,size.height);
    return {...size,png,renderer:'pdfium-2.15.1',pageIndex:0,pageCount:1,linearMemoryBytes:api.HEAPU8.buffer.byteLength};
  }finally{if(bitmap)p.FPDFBitmap_Destroy(bitmap);if(page)p.FPDF_ClosePage(page);if(doc)p.FPDF_CloseDocument(doc);api.wasmExports.free(ptr);p.FPDF_DestroyLibrary();}
}
export async function convertOriginal({bytes,mime,expectedSha256,maxEdge=2048}){
  if(!(bytes instanceof Uint8Array))reject('INVALID_INPUT','ต้องส่งไฟล์ต้นฉบับเป็น bytes');
  if(!bytes.length||bytes.length>MAX_BYTES)reject('INPUT_TOO_LARGE','ไฟล์ต้องมีข้อมูลและไม่เกิน 5 MB');
  if(![512,2048].includes(maxEdge))reject('INVALID_INPUT','ขนาดภาพตัวอย่างไม่รองรับ');
  const originalSha256=await digest(bytes);if(expectedSha256&&expectedSha256!==originalSha256)reject('SOURCE_MISMATCH','ไฟล์ต้นฉบับไม่ตรงกับข้อมูลอัปโหลด');
  let result;
  try{if(mime==='image/svg+xml')result=renderSvg(bytes,maxEdge);else if(mime==='application/pdf'){if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')reject('INVALID_PDF','ไม่พบส่วนหัว PDF');result=await renderPdf(bytes,maxEdge);}else reject('UNSUPPORTED_FORMAT','รองรับเฉพาะ SVG หรือ PDF');}
  catch(error){if(error instanceof ConversionError)throw error;if(error instanceof WebAssembly.RuntimeError||/memory|OOM|abort/i.test(error?.message||''))reject('CONVERSION_MEMORY','ไฟล์ซับซ้อนหรือใช้หน่วยความจำเกินขอบเขต');throw error;}
  return {...result,mime:'image/png',originalMime:mime,originalSha256,sha256:await digest(result.png),converterVersion:CONVERTER_VERSION,originalPreserved:true};
}
