import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandConcept } from '../src/brand-concept.js';

const image = (src, rgb, locked = false) => ({ src, rgb, locked, name: 'secret-file-name.png' });

test('concept prose connects supplied identity, palette and ingredients without pipeline jargon', () => {
  const result = buildBrandConcept({
    name: 'POKO', words: 'สดชื่น เรียบง่าย สำหรับทุกวัน', referenceColor: 'rgb(120, 210, 150)',
    ingredients: [null, image('/one.png', [120, 210, 150]), image('/two.png', [20, 100, 40], true)],
  });
  assert.equal(result.title, 'POKO · สดชื่น เรียบง่าย สำหรับทุกวัน');
  assert.match(result.summary, /วัตถุดิบ 2 ภาพ/u);
  assert.match(result.summary, /ตัวตนของ POKO โดยใช้โทนสีเขียวเป็นสีตั้งต้น/u);
  assert.match(result.summary, /เก็บเอกลักษณ์จากวัตถุดิบที่คุณล็อกไว้เป็นจุดเด่น/u);
  assert.doesNotMatch(result.summary, /secret-file-name|AI|เครื่องดื่ม|สินค้าออร์แกนิก|#[0-9A-F]{6}|3 เท่า|3×|น้ำหนัก|ลำดับ|ภาพแรก|ภาพหลัก/u);
  assert.equal((result.title + result.summary).split('สดชื่น เรียบง่าย สำหรับทุกวัน').length - 1, 1);
});

test('fallback palette includes primary and gives every locked RGB sample threefold weight', () => {
  const result = buildBrandConcept({ ingredients: [image('/green.png', [0, 240, 0], true), image('/red.png', [240, 0, 0])] });
  assert.match(result.summary, /โทนสีเขียว/u);
  assert.doesNotMatch(result.summary, /โทนสีเหลือง|โทนสีแดง/u);
});

test('an explicit valid reference color takes precedence over ingredient samples', () => {
  const result = buildBrandConcept({ referenceColor: '#abc', ingredients: [image('/red.png', [255, 0, 0])] });
  assert.match(result.summary, /โทนสีน้ำเงินอ่อน/u);
  assert.doesNotMatch(result.summary, /สีแดง|#[0-9A-F]{6}/u);
});

test('missing and invalid color data never invents a palette', () => {
  const result = buildBrandConcept({ name: 'INK', referenceColor: 'rgb(400, 0, 0)', ingredients: [image('/one.png', [NaN, 30, 50]), image('/two.png', ['100', 30, 50])] });
  assert.equal(result.title, 'INK · จากภาพ 2 ภาพ');
  assert.doesNotMatch(result.summary, /โทนสี|#[0-9A-F]{6}|ภาพแรก|ภาพหลัก/u);
  assert.equal(result.summary, 'นำวัตถุดิบ 2 ภาพมารวมเป็นตัวตนของ INK');
});

test('legacy sources are counted without duplicating product and reference paths', () => {
  const recipe = { name: 'เก่า', description: 'คำอธิบายที่บันทึกไว้', productImage: '/old.png', referenceImage: '/old.png' };
  const result = buildBrandConcept(recipe);
  assert.match(result.summary, /วัตถุดิบ 1 ภาพ/u);
  assert.match(result.title, /คำอธิบายที่บันทึกไว้/u);
  assert.doesNotMatch(result.summary, /ล็อก/u);
  assert.match(buildBrandConcept({ image: '/old.png', referenceImage: '/ref.png' }).summary, /วัตถุดิบ 2 ภาพ/u);
});

test('empty slots and malformed legacy fields are ignored without throwing', () => {
  assert.deepEqual(buildBrandConcept(null), buildBrandConcept());
  assert.deepEqual(buildBrandConcept({ name: {}, words: 20, ingredients: [null, false, {}, { src: '' }, { src: 42 }] }), buildBrandConcept());
  assert.match(buildBrandConcept({ name: 'มีแต่ชื่อ' }).summary, /เริ่มต้นจากชื่อ “มีแต่ชื่อ”/u);
});

test('known prototype placeholder text is not attributed to the user', () => {
  const result = buildBrandConcept({ name: 'YOUR BRAND', words: 'A little of you. A brand of your own.', promise: '', ingredients: [image('/one.png')] });
  assert.equal(result.title, 'แนวคิดจากภาพ 1 ภาพ');
  assert.doesNotMatch(result.summary, /A little of you|YOUR BRAND|คำอธิบาย/u);
});

test('long Thai combining text and joined emoji are shortened at grapheme boundaries', () => {
  const group = '👩🏽‍🍳';
  const recipe = { name: group.repeat(70), words: 'น้ำ'.repeat(180) };
  const result = buildBrandConcept(recipe);
  assert.ok(result.title.startsWith(group.repeat(41) + '…'));
  assert.ok(result.title.endsWith('…'));
  assert.ok(!result.title.includes('\uFFFD') && !result.summary.includes('\uFFFD'));
  assert.ok(result.summary.length < recipe.words.length);
});

test('filenames and preset moods cannot create semantic claims, and input stays immutable', () => {
  const recipe = Object.freeze({ name: 'PLAIN', words: '  อ่านง่าย\n ทุกวัน  ', mood: 'luxe', ingredients: Object.freeze([Object.freeze(image('/one.png', Object.freeze([20, 20, 20])))]) });
  const before = JSON.stringify(recipe);
  const result = buildBrandConcept(recipe);
  assert.deepEqual(result, buildBrandConcept({ ...recipe, mood: 'fresh', ingredients: [{ ...recipe.ingredients[0], name: 'luxury-organic-coffee.png' }] }));
  assert.match(result.title, /อ่านง่าย ทุกวัน/u);
  assert.equal(JSON.stringify(recipe), before);
});
