import { describe, expect, it } from "vitest";

import { serializeTabsSession } from "./persistence";
import { createBrowserTab, createInitialTabsState, tabsReducer } from "./reducer";

describe("tabs reducer", () => {
  it("creates a tab and activates it", () => {
    const state = createInitialTabsState();
    const tab = createBrowserTab({ url: "https://example.com/" });
    const next = tabsReducer(state, { type: "create", tab });
    expect(next.tabs).toHaveLength(2);
    expect(next.activeTabId).toBe(tab.id);
  });

  it("closes the active tab", () => {
    const first = createBrowserTab();
    const second = createBrowserTab({ url: "https://example.com/" });
    const state = { ...createInitialTabsState([first, second]), activeTabId: second.id };
    const next = tabsReducer(state, { type: "close", id: second.id });
    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe(first.id);
  });

  it("closes an inactive tab without changing active tab", () => {
    const first = createBrowserTab();
    const second = createBrowserTab({ url: "https://example.com/" });
    const state = { ...createInitialTabsState([first, second]), activeTabId: second.id };
    const next = tabsReducer(state, { type: "close", id: first.id });
    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe(second.id);
  });

  it("closing the last tab creates a new start tab", () => {
    const state = createInitialTabsState();
    const next = tabsReducer(state, { type: "close", id: state.activeTabId });
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].status).toBe("start");
  });

  it("switches tabs", () => {
    const first = createBrowserTab();
    const second = createBrowserTab({ url: "https://example.com/" });
    const state = createInitialTabsState([first, second]);
    const next = tabsReducer(state, { type: "switch", id: second.id });
    expect(next.activeTabId).toBe(second.id);
  });

  it("sleeps and restores a tab", () => {
    const tab = createBrowserTab({ url: "https://example.com/", status: "ready" });
    const state = createInitialTabsState([tab]);
    const sleeping = tabsReducer(state, { type: "sleep", id: tab.id });
    expect(sleeping.tabs[0].status).toBe("sleeping");
    const restored = tabsReducer(sleeping, { type: "restore-sleeping", id: tab.id });
    expect(restored.tabs[0].status).toBe("ready");
  });

  it("excludes private tabs from persistence", () => {
    const normal = createBrowserTab({ url: "https://example.com/" });
    const priv = createBrowserTab({ url: "https://private.example/", isPrivate: true });
    const session = serializeTabsSession(createInitialTabsState([normal, priv]));
    expect(session.tabs).toHaveLength(1);
    expect(session.tabs[0].url).toBe("https://example.com/");
  });

  it("handles 1000 fake tabs without keeping 1000 live records", () => {
    const state = createInitialTabsState();
    const tabs = Array.from({ length: 1000 }, (_, index) =>
      createBrowserTab({ url: `https://example.com/${index}`, title: `Tab ${index}` }),
    );
    const start = performance.now();
    const next = tabsReducer(state, { type: "create-many", tabs, activateId: tabs[999].id });
    const elapsed = performance.now() - start;
    expect(next.tabs.length).toBe(1001);
    expect(next.liveTabIds.length).toBeLessThanOrEqual(next.liveTabCacheSize);
    expect(elapsed).toBeLessThan(500);
  });
});
