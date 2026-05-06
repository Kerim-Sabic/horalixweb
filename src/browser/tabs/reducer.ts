import { faviconForUrl, getDisplayUrl } from "../url";
import type { BrowserTab, TabBlockStats, TabCreateOptions, TabsAction, TabsState } from "./types";
import { TAB_SESSION_VERSION } from "./types";

const DEFAULT_LIVE_CACHE_SIZE = 3;
const MAX_CLOSED_TABS = 20;

let tabCounter = 0;

export function createTabId() {
  tabCounter += 1;
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `tab-${Date.now().toString(36)}-${tabCounter.toString(36)}-${entropy}`;
}

export function createWebviewLabel(tabId: string) {
  return `horalix_${tabId.replace(/[^a-zA-Z0-9_:-]/g, "_")}`;
}

export function createEmptyStats(): TabBlockStats {
  return {
    ads: 0,
    trackers: 0,
    popups: 0,
    dangerous: 0,
    cosmetic: 0,
  };
}

export function createBrowserTab(options: TabCreateOptions = {}): BrowserTab {
  const now = options.now ?? Date.now();
  const id = createTabId();
  const url = options.url ?? "";
  const displayUrl = options.displayUrl ?? (url ? getDisplayUrl(url) : "");
  const title = options.title ?? (url ? displayUrl : "New Tab");

  return {
    id,
    webviewLabel: createWebviewLabel(id),
    url,
    displayUrl,
    title,
    favicon: options.favicon ?? faviconForUrl(url),
    status: options.status ?? (url ? "ready" : "start"),
    canGoBack: false,
    canGoForward: false,
    isPrivate: Boolean(options.isPrivate),
    isPinned: false,
    isMuted: false,
    isAudible: false,
    isDirty: false,
    hasLiveWebview: false,
    createdAt: now,
    lastAccessedAt: now,
    blockStats: createEmptyStats(),
  };
}

export function createInitialTabsState(seed?: BrowserTab[]): TabsState {
  const tabs = seed && seed.length ? seed : [createBrowserTab()];
  return {
    version: TAB_SESSION_VERSION,
    tabs,
    activeTabId: tabs[0].id,
    closedTabs: [],
    liveTabIds: [],
    liveTabCacheSize: DEFAULT_LIVE_CACHE_SIZE,
    sleepingTabsEnabled: true,
  };
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "create": {
      const tabs = [...state.tabs, action.tab];
      const activeTabId = action.activate === false ? state.activeTabId : action.tab.id;
      return touchActive(enforceLiveCache({ ...state, tabs, activeTabId }, activeTabId), activeTabId);
    }

    case "create-many": {
      const tabs = [...state.tabs, ...action.tabs];
      const activeTabId = action.activateId ?? state.activeTabId;
      return touchActive(enforceLiveCache({ ...state, tabs, activeTabId }, activeTabId), activeTabId);
    }

    case "close": {
      const closed = state.tabs.find((tab) => tab.id === action.id);
      const remaining = state.tabs.filter((tab) => tab.id !== action.id);
      const closedTabs = closed && !closed.isPrivate ? [closed, ...state.closedTabs].slice(0, MAX_CLOSED_TABS) : state.closedTabs;

      if (!remaining.length) {
        const replacement = createBrowserTab({ isPrivate: closed?.isPrivate ?? false });
        return {
          ...state,
          tabs: [replacement],
          activeTabId: replacement.id,
          closedTabs,
          liveTabIds: [],
        };
      }

      const closedIndex = state.tabs.findIndex((tab) => tab.id === action.id);
      const activeTabId =
        state.activeTabId === action.id
          ? remaining[Math.max(0, closedIndex - 1)]?.id ?? remaining[0].id
          : state.activeTabId;

      return touchActive(
        enforceLiveCache(
          {
            ...state,
            tabs: remaining,
            activeTabId,
            closedTabs,
            liveTabIds: state.liveTabIds.filter((id) => id !== action.id),
          },
          activeTabId,
        ),
        activeTabId,
      );
    }

    case "switch": {
      if (!state.tabs.some((tab) => tab.id === action.id)) return state;
      return touchActive(enforceLiveCache({ ...state, activeTabId: action.id }, action.id), action.id);
    }

    case "update":
      return {
        ...state,
        tabs: state.tabs.map((tab) => (tab.id === action.id ? { ...tab, ...action.patch } : tab)),
      };

    case "navigate-start":
      return updateTab(state, action.id, {
        url: action.url,
        displayUrl: action.displayUrl,
        title: action.title,
        favicon: action.favicon,
        status: "loading",
        errorMessage: undefined,
        blockedReason: undefined,
        hasLiveWebview: true,
      });

    case "navigation-ready":
      return updateTab(state, action.id, {
        url: action.url,
        displayUrl: action.displayUrl,
        title: action.title ?? action.displayUrl,
        favicon: action.favicon ?? faviconForUrl(action.url),
        status: "ready",
        hasLiveWebview: true,
        errorMessage: undefined,
        blockedReason: undefined,
      });

    case "navigation-error":
      return updateTab(state, action.id, {
        status: "error",
        errorMessage: action.message,
        hasLiveWebview: false,
      });

    case "navigation-blocked":
      return updateTab(state, action.id, {
        url: action.url,
        displayUrl: action.displayUrl,
        title: "Blocked",
        favicon: "/icon.png",
        status: "blocked",
        blockedReason: action.reason,
        hasLiveWebview: false,
      });

    case "sleep":
      return updateTab(
        {
          ...state,
          liveTabIds: state.liveTabIds.filter((id) => id !== action.id),
        },
        action.id,
        {
          status: "sleeping",
          hasLiveWebview: false,
        },
      );

    case "restore-sleeping":
      return touchActive(
        enforceLiveCache(
          updateTab(state, action.id, {
            status: state.tabs.find((tab) => tab.id === action.id)?.url ? "ready" : "start",
          }),
          action.id,
        ),
        action.id,
      );

    case "pin":
      return updateTab(state, action.id, { isPinned: action.pinned });

    case "mute":
      return updateTab(state, action.id, { isMuted: action.muted });

    case "reorder":
      return {
        ...state,
        tabs: reorderTabs(state.tabs, action.draggedId, action.targetId),
      };

    case "clear-closed":
      return {
        ...state,
        closedTabs: [],
      };

    case "set-live-cache-size":
      return enforceLiveCache({
        ...state,
        liveTabCacheSize: clampLiveCacheSize(action.value),
      });

    case "set-sleeping-enabled":
      return enforceLiveCache({
        ...state,
        sleepingTabsEnabled: action.value,
      });

    default:
      return state;
  }
}

