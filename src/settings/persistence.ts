import { DEFAULT_SETTINGS } from "./defaults";
import type { AppSettings, ThemeMode } from "./types";
import { SETTINGS_VERSION } from "./types";

export const SETTINGS_STORAGE_KEY = "horalix-web-settings-v1";

export function parseSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Partial<AppSettings>;
  if (raw.version !== SETTINGS_VERSION) return DEFAULT_SETTINGS;

  return {
    version: SETTINGS_VERSION,
    appearance: {
      theme: parseTheme(raw.appearance?.theme),
      compactMode: Boolean(raw.appearance?.compactMode),
    },
    search: {
      engine:
        raw.search?.engine === "google" ||
        raw.search?.engine === "duckduckgo" ||
        raw.search?.engine === "brave" ||
        raw.search?.engine === "bing" ||
        raw.search?.engine === "custom"
          ? raw.search.engine
          : DEFAULT_SETTINGS.search.engine,
      customSearchUrl:
        typeof raw.search?.customSearchUrl === "string"
          ? raw.search.customSearchUrl
          : DEFAULT_SETTINGS.search.customSearchUrl,
    },
    privacy: {
      blockerEnabled: raw.privacy?.blockerEnabled ?? DEFAULT_SETTINGS.privacy.blockerEnabled,
      blockAds: raw.privacy?.blockAds ?? DEFAULT_SETTINGS.privacy.blockAds,
      blockTrackers: raw.privacy?.blockTrackers ?? DEFAULT_SETTINGS.privacy.blockTrackers,
      blockDangerousProtocols: raw.privacy?.blockDangerousProtocols ?? DEFAULT_SETTINGS.privacy.blockDangerousProtocols,
      allowlist: Array.isArray(raw.privacy?.allowlist)
        ? raw.privacy.allowlist.filter((item): item is string => typeof item === "string")
        : [],
    },
    tabs: {
      restorePreviousSession: raw.tabs?.restorePreviousSession ?? DEFAULT_SETTINGS.tabs.restorePreviousSession,
      sleepingTabsEnabled: raw.tabs?.sleepingTabsEnabled ?? DEFAULT_SETTINGS.tabs.sleepingTabsEnabled,
      liveTabCacheSize: clampLiveCacheSize(raw.tabs?.liveTabCacheSize),
      openNewTabsInBackground: raw.tabs?.openNewTabsInBackground ?? DEFAULT_SETTINGS.tabs.openNewTabsInBackground,
    },
  };
}

export function loadSettings(storage: Storage = window.localStorage): AppSettings {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings, storage: Storage = window.localStorage) {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parseSettings(settings)));
}

function parseTheme(value: unknown): ThemeMode {
  return value === "system" || value === "light" || value === "dark" ? value : DEFAULT_SETTINGS.appearance.theme;
}

function clampLiveCacheSize(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(12, Math.max(1, Math.round(value))) : 3;
}
