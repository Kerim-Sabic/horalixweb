import type { SearchEngineId } from "../browser/url";

export const SETTINGS_VERSION = 1;

export type ThemeMode = "system" | "light" | "dark";

export type AppSettings = {
  version: typeof SETTINGS_VERSION;
  appearance: {
    theme: ThemeMode;
    compactMode: boolean;
  };
  search: {
    engine: SearchEngineId;
    customSearchUrl: string;
  };
  privacy: {
    blockerEnabled: boolean;
    blockAds: boolean;
    blockTrackers: boolean;
    blockDangerousProtocols: boolean;
    allowlist: string[];
  };
  tabs: {
    restorePreviousSession: boolean;
    sleepingTabsEnabled: boolean;
    liveTabCacheSize: number;
    openNewTabsInBackground: boolean;
  };
};
