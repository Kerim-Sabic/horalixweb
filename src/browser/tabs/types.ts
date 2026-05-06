export const TAB_SESSION_VERSION = 1;

export type TabStatus = "start" | "loading" | "ready" | "error" | "blocked" | "sleeping";

export type TabBlockStats = {
  ads: number;
  trackers: number;
  popups: number;
  dangerous: number;
  cosmetic: number;
};

export type BrowserTab = {
  id: string;
  webviewLabel: string;
  url: string;
  displayUrl: string;
  title: string;
  favicon: string;
  status: TabStatus;
  canGoBack: boolean;
  canGoForward: boolean;
  isPrivate: boolean;
  isPinned: boolean;
  isMuted: boolean;
  isAudible: boolean;
  isDirty: boolean;
  hasLiveWebview: boolean;
  createdAt: number;
  lastAccessedAt: number;
  errorMessage?: string;
  blockedReason?: string;
  blockStats: TabBlockStats;
};

export type TabsState = {
  version: typeof TAB_SESSION_VERSION;
  tabs: BrowserTab[];
  activeTabId: string;
  closedTabs: BrowserTab[];
  liveTabIds: string[];
  liveTabCacheSize: number;
  sleepingTabsEnabled: boolean;
};

export type PersistedTab = Omit<
  BrowserTab,
  "hasLiveWebview" | "status" | "canGoBack" | "canGoForward" | "isAudible" | "isDirty"
> & {
  status: Exclude<TabStatus, "loading">;
};

export type PersistedTabsSession = {
  version: typeof TAB_SESSION_VERSION;
  tabs: PersistedTab[];
  activeTabId: string;
};

export type TabsAction =
  | { type: "create"; tab: BrowserTab; activate?: boolean }
  | { type: "create-many"; tabs: BrowserTab[]; activateId?: string }
  | { type: "close"; id: string }
  | { type: "switch"; id: string }
  | { type: "update"; id: string; patch: Partial<BrowserTab> }
  | { type: "navigate-start"; id: string; url: string; displayUrl: string; title: string; favicon: string }
  | { type: "navigation-ready"; id: string; url: string; displayUrl: string; title?: string; favicon?: string }
  | { type: "navigation-error"; id: string; message: string }
  | { type: "navigation-blocked"; id: string; url: string; displayUrl: string; reason: string }
  | { type: "sleep"; id: string }
  | { type: "restore-sleeping"; id: string }
  | { type: "pin"; id: string; pinned: boolean }
  | { type: "mute"; id: string; muted: boolean }
  | { type: "reorder"; draggedId: string; targetId: string }
  | { type: "clear-closed" }
  | { type: "set-live-cache-size"; value: number }
  | { type: "set-sleeping-enabled"; value: boolean };

export type TabCreateOptions = {
  url?: string;
  displayUrl?: string;
  title?: string;
  favicon?: string;
  isPrivate?: boolean;
  status?: TabStatus;
  now?: number;
};
