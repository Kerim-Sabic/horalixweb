export const INTERNAL_START_URL = "horalix://start";
export const INTERNAL_SETTINGS_URL = "horalix://settings";
export const FALLBACK_HOME_URL = "https://duckduckgo.com/";

export type SearchEngineId = "duckduckgo" | "google" | "brave" | "bing" | "custom";

export type SearchEngine = {
  id: SearchEngineId;
  name: string;
  searchUrl: string;
};

export type NormalizedNavigation =
  | {
      kind: "start";
      input: string;
      url: typeof INTERNAL_START_URL;
      displayUrl: "";
      originLabel: "Horalix";
      isSearch: false;
      blocked: false;
    }
  | {
      kind: "navigate";
      input: string;
      url: string;
      displayUrl: string;
      originLabel: string;
      isSearch: false;
      blocked: false;
    }
  | {
      kind: "search";
      input: string;
      query: string;
      url: string;
      displayUrl: string;
      originLabel: string;
      isSearch: true;
      blocked: false;
    }
  | {
      kind: "blocked";
      input: string;
      url: string;
      displayUrl: string;
      originLabel: "Blocked";
      isSearch: false;
      blocked: true;
      reason: string;
    }
  | {
      kind: "invalid";
      input: string;
      url: "";
      displayUrl: string;
      originLabel: "Invalid";
      isSearch: false;
      blocked: true;
      reason: string;
    };

export const SEARCH_ENGINES: Record<Exclude<SearchEngineId, "custom">, SearchEngine> = {
  duckduckgo: {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q={searchTerms}",
  },
  google: {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q={searchTerms}",
  },
  brave: {
    id: "brave",
    name: "Brave",
    searchUrl: "https://search.brave.com/search?q={searchTerms}",
  },
  bing: {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q={searchTerms}",
  },
};

const HOST_WITH_PORT_RE =
  /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:.]+\]|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d{1,5})?(?:[/?#].*)?$/i;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
const DANGEROUS_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:"]);

export function normalizeUrlInput(input: string, searchEngine: SearchEngine): NormalizedNavigation {
  const value = input.trim();

  if (!value) {
    return {
      kind: "start",
      input,
      url: INTERNAL_START_URL,
      displayUrl: "",
      originLabel: "Horalix",
      isSearch: false,
      blocked: false,
    };
  }

  if (isDangerousProtocol(value)) {
    return {
      kind: "blocked",
      input,
      url: value,
      displayUrl: value,
      originLabel: "Blocked",
      isSearch: false,
      blocked: true,
      reason: "Horalix Web blocked this protocol before navigation.",
    };
  }

  const internal = normalizeInternalUrl(value);
  if (internal) {
    return {
      kind: "navigate",
      input,
      url: internal,
      displayUrl: getDisplayUrl(internal),
      originLabel: getOriginLabel(internal),
      isSearch: false,
      blocked: false,
    };
  }

  const parsed = parseHttpUrl(value);
  if (parsed) {
    return {
      kind: "navigate",
      input,
      url: parsed.href,
      displayUrl: getDisplayUrl(parsed.href),
      originLabel: getOriginLabel(parsed.href),
      isSearch: false,
      blocked: false,
    };
  }

  if (hasMalformedExplicitScheme(value)) {
    return {
      kind: "invalid",
      input,
      url: "",
      displayUrl: value,
      originLabel: "Invalid",
      isSearch: false,
      blocked: true,
      reason: "That address is not valid.",
    };
  }

  if (isSearchQuery(value)) {
    return {
      kind: "search",
      input,
      query: value,
      url: getSearchUrl(value, searchEngine),
      displayUrl: value,
      originLabel: searchEngine.name,
      isSearch: true,
      blocked: false,
    };
  }

  const hostUrl = parseHttpUrl(`https://${value}`);
  if (hostUrl) {
    return {
      kind: "navigate",
      input,
      url: hostUrl.href,
      displayUrl: getDisplayUrl(hostUrl.href),
      originLabel: getOriginLabel(hostUrl.href),
      isSearch: false,
      blocked: false,
    };
  }

  return {
    kind: "search",
    input,
    query: value,
    url: getSearchUrl(value, searchEngine),
    displayUrl: value,
    originLabel: searchEngine.name,
    isSearch: true,
    blocked: false,
  };
}

export function isLikelyUrl(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  if (isDangerousProtocol(value)) return true;
  if (normalizeInternalUrl(value)) return true;
  if (SCHEME_RE.test(value)) return true;
  return HOST_WITH_PORT_RE.test(value);
}

export function isSearchQuery(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  if (/\s/.test(value)) return true;
  return !isLikelyUrl(value);
}

export function isDangerousProtocol(input: string): boolean {
  const value = input.trim().toLowerCase();
  const scheme = value.match(SCHEME_RE)?.[1];
  if (!scheme) return false;
  if (DANGEROUS_PROTOCOLS.has(`${scheme}:`)) return true;
  if (scheme === "about" && value !== "about:blank") return true;
  return scheme === "tauri";
}

export function getSearchUrl(query: string, engine: SearchEngine): string {
  const encoded = encodeURIComponent(query.trim()).replace(/%20/g, "+");
  const template = engine.searchUrl.trim() || SEARCH_ENGINES.duckduckgo.searchUrl;
  if (template.includes("{searchTerms}")) {
    return template.replaceAll("{searchTerms}", encoded);
  }
  try {
    const url = new URL(template);
    url.searchParams.set("q", query.trim());
    return url.href;
  } catch {
    return SEARCH_ENGINES.duckduckgo.searchUrl.replace("{searchTerms}", encoded);
  }
}

export function getSearchHomeUrl(engine: SearchEngine): string {
  if (engine.id === "google") return "https://www.google.com/";
  if (engine.id === "brave") return "https://search.brave.com/";
  if (engine.id === "bing") return "https://www.bing.com/";
  if (engine.id === "duckduckgo") return FALLBACK_HOME_URL;

  try {
    const url = new URL(engine.searchUrl);
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return FALLBACK_HOME_URL;
  }
}

export function getDisplayUrl(url: string): string {
  if (!url) return "";
  if (url === INTERNAL_START_URL) return "New Tab";
  if (url === INTERNAL_SETTINGS_URL) return "Settings";

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "about:") return parsed.href;
    if (parsed.hostname === "duckduckgo.com" && parsed.searchParams.has("q")) {
      return parsed.searchParams.get("q") ?? parsed.href;
    }

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const cleanPath = path === "/" ? "" : path;
    return `${parsed.host}${cleanPath}`;
  } catch {
    return url;
  }
}

export function getOriginLabel(url: string): string {
  if (!url) return "New Tab";
  if (url === INTERNAL_START_URL) return "Horalix";
  if (url === INTERNAL_SETTINGS_URL) return "Settings";

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "about:") return parsed.href;
    return parsed.hostname || parsed.protocol.replace(":", "");
  } catch {
    return "Unknown";
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

function normalizeInternalUrl(value: string) {
  const lower = value.toLowerCase();
  if (lower === INTERNAL_START_URL || lower === "horalix://newtab" || lower === "horalix://home") {
    return INTERNAL_START_URL;
  }
  if (lower === INTERNAL_SETTINGS_URL) return INTERNAL_SETTINGS_URL;
  if (lower === "about:blank") return "about:blank";
  return null;
}

function parseHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function hasMalformedExplicitScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:\s*$/i.test(value);
}
