import { faviconForUrl, getDisplayUrl } from "../url";
import { createBrowserTab, createInitialTabsState, createWebviewLabel } from "./reducer";
import type { BrowserTab, PersistedTab, PersistedTabsSession, TabsState } from "./types";
import { TAB_SESSION_VERSION } from "./types";

export const SESSION_STORAGE_KEY = "horalix-web-session-v1";

export function serializeTabsSession(state: TabsState): PersistedTabsSession {
  const tabs: PersistedTab[] = state.tabs
    .filter((tab) => !tab.isPrivate)
    .map((tab) => ({
      id: tab.id,
      webviewLabel: createWebviewLabel(tab.id),
      url: tab.url,
      displayUrl: tab.displayUrl,
      title: tab.title,
      favicon: tab.favicon,
      status: tab.status === "error" || tab.status === "blocked" ? tab.status : tab.url ? "sleeping" : "start",
      isPrivate: false,
      isPinned: tab.isPinned,
      isMuted: tab.isMuted,
      createdAt: tab.createdAt,
      lastAccessedAt: tab.lastAccessedAt,
      errorMessage: tab.errorMessage,
      blockedReason: tab.blockedReason,
      blockStats: tab.blockStats,
    }));

  return {
    version: TAB_SESSION_VERSION,
    tabs,
    activeTabId: tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : tabs[0]?.id ?? "",
  };
}

export function deserializeTabsSession(value: unknown): TabsState | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<PersistedTabsSession>;
  if (session.version !== TAB_SESSION_VERSION || !Array.isArray(session.tabs)) return null;

  const tabs = session.tabs.map(toBrowserTab).filter(Boolean) as BrowserTab[];
  if (!tabs.length) return null;

  return {
    ...createInitialTabsState(tabs),
    activeTabId: tabs.some((tab) => tab.id === session.activeTabId) ? String(session.activeTabId) : tabs[0].id,
  };
}

export function loadTabsSession(storage: Storage = window.localStorage): TabsState | null {
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return deserializeTabsSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveTabsSession(state: TabsState, storage: Storage = window.localStorage) {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializeTabsSession(state)));
}

export function clearTabsSession(storage: Storage = window.localStorage) {
  storage.removeItem(SESSION_STORAGE_KEY);
}

function toBrowserTab(value: PersistedTab): BrowserTab | null {
  if (!value || typeof value.id !== "string") return null;
  const url = typeof value.url === "string" ? value.url : "";
  const displayUrl = typeof value.displayUrl === "string" ? value.displayUrl : getDisplayUrl(url);
  return {
    ...createBrowserTab({
      url,
      displayUrl,
      title: typeof value.title === "string" ? value.title : displayUrl || "New Tab",
      favicon: typeof value.favicon === "string" ? value.favicon : faviconForUrl(url),
      status: value.status === "blocked" || value.status === "error" ? value.status : url ? "sleeping" : "start",
      now: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    }),
    id: value.id,
    webviewLabel: createWebviewLabel(value.id),
    isPrivate: false,
    isPinned: Boolean(value.isPinned),
    isMuted: Boolean(value.isMuted),
    hasLiveWebview: false,
    canGoBack: false,
    canGoForward: false,
    isAudible: false,
    isDirty: false,
    lastAccessedAt: typeof value.lastAccessedAt === "number" ? value.lastAccessedAt : Date.now(),
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : undefined,
    blockedReason: typeof value.blockedReason === "string" ? value.blockedReason : undefined,
    blockStats: value.blockStats ?? {
      ads: 0,
      trackers: 0,
      popups: 0,
      dangerous: 0,
      cosmetic: 0,
    },
  };
}
