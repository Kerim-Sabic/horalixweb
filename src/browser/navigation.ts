import { SEARCH_ENGINES, faviconForUrl, getDisplayUrl, normalizeUrlInput } from "./url";
import { createTabId, createWebviewLabel } from "./tabs/reducer";

export { createTabId, createWebviewLabel, faviconForUrl };

export function resolveNavigationInput(input: string) {
  const normalized = normalizeUrlInput(input, SEARCH_ENGINES.duckduckgo);
  return normalized.kind === "invalid" ? "" : normalized.url;
}

export function displayUrl(url: string) {
  return getDisplayUrl(url);
}
