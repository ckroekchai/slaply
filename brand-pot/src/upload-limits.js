export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_RECIPE_UPLOAD_BYTES = 18 * 1024 * 1024;
export const UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf';

// Extension fallback accommodates browsers that leave File.type empty. These
// hints never establish file safety: the server validates the actual bytes.
export function uploadFileKind(file) {
  const mime=String(file?.type||'').toLowerCase().split(';')[0].trim();
  const extension=/\.([a-z0-9]+)$/i.exec(String(file?.name||'').trim())?.[1]?.toLowerCase();
  if(['image/svg+xml','application/pdf'].includes(mime)||['svg','pdf'].includes(extension))return 'document';
  if(['image/png','image/jpeg','image/webp'].includes(mime)||['png','jpg','jpeg','webp'].includes(extension))return 'raster';
  return null;
}
export function uploadValidationMessage(file, ingredients = [], slot = -1) {
  if(!uploadFileKind(file))return 'เลือกไฟล์ JPG, PNG, WebP, SVG หรือ PDF';
  if(!Number.isFinite(file.size)||file.size<1)return 'ไฟล์นี้ไม่มีข้อมูล กรุณาเลือกไฟล์อื่น';
  if(file.size>MAX_UPLOAD_BYTES)return 'เลือกไฟล์ขนาดไม่เกิน 5 MB';
  // Older saved recipes may have no byte metadata. The server always validates
  // the complete total; the browser can reject only a known over-limit sum.
  const otherBytes=ingredients.reduce((sum,item,index)=>sum+(index!==slot&&Number.isFinite(item?.bytes)?item.bytes:0),0);
  if(otherBytes+file.size>MAX_RECIPE_UPLOAD_BYTES)return 'ไฟล์ในสูตรนี้รวมกันเกิน 18 MB กรุณาเลือกไฟล์ขนาดเล็กลง';
  return '';
}
