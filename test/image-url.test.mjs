import assert from "node:assert/strict";
import { test } from "node:test";
import { safeImageUrl } from "../public/image-url.js";

test("image URL validation allows only the approved Netinet HTTPS origin", () => {
  assert.equal(safeImageUrl("https://b2b.netinet.pl/images/product.jpg"), "https://b2b.netinet.pl/images/product.jpg");

  for (const unsafeUrl of [
    "http://127.0.0.1/admin",
    "http://[::1]/admin",
    "http://192.168.1.1/router.png",
    "https://localhost/image.jpg",
    "https://b2b.netinet.pl.evil.example/image.jpg",
    "https://user:password@b2b.netinet.pl/image.jpg",
    "data:image/svg+xml,<svg onload=alert(1)></svg>",
    "javascript:alert(1)",
    "//b2b.netinet.pl/image.jpg"
  ]) {
    assert.equal(safeImageUrl(unsafeUrl), "", unsafeUrl);
  }
});
