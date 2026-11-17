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
  attributes: { "Kod Produktu": "EFB_028152", MPN: "028152", EAN: "4049759028152" }
};

test("print view keeps the current offer fields and a working demo product link", () => {
  const html = buildPrintOfferHtml({
    products: [product],
    publicAppUrl: "https://generator-xml-oferta.admprocpu.workers.dev",
    sourceUrl: "https://b2b.netinet.pl/xmlg/demo.xml",
    generatedAt: new Date("2026-08-07T08:30:00Z")
  });

  assert.match(html, /Oferta produktowa/);
  assert.deepEqual([...html.matchAll(/<th>([^<]+)<\/th>/g)].map((match) => match[1]),
    ["Zdjęcie", "Part Number", "Nazwa", "Kategoria", "Cena", "Stan", "EAN"]);
  assert.match(html, /<td>028152<\/td>/);
  assert.doesNotMatch(html, /<td>35<\/td>|EFB_028152/);
  assert.match(html, /4049759028152/);
  assert.match(html, /<td class="numeric">3,36\u00a0zł<\/td>/);
  assert.match(html, /open-product\?target=https%3A%2F%2Fb2b\.netinet\.pl%2Fwtyki-gniazda-adaptery%2F35-adapter\.html/);
  assert.match(html, /@page \{ size: A4 portrait;/);
  assert.match(html, /th:nth-child\(7\) \{ width: 25mm; \}/);
  assert.doesNotMatch(html, /class="stats"/);
  assert.doesNotMatch(html, /Podsumowanie oferty/);
  assert.match(html, /Serwis Netinet może zapisać niezbędny plik cookie/);
});

test("print view formats a zero price and leaves a missing price empty", () => {
  const html = buildPrintOfferHtml({ products: [{ ...product, price: "0" }, { ...product, price: "" }] });

  assert.match(html, /<td class="numeric">0,00\u00a0zł<\/td>/);
  assert.match(html, /<td class="numeric"><\/td>/);
});

test("print view escapes product data and rejects unsafe image protocols", () => {
  const html = buildPrintOfferHtml({ products: [{ ...product, images: ["javascript:alert(1)"] }], publicAppUrl: "https://generator.example.test" });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /Adapter RJ45 &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /src="javascript:/);
});
