import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSelectionView } from '../public/selection-view.js';

const products = Array.from({ length: 8 }, (_, index) => ({ key: `p${index + 1}`, name: `Produkt ${index + 1}` }));

test('wskazuje zaznaczone produkty poza aktualnie renderowanym widokiem', () => {
  const view = buildSelectionView({
    products,
    filtered: products.slice(0, 4),
    selectedKeys: new Set(['p1', 'p3', 'p6'])
  });

  assert.deepEqual(view.visibleSelected.map((product) => product.key), ['p1', 'p3']);
  assert.deepEqual(view.hiddenSelected.map((product) => product.key), ['p6']);
});

test('tryb zaznaczonych pokazuje wybrane produkty niezależnie od filtrów', () => {
  const view = buildSelectionView({
    products,
    filtered: products.slice(0, 2),
    selectedKeys: new Set(['p2', 'p6', 'p8']),
    showSelectedOnly: true
  });

  assert.deepEqual(view.rows.map((product) => product.key), ['p2', 'p6', 'p8']);
  assert.equal(view.hiddenSelected.length, 0);
});

test('limit tabeli także zalicza wybrane rekordy do produktów poza widokiem', () => {
  const view = buildSelectionView({
    products,
    filtered: products,
    selectedKeys: new Set(['p1', 'p5']),
    limit: 4
  });

  assert.deepEqual(view.visibleSelected.map((product) => product.key), ['p1']);
  assert.deepEqual(view.hiddenSelected.map((product) => product.key), ['p5']);
});
