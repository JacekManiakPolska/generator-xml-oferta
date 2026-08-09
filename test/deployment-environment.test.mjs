import assert from "node:assert/strict";
import test from "node:test";

const worker = (await import("../src/worker.js")).default;

test("XML download reports a configuration error when the environment flag is missing", async () => {
  const originalError = console.error;
  const messages = [];
  console.error = (message) => messages.push(message);

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/fetch-xml"),
      { ASSETS: { fetch: () => new Response("asset") } }
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Brak zmiennej XML_FETCH_ENABLED w środowisku uruchomieniowym."
    });
    assert.deepEqual(messages, ["deployment_configuration_error: missing XML_FETCH_ENABLED=true"]);
  } finally {
    console.error = originalError;
  }
});

test("XML download proceeds when the environment flag is configured", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<products />", {
    status: 200,
    headers: { "Content-Type": "application/xml" }
  });

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/fetch-xml?url=https%3A%2F%2Ffeed.example%2Fproducts.xml"),
      {
        XML_FETCH_ENABLED: "true",
        ASSETS: { fetch: () => new Response("asset") }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<products />");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
