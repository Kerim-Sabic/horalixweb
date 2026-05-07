(() => {
  const AD_CONTAINER_SELECTORS = [
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".video-ads",
    "ytd-ad-slot-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-companion-slot-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-rich-item-renderer [id='content'][class*='ad']",
    "tp-yt-paper-dialog ytd-mealbar-promo-renderer"
  ];
  const SKIP_BUTTON_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    ".ytp-ad-overlay-close-button",
    "button[aria-label*='Skip' i]",
    "button[class*='ytp-ad-skip']"
  ];
  const PROMOTED_BADGE_TEXT = /^(ad|ads|sponsored|paid promotion)$/i;
  const state = {
    cosmetic: 0,
    skips: 0,
    scheduled: false,
    bridged: false
  };

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function hideElement(element) {
    if (!(element instanceof HTMLElement)) return;
    if (element.dataset.horalixYtHidden === "true") return;
    element.dataset.horalixYtHidden = "true";
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    state.cosmetic += 1;
  }

  function hideSelectorMatches() {
    for (const element of document.querySelectorAll(AD_CONTAINER_SELECTORS.join(","))) {
      hideElement(element);
    }
  }

  function hidePromotedRenderers() {
    const badges = document.querySelectorAll("ytd-badge-supported-renderer, .badge-shape-wiz__text");
    for (const badge of badges) {
      const text = badge.textContent?.trim();
      if (!text || !PROMOTED_BADGE_TEXT.test(text)) continue;
      const renderer = badge.closest(
        "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-reel-item-renderer"
      );
      hideElement(renderer);
    }
  }

  function clickSkipButtons() {
    for (const button of document.querySelectorAll(SKIP_BUTTON_SELECTORS.join(","))) {
      if (!(button instanceof HTMLElement) || !isVisible(button)) continue;
      button.click();
      state.skips += 1;
    }
  }

  function exposeStats() {
    document.documentElement?.setAttribute("data-horalix-youtube", "playback-safe");
    document.documentElement?.setAttribute("data-horalix-blocker", "extension-loaded");
    window.__HORALIX_YOUTUBE_BLOCKS__ = {
      cosmetic: state.cosmetic,
      skips: state.skips
    };

    if (state.bridged || !window.__HORALIX_WEB__) return;
    const existing = window.__HORALIX_WEB__;
    const originalBlockedCount = existing.blockedCount;
    window.__HORALIX_WEB__ = {
      ...existing,
      blockedCount: () =>
        (typeof originalBlockedCount === "function" ? originalBlockedCount() : 0) +
        state.cosmetic +
        state.skips
    };
    state.bridged = true;
  }

  function scan() {
    state.scheduled = false;
    hideSelectorMatches();
    hidePromotedRenderers();
    clickSkipButtons();
    exposeStats();
  }

  function scheduleScan() {
    if (state.scheduled) return;
    state.scheduled = true;
    window.requestAnimationFrame(scan);
  }

  function install() {
    scheduleScan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-label"]
    });
    window.setInterval(scheduleScan, 1500);
  }

  if (document.documentElement) {
    install();
  } else {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  }
})();
