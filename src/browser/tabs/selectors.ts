import type { BrowserTab, TabsState } from "./types";

export function selectActiveTab(state: TabsState): BrowserTab {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
}

export function selectVisibleTabs(state: TabsState, limit = 80): BrowserTab[] {
  if (state.tabs.length <= limit) return state.tabs;

  const activeIndex = Math.max(
    0,
    state.tabs.findIndex((tab) => tab.id === state.activeTabId),
  );
  const pinned = state.tabs.filter((tab) => tab.isPinned);
  const pinnedIds = new Set(pinned.map((tab) => tab.id));
  const remainingLimit = Math.max(1, limit - pinned.length);
  const start = Math.max(0, Math.min(activeIndex - Math.floor(remainingLimit / 2), state.tabs.length - remainingLimit));
  const windowed = state.tabs.slice(start, start + remainingLimit).filter((tab) => !pinnedIds.has(tab.id));
  return [...pinned, ...windowed];
}

export function selectHiddenTabCount(state: TabsState, visibleTabs: BrowserTab[]) {
  return Math.max(0, state.tabs.length - visibleTabs.length);
}

export function selectLiveTabs(state: TabsState) {
  const live = new Set(state.liveTabIds);
  return state.tabs.filter((tab) => live.has(tab.id) || tab.hasLiveWebview);
}

export function selectPersistableTabs(state: TabsState) {
  return state.tabs.filter((tab) => !tab.isPrivate);
}

export function selectTotalBlocked(tab?: BrowserTab) {
  if (!tab) return 0;
  return (
    tab.blockStats.ads +
    tab.blockStats.trackers +
    tab.blockStats.popups +
    tab.blockStats.dangerous +
    tab.blockStats.cosmetic
  );
}
