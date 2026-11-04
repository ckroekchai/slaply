import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeIngredients } from '../src/ingredient-priority.js';

const ingredient = (name, rgb, locked = false) => ({
  name, src: `/assets/${name}.png`, rgb, locked,
});

test('unlocked ingredients contribute equally, including the primary image', () => {
  const red = ingredient('red', [240, 0, 0]);
  const green = ingredient('green', [0, 240, 0]);
  const blue = ingredient('blue', [0, 0, 240]);
  const result = prioritizeIngredients([red, green, blue]);
  assert.equal(result.primary, red);
  assert.equal(result.reference, green);
  assert.deepEqual(result.rgb, [80, 80, 80]);
});

test('locking a later ingredient promotes its image and gives its color threefold weight', () => {
  const blue = ingredient('blue', [0, 0, 240]);
  const red = ingredient('red', [240, 0, 0], true);
  const result = prioritizeIngredients([blue, red]);
  assert.equal(result.primary, red);
  assert.equal(result.reference, blue);
  // A promoted primary must remain in the palette rather than disappearing.
  assert.deepEqual(result.rgb, [180, 0, 60]);
});

test('multiple locks retain slot order for the hero and weight every locked color', () => {
  const red = ingredient('red', [180, 0, 0], true);
  const blue = ingredient('blue', [0, 0, 180]);
  const green = ingredient('green', [0, 180, 0], true);
  const result = prioritizeIngredients([red, blue, green]);
  assert.equal(result.primary, red);
  assert.equal(result.reference, blue);
  assert.deepEqual(result.rgb, [77, 77, 26]);
});

test('unlocking removes the extra influence and restores the first-slot primary', () => {
  const blue = ingredient('blue', [0, 0, 240]);
  const lockedRed = ingredient('red', [240, 0, 0], true);
  const emphasized = prioritizeIngredients([blue, lockedRed]);
  const normal = prioritizeIngredients([blue, { ...lockedRed, locked: false }]);
  assert.equal(emphasized.primary, lockedRed);
  assert.equal(normal.primary, blue);
  assert.deepEqual(emphasized.rgb, [180, 0, 60]);
  assert.deepEqual(normal.rgb, [120, 0, 120]);
});

test('empty carousel slots do not affect ordering, references or palette weight', () => {
  const first = ingredient('first', [20, 40, 60]);
  const last = ingredient('last', [60, 80, 100]);
  const result = prioritizeIngredients([null, first, null, null, last, null]);
  assert.deepEqual(result.valid, [first, last]);
  assert.equal(result.primary, first);
  assert.equal(result.reference, last);
  assert.deepEqual(result.rgb, [40, 60, 80]);
});

test('JSON save/restore preserves locked priority and color influence', () => {
  const original = [ingredient('first', [40, 60, 80]), null,
    ingredient('priority', [200, 160, 120], true), null, null, null];
  const restored = JSON.parse(JSON.stringify(original));
  const before = prioritizeIngredients(original);
  const after = prioritizeIngredients(restored);
  assert.equal(after.primary.src, '/assets/priority.png');
  assert.equal(after.primary.locked, true);
  assert.equal(after.reference.src, before.reference.src);
  assert.deepEqual(after.rgb, before.rgb);
  assert.deepEqual(after.valid.map(item => item.locked), [false, true]);
});

test('priority calculation never mutates the input snapshot or RGB arrays', () => {
  const first = Object.freeze(ingredient('first', Object.freeze([25, 50, 75])));
  const second = Object.freeze(ingredient('second', Object.freeze([200, 150, 100]), true));
  const input = Object.freeze([null, first, second]);
  const original = JSON.stringify(input);
  const result = prioritizeIngredients(input);
  assert.equal(result.primary, second);
  assert.equal(JSON.stringify(input), original);
  assert.notEqual(result.valid, input);
});

test('legacy ingredients without sampled RGB use the neutral fallback', () => {
  const known = ingredient('known', [30, 60, 90]);
  const legacy = { name: 'legacy', src: '/assets/legacy.png', locked: false };
  const result = prioritizeIngredients([known, legacy]);
  assert.deepEqual(result.rgb, [115, 140, 145]);
  assert.ok(result.rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
});
