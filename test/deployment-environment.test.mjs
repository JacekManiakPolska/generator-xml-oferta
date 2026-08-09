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

test("XML download never exposes an upstream HTML content type", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<script>globalThis.compromised = true</script>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/fetch-xml?url=https%3A%2F%2Fattacker.example%2Fpayload"),
      {
        XML_FETCH_ENABLED: "true",
        ASSETS: { fetch: () => new Response("asset") }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("XML download stops a streamed body after the real 50 MB limit", async () => {
  const originalFetch = globalThis.fetch;
  const oneMegabyte = new Uint8Array(1024 * 1024);
  let chunkNumber = 0;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) {
      chunkNumber += 1;
      controller.enqueue(chunkNumber <= 50 ? oneMegabyte : new Uint8Array(1));
      if (chunkNumber === 51) controller.close();
    }
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": "1"
    }
  });

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/fetch-xml?url=https%3A%2F%2Ffeed.example%2Fchunked.xml"),
      {
        XML_FETCH_ENABLED: "true",
        ASSETS: { fetch: () => new Response("asset") }
      }
    );
    const reader = response.body.getReader();
    let receivedBytes = 0;
    let streamError;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
      }
    } catch (error) {
      streamError = error;
    }

    assert.equal(receivedBytes, 50 * 1024 * 1024);
    assert.match(String(streamError), /limit 50 MB/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("XML download cancels a body declared above 50 MB before reading it", async () => {
  const originalFetch = globalThis.fetch;
  let canceled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    cancel() {
      canceled = true;
    }
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": String(50 * 1024 * 1024 + 1)
    }
  });

  try {
    const response = await worker.fetch(
      new Request("https://example.test/api/fetch-xml?url=https%3A%2F%2Ffeed.example%2Ftoo-large.xml"),
      {
        XML_FETCH_ENABLED: "true",
        ASSETS: { fetch: () => new Response("asset") }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Plik XML przekracza limit 50 MB." });
    assert.equal(canceled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
