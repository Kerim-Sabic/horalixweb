const HIDE_SELECTORS = [
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
  "iframe[src*='googlesyndication']"
];

function injectCosmeticCss() {
  const style = document.createElement("style");
  style.textContent = `${HIDE_SELECTORS.join(",")}{display:none!important;visibility:hidden!important;}`;
  (document.documentElement || document.head).appendChild(style);
}

function disableSiteBlocking() {
  chrome.runtime.sendMessage({
    type: "horalix-disable-site-blocking",
    host: location.hostname
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "HORALIX_DISABLE_SITE_BLOCKING") {
    disableSiteBlocking();
  }
});

injectCosmeticCss();