export function clampLiveCacheSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIVE_CACHE_SIZE;
  return Math.min(12, Math.max(1, Math.round(value)));
}

function updateTab(state: TabsState, id: string, patch: Partial<BrowserTab>): TabsState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  };
}

function touchActive(state: TabsState, activeTabId: string): TabsState {
  const now = Date.now();
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === activeTabId
        ? {
            ...tab,
            lastAccessedAt: now,
            status: tab.status === "sleeping" ? (tab.url ? "ready" : "start") : tab.status,
          }
        : tab,
    ),
  };
}

function enforceLiveCache(state: TabsState, activatedId = state.activeTabId): TabsState {
  if (!state.sleepingTabsEnabled) {
    return {
      ...state,
      liveTabIds: state.liveTabIds.includes(activatedId) ? state.liveTabIds : [activatedId, ...state.liveTabIds],
    };
  }

  const active = state.tabs.find((tab) => tab.id === activatedId);
  const nextLive = active?.url
    ? [activatedId, ...state.liveTabIds.filter((id) => id !== activatedId && state.tabs.some((tab) => tab.id === id))]
    : state.liveTabIds.filter((id) => state.tabs.some((tab) => tab.id === id));
  const keep = new Set(nextLive.slice(0, state.liveTabCacheSize));

  return {
    ...state,
    liveTabIds: Array.from(keep),
    tabs: state.tabs.map((tab) => {
      if (tab.id === activatedId || tab.isPinned || !tab.url || tab.status === "blocked" || tab.status === "error") {
        return tab;
      }
      if (keep.has(tab.id)) return tab;
      if (!tab.hasLiveWebview && tab.status === "sleeping") return tab;
      return {
        ...tab,
        status: "sleeping",
        hasLiveWebview: false,
      };
    }),
  };
}

function reorderTabs(tabs: BrowserTab[], draggedId: string, targetId: string) {
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
  const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return tabs;
  const next = [...tabs];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}
