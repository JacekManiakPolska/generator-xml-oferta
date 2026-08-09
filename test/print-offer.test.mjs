import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrintOfferHtml } from "../public/print-offer.js";

const product = {
  id: "35",
  url: "https://b2b.netinet.pl/wtyki-gniazda-adaptery/35-adapter.html",
  price: "3.36",
  stock: "11",
  category: "wtyki / gniazda / adaptery",
  name: "Adapter RJ45 <script>alert(1)</script>",
  images: ["https://b2b.netinet.pl/adapter.jpg"],
  attributes: { "Kod Produktu": "EFB_028152", EAN: "4049759028152" }
};

test("print view keeps the current offer fields and a working demo product link", () => {
  const html = buildPrintOfferHtml({
    products: [product],
    publicAppUrl: "https://generator-xml-oferta.admprocpu.workers.dev",
    sourceUrl: "https://b2b.netinet.pl/xmlg/demo.xml",
    generatedAt: new Date("2026-08-07T08:30:00Z")
  });

  assert.match(html, /Oferta produktowa/);
  assert.match(html, /EFB_028152/);
  assert.match(html, /4049759028152/);
  assert.match(html, /open-product\?target=https%3A%2F%2Fb2b\.netinet\.pl%2Fwtyki-gniazda-adaptery%2F35-adapter\.html/);
  assert.match(html, /@page \{ size: A4 portrait;/);
  assert.match(html, /th:nth-child\(8\) \{ width: 25mm; \}/);
  assert.doesNotMatch(html, /class="stats"/);
  assert.doesNotMatch(html, /Podsumowanie oferty/);
  assert.match(html, /Serwis Netinet może zapisać niezbędny plik cookie/);
});

test("print view escapes product data and rejects unsafe image protocols", () => {
  const html = buildPrintOfferHtml({ products: [{ ...product, images: ["javascript:alert(1)"] }], publicAppUrl: "https://generator.example.test" });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /Adapter RJ45 &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /src="javascript:/);
});

test("print view does not request images from local, private or unapproved hosts", () => {
  const products = [
    { ...product, id: "local", images: ["http://127.0.0.1/admin"] },
    { ...product, id: "private", images: ["http://192.168.1.1/router.png"] },
    { ...product, id: "lookalike", images: ["https://b2b.netinet.pl.evil.example/image.jpg"] },
    { ...product, id: "approved", images: ["https://b2b.netinet.pl/adapter.jpg"] }
  ];
  const html = buildPrintOfferHtml({ products, publicAppUrl: "https://generator.example.test" });

  assert.doesNotMatch(html, /127\.0\.0\.1|192\.168\.1\.1|b2b\.netinet\.pl\.evil/);
  assert.match(html, /src="https:\/\/b2b\.netinet\.pl\/adapter\.jpg"/);
});
