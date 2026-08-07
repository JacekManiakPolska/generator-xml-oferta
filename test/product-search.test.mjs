import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productMatchesSearch, searchTerms } from '../public/product-search.js';

const product = {
  id: '35',
  name: 'Adapter sieciowy RJ45',
  category: 'Wtyki i adaptery',
  url: 'https://b2b.netinet.pl/adapter.html',
  attributes: { EAN: '4049759028152', 'Kod Produktu': 'EFB_028152', Producent: 'EFB' }
};

test('comma-separated search matches any supplied phrase', () => {
  assert.equal(productMatchesSearch(product, '4049759028152, adapter sieciowy'), true);
  assert.equal(productMatchesSearch(product, '4049759028152, inny produkt'), true);
  assert.equal(productMatchesSearch(product, 'brak, inny produkt'), false);
});

test('search ignores empty comma-separated phrases and letter case', () => {
  assert.deepEqual(searchTerms(' EFB, , RJ45, '), ['efb', 'rj45']);
  assert.equal(productMatchesSearch(product, 'efb, RJ45,'), true);
});
