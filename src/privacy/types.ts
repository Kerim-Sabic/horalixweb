export type BlockCategory = "ad" | "tracker" | "social" | "dangerous" | "popup" | "cosmetic";

export type PrivacyBlockerSettings = {
  enabled: boolean;
  blockAds: boolean;
  blockTrackers: boolean;
  blockDangerousProtocols: boolean;
};

export type BlockDecision = {
  blocked: boolean;
  category?: BlockCategory;
  host?: string;
  reason?: string;
};

export type PrivacyStats = {
  ads: number;
  trackers: number;
  popups: number;
  dangerous: number;
  cosmetic: number;
};
