import { buildPrintOfferHtml } from './print-offer.js';
import { formatPrice, parseDecimal } from './numbers.js';
import { productMatchesSearch } from './product-search.js';

const state = { products: [], filtered: [], defaultUrl: '', loadedUrl: '', publicAppUrl: '', filterDefinitions: [], activeFilters: new Map(), selectedProducts: new Set() };
const $ = (id) => document.getElementById(id);
const elements = {
  url: $('xml-url'), load: $('load-button'), status: $('source-status'), results: $('results'), welcomeGuide: $('welcome-guide'), productCount: $('product-count'), visibleCount: $('visible-count'), categoryCount: $('category-count'), loadedUrl: $('loaded-url'), search: $('search'), filterField: $('filter-field'), addFilter: $('add-filter-button'), clearFilters: $('clear-filters-button'), activeFilters: $('active-filters'), selectionSummary: $('selection-summary'), selectVisible: $('select-visible'), rows: $('product-rows'), note: $('table-note'), includeImageUrls: $('include-image-urls'), xlsx: $('xlsx-button'), xls: $('xls-button'), pdf: $('pdf-button'), tipText: $('tip-text'), tipCounter: $('tip-counter'), tipDots: $('tip-dots'), tipPrev: $('tip-prev'), tipNext: $('tip-next')
};
const SELECT_FILTER_LIMIT = 150;
const numberFormatter = new Intl.NumberFormat('pl-PL');
const counterAnimations = new WeakMap();
const welcomeTips = [
  'Użyj bezpośredniego adresu do pliku .xml. Link powinien zaczynać się od http:// lub https://.',
  'Najpierw wczytaj XML, a następnie wyszukuj wiele produktów, oddzielając frazy przecinkami.',
  'Przed eksportem możesz zaznaczyć konkretne produkty albo pobrać cały aktualnie przefiltrowany zestaw.'
];
let welcomeTipIndex = 0;

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
function renderWelcomeTip() {
  if (!elements.tipText) return;
  elements.tipText.textContent = welcomeTips[welcomeTipIndex];
  elements.tipCounter.textContent = `Porada ${welcomeTipIndex + 1}/${welcomeTips.length}`;
  [...elements.tipDots.children].forEach((dot, index) => dot.classList.toggle('active', index === welcomeTipIndex));
}
function changeWelcomeTip(direction) {
  welcomeTipIndex = (welcomeTipIndex + direction + welcomeTips.length) % welcomeTips.length;
  renderWelcomeTip();
}
function animateCounter(element, target, duration = 1000) {
  if (!element) return;
  const activeAnimation = counterAnimations.get(element);
  if (activeAnimation) cancelAnimationFrame(activeAnimation);
  const finalValue = Math.max(0, Number(target) || 0);
  let startedAt = null;
  element.textContent = '0';
  function update(now) {
    if (startedAt === null) startedAt = now;
    const progress = Math.min((now - startedAt) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    element.textContent = numberFormatter.format(Math.round(finalValue * easedProgress));
    if (progress < 1) counterAnimations.set(element, requestAnimationFrame(update));
    else counterAnimations.delete(element);
  }
  counterAnimations.set(element, requestAnimationFrame(update));
}
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
function updateAddFilterButton() {
  const hasSelection = Boolean(elements.filterField.value);
  const label = elements.addFilter.querySelector('[data-add-filter-label]');
  elements.addFilter.disabled = !hasSelection;
  elements.addFilter.classList.toggle('is-ready', hasSelection);
  elements.addFilter.title = hasSelection ? 'Kliknij, aby dodać wybrany filtr do listy' : 'Najpierw wybierz znacznik XML';
  if (label) label.textContent = hasSelection ? 'Dodaj wybrany filtr' : 'Wybierz znacznik';
}
function renderFilterFieldOptions() {
  const available = state.filterDefinitions.filter((definition) => !state.activeFilters.has(definition.key));
  elements.filterField.innerHTML = '<option value="">Wybierz znacznik XML</option>' + available.map((definition) => `<option value="${escapeHtml(definition.key)}">${escapeHtml(definition.label)} · ${escapeHtml(definition.path)} (${definition.values.length})</option>`).join('');
  updateAddFilterButton();
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
function updateClearFiltersButton() {
  const hasFilters = state.activeFilters.size > 0 || Boolean(elements.search.value.trim());
  elements.clearFilters.disabled = !hasFilters;
  elements.clearFilters.classList.toggle('is-active', hasFilters);
  elements.clearFilters.title = hasFilters ? 'Usuń wyszukiwanie i wszystkie aktywne filtry' : 'Brak aktywnych filtrów';
}
function renderRows() {
  const rows = state.filtered.slice(0, 250);
  elements.rows.innerHTML = rows.map((product) => `<tr><td><input class="row-select" type="checkbox" data-product-key="${escapeHtml(product.key)}" aria-label="Zaznacz produkt ${escapeHtml(product.name)}"${state.selectedProducts.has(product.key) ? ' checked' : ''}></td><td>${product.images[0] ? `<img class="thumb" loading="lazy" src="${escapeHtml(product.images[0])}" alt="">` : '<span class="muted">brak</span>'}</td><td>${escapeHtml(product.id)}</td><td>${escapeHtml(product.attributes['Kod Produktu'])}</td><td class="name-cell">${product.url ? `<a class="product-link" href="/open-product?target=${encodeURIComponent(product.url)}" target="_blank" rel="noopener" title="Zaloguj do konta demo i otwórz oryginalną kartę produktu">${escapeHtml(product.name)} <span aria-hidden="true">↗</span></a>` : escapeHtml(product.name)}</td><td>${escapeHtml(product.category)}</td><td>${escapeHtml(formatPrice(product.price))}</td><td>${escapeHtml(product.stock)}</td><td>${escapeHtml(product.attributes.EAN)}</td></tr>`).join('');
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
  const activeFilters = [...state.activeFilters.entries()].filter(([, value]) => value);
  state.filtered = state.products.filter((item) => {
    if (!productMatchesSearch(item, elements.search.value)) return false;
    return activeFilters.every(([key, selectedValue]) => {
      const value = valueForFilter(item, key);
      if (selectedValue === '__missing__') return !value;
      const definition = getFilterDefinition(key);
      return definition?.values.length > SELECT_FILTER_LIMIT ? value.toLocaleLowerCase('pl-PL').includes(selectedValue.toLocaleLowerCase('pl-PL')) : value === selectedValue;
    });
  });
  updateClearFiltersButton();
  renderRows();
}
function productOpenUrl(productUrl) {
  if (!productUrl) return '';
  const base = (state.publicAppUrl || window.location.origin).replace(/\/$/, '');
  return `${base}/open-product?target=${encodeURIComponent(productUrl)}`;
}
function exportRows(products) {
  const maxImages = elements.includeImageUrls.checked ? Math.max(0, ...products.map((item) => item.images.length)) : 0;
  return products.map((item) => {
    const row = {
      ID: item.id,
      'Kod produktu': item.attributes['Kod Produktu'] || '',
      EAN: item.attributes.EAN || '',
      MPN: item.attributes.MPN || '',
      Nazwa: item.name,
      Kategoria: item.category,
      Cena: parseDecimal(item.price),
      Stan: parseDecimal(item.stock),
      Dostępność: parseDecimal(item.avail),
      Waga: parseDecimal(item.weight),
      'Otwórz produkt (demo)': productOpenUrl(item.url),
      'URL produktu B2B': item.url,
      'Liczba zdjęć': item.images.length,
      Producent: item.attributes.Producent || '',
      Marka: item.attributes.Marka || '',
      Jednostka: item.attributes.Jednostka || ''
    };
    for (let index = 0; index < maxImages; index += 1) row[`URL zdjęcia ${index + 1}`] = item.images[index] || '';
    return row;
  });
}
function formatOfferSheet(sheet, headerRow) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const productLinks = new Map([
    ['Otwórz produkt (demo)', { label: 'Otwórz produkt', tooltip: 'Otwórz demonstracyjny podgląd produktu' }],
    ['URL produktu B2B', { label: 'Karta w B2B', tooltip: 'Otwórz oryginalną kartę produktu w Netinet B2B' }]
  ]);
  const columns = new Map();
  sheet['!cols'] ??= [];

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const header = sheet[XLSX.utils.encode_cell({ r: headerRow, c: column })]?.v || '';
    const photoNumber = /^URL zdjęcia (\d+)$/.exec(header)?.[1];
    const link = photoNumber ? { label: `Zdjęcie ${photoNumber}`, tooltip: 'Otwórz zdjęcie produktu' } : productLinks.get(header);
    const numericIdentifier = header === 'ID' || header === 'EAN';
    columns.set(column, { header, link, numericIdentifier });
    if (numericIdentifier) sheet['!cols'][column] = { wch: 17 };
    if (link) sheet['!cols'][column] = { wch: Math.max(16, header.length + 3) };
  }
  for (let row = headerRow + 1; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const { header, link, numericIdentifier } = columns.get(column);
      if (!cell) continue;
      if (header === 'Cena' && cell.t === 'n') cell.z = '#,##0.00" zł"';
      if (typeof cell.v !== 'string') continue;
      if (numericIdentifier && /^\d{1,15}$/.test(cell.v)) {
        // Preserve the displayed digits within Excel's 15-digit precision limit.
        cell.z = '0'.repeat(cell.v.length);
        cell.v = Number(cell.v);
        cell.t = 'n';
      } else if (link && /^https?:\/\//i.test(cell.v)) {
        cell.l = { Target: cell.v, Tooltip: link.tooltip };
        cell.v = link.label;
      }
    }
  }
}
function createOfferSheet(rows) {
  const instructions = [
    ['Jak otwierać produkty z oferty Netinet'],
    ['Kliknij link "Otwórz produkt" w tabeli poniżej.'],
    ['Generator zaloguje Cię automatycznie do publicznego konta demonstracyjnego i otworzy oryginalną kartę produktu.'],
    [],
    ['Logowanie ręczne'],
    ['Adres', 'https://b2b.netinet.pl'],
    ['Login', 'demo@netinet.pl'],
    ['Hasło', 'b2bdemo'],
    ['Jeżeli automatyczne wejście nie zadziała, otwórz powyższy adres, zaloguj się podanymi danymi i ponownie kliknij link produktu.'],
    []
  ];
  const sheet = XLSX.utils.aoa_to_sheet(instructions);
  sheet['!merges'] = ['A1:L1', 'A2:L2', 'A3:L3', 'A5:L5', 'B6:E6', 'B7:E7', 'B8:E8', 'A9:L9']
    .map((range) => XLSX.utils.decode_range(range));
  const loginLink = { Target: sheet.B6.v, Tooltip: 'Otwórz stronę logowania Netinet' };
  sheet.A6.l = loginLink;
  sheet.B6.l = loginLink;

  const headerRow = instructions.length;
  XLSX.utils.sheet_add_json(sheet, rows, { origin: headerRow });
  formatOfferSheet(sheet, headerRow);
  return sheet;
}
function exportFile(type) {
  const productsToExport = state.selectedProducts.size ? state.products.filter((item) => state.selectedProducts.has(item.key)) : state.filtered;
  if (!productsToExport.length) return setStatus('Brak danych do eksportu', 'error');
  const sheet = createOfferSheet(exportRows(productsToExport));
  if (type === 'xls' && XLSX.utils.decode_range(sheet['!ref']).e.r >= 65536) {
    return setStatus('Oferta z instrukcją przekracza limit wierszy XLS. Wybierz XLSX lub zawęź wyniki.', 'error');
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Oferta');
  const stamp = new Date().toISOString().replace(/[T:.Z]/g, '-').replace(/-+$/, '');
  XLSX.writeFile(workbook, `oferta-podglad-demo-${stamp}.${type}`, { bookType: type, cellStyles: true });
}
function productsForExport() {
  return state.selectedProducts.size ? state.products.filter((item) => state.selectedProducts.has(item.key)) : state.filtered;
}
async function printOffer() {
  const products = productsForExport();
  if (!products.length) return setStatus('Brak danych do wydruku', 'error');
  const printTab = window.open('', '_blank');
  if (!printTab) return setStatus('Przeglądarka zablokowała okno wydruku. Zezwól na wyskakujące okna i spróbuj ponownie.', 'error');
  printTab.opener = null;
  printTab.document.open();
  printTab.document.write(buildPrintOfferHtml({ products, publicAppUrl: state.publicAppUrl || window.location.origin, sourceUrl: state.loadedUrl || state.defaultUrl }));
  printTab.document.close();
  const triggerPrint = () => { if (!printTab.closed) { printTab.focus(); printTab.print(); } };
  printTab.document.getElementById('print-now')?.addEventListener('click', triggerPrint);
  const images = [...printTab.document.images];
  const settleImage = (image) => new Promise((resolve) => {
    const showFallback = () => {
      const fallback = printTab.document.createElement('span');
      fallback.className = 'no-image';
      fallback.textContent = 'brak';
      image.replaceWith(fallback);
      resolve();
    };
    if (image.complete) return image.naturalWidth ? resolve() : showFallback();
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', showFallback, { once: true });
  });
  await Promise.race([
    Promise.all(images.map(settleImage)),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  if (printTab.document.fonts?.ready) await printTab.document.fonts.ready;
  setStatus(`Przygotowano widok PDF dla ${products.length.toLocaleString('pl-PL')} produktów`, 'success');
  triggerPrint();
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
    const categoryCount = uniqueCategories(state.products).length;
    elements.loadedUrl.textContent = new URL(state.loadedUrl).hostname; elements.welcomeGuide?.classList.add('hidden'); elements.results.classList.remove('hidden'); renderFilterFieldOptions(); renderActiveFilters(); applyFilters();
    animateCounter(elements.productCount, state.products.length); animateCounter(elements.visibleCount, state.filtered.length); animateCounter(elements.categoryCount, categoryCount);
    setStatus(`Wczytano ${state.products.length.toLocaleString('pl-PL')} produktów`, 'success');
  } catch (error) { setStatus(error.message || 'Wystąpił błąd', 'error'); } finally { elements.load.disabled = false; }
}
elements.load.addEventListener('click', loadXml);
elements.tipPrev?.addEventListener('click', () => changeWelcomeTip(-1));
elements.tipNext?.addEventListener('click', () => changeWelcomeTip(1));
elements.url.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadXml(); });
elements.search.addEventListener('input', applyFilters);
elements.filterField.addEventListener('change', updateAddFilterButton);
elements.addFilter.addEventListener('click', addFilter);
elements.clearFilters.addEventListener('click', clearFilters);
elements.activeFilters.addEventListener('input', (event) => { if (event.target.matches('[data-filter-value]')) { state.activeFilters.set(event.target.dataset.filterKey, event.target.value); applyFilters(); } });
elements.activeFilters.addEventListener('change', (event) => { if (event.target.matches('[data-filter-value]')) { state.activeFilters.set(event.target.dataset.filterKey, event.target.value); applyFilters(); } });
elements.activeFilters.addEventListener('click', (event) => { const button = event.target.closest('[data-remove-filter]'); if (!button) return; state.activeFilters.delete(button.dataset.removeFilter); renderFilterFieldOptions(); renderActiveFilters(); applyFilters(); });
elements.rows.addEventListener('change', (event) => { const checkbox = event.target.closest('[data-product-key]'); if (!checkbox) return; if (checkbox.checked) state.selectedProducts.add(checkbox.dataset.productKey); else state.selectedProducts.delete(checkbox.dataset.productKey); updateSelectionUi(); });
elements.selectVisible.addEventListener('change', () => { state.filtered.slice(0, 250).forEach((item) => { if (elements.selectVisible.checked) state.selectedProducts.add(item.key); else state.selectedProducts.delete(item.key); }); renderRows(); });
elements.selectionSummary.addEventListener('click', (event) => { if (!event.target.closest('#clear-selection-button')) return; state.selectedProducts.clear(); renderRows(); });
elements.xlsx.addEventListener('click', () => exportFile('xlsx'));
elements.xls.addEventListener('click', () => exportFile('xls'));
elements.pdf.addEventListener('click', printOffer);
fetch('/api/config').then((response) => response.json()).then((config) => { state.defaultUrl = config.defaultUrl; state.publicAppUrl = config.publicAppUrl || window.location.origin; elements.url.value = config.defaultUrl; }).catch(() => { state.publicAppUrl = window.location.origin; elements.url.value = 'https://b2b.netinet.pl/xmlg/22lxnanobig.xml'; });
