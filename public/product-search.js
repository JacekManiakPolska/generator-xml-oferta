export function searchTerms(value) {
  return String(value || '')
    .split(',')
    .map((term) => term.trim().toLocaleLowerCase('pl-PL'))
    .filter(Boolean);
}

export function productMatchesSearch(product, value) {
  const terms = searchTerms(value);
  if (!terms.length) return true;
  const searchableText = [
    product.id,
    product.name,
    product.category,
    product.url,
    ...Object.values(product.attributes || {})
  ].join(' ').toLocaleLowerCase('pl-PL');
  return terms.some((term) => searchableText.includes(term));
}
