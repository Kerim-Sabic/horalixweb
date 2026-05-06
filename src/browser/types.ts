export type TabStatus = "new" | "loading" | "ready" | "blocked" | "error";

export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserTab = {
  id: string;
  webviewLabel: string;
  title: string;
  url: string;
  address: string;
  status: TabStatus;
  isPrivate: boolean;
  isPinned: boolean;
  hasWebview: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  historyIndex: number;
  error?: string;
};

export type NavigationDecision = {
  url: string;
  blocked: boolean;
  reason: string | null;
};

export type NativeTabEvent = {
  label: string;
  url: string;
  title: string | null;
  status: "loading" | "ready" | "blocked" | "error";
};

export type NativeTitleEvent = {
  label: string;
  title: string;
};
