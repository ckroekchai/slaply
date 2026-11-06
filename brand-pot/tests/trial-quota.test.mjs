import test from 'node:test';
import assert from 'node:assert/strict';
import { trialQuota } from '../src/trial-quota.js';

test('unlimited authenticated trial remains available with null or exhausted counters', () => {
  for (const remaining of [null, 0]) {
    const quota = trialQuota({ unlimited: true, remaining, globalRemaining: remaining });
    assert.equal(quota.canGenerate, true);
    assert.equal(quota.label, 'ไม่จำกัด');
    assert.equal(quota.count, '∞');
  }
});

test('ordinary trials obey the lowest counter and missing data fails closed', () => {
  assert.equal(trialQuota({ remaining: 4, globalRemaining: 2 }).label, '2 รอบ');
  assert.equal(trialQuota({ remaining: 4, globalRemaining: 2 }).canGenerate, true);
  for (const session of [null, {}, { remaining: 0, globalRemaining: 3 }, { remaining: 3, globalRemaining: 0 }, { unlimited: 'true', remaining: null, globalRemaining: null }]) {
    assert.equal(trialQuota(session).canGenerate, false);
  }
});
