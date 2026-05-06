const SEARCH_URL = "https://duckduckgo.com/?q=";

export function createTabId() {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWebviewLabel(tabId: string) {
  return `horalix_${tabId.replace(/[^a-zA-Z0-9_:-]/g, "_")}`;
}

export function resolveNavigationInput(input: string) {
  const value = input.trim();

  if (!value) {
    return "https://duckduckgo.com/";
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "about:") {
      return url.href;
    }
  } catch {
    // Fall through to host/search handling.
  }

  if (looksLikeHost(value)) {
    return `https://${value}`;
  }

  return `${SEARCH_URL}${encodeURIComponent(value).replace(/%20/g, "+")}`;
}

export function displayUrl(url: string) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "duckduckgo.com" && parsed.searchParams.has("q")) {
      return parsed.searchParams.get("q") ?? url;
    }

    return parsed.href.replace(/^https?:\/\//, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function faviconForUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "/icon.png";
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "/icon.png";
  }
}

function looksLikeHost(value: string) {
  return !/\s/.test(value) && (value.includes(".") || value === "localhost" || value.startsWith("127."));
}
