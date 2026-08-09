const APPROVED_IMAGE_ORIGIN = "https://b2b.netinet.pl";

export function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.origin !== APPROVED_IMAGE_ORIGIN || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}
