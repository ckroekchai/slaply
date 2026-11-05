import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFArray, PDFRawStream } from 'pdf-lib';
import { tagSRGBPNG, createBoardPDF } from '../src/export-formats.js';

const original=new Uint8Array(await readFile(new URL('../public/assets/poko-product.png',import.meta.url)));
function chunks(data) {
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),result=[];
  for(let i=8;i<data.length;) {
    const length=view.getUint32(i),name=String.fromCharCode(...data.subarray(i+4,i+8));
    result.push({name,data:data.subarray(i+8,i+8+length)});i+=length+12;
  }
  return result;
}
test('sRGB PNG tagging preserves compressed image bytes and remains idempotent',()=>{
  const result=tagSRGBPNG(original),parts=chunks(result);
  assert.equal(parts.filter(p=>p.name==='sRGB').length,1);
  assert.equal(parts.filter(p=>p.name==='pHYs').length,1);
  assert.deepEqual(parts.filter(p=>p.name==='IDAT'),chunks(original).filter(p=>p.name==='IDAT'));
  const physical=parts.find(p=>p.name==='pHYs').data;
  assert.equal(new DataView(physical.buffer,physical.byteOffset,9).getUint32(0),11811);
  assert.deepEqual(tagSRGBPNG(result),result);
});
test('invalid or corrupt export pixels fail instead of producing mislabeled files',()=>{
  assert.throws(()=>tagSRGBPNG(new Uint8Array(50)),/valid PNG/);
  assert.throws(()=>tagSRGBPNG(original.subarray(0,40)),/valid PNG/);
  const corrupt=original.slice();corrupt[30]^=1;
  assert.throws(()=>tagSRGBPNG(corrupt),/checksum/);
  assert.throws(()=>tagSRGBPNG(original,{dpi:0}),/resolution/);
});
test('PDF contains a single physical-size page and an ICC-based lossless RGB image',async()=>{
  const header=new DataView(original.buffer,original.byteOffset,original.byteLength);
  const width=header.getUint32(16),height=header.getUint32(20);
  const output=await createBoardPDF(original,{width,height,title:'ไทย Brand'});
  const pdf=await PDFDocument.load(output);
  assert.equal(pdf.getPageCount(),1);
  assert.equal(pdf.getTitle(),'ไทย Brand');
  const page=pdf.getPage(0);
  assert.equal(page.getWidth(),width*72/300);assert.equal(page.getHeight(),height*72/300);
  const resources=page.node.Resources(),xobjects=resources.lookup(PDFName.of('XObject'));
  const image=pdf.context.lookup(xobjects.values()[0],PDFRawStream);
  const space=image.dict.lookup(PDFName.of('ColorSpace'),PDFArray);
  assert.equal(space.get(0).toString(),'/ICCBased');
  const profile=pdf.context.lookup(space.get(1),PDFRawStream);
  assert.equal(profile.dict.get(PDFName.of('N')).asNumber(),3);
  assert.equal(image.dict.get(PDFName.of('Filter')).toString(),'/FlateDecode');
  assert.equal(image.dict.get(PDFName.of('Interpolate')).toString(),'false');
});
test('PDF rejects dimension mismatch instead of stretching the board',async()=>{
  await assert.rejects(createBoardPDF(original,{width:2400,height:1800}),/dimensions do not match/);
});
