import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_XML_URL = "https://b2b.netinet.pl/xmlg/22lxnanobig.xml";
const NETINET_ORIGIN = "https://b2b.netinet.pl";
const NETINET_DEMO_EMAIL = process.env.NETINET_DEMO_EMAIL || "demo@netinet.pl";
const NETINET_DEMO_PASSWORD = process.env.NETINET_DEMO_PASSWORD || "b2bdemo";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const MAX_XML_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase();
  const mappedIpv4 = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mappedIpv4 && isPrivateIpv4(mappedIpv4[1])) || value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
}

async function assertSafeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Nieprawidłowy adres URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Dozwolone są wyłącznie adresy HTTP i HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Adres lokalny nie jest dozwolony.");
  if (net.isIP(hostname)) {
    if ((net.isIPv4(hostname) && isPrivateIpv4(hostname)) || (net.isIPv6(hostname) && isPrivateIpv6(hostname))) throw new Error("Prywatne adresy sieciowe nie są dozwolone.");
  } else {
    const records = await dns.lookup(hostname, { all: true });
    if (records.some(({ address }) => (net.isIPv4(address) && isPrivateIpv4(address)) || (net.isIPv6(address) && isPrivateIpv6(address)))) throw new Error("Adres wskazuje na prywatną sieć i nie jest dozwolony.");
  }
  return url;
}

async function readResponse(response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_XML_BYTES) throw new Error("Plik XML przekracza limit 50 MB.");
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_XML_BYTES) { await reader.cancel(); throw new Error("Plik XML przekracza limit 50 MB."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchXml(value) {
  let current = await assertSafeUrl(value);
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(45_000) });
    if (response.status >= 300 && response.status < 400) {
      if (attempt === MAX_REDIRECTS) throw new Error("Zbyt wiele przekierowań.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Źródło zwróciło niepełne przekierowanie.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Źródło XML zwróciło HTTP ${response.status}.`);
    return { text: await readResponse(response), finalUrl: current.toString() };
  }
  throw new Error("Nie udało się pobrać XML.");
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(body);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function assertDemoCredentials() {
  if (!NETINET_DEMO_EMAIL || !NETINET_DEMO_PASSWORD) {
    throw new Error("Brak lokalnej konfiguracji konta demo dla podglądu produktu.");
  }
}

function createProductOpenPage(value) {
  assertDemoCredentials();
  const target = getProductUrl(value);
  const back = `${target.pathname}${target.search}${target.hash}`;
  const loginUrl = `${NETINET_ORIGIN}/logowanie?back=${encodeURIComponent(back)}`;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Otwieranie produktu…</title></head><body><p>Logowanie do publicznej oferty demonstracyjnej Netinet…</p><form id="demo-login" action="${escapeHtml(loginUrl)}" method="post"><input type="hidden" name="email" value="${escapeHtml(NETINET_DEMO_EMAIL)}"><input type="hidden" name="password" value="${escapeHtml(NETINET_DEMO_PASSWORD)}"><input type="hidden" name="submitLogin" value="1"><input type="hidden" name="back" value="${escapeHtml(back)}"><noscript><button type="submit">Zaloguj i otwórz produkt</button></noscript></form><script>document.getElementById('demo-login').submit();</script></body></html>`;
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

function prepareProductPreview(html, target) {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<base\b[^>]*>/gi, "");
  const base = `<base href="${escapeHtml(`${NETINET_ORIGIN}/`)}">`;
  const banner = `<div style="position:sticky;top:0;z-index:99999;padding:10px 16px;background:#1f6feb;color:#fff;font:600 14px system-ui">Podgląd produktu z publicznej oferty demo Netinet</div>`;
  if (/<head\b[^>]*>/i.test(withoutScripts)) return withoutScripts.replace(/<head\b[^>]*>/i, (head) => `${head}${base}`).replace(/<body\b[^>]*>/i, (body) => `${body}${banner}`);
  return `<!doctype html><html><head><meta charset="utf-8">${base}<title>Podgląd produktu</title></head><body>${banner}${withoutScripts}</body></html>`;
}

async function fetchProductPreview(value) {
  assertDemoCredentials();
  const target = getProductUrl(value);
  const loginBody = new URLSearchParams({ email: NETINET_DEMO_EMAIL, password: NETINET_DEMO_PASSWORD, submitLogin: "1" });
  const loginResponse = await fetch(`${NETINET_ORIGIN}/logowanie`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: loginBody, redirect: "manual", signal: AbortSignal.timeout(20_000) });
  const cookieHeader = getCookieHeader(loginResponse);
  if (!cookieHeader) throw new Error("Nie udało się utworzyć sesji oferty demo.");
  const productResponse = await fetch(target, { headers: { Cookie: cookieHeader }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
  if (!productResponse.ok) throw new Error(`Produkt zwrócił HTTP ${productResponse.status}.`);
  return prepareProductPreview(await productResponse.text(), target);
}

async function serveStatic(res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) return send(res, 403, "Forbidden");
  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
    send(res, 200, body, types[ext] || "application/octet-stream");
  } catch { send(res, 404, "Not found"); }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (requestUrl.pathname === "/api/config") return send(res, 200, JSON.stringify({ defaultUrl: DEFAULT_XML_URL, googleClientId: GOOGLE_CLIENT_ID }), "application/json; charset=utf-8");
    if (requestUrl.pathname === "/api/fetch-xml") {
      const source = requestUrl.searchParams.get("url") || DEFAULT_XML_URL;
      return send(res, 200, JSON.stringify(await fetchXml(source)), "application/json; charset=utf-8");
    }
    if (requestUrl.pathname === "/open-product") {
      return send(res, 200, createProductOpenPage(requestUrl.searchParams.get("target") || ""), "text/html; charset=utf-8");
    }
    if (requestUrl.pathname === "/product-preview") {
      return send(res, 200, await fetchProductPreview(requestUrl.searchParams.get("target") || ""), "text/html; charset=utf-8");
    }
    return serveStatic(res, requestUrl.pathname);
  } catch (error) {
    return send(res, 400, JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd." }), "application/json; charset=utf-8");
  }
});

server.listen(PORT, () => console.log(`Generator XML działa na http://localhost:${PORT}`));

export { server };
