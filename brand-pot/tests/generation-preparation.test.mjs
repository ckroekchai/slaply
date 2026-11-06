import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationPreparation } from '../src/generation-preparation.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('Stop or input edits during preparation prevent a new generation', async () => {
  const read = deferred(), busy = [], started = [];
  let isCurrent;
  const preparation = createGenerationPreparation({
    prepare: async (ingredients, options) => { isCurrent = options.isCurrent; await read.promise; return ingredients; },
    onBusyChange: value => busy.push(value),
  });
  const pending = preparation.run([{ id: 'logo', locked: true }], { onPrepared: value => started.push(value) });
  assert.equal(isCurrent(), true);
  preparation.invalidate();
  assert.equal(isCurrent(), false);
  read.resolve();
  assert.equal(await pending, false);
  assert.deepEqual(started, []);
  assert.deepEqual(busy, [true, false]);
});

test('stale completion cannot publish or clear a newer preparation busy state', async () => {
  const reads = [deferred(), deferred()], busy = [], started = [];
  let calls = 0;
  const preparation = createGenerationPreparation({
    prepare: async ingredients => { await reads[calls++].promise; return ingredients; },
    onBusyChange: value => busy.push(value),
  });
  const old = preparation.run(['old'], { onPrepared: value => started.push(value) });
  preparation.invalidate();
  const current = preparation.run(['current'], { onPrepared: value => started.push(value) });
  reads[0].resolve();
  assert.equal(await old, false);
  assert.equal(preparation.active, true);
  assert.deepEqual(busy, [true, false, true]);
  reads[1].resolve();
  assert.equal(await current, true);
  assert.deepEqual(started, [['current']]);
  assert.deepEqual(busy, [true, false, true, false]);
});

test('rapid repeated Shake does not duplicate preparation or generation', async () => {
  const read = deferred();
  let reads = 0, starts = 0;
  const preparation = createGenerationPreparation({ prepare: async ingredients => { reads++; await read.promise; return ingredients; } });
  const first = preparation.run(['three ingredients'], { onPrepared: () => starts++ });
  assert.equal(await preparation.run(['duplicate'], { onPrepared: () => starts++ }), false);
  read.resolve();
  await first;
  assert.equal(reads, 1);
  assert.equal(starts, 1);
});

test('old preparation errors stay silent and a current failure permits explicit retry', async () => {
  const reads = [deferred(), deferred()], errors = [], busy = [];
  let calls = 0;
  const preparation = createGenerationPreparation({ prepare: () => reads[calls++].promise, onBusyChange: value => busy.push(value) });
  const old = preparation.run([], { onError: error => errors.push(error.message) });
  preparation.invalidate();
  const current = preparation.run([], { onError: error => errors.push(error.message) });
  reads[0].reject(new Error('stale'));
  await old;
  assert.deepEqual(errors, []);
  assert.equal(preparation.active, true);
  reads[1].reject(new Error('current'));
  await current;
  assert.deepEqual(errors, ['current']);
  assert.equal(preparation.active, false);
  assert.deepEqual(busy, [true, false, true, false]);
});
