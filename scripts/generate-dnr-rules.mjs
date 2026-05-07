import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pglPath = resolve(root, "crates/horalix-net/src/pgl_domains.txt");
const rulesPath = resolve(root, "src-tauri/extensions/horalix-blocker/rules.json");

const ALL_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other",
];

const SCRIPT_RESOURCE_TYPES = ["sub_frame", "script", "image", "xmlhttprequest", "ping", "websocket", "other"];
const YOUTUBE_MEDIA_HOSTS = [
  ["googlevideo.com", ["media", "xmlhttprequest", "other"]],
  ["ytimg.com", ["stylesheet", "script", "image", "font", "xmlhttprequest", "other"]],
  ["gstatic.com", ["stylesheet", "script", "image", "font", "xmlhttprequest", "other"]],
  ["ggpht.com", ["image", "xmlhttprequest", "other"]],
  ["googleusercontent.com", ["image", "media", "xmlhttprequest", "other"]],
  ["youtube-nocookie.com", ["main_frame", "sub_frame", "media", "script", "xmlhttprequest", "other"]],
];
const YOUTUBE_SAFE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtubei.googleapis.com",
  "googlevideo.com",
  "ytimg.com",
  "gstatic.com",
  "ggpht.com",
  "googleusercontent.com",
]);
const YOUTUBE_SAFE_SUFFIXES = [
  ".googlevideo.com",
  ".ytimg.com",
  ".gstatic.com",
  ".ggpht.com",
  ".googleusercontent.com",
];
const EXTRA_BLOCK_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "ads.youtube.com",
  "pagead2.googlesyndication.com",
  "securepubads.g.doubleclick.net",
  "stats.g.doubleclick.net",
];
const YOUTUBE_BLOCK_FILTERS = [
  ["ads.youtube.com", ALL_RESOURCE_TYPES, 95],
  ["youtube.com/pagead/", SCRIPT_RESOURCE_TYPES, 90],
  ["www.youtube.com/pagead/", SCRIPT_RESOURCE_TYPES, 90],
  ["youtube.com/api/stats/ads", SCRIPT_RESOURCE_TYPES, 90],
  ["www.youtube.com/api/stats/ads", SCRIPT_RESOURCE_TYPES, 90],
  ["youtube.com/ptracking", SCRIPT_RESOURCE_TYPES, 90],
  ["www.youtube.com/ptracking", SCRIPT_RESOURCE_TYPES, 90],
];

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function isSafeYouTubeHost(host) {
  return YOUTUBE_SAFE_HOSTS.has(host) || YOUTUBE_SAFE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

const domains = new Set();
for (const line of readFileSync(pglPath, "utf8").split(/\r?\n/)) {
  const host = normalizeHost(line);
  if (!host || host.startsWith("#") || isSafeYouTubeHost(host)) continue;
  domains.add(host);
}
for (const host of EXTRA_BLOCK_HOSTS) {
  if (!isSafeYouTubeHost(host)) domains.add(host);
}

const rules = [...domains].sort().map((host, index) => ({
  id: index + 1,
  priority: 1,
  action: { type: "block" },
  condition: {
    resourceTypes: ALL_RESOURCE_TYPES,
    urlFilter: `||${host}^`,
  },
}));

let id = 800001;
for (const [host, resourceTypes] of YOUTUBE_MEDIA_HOSTS) {
  rules.push({
    id: id++,
    priority: 100,
    action: { type: "allow" },
    condition: {
      resourceTypes,
      urlFilter: `||${host}^`,
    },
  });
}

id = 800101;
for (const [filter, resourceTypes, priority] of YOUTUBE_BLOCK_FILTERS) {
  rules.push({
    id: id++,
    priority,
    action: { type: "block" },
    condition: {
      resourceTypes,
      urlFilter: filter.includes("/") ? `||${filter}` : `||${filter}^`,
    },
  });
}

writeFileSync(rulesPath, `${JSON.stringify(rules)}\n`);
console.log(`Generated ${rules.length} DNR rules at ${rulesPath}`);
