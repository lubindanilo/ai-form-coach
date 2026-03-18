/**
 * Appels API avec credentials pour envoyer les cookies HttpOnly (JWT).
 */
const RAW_API_BASE = import.meta.env?.VITE_API_BASE_URL || "";
const API_BASE = typeof RAW_API_BASE === "string" ? RAW_API_BASE.replace(/\/+$/, "") : "";

export function resolveApiUrl(url) {
  if (typeof url !== "string") return url;
  // Absolute URL: leave as-is
  if (/^https?:\/\//i.test(url)) return url;
  // Relative API path: optionally prefix with VITE_API_BASE_URL
  if (API_BASE && url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export async function apiFetch(url, options = {}) {
  const resolved = resolveApiUrl(url);
  const res = await fetch(resolved, { ...options, credentials: "include" });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
