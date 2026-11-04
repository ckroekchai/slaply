// A summary of supplied facts, not image recognition or generated brand strategy.
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
const clean = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
const defaultDescriptions = new Set([
  'A little of you. A brand of your own.',
  'Thoughtfully made. Distinctly you.',
]);
function excerpt(value, limit) {
  const units = segmenter ? Array.from(segmenter.segment(value), part => part.segment) : Array.from(value);
  return units.length > limit ? units.slice(0, limit - 1).join('').trimEnd() + '…' : value;
}
function channels(value) {
  return Array.isArray(value) && value.length >= 3
    && value.slice(0, 3).every(channel => typeof channel === 'number' && Number.isFinite(channel) && channel >= 0 && channel <= 255)
    ? value.slice(0, 3) : null;
}
function parseColor(value) {
  const text = clean(value);
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text);
  if (hex) {
    const expanded = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
    return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16));
  }
  const match = /^rgb\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*\)$/i.exec(text);
  return match ? channels(match.slice(1).map(Number)) : null;
}
function imagesFrom(recipe) {
  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients.filter(item => item && typeof item === 'object' && clean(item.src));
  }
  // Old recipes stored their two image sources directly. Do not count one image twice.
  const sources = [recipe.productImage || recipe.image, recipe.referenceImage].map(clean).filter(Boolean);
  return [...new Set(sources)].map(src => ({ src }));
}
function sourceColor(recipe, images) {
  const saved = parseColor(recipe.referenceColor);
  if (saved) return saved;
  const samples = images.map(item => ({ rgb: channels(item.rgb), weight: item.locked ? 3 : 1 })).filter(item => item.rgb);
  const weight = samples.reduce((sum, item) => sum + item.weight, 0);
  return weight ? [0, 1, 2].map(channel => Math.round(samples.reduce((sum, item) => sum + item.rgb[channel] * item.weight, 0) / weight)) : null;
}
function colorName(rgb) {
  const [r, g, b] = rgb.map(value => value / 255);
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low, light = (high + low) / 2;
  if (light <= .10) return 'สีดำ';
  if (delta < .065) return light >= .93 ? 'สีขาว' : light >= .72 ? 'สีเทาอ่อน' : light <= .30 ? 'สีเทาเข้ม' : 'สีเทา';
  let hue = high === r ? (g - b) / delta % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const base = hue < 15 || hue >= 345 ? 'สีแดง' : hue < 45 ? 'สีส้ม' : hue < 70 ? 'สีเหลือง'
    : hue < 165 ? 'สีเขียว' : hue < 205 ? 'สีฟ้า' : hue < 260 ? 'สีน้ำเงิน' : hue < 295 ? 'สีม่วง' : 'สีชมพู';
  return base + (light >= .73 ? 'อ่อน' : light <= .30 ? 'เข้ม' : '');
}

/** Pure, deterministic Thai copy for the result heading. Returns plain text for React. */
export function buildBrandConcept(recipe = {}) {
  recipe = recipe && typeof recipe === 'object' ? recipe : {};
  const rawName = clean(recipe.name);
  const name = /^your brand$/i.test(rawName) ? '' : excerpt(rawName, 42);
  const rawWords = clean(recipe.words) || clean(recipe.description) || clean(recipe.promise);
  const words = defaultDescriptions.has(rawWords) && !clean(recipe.promise) ? '' : rawWords;
  const images = imagesFrom(recipe), locked = images.filter(item => item.locked).length;
  const color = sourceColor(recipe, images), label = color ? colorName(color) : '';
  const title = name
    ? `${name} · ${words ? excerpt(words, 38) : label ? `โทน${label}` : images.length ? `จากภาพ ${images.length} ภาพ` : 'แนวคิดแบรนด์'}`
    : words ? `แนวคิดจาก “${excerpt(words, 42)}”`
      : label ? `แนวคิดแบรนด์ในโทน${label}`
        : images.length ? `แนวคิดจากภาพ ${images.length} ภาพ` : 'ยังไม่มีข้อมูลแนวคิดแบรนด์';
  // The supplied description appears once, in the title. The paragraph connects
  // the remaining facts into a concept without exposing the mixing algorithm.
  const identity = name || 'แบรนด์คุณ';
  let summary;
  if (images.length) {
    summary = `นำวัตถุดิบ ${images.length} ภาพมารวมเป็นตัวตนของ ${identity}`
      + (label ? ` โดยใช้โทน${label}เป็นสีตั้งต้น` : '');
  } else if (label) {
    summary = `ใช้โทน${label}เป็นสีตั้งต้นของ ${identity}`;
  } else if (words) {
    summary = `ใช้คำอธิบายที่คุณให้ไว้กำหนดทิศทางของ ${identity} โดยยังไม่มีภาพวัตถุดิบประกอบ`;
  } else {
    summary = name ? `แนวคิดเริ่มต้นจากชื่อ “${name}” ยังไม่มีคำอธิบายหรือภาพวัตถุดิบประกอบ`
      : 'สูตรนี้ยังไม่มีชื่อ คำอธิบาย หรือภาพวัตถุดิบที่ใช้สรุปแนวคิด';
  }
  if (locked) summary += ' เก็บเอกลักษณ์จากวัตถุดิบที่คุณล็อกไว้เป็นจุดเด่น';
  return { title, summary };
}
