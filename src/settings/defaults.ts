import { SEARCH_ENGINES, type SearchEngine } from "../browser/url";
import type { AppSettings } from "./types";
import { SETTINGS_VERSION } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  appearance: {
    theme: "system",
    compactMode: false,
  },
  search: {
    engine: "duckduckgo",
    customSearchUrl: "https://duckduckgo.com/?q={searchTerms}",
  },
  privacy: {
    blockerEnabled: true,
    blockAds: true,
    blockTrackers: true,
    blockDangerousProtocols: true,
    allowlist: [],
  },
  tabs: {
    restorePreviousSession: true,
    sleepingTabsEnabled: true,
    liveTabCacheSize: 3,
    openNewTabsInBackground: false,
  },
};

export function getSearchEngine(settings: AppSettings): SearchEngine {
  if (settings.search.engine === "custom") {
    return {
      id: "custom",
      name: "Custom",
      searchUrl: settings.search.customSearchUrl || DEFAULT_SETTINGS.search.customSearchUrl,
    };
  }

  return SEARCH_ENGINES[settings.search.engine] ?? SEARCH_ENGINES.duckduckgo;
}
