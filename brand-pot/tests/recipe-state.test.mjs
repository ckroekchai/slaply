import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeFingerprint, isRecipeSaved, persistRecipeSnapshot, moveSavedRecipe, applyRecipeMove } from '../src/recipe-state.js';
import { uploadValidationMessage, MAX_UPLOAD_BYTES, MAX_RECIPE_UPLOAD_BYTES } from '../src/upload-limits.js';

const recipe = { id: 'job', jobId: 'job', name: 'แบรนด์ของฉัน', words: 'สดใส', concept: { title: 'แนวคิด', summary: 'อบอุ่น เป็นกันเอง' }, customization: { objectStyles: ['bloom'], hue: 0, brightness: 100 } };
const saved = { ...structuredClone(recipe), id: 'saved-1', savedAt: '2026-11-04T04:00:00Z', version: 2 };

test('saved state depends on confirmed matching content, including concept and each customization', () => {
  assert.equal(isRecipeSaved(recipe, []), false);
  assert.equal(isRecipeSaved(recipe, [saved]), true);
  assert.equal(isRecipeSaved(recipe, [{ ...saved, trashedAt: 'now' }]), false);
  const edits = [
    { name: 'ชื่อใหม่' }, { words: 'เข้มข้น' }, { concept: { ...recipe.concept, title: 'อีกแนวคิด' } }, { concept: { ...recipe.concept, summary: 'คำอธิบายใหม่' } },
    ...['textScale', 'objectScale', 'hue', 'brightness', 'saturation'].map(key => ({ customization: { ...recipe.customization, [key]: key === 'hue' ? 20 : 110 } })),
    { customization: { ...recipe.customization, objectStyles: [] } }, { jobId: 'another-generation' },
  ];
  for (const edit of edits) assert.equal(isRecipeSaved({ ...recipe, ...edit }, [saved]), false, JSON.stringify(edit));
  assert.equal(isRecipeSaved({ ...recipe, name: ' แบรนด์ของฉัน ' }, [saved]), true, 'Match server-trimmed text');
});

test('a save in flight captures its submitted version and cannot mark subsequent edits as saved', async () => {
  const current = structuredClone(recipe); let complete, submitted;
  const pending = persistRecipeSnapshot(current, async (_path, options) => { submitted = JSON.parse(options.body).recipe; return new Promise(resolve => { complete = resolve; }); });
  current.customization.hue = 30; current.concept.summary = 'แก้ระหว่างเก็บ';
  assert.equal(submitted.customization.hue, 0);
  assert.equal(isRecipeSaved(current, []), false);
  complete({ recipe: { ...submitted, id: 'persisted-id', jobId: 'job', savedAt: 'now' } });
  const confirmed = await pending;
  assert.equal(isRecipeSaved(current, [confirmed.recipe]), false);
  assert.equal(isRecipeSaved(recipe, [confirmed.recipe]), true);
  assert.equal(confirmed.fingerprint, recipeFingerprint(recipe));
});

test('failed or malformed save never supplies a confirmed snapshot', async () => {
  const known = [structuredClone(saved)];
  await assert.rejects(persistRecipeSnapshot({ ...recipe, name: 'ใหม่' }, async () => { throw Error('Network failed'); }), /Network failed/);
  await assert.rejects(persistRecipeSnapshot(recipe, async () => ({ persisted: true })), /ยืนยัน/);
  assert.deepEqual(known, [saved]);
  assert.equal(isRecipeSaved({ ...recipe, name: 'ใหม่' }, known), false);
});

test('trash and undo move only the confirmed saved version and preserve current artwork data', async () => {
  const original = structuredClone(saved); let state = { recipes: [saved], trash: [] }; const calls = [];
  const request = async (path, options) => { calls.push({ path, method: options.method }); return options.method === 'DELETE' ? { recipe: { ...saved, trashedAt: 'now' }, trashed: true } : { recipe: saved, restored: true }; };
  const trashed = await moveSavedRecipe(saved.id, false, request); state = applyRecipeMove(state, trashed);
  assert.equal(state.recipes.length, 0); assert.equal(state.trash[0].id, saved.id); assert.equal(isRecipeSaved(recipe, state.recipes), false);
  const restored = await moveSavedRecipe(saved.id, true, request); state = applyRecipeMove(state, restored, true);
  assert.equal(state.trash.length, 0); assert.equal(isRecipeSaved(recipe, state.recipes), true);
  state = applyRecipeMove(state, restored, true); assert.equal(state.recipes.length, 1, 'Undo replay does not duplicate cards');
  assert.deepEqual(saved, original, 'Moving a saved version does not mutate the current working artwork');
  assert.deepEqual(calls, [{ path: '/api/recipes/saved-1', method: 'DELETE' }, { path: '/api/recipes/saved-1/restore', method: 'POST' }]);
});

test('failed trash or restore leaves lists unchanged and rejects unrelated returned IDs', async () => {
  const state = { recipes: [saved], trash: [] };
  await assert.rejects(moveSavedRecipe(saved.id, false, async () => { throw Error('Offline'); }), /Offline/);
  await assert.rejects(moveSavedRecipe(saved.id, true, async () => ({ recipe: { ...saved, id: 'unrelated' }, restored: true })), /ยืนยัน/);
  assert.deepEqual(state, { recipes: [saved], trash: [] });
});

test('upload preflight accepts up to 18 MiB total while keeping the 5 MiB per-image limit', () => {
  const mb = 1024 * 1024, file = { type: 'image/png', size: 5 * mb };
  assert.equal(MAX_UPLOAD_BYTES, 5 * mb); assert.equal(MAX_RECIPE_UPLOAD_BYTES, 18 * mb);
  assert.equal(uploadValidationMessage(file, [{ bytes: 5 * mb }, { bytes: 5 * mb }, { bytes: 3 * mb }], 3), '');
  assert.match(uploadValidationMessage({ ...file, size: file.size + 1 }), /5 MB/);
  assert.match(uploadValidationMessage(file, [{ bytes: 5 * mb }, { bytes: 5 * mb }, { bytes: 3 * mb + 1 }], 3), /18 MB/);
  assert.equal(uploadValidationMessage(file, [{ bytes: 5 * mb }, { bytes: 5 * mb }, { bytes: 5 * mb }], 0), '', 'Replacement excludes the old slot size');
  assert.equal(uploadValidationMessage(file, [{ id: 'legacy-without-bytes' }], 1), '', 'Old recipes remain usable; the server validates their actual bytes');
});
