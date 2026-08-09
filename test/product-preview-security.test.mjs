import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/worker.js";

test("product preview is isolated by a restrictive sandbox policy", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/logowanie")) {
      return new Response("", { status: 302, headers: { "Set-Cookie": "session=demo; Path=/" } });
    }
    return new Response('<html><head></head><body><img src="x" onerror="alert(document.cookie)"><svg onload="alert(1)"></svg></body></html>');
  };

  try {
    const response = await worker.fetch(
      new Request("https://generator.example.test/product-preview?target=https%3A%2F%2Fb2b.netinet.pl%2Fproduct.html"),
      { NETINET_DEMO_EMAIL: "demo@example.test", NETINET_DEMO_PASSWORD: "secret" }
    );

    assert.equal(response.status, 200);
    const policy = response.headers.get("content-security-policy") || "";
    assert.match(policy, /(?:^|;)\s*sandbox(?:;|$)/);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'none'/);
    assert.match(policy, /form-action 'none'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
