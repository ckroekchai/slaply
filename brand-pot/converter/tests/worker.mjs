import {convertOriginal} from '../render.mjs';
import resvgModule from '../resvg.wasm';
import pdfiumModule from '../pdfium.wasm';
import {init} from '@embedpdf/pdfium';
export default {async fetch(request){try{
  if(new URL(request.url).pathname==='/test-memory-caps'){
    const svg=new WebAssembly.Instance(resvgModule,{}),pdf=await init({instantiateWasm(imports,receive){const instance=new WebAssembly.Instance(pdfiumModule,imports);receive(instance);return instance.exports;},print:()=>{},printErr:()=>{}});
    const result={};for(const [name,memory] of [['svg',svg.exports.memory],['pdf',pdf.pdfium.wasmExports.memory]]){const before=memory.buffer.byteLength;try{memory.grow(2048);result[name]=false;}catch{result[name]=memory.buffer.byteLength===before;}}return Response.json(result);
  }
  const result=await convertOriginal({bytes:new Uint8Array(await request.arrayBuffer()),mime:request.headers.get('content-type'),expectedSha256:request.headers.get('x-source-sha256')||undefined});const {png,...metadata}=result;return new Response(png,{headers:{'content-type':'image/png','x-conversion-metadata':JSON.stringify(metadata)}});
}catch(error){return Response.json({code:error.code||'INTERNAL_ERROR',message:error.message},{status:422});}}};
