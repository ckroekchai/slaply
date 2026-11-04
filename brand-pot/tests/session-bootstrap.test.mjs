import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadKitchenSession } from '../src/api.js';
import { kitchenStatus } from '../src/kitchen-jobs.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('reload hydration cannot expose readiness before its active job and saved recipes are resolved', async () => {
  let releaseRecipes, hydrated = false;
  const calls = [];
  const request = async path => {
    calls.push(path);
    if (path === '/api/session') return { activeJob: { id: 'already-running' }, remaining: 0 };
    return new Promise(resolve => { releaseRecipes = resolve; });
  };
  const pending = loadKitchenSession(request).then(value => { hydrated = true; return value; });
  await flush();
  assert.equal(hydrated, false, 'The UI must not become ready during the gap between session and recipe requests');
  releaseRecipes({ recipes: [] });
  const snapshot = await pending;
  assert.deepEqual(calls, ['/api/session', '/api/recipes']);
  assert.equal(snapshot.activeJobId, 'already-running');
  assert.equal(snapshot.session.remaining, 0, 'Resume is allowed even when no new-generation quota remains');
});

test('reload restores saved edits as one normalized snapshot without creating a new job', async () => {
  const calls = [];
  const saved = { id: 'saved', name: 'ชื่อที่แก้แล้ว', ingredients: [{ id: 'photo', url: '/api/assets/photo' }], customization: { objectStyles: [] } };
  const snapshot = await loadKitchenSession(async path => { calls.push(path); return path === '/api/session' ? { latestRecipe: saved } : { recipes: [saved] }; });
  assert.equal(snapshot.latestRecipe.name, 'ชื่อที่แก้แล้ว');
  assert.equal(snapshot.latestRecipe.ingredients[0].src, '/api/assets/photo');
  assert.deepEqual(snapshot.latestRecipe.customization.objectStyles, []);
  assert.equal(snapshot.activeJobId, null);
  assert.ok(calls.every(path => path !== '/api/jobs'));
});

test('resumed job status is visible while its ingredients have not yet hydrated', () => {
  assert.equal(kitchenStatus({ count: 0, job: { phase: 'cooking', step: 'generating' }, hasResult: false }), 'กำลังสร้างภาพแบรนด์ของคุณ…');
  assert.equal(kitchenStatus({ count: 0, job: { phase: 'error', error: 'เชื่อมต่อไม่สำเร็จ' }, hasResult: false }), 'เชื่อมต่อไม่สำเร็จ');
  assert.equal(kitchenStatus({ count: 0, job: { phase: 'idle' }, hasResult: false }), 'ใส่วัตถุดิบแรกกันเลย');
});
