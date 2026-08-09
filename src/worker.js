const DEFAULT_XML_URL = "https://b2b.netinet.pl/xmlg/22lxnanobig.xml";
const NETINET_ORIGIN = "https://b2b.netinet.pl";
const NETINET_DEMO_EMAIL = "demo@netinet.pl";
const NETINET_DEMO_PASSWORD = "b2bdemo";
const MAX_XML_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const XML_FETCH_TIMEOUT_MS = 45_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase();
  const mappedIpv4 = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mappedIpv4 && isPrivateIpv4(mappedIpv4[1])) || value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
}

function isIpAddress(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function assertSafeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Nieprawidłowy adres URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Dozwolone są wyłącznie adresy HTTP i HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Adres lokalny nie jest dozwolony.");
  if (isIpAddress(hostname) && (isPrivateIpv4(hostname) || isPrivateIpv6(hostname))) throw new Error("Prywatne adresy sieciowe nie są dozwolone.");
  return url;
}

function limitResponseBody(body, maxBytes) {
  if (!body) return null;
  const reader = body.getReader();
  let receivedBytes = 0;

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        receivedBytes += value.byteLength;
        if (receivedBytes > maxBytes) {
          await reader.cancel("XML response exceeded the configured byte limit.");
          controller.error(new Error("Plik XML przekracza limit 50 MB."));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
}

async function fetchXml(value) {
  let current = assertSafeUrl(value);
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(current.toString(), { redirect: "manual", signal: AbortSignal.timeout(XML_FETCH_TIMEOUT_MS) });
    if (response.status >= 300 && response.status < 400) {
      if (attempt === MAX_REDIRECTS) throw new Error("Zbyt wiele przekierowań.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Źródło zwróciło niepełne przekierowanie.");
      current = assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Źródło XML zwróciło HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_XML_BYTES) {
      await response.body?.cancel("XML response declared a body above the configured byte limit.");
      throw new Error("Plik XML przekracza limit 50 MB.");
    }
    return new Response(limitResponseBody(response.body, MAX_XML_BYTES), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": "attachment; filename=offer.xml",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "X-Source-Url": current.toString()
      }
    });
  }
  throw new Error("Nie udało się pobrać XML.");
}

function getProductUrl(value) {
  let target;
  try { target = new URL(value); } catch { throw new Error("Nieprawidłowy adres produktu."); }
  if (target.origin !== NETINET_ORIGIN || !target.pathname.endsWith(".html")) throw new Error("Można otwierać wyłącznie strony produktów z b2b.netinet.pl.");
  return target;
}

function getCookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  const cookieJar = new Map();
  for (const cookie of cookies) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookieJar.set(pair.slice(0, separator), pair);
  }
  return [...cookieJar.values()].join("; ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function createProductOpenPage(value) {
  const target = getProductUrl(value);
  const back = target.toString();
  const loginUrl = `${NETINET_ORIGIN}/logowanie`;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Otwieranie produktu…</title></head><body><p>Logowanie do publicznej oferty demonstracyjnej Netinet…</p><form id="demo-login" action="${escapeHtml(loginUrl)}" method="post"><input type="hidden" name="email" value="${escapeHtml(NETINET_DEMO_EMAIL)}"><input type="hidden" name="password" value="${escapeHtml(NETINET_DEMO_PASSWORD)}"><input type="hidden" name="submitLogin" value="1"><input type="hidden" name="back" value="${escapeHtml(back)}"><noscript><button type="submit">Zaloguj i otwórz produkt</button></noscript></form><script>document.getElementById('demo-login').submit();</script></body></html>`;
}

function prepareProductPreview(html) {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<base\b[^>]*>/gi, "");
  const base = `<base href="${NETINET_ORIGIN}/">`;
  const banner = '<div style="position:sticky;top:0;z-index:99999;padding:10px 16px;background:#372aac;color:#fff;font:600 14px system-ui">Podgląd produktu z publicznej oferty demo Netinet</div>';
  if (/<head\b[^>]*>/i.test(withoutScripts)) return withoutScripts.replace(/<head\b[^>]*>/i, (head) => `${head}${base}`).replace(/<body\b[^>]*>/i, (body) => `${body}${banner}`);
  return `<!doctype html><html><head><meta charset="utf-8">${base}<title>Podgląd produktu</title></head><body>${banner}${withoutScripts}</body></html>`;
}

async function fetchProductPreview(value, env) {
  if (!env.NETINET_DEMO_EMAIL || !env.NETINET_DEMO_PASSWORD) throw new Error("Brak konfiguracji konta demo dla podglądu produktu.");
  const target = getProductUrl(value);
  const loginBody = new URLSearchParams({ email: env.NETINET_DEMO_EMAIL, password: env.NETINET_DEMO_PASSWORD, submitLogin: "1" });
  const loginResponse = await fetch(`${NETINET_ORIGIN}/logowanie`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: loginBody, redirect: "manual" });
  const cookieHeader = getCookieHeader(loginResponse);
  if (!cookieHeader) throw new Error("Nie udało się utworzyć sesji oferty demo.");
  const productResponse = await fetch(target.toString(), { headers: { Cookie: cookieHeader }, redirect: "manual" });
  if (!productResponse.ok) throw new Error(`Produkt zwrócił HTTP ${productResponse.status}.`);
  return prepareProductPreview(await productResponse.text());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/config") return json({ defaultUrl: env.DEFAULT_XML_URL || DEFAULT_XML_URL, googleClientId: env.GOOGLE_CLIENT_ID || "", publicAppUrl: env.PUBLIC_APP_URL || url.origin });
      if (url.pathname === "/api/fetch-xml") {
        if (env.XML_FETCH_ENABLED !== "true") {
          console.error("deployment_configuration_error: missing XML_FETCH_ENABLED=true");
          return json({ error: "Brak zmiennej XML_FETCH_ENABLED w środowisku uruchomieniowym." }, 500);
        }
        return await fetchXml(url.searchParams.get("url") || env.DEFAULT_XML_URL || DEFAULT_XML_URL);
      }
      if (url.pathname === "/open-product") return new Response(createProductOpenPage(url.searchParams.get("target") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      if (url.pathname === "/product-preview") return new Response(await fetchProductPreview(url.searchParams.get("target") || "", env), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nieznany błąd.";
      return url.pathname.startsWith("/api/") ? json({ error: message }, 400) : new Response(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }
};
