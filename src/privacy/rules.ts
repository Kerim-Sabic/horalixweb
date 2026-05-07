export const AD_HOSTS = new Set([
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "ads.youtube.com",
  "adnxs.com",
  "adsystem.com",
  "ads-twitter.com",
  "criteo.com",
  "rubiconproject.com",
  "taboola.com",
  "outbrain.com",
  "pubmatic.com",
  "scorecardresearch.com",
]);

export const TRACKER_HOSTS = new Set([
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "fullstory.com",
  "newrelic.com",
  "sentry.io",
  "clarity.ms",
  "mouseflow.com",
]);

export const SOCIAL_TRACKER_HOSTS = new Set([
  "connect.facebook.net",
  "facebook.com",
  "pixel.facebook.com",
  "analytics.twitter.com",
  "platform.twitter.com",
  "snap.licdn.com",
  "ads.linkedin.com",
  "tiktok.com",
  "analytics.tiktok.com",
]);

export const YOUTUBE_PLAYBACK_EXACT_HOSTS = new Set([
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

export const YOUTUBE_PLAYBACK_HOST_SUFFIXES = [
  ".googlevideo.com",
  ".ytimg.com",
  ".gstatic.com",
  ".ggpht.com",
  ".googleusercontent.com",
] as const;

export const DANGEROUS_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:"]);

export const COSMETIC_SELECTORS = [
  "[id^='ad-']",
  "[id*='-ad-']",
  "[id*='ads']",
  "[class^='ad-']",
  "[class*=' ad-']",
  "[class*=' ads']",
  "[class*='advert']",
  "[class*='sponsor']",
  "[aria-label*='advertisement' i]",
  "iframe[src*='doubleclick']",
  "iframe[src*='googlesyndication']",
] as const;
