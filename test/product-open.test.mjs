import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const PRODUCT_URL = "https://b2b.netinet.pl/wycofane-z-oferty/21-sluchawki-discover-pink-4029599095620.html";

process.env.PORT = "0";
process.env.PUBLIC_APP_URL = "https://generator.example.test";

const { server } = await import("../server.mjs");
const worker = (await import("../src/worker.js")).default;

before(async () => {
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
});

after(async () => {
  if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("local server listens only on the user's computer", () => {
  const address = server.address();

  assert.equal(address.address, "127.0.0.1");
});

test("local server sends the full product URL as the post-login destination", async () => {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/open-product?target=${encodeURIComponent(PRODUCT_URL)}`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /action="https:\/\/b2b\.netinet\.pl\/logowanie"/);
  assert.match(html, new RegExp(`name="back" value="${PRODUCT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("worker sends the full product URL as the post-login destination", async () => {
  const request = new Request(`https://generator.example.test/open-product?target=${encodeURIComponent(PRODUCT_URL)}`);
  const response = await worker.fetch(request, { ASSETS: { fetch: () => new Response("asset") } });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, new RegExp(`name="back" value="${PRODUCT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("config exposes a durable public URL for links generated locally", async () => {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/config`);
  const config = await response.json();

  assert.equal(config.publicAppUrl, "https://generator.example.test");
});

test("foreign product hosts remain blocked", async () => {
  const request = new Request("https://generator.example.test/open-product?target=https%3A%2F%2Fexample.com%2Fproduct.html");
  const response = await worker.fetch(request, { ASSETS: { fetch: () => new Response("asset") } });

  assert.equal(response.status, 400);
});
