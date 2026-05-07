export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NavigationDecision = {
  url: string;
  blocked: boolean;
  reason: string | null;
  blockedCount: number;
};

export type NativeTabEvent = {
  label: string;
  url: string;
  title: string | null;
  status: "loading" | "ready" | "blocked" | "error";
  reason?: string | null;
  blockedCount: number;
};

export type NativeTitleEvent = {
  label: string;
  title: string;
};

export type NativePrivacyEvent = {
  label: string;
  blockedCount: number;
};
