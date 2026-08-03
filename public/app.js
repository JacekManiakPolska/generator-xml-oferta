const state = { products: [], filtered: [], defaultUrl: '', loadedUrl: '', filterDefinitions: [], activeFilters: new Map(), selectedProducts: new Set() };
const $ = (id) => document.getElementById(id);
const elements = {
  url: $('xml-url'), load: $('load-button'), status: $('source-status'), results: $('results'), productCount: $('product-count'), visibleCount: $('visible-count'), categoryCount: $('category-count'), loadedUrl: $('loaded-url'), search: $('search'), filterField: $('filter-field'), addFilter: $('add-filter-button'), clearFilters: $('clear-filters-button'), activeFilters: $('active-filters'), selectionSummary: $('selection-summary'), selectVisible: $('select-visible'), rows: $('product-rows'), note: $('table-note'), includeImageUrls: $('include-image-urls'), csv: $('csv-button'), xlsx: $('xlsx-button'), xls: $('xls-button')
};
const SELECT_FILTER_LIMIT = 150;

function text(node) { return node?.textContent?.trim() || ''; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function parseProduct(node) {
  const attributes = {};
  node.querySelectorAll(':scope > attrs > a').forEach((item) => { attributes[item.getAttribute('name') || ''] = text(item); });
  const images = [...node.querySelectorAll(':scope > imgs > *')].map((item) => item.getAttribute('url')).filter(Boolean);
  const id = node.getAttribute('id') || '';
  const url = node.getAttribute('url') || '';
  return { key: url || id, id, url, price: node.getAttribute('price') || '', avail: node.getAttribute('avail') || '', stock: node.getAttribute('stock') || '', weight: node.getAttribute('weight') || '', category: text(node.querySelector(':scope > cat')), name: text(node.querySelector(':scope > name')), description: node.querySelector(':scope > desc')?.textContent || '', images, attributes };
}
function setStatus(message, type = '') { elements.status.textContent = message; elements.status.className = `status ${type}`; }
function parseXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Pobrany plik nie jest poprawnym XML-em.');
  const nodes = [...xml.querySelectorAll('offers > o')];
  if (!nodes.length) throw new Error('Nie znaleziono produktów w strukturze offers > o.');
  return nodes.map(parseProduct);
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')); }
function uniqueCategories(products) { return unique(products.map((item) => item.category)); }
function productWord(count) { const remainder = count % 100; return count === 1 ? 'produkt' : remainder >= 12 && remainder <= 14 ? 'produktów' : count % 10 >= 2 && count % 10 <= 4 ? 'produkty' : 'produktów'; }
function valueForFilter(item, key) { return key === 'tag:cat' ? item.category : item.attributes[key.slice(5)] || ''; }
function buildFilterDefinitions(products) {
  const definitions = [{ key: 'tag:cat', label: 'Kategoria', path: '<cat>', values: uniqueCategories(products) }];
  const attributeNames = unique(products.flatMap((item) => Object.keys(item.attributes)));
  attributeNames.forEach((name) => definitions.push({ key: `attr:${name}`, label: name, path: `<attrs><a name="${name}">`, values: unique(products.map((item) => item.attributes[name] || '')) }));
  return definitions;
}
function getFilterDefinition(key) { return state.filterDefinitions.find((definition) => definition.key === key); }
function renderFilterFieldOptions() {
  const available = state.filterDefinitions.filter((definition) => !state.activeFilters.has(definition.key));
  elements.filterField.innerHTML = '<option value="">Wybierz znacznik XML</option>' + available.map((definition) => `<option value="${escapeHtml(definition.key)}">${escapeHtml(definition.label)} · ${escapeHtml(definition.path)} (${definition.values.length})</option>`).join('');
  elements.addFilter.disabled = !available.length;
}
function renderActiveFilters() {
  if (!state.activeFilters.size) {
    elements.activeFilters.innerHTML = '';
    return;
  }
  elements.activeFilters.innerHTML = [...state.activeFilters.entries()].map(([key, selectedValue]) => {
    const definition = getFilterDefinition(key);
    if (!definition) return '';
    const title = `${definition.label} · ${definition.path}`;
    const control = definition.values.length <= SELECT_FILTER_LIMIT
      ? `<select data-filter-value data-filter-key="${escapeHtml(key)}"><option value="">Wszystkie wartości</option><option value="__missing__"${selectedValue === '__missing__' ? ' selected' : ''}>Brak wartości</option>${definition.values.map((value) => `<option value="${escapeHtml(value)}"${selectedValue === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`
      : `<input data-filter-value data-filter-key="${escapeHtml(key)}" type="search" value="${escapeHtml(selectedValue)}" placeholder="Wpisz fragment wartości">`;
    return `<div class="filter-card" data-filter-card="${escapeHtml(key)}"><label title="${escapeHtml(title)}">${escapeHtml(definition.label)} <span class="muted">${escapeHtml(definition.path)}</span>${control}</label><button type="button" class="remove-filter" data-remove-filter="${escapeHtml(key)}" aria-label="Usuń filtr ${escapeHtml(definition.label)}">×</button></div>`;
  }).join('');
}
function addFilter() {
  const key = elements.filterField.value;
  if (!key || state.activeFilters.has(key)) return;
  state.activeFilters.set(key, '');
  renderFilterFieldOptions();
  renderActiveFilters();
  applyFilters();
}
function clearFilters() {
  state.activeFilters.clear();
  elements.search.value = '';
  renderFilterFieldOptions();
  renderActiveFilters();
  applyFilters();
}
function renderRows() {
  const rows = state.filtered.slice(0, 250);
  elements.rows.innerHTML = rows.map((product) => `<tr><td><input class="row-select" type="checkbox" data-product-key="${escapeHtml(product.key)}" aria-label="Zaznacz produkt ${escapeHtml(product.name)}"${state.selectedProducts.has(product.key) ? ' checked' : ''}></td><td>${product.images[0] ? `<img class="thumb" loading="lazy" src="${escapeHtml(product.images[0])}" alt="">` : '<span class="muted">brak</span>'}</td><td>${escapeHtml(product.id)}</td><td>${escapeHtml(product.attributes['Kod Produktu'])}</td><td class="name-cell">${escapeHtml(product.name)}</td><td>${escapeHtml(product.category)}</td><td>${escapeHtml(product.price)}</td><td>${escapeHtml(product.stock)}</td><td>${escapeHtml(product.attributes.EAN)}</td></tr>`).join('');
  elements.visibleCount.textContent = state.filtered.length.toLocaleString('pl-PL');
  elements.note.textContent = state.filtered.length > rows.length ? `Pokazano pierwsze ${rows.length} rekordów. Eksport obejmie wszystkie rekordy spełniające filtry.` : `${rows.length.toLocaleString('pl-PL')} rekordów spełnia aktualne filtry.`;
  updateSelectionUi(rows);
}
function updateSelectionUi(visibleRows = state.filtered.slice(0, 250)) {
  const selectedCount = state.selectedProducts.size;
  elements.selectionSummary.innerHTML = selectedCount ? `<span>Zaznaczono <strong>${selectedCount.toLocaleString('pl-PL')}</strong> ${productWord(selectedCount)} — eksport obejmie tylko zaznaczone.</span><button id="clear-selection-button" type="button" class="quiet">Wyczyść zaznaczenie</button>` : '';
  const visibleSelected = visibleRows.filter((item) => state.selectedProducts.has(item.key)).length;
  elements.selectVisible.checked = Boolean(visibleRows.length) && visibleSelected === visibleRows.length;
  elements.selectVisible.indeterminate = visibleSelected > 0 && visibleSelected < visibleRows.length;
}
function applyFilters() {
  const query = elements.search.value.trim().toLocaleLowerCase('pl-PL');
  const activeFilters = [...state.activeFilters.entries()].filter(([, value]) => value);
  state.filtered = state.products.filter((item) => {
    if (query && ![item.id, item.name, item.category, item.url, ...Object.values(item.attributes)].join(' ').toLocaleLowerCase('pl-PL').includes(query)) return false;
    return activeFilters.every(([key, selectedValue]) => {
      const value = valueForFilter(item, key);
      if (selectedValue === '__missing__') return !value;
      const definition = getFilterDefinition(key);
      return definition?.values.length > SELECT_FILTER_LIMIT ? value.toLocaleLowerCase('pl-PL').includes(selectedValue.toLocaleLowerCase('pl-PL')) : value === selectedValue;
    });
  });
  renderRows();
}
function exportRows(products) {
  const maxImages = elements.includeImageUrls.checked ? Math.max(0, ...products.map((item) => item.images.length)) : 0;
  return products.map((item) => {
    const row = { ID: item.id, 'Kod produktu': item.attributes['Kod Produktu'] || '', EAN: item.attributes.EAN || '', MPN: item.attributes.MPN || '', Nazwa: item.name, Kategoria: item.category, Cena: Number(item.price) || item.price, Stan: Number(item.stock) || item.stock, Dostępność: item.avail, Waga: Number(item.weight) || item.weight, 'Otwórz produkt (demo)': `${window.location.origin}/product-preview?target=${encodeURIComponent(item.url)}`, 'URL produktu B2B': item.url, 'Liczba zdjęć': item.images.length, Producent: item.attributes.Producent || '', Marka: item.attributes.Marka || '', Jednostka: item.attributes.Jednostka || '' };
    for (let index = 0; index < maxImages; index += 1) row[`URL zdjęcia ${index + 1}`] = item.images[index] || '';
    return row;
  });
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function addHyperlinks(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = new Map();
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
    headers.set(column, String(header?.v || ''));
  }
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const header = headers.get(column);
      if (!cell || typeof cell.v !== 'string') continue;
      if (header === 'Otwórz produkt (demo)' && /^https?:\/\//i.test(cell.v)) {
        const target = cell.v;
        cell.v = 'Otwórz produkt';
        cell.l = { Target: target, Tooltip: 'Otwórz demonstracyjny podgląd produktu' };
      } else if (/^URL zdjęcia \d+$/.test(header) && /^https?:\/\//i.test(cell.v)) {
        cell.l = { Target: cell.v, Tooltip: 'Otwórz zdjęcie' };
      }
    }
  }
}
function exportFile(type) {
  const productsToExport = state.selectedProducts.size ? state.products.filter((item) => state.selectedProducts.has(item.key)) : state.filtered;
  if (!productsToExport.length) return setStatus('Brak danych do eksportu', 'error');
  const rows = exportRows(productsToExport); const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); addHyperlinks(sheet); XLSX.utils.book_append_sheet(workbook, sheet, 'Oferta'); const stamp = new Date().toISOString().replace(/[T:.Z]/g, '-').replace(/-+$/, '');
  if (type === 'csv') { const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' }); downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `oferta-podglad-demo-${stamp}.csv`); } else XLSX.writeFile(workbook, `oferta-podglad-demo-${stamp}.${type}`, { bookType: type });
}
async function loadXml() {
  const url = elements.url.value.trim(); if (!url) return setStatus('Podaj adres XML', 'error');
  elements.load.disabled = true; setStatus('Pobieranie i analiza…', 'loading');
  try {
    const response = await fetch(`/api/fetch-xml?url=${encodeURIComponent(url)}`);
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const payload = isJson ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.error || 'Nie udało się pobrać XML.');
    const xmlText = payload ? payload.text : await response.text();
    const finalUrl = payload?.finalUrl || response.headers.get('x-source-url') || url;
    state.products = parseXml(xmlText); state.filtered = state.products; state.loadedUrl = finalUrl; state.filterDefinitions = buildFilterDefinitions(state.products); state.activeFilters.clear(); state.selectedProducts.clear();
    elements.productCount.textContent = state.products.length.toLocaleString('pl-PL'); elements.categoryCount.textContent = uniqueCategories(state.products).length.toLocaleString('pl-PL'); elements.loadedUrl.textContent = new URL(state.loadedUrl).hostname; elements.results.classList.remove('hidden'); renderFilterFieldOptions(); renderActiveFilters(); applyFilters(); setStatus(`Wczytano ${state.products.length.toLocaleString('pl-PL')} produktów`, 'success');
  } catch (error) { setStatus(error.message || 'Wystąpił błąd', 'error'); } finally { elements.load.disabled = false; }
}
elements.load.addEventListener('click', loadXml);
elements.url.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadXml(); });
elements.search.addEventListener('input', applyFilters);
elements.addFilter.addEventListener('click', addFilter);
elements.clearFilters.addEventListener('click', clearFilters);
elements.activeFilters.addEventListener('input', (event) => { if (event.target.matches('[data-filter-value]')) { state.activeFilters.set(event.target.dataset.filterKey, event.target.value); applyFilters(); } });
elements.activeFilters.addEventListener('change', (event) => { if (event.target.matches('[data-filter-value]')) { state.activeFilters.set(event.target.dataset.filterKey, event.target.value); applyFilters(); } });
elements.activeFilters.addEventListener('click', (event) => { const button = event.target.closest('[data-remove-filter]'); if (!button) return; state.activeFilters.delete(button.dataset.removeFilter); renderFilterFieldOptions(); renderActiveFilters(); applyFilters(); });
elements.rows.addEventListener('change', (event) => { const checkbox = event.target.closest('[data-product-key]'); if (!checkbox) return; if (checkbox.checked) state.selectedProducts.add(checkbox.dataset.productKey); else state.selectedProducts.delete(checkbox.dataset.productKey); updateSelectionUi(); });
elements.selectVisible.addEventListener('change', () => { state.filtered.slice(0, 250).forEach((item) => { if (elements.selectVisible.checked) state.selectedProducts.add(item.key); else state.selectedProducts.delete(item.key); }); renderRows(); });
elements.selectionSummary.addEventListener('click', (event) => { if (!event.target.closest('#clear-selection-button')) return; state.selectedProducts.clear(); renderRows(); });
elements.csv.addEventListener('click', () => exportFile('csv'));
elements.xlsx.addEventListener('click', () => exportFile('xlsx'));
elements.xls.addEventListener('click', () => exportFile('xls'));
fetch('/api/config').then((response) => response.json()).then((config) => { state.defaultUrl = config.defaultUrl; elements.url.value = config.defaultUrl; }).catch(() => { elements.url.value = 'https://b2b.netinet.pl/xmlg/22lxnanobig.xml'; });
