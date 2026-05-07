import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./defaults";
import { parseSettings } from "./persistence";

describe("settings persistence", () => {
  it("keeps default settings valid", () => {
    const settings = parseSettings(DEFAULT_SETTINGS);
    expect(settings.version).toBe(2);
    expect(settings.onboarding.searchEngineChosen).toBe(false);
    expect(settings.privacy.blockerEnabled).toBe(true);
    expect(settings.tabs.liveTabCacheSize).toBe(3);
  });

  it("parses persisted settings", () => {
    const settings = parseSettings({
      ...DEFAULT_SETTINGS,
      appearance: { theme: "dark", compactMode: true },
      search: { engine: "brave", customSearchUrl: "" },
      tabs: { restorePreviousSession: false, sleepingTabsEnabled: true, liveTabCacheSize: 6, openNewTabsInBackground: true },
    });
    expect(settings.appearance.theme).toBe("dark");
    expect(settings.search.engine).toBe("brave");
    expect(settings.tabs.liveTabCacheSize).toBe(6);
  });

  it("migrates v1 settings and asks for search onboarding once", () => {
    const settings = parseSettings({
      ...DEFAULT_SETTINGS,
      version: 1,
      search: { engine: "google", customSearchUrl: "" },
    });
    expect(settings.version).toBe(2);
    expect(settings.search.engine).toBe("google");
    expect(settings.onboarding.searchEngineChosen).toBe(false);
  });

  it("preserves completed first-run search onboarding", () => {
    const settings = parseSettings({
      ...DEFAULT_SETTINGS,
      onboarding: { searchEngineChosen: true },
      search: { engine: "brave", customSearchUrl: "" },
    });
    expect(settings.search.engine).toBe("brave");
    expect(settings.onboarding.searchEngineChosen).toBe(true);
  });

  it("recovers from corrupted settings", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ version: 99 })).toEqual(DEFAULT_SETTINGS);
  });
});
