import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDecimal } from '../public/numbers.js';

test('offer numbers accept a decimal point or comma and preserve zero', () => {
  assert.equal(parseDecimal('0'), 0);
  assert.equal(parseDecimal('0.000000'), 0);
  assert.equal(parseDecimal(' 1,25 '), 1.25);
  assert.equal(parseDecimal('1.25'), 1.25);
});

test('missing or invalid offer numbers do not become zero', () => {
  for (const value of [undefined, '', ' ', 'brak', '10 kg', '0x10', 'Infinity', '1e999']) {
    assert.equal(parseDecimal(value), null);
  }
});
