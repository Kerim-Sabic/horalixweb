import { isDangerousProtocol as isDangerousBrowserProtocol } from "../browser/url";
import { getHostFromUrl, isHostAllowlisted, normalizeHost } from "./allowlist";
import { AD_HOSTS, SOCIAL_TRACKER_HOSTS, TRACKER_HOSTS } from "./rules";
import type { BlockDecision, PrivacyBlockerSettings } from "./types";

export const MAXIMUM_PRIVACY_SETTINGS: PrivacyBlockerSettings = {
  enabled: true,
  blockAds: true,
  blockTrackers: true,
  blockDangerousProtocols: true,
};

export function classifyNavigation(
  url: string,
  settings: PrivacyBlockerSettings = MAXIMUM_PRIVACY_SETTINGS,
  allowlist: Iterable<string> = [],
): BlockDecision {
  if (settings.blockDangerousProtocols && isDangerousBrowserProtocol(url)) {
    return {
      blocked: true,
      category: "dangerous",
      reason: "Dangerous protocol blocked before navigation.",
    };
  }

  if (!settings.enabled) return { blocked: false };

  const host = getHostFromUrl(url);
  if (!host || isHostAllowlisted(host, allowlist)) return { blocked: false, host };

  if (settings.blockAds && matchesHostSet(host, AD_HOSTS)) {
    return {
      blocked: true,
      category: "ad",
      host,
      reason: "Known advertising network blocked.",
    };
  }

  if (settings.blockTrackers && matchesHostSet(host, TRACKER_HOSTS)) {
    return {
      blocked: true,
      category: "tracker",
      host,
      reason: "Known analytics tracker blocked.",
    };
  }

  if (settings.blockTrackers && matchesHostSet(host, SOCIAL_TRACKER_HOSTS)) {
    return {
      blocked: true,
      category: "social",
      host,
      reason: "Known social tracker blocked.",
    };
  }

  return { blocked: false, host };
}

export function matchesHostSet(host: string, rules: ReadonlySet<string>) {
  let cursor = normalizeHost(host);
  if (!cursor) return false;
  if (rules.has(cursor)) return true;

  while (cursor.includes(".")) {
    cursor = cursor.slice(cursor.indexOf(".") + 1);
    if (rules.has(cursor)) return true;
  }
  return false;
}
