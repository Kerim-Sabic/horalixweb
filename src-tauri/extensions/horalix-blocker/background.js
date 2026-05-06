const SESSION_RULE_BASE = 900000;
const MAX_SESSION_RULE_ID = 999999;

function sessionRuleId(host) {
  let hash = 0;
  for (const ch of host) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return SESSION_RULE_BASE + (hash % (MAX_SESSION_RULE_ID - SESSION_RULE_BASE));
}

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "horalix-disable-site-blocking") return false;

  const host = normalizeHost(message.host);
  if (!host) {
    sendResponse({ ok: false, error: "Missing host" });
    return false;
  }

  const id = sessionRuleId(host);
  chrome.declarativeNetRequest.updateSessionRules(
    {
      removeRuleIds: [id],
      addRules: [
        {
          id,
          priority: 100000,
          action: { type: "allowAllRequests" },
          condition: {
            initiatorDomains: [host],
            resourceTypes: ["main_frame", "sub_frame"]
          }
        }
      ]
    },
    () => {
      const error = chrome.runtime.lastError?.message;
      sendResponse({ ok: !error, error });
    }
  );

  return true;
});
