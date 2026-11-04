export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_RECIPE_UPLOAD_BYTES = 18 * 1024 * 1024;

export function uploadValidationMessage(file, ingredients = [], slot = -1) {
  if (!/^image\/(png|jpeg|webp)$/.test(file?.type || '')) return 'เลือกไฟล์ JPG, PNG หรือ WebP';
  if (file.size > MAX_UPLOAD_BYTES) return 'เลือกรูปขนาดไม่เกิน 5 MB';
  // Older saved recipes may have no byte metadata. The server always validates
  // the complete total; the browser can reject only a known over-limit sum.
  const otherBytes = ingredients.reduce((sum, item, index) => sum + (index !== slot && Number.isFinite(item?.bytes) ? item.bytes : 0), 0);
  if (otherBytes + file.size > MAX_RECIPE_UPLOAD_BYTES) return 'รูปในสูตรนี้รวมกันเกิน 18 MB กรุณาเลือกรูปขนาดเล็กลง';
  return '';
}
