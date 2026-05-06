import type { BlockCategory, PrivacyStats } from "./types";

export function createPrivacyStats(): PrivacyStats {
  return {
    ads: 0,
    trackers: 0,
    popups: 0,
    dangerous: 0,
    cosmetic: 0,
  };
}

export function incrementPrivacyStats(stats: PrivacyStats, category: BlockCategory, count = 1): PrivacyStats {
  switch (category) {
    case "ad":
      return { ...stats, ads: stats.ads + count };
    case "tracker":
    case "social":
      return { ...stats, trackers: stats.trackers + count };
    case "popup":
      return { ...stats, popups: stats.popups + count };
    case "dangerous":
      return { ...stats, dangerous: stats.dangerous + count };
    case "cosmetic":
      return { ...stats, cosmetic: stats.cosmetic + count };
    default:
      return stats;
  }
}

export function totalPrivacyStats(stats: PrivacyStats) {
  return stats.ads + stats.trackers + stats.popups + stats.dangerous + stats.cosmetic;
}
