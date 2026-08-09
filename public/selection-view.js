export function buildSelectionView({ products, filtered, selectedKeys, showSelectedOnly = false, limit = 250 }) {
  const selectedProducts = products.filter((product) => selectedKeys.has(product.key));
  const tableProducts = showSelectedOnly ? selectedProducts : filtered;
  const rows = tableProducts.slice(0, limit);
  const visibleKeys = new Set(rows.map((product) => product.key));
  const visibleSelected = selectedProducts.filter((product) => visibleKeys.has(product.key));
  const hiddenSelected = selectedProducts.filter((product) => !visibleKeys.has(product.key));

  return { selectedProducts, tableProducts, rows, visibleSelected, hiddenSelected };
}
