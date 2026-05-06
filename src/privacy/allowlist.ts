export function normalizeHost(host: string) {
  return host.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

export function getHostFromUrl(value: string) {
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return "";
  }
}

export function isHostAllowlisted(host: string, allowlist: Iterable<string>) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  const set = new Set(Array.from(allowlist, normalizeHost));
  if (set.has(normalized)) return true;

  let cursor = normalized;
  while (cursor.includes(".")) {
    cursor = cursor.slice(cursor.indexOf(".") + 1);
    if (set.has(cursor)) return true;
  }
  return false;
}

export function addAllowlistHost(allowlist: string[], host: string) {
  const normalized = normalizeHost(host);
  if (!normalized || isHostAllowlisted(normalized, allowlist)) return allowlist;
  return [...allowlist, normalized].sort();
}

export function removeAllowlistHost(allowlist: string[], host: string) {
  const normalized = normalizeHost(host);
  return allowlist.filter((item) => normalizeHost(item) !== normalized);
}
