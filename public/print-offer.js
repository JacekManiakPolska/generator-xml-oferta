function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function productOpenUrl(productUrl, publicAppUrl) {
  const target = safeHttpUrl(productUrl);
  const base = safeHttpUrl(publicAppUrl);
  if (!target || !base) return '';
  return `${base.replace(/\/$/, '')}/open-product?target=${encodeURIComponent(target)}`;
}

function productRows(products, publicAppUrl) {
  return products.map((product) => {
    const imageUrl = safeHttpUrl(product.images?.[0]);
    const demoUrl = productOpenUrl(product.url, publicAppUrl);
    const name = escapeHtml(product.name || 'Bez nazwy');
    const nameCell = demoUrl ? `<a href="${escapeHtml(demoUrl)}" target="_blank" rel="noopener">${name} <span aria-hidden="true">&#8599;</span></a>` : name;
    return `<tr>
      <td class="image-cell">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : '<span class="no-image">brak</span>'}</td>
      <td>${escapeHtml(product.attributes?.MPN)}</td>
      <td class="name-cell">${nameCell}</td>
      <td>${escapeHtml(product.category)}</td>
      <td class="numeric">${escapeHtml(product.price)}</td>
      <td class="numeric">${escapeHtml(product.stock)}</td>
      <td>${escapeHtml(product.attributes?.EAN)}</td>
    </tr>`;
  }).join('');
}

export function buildPrintOfferHtml({ products, publicAppUrl, sourceUrl = '', generatedAt = new Date() }) {
  const generatedLabel = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(generatedAt);
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Oferta produktowa - ${escapeHtml(generatedLabel)}</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #09090b; background: #dcefff; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at 12% 8%, rgba(255,255,255,.95), transparent 34rem), linear-gradient(135deg, #eaf7ff, #c4e1ff); }
    .toolbar { position: sticky; z-index: 5; top: 0; display: flex; justify-content: center; padding: 12px; background: rgba(13,13,16,.94); }
    .toolbar button { min-height: 42px; padding: 0 20px; border: 0; border-radius: 3px; color: #fff; background: #372aac; font: inherit; font-weight: 800; cursor: pointer; }
    .page { width: min(1440px, calc(100% - 40px)); margin: 0 auto; padding: 38px 0 56px; }
    .hero { margin-bottom: 22px; }
    .eyebrow { margin: 0 0 6px; color: #372aac; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font-size: 38px; line-height: 1.04; letter-spacing: -.045em; }
    .lead { margin: 0; color: #625f68; font-size: 14px; }
    .cookie-note { margin: 0 0 15px; padding: 11px 13px; border-left: 3px solid #372aac; color: #4d4954; background: #f4f3f8; font-size: 10px; line-height: 1.45; }
    .cookie-note strong { color: #201a63; }
    .panel { overflow: hidden; border: 1px solid rgba(9,9,11,.13); border-radius: 13px; background: #fff; box-shadow: 0 18px 52px rgba(9,9,11,.07); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
    thead { display: table-header-group; }
    th { padding: 9px 8px; color: #514d59; background: #f4f3f8; font-size: 8px; text-align: left; text-transform: uppercase; letter-spacing: .06em; }
    td { padding: 8px; border-top: 1px solid rgba(9,9,11,.08); vertical-align: middle; overflow-wrap: anywhere; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th:nth-child(1) { width: 11mm; } th:nth-child(2) { width: 28mm; } th:nth-child(4) { width: 27mm; } th:nth-child(5) { width: 15mm; } th:nth-child(6) { width: 10mm; } th:nth-child(7) { width: 25mm; }
    .image-cell { text-align: center; }
    .image-cell img { width: 38px; height: 38px; object-fit: contain; border-radius: 7px; background: #f2f1fa; }
    .no-image { color: #77717f; font-size: 8px; }
    .name-cell { color: #201a63; font-weight: 750; }
    a { color: #2e247e; text-decoration-color: rgba(46,36,126,.35); text-underline-offset: 2px; }
    .numeric { text-align: right; font-variant-numeric: tabular-nums; }
    .footer-note { margin: 10px 2px 0; color: #625f68; font-size: 9px; }
    @page { size: A4 portrait; margin: 7mm; }
    @media print {
      html, body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .toolbar { display: none !important; }
      .page { width: 100%; margin: 0; padding: 0; }
      .hero { margin-bottom: 3mm; }
      .eyebrow { margin-bottom: 1mm; font-size: 7pt; }
      h1 { margin-bottom: 1mm; font-size: 20pt; }
      .lead { font-size: 8pt; }
      .cookie-note { margin-bottom: 3mm; padding: 2.5mm 3mm; font-size: 6.5pt; line-height: 1.35; }
      .panel { box-shadow: none; }
      table { font-size: 6.5pt; }
      th { padding: 1.8mm 1.2mm; font-size: 5.5pt; letter-spacing: .03em; }
      td { padding: 1.5mm 1.2mm; }
      .image-cell img { width: 9mm; height: 9mm; border-radius: 1.5mm; }
      .no-image { font-size: 5.5pt; }
      .footer-note { margin-top: 2mm; font-size: 6pt; }
      a { color: #2e247e !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button id="print-now" type="button">Drukuj / Zapisz jako PDF</button></div>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">Generator oferty</p>
      <h1>Oferta produktowa</h1>
      <p class="lead">Widok produktów przygotowany ${escapeHtml(generatedLabel)}.</p>
    </header>
    <p class="cookie-note"><strong>Informacja:</strong> Kliknięcie nazwy produktu powoduje przejście do serwisu b2b.netinet.pl i automatyczne zalogowanie na publiczne konto demonstracyjne. Serwis Netinet może zapisać niezbędny plik cookie służący do utrzymania sesji użytkownika.</p>
    <section class="panel">
      <table>
        <thead><tr><th>Zdjęcie</th><th>Part Number</th><th>Nazwa</th><th>Kategoria</th><th>Cena</th><th>Stan</th><th>EAN</th></tr></thead>
        <tbody>${productRows(products, publicAppUrl)}</tbody>
      </table>
    </section>
    <p class="footer-note">Kliknięcie nazwy produktu otwiera publiczny podgląd demonstracyjny Netinet.</p>
  </main>
</body>
</html>`;
}
