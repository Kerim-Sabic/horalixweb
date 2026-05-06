import { useEffect } from "react";

export type ButtonRegistryEntry = {
  id: string;
  label: string;
  component: string;
  handlerName: string;
  handlerExists: boolean;
  disabled: boolean;
  shortcut?: string;
};

export type ButtonDefinition = Omit<ButtonRegistryEntry, "handlerExists" | "disabled"> & {
  expectedDisabledLogic: string;
  expectedBehavior: string;
};

const registry = new Map<string, ButtonRegistryEntry>();

export const BUTTON_QA_DEFINITIONS: ButtonDefinition[] = [
  {
    id: "window.minimize",
    label: "Minimize",
    component: "WindowControls",
    handlerName: "handleMinimizeWindow",
    shortcut: "Alt+Space then N",
    expectedDisabledLogic: "Enabled in Tauri runtime; inert in web preview.",
    expectedBehavior: "Minimizes the native window.",
  },
  {
    id: "window.maximize",
    label: "Maximize/restore",
    component: "WindowControls",
    handlerName: "handleToggleMaximizeWindow",
    shortcut: "Alt+Space then X",
    expectedDisabledLogic: "Enabled in Tauri runtime; inert in web preview.",
    expectedBehavior: "Toggles native window maximized state.",
  },
  {
    id: "window.close",
    label: "Close window",
    component: "WindowControls",
    handlerName: "handleCloseWindow",
    shortcut: "Alt+F4",
    expectedDisabledLogic: "Enabled in Tauri runtime; inert in web preview.",
    expectedBehavior: "Closes the native window.",
  },
  {
    id: "tabs.new",
    label: "New tab",
    component: "TabStrip",
    handlerName: "handleNewTab",
    shortcut: "Ctrl/Cmd+T",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Creates and activates a new start tab unless background tabs are enabled.",
  },
  {
    id: "tabs.private",
    label: "New private tab",
    component: "TabStrip",
    handlerName: "handleNewPrivateTab",
    shortcut: "Ctrl/Cmd+Shift+N",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Creates a private tab that is excluded from session persistence.",
  },
  {
    id: "tabs.close-active",
    label: "Close active tab",
    component: "TabStrip",
    handlerName: "handleCloseActiveTab",
    shortcut: "Ctrl/Cmd+W",
    expectedDisabledLogic: "Always enabled; closing the final tab creates a replacement start tab.",
    expectedBehavior: "Closes the active tab and destroys its live webview.",
  },
  {
    id: "tabs.duplicate",
    label: "Duplicate tab",
    component: "Toolbar",
    handlerName: "handleDuplicateTab",
    expectedDisabledLogic: "Disabled only when there is no active tab.",
    expectedBehavior: "Creates a new tab with the same URL and private flag as the active tab.",
  },
  {
    id: "tabs.restore",
    label: "Restore closed tab",
    component: "Toolbar",
    handlerName: "handleRestoreClosedTab",
    shortcut: "Ctrl/Cmd+Shift+T",
    expectedDisabledLogic: "Disabled when no closed normal tabs exist.",
    expectedBehavior: "Restores the last closed normal tab.",
  },
  {
    id: "nav.back",
    label: "Back",
    component: "Toolbar",
    handlerName: "handleBack",
    shortcut: "Alt+Left",
    expectedDisabledLogic: "Disabled unless active tab can go back.",
    expectedBehavior: "Runs native WebView history back.",
  },
  {
    id: "nav.forward",
    label: "Forward",
    component: "Toolbar",
    handlerName: "handleForward",
    shortcut: "Alt+Right",
    expectedDisabledLogic: "Disabled unless active tab can go forward.",
    expectedBehavior: "Runs native WebView history forward.",
  },
  {
    id: "nav.reload",
    label: "Reload",
    component: "Toolbar",
    handlerName: "handleReload",
    shortcut: "Ctrl/Cmd+R",
    expectedDisabledLogic: "Visible and enabled when active tab is not loading.",
    expectedBehavior: "Reloads the live WebView or reopens the current URL.",
  },
  {
    id: "nav.stop",
    label: "Stop loading",
    component: "Toolbar",
    handlerName: "handleStopLoading",
    shortcut: "Esc",
    expectedDisabledLogic: "Visible only while loading.",
    expectedBehavior: "Stops loading by returning the tab to its last stable state where native stop API is unavailable.",
  },
  {
    id: "nav.home",
    label: "Home",
    component: "Toolbar",
    handlerName: "handleHome",
    shortcut: "Alt+Home",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens the internal start page.",
  },
  {
    id: "omnibox.submit",
    label: "Open address",
    component: "Toolbar",
    handlerName: "handleOmniboxSubmit",
    shortcut: "Enter",
    expectedDisabledLogic: "Disabled only during invalid blocked input state.",
    expectedBehavior: "Normalizes URL/search input and navigates or blocks safely.",
  },
  {
    id: "security.lock",
    label: "Security/lock indicator",
    component: "Toolbar",
    handlerName: "handleToggleSiteInfo",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens current-site connection information.",
  },
  {
    id: "privacy.shield",
    label: "Privacy shield",
    component: "Toolbar",
    handlerName: "handleToggleShield",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens or closes current-site privacy panel.",
  },
  {
    id: "settings.open",
    label: "Settings",
    component: "Toolbar",
    handlerName: "handleOpenSettings",
    shortcut: "Ctrl/Cmd+,",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens the settings view.",
  },
  {
    id: "theme.toggle",
    label: "Theme",
    component: "Toolbar",
    handlerName: "handleCycleTheme",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Cycles System, Light, and Dark themes.",
  },
  {
    id: "start.submit",
    label: "Start page open/search",
    component: "StartPage",
    handlerName: "handleStartSubmit",
    shortcut: "Enter",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Uses the same URL engine as the toolbar omnibox.",
  },
  {
    id: "start.search",
    label: "Search quick action",
    component: "StartPage",
    handlerName: "handleOpenSearch",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens the default search provider home.",
  },
  {
    id: "start.github",
    label: "GitHub quick action",
    component: "StartPage",
    handlerName: "handleOpenGithub",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens https://github.com.",
  },
  {
    id: "start.example",
    label: "Example quick action",
    component: "StartPage",
    handlerName: "handleOpenExample",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens https://example.com.",
  },
  {
    id: "start.private",
    label: "Private quick action",
    component: "StartPage",
    handlerName: "handleStartPrivate",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Creates a private tab.",
  },
  {
    id: "start.settings",
    label: "Settings quick action",
    component: "StartPage",
    handlerName: "handleOpenSettings",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Opens the settings view.",
  },
  {
    id: "state.retry",
    label: "Retry / wake tab",
    component: "StatePage",
    handlerName: "onRetry",
    expectedDisabledLogic: "Always enabled on state pages.",
    expectedBehavior: "Retries failed navigation, blocked navigation, or restores a sleeping tab.",
  },
  {
    id: "state.copy-url",
    label: "Copy URL",
    component: "StatePage",
    handlerName: "copyText",
    expectedDisabledLogic: "Disabled when the state page has no URL.",
    expectedBehavior: "Copies the page URL to the clipboard.",
  },
  {
    id: "state.open-external",
    label: "Open externally",
    component: "StatePage",
    handlerName: "openExternalSafe",
    expectedDisabledLogic: "Disabled unless the URL is HTTP(S).",
    expectedBehavior: "Attempts to open the URL outside the app through the safest available fallback.",
  },
  {
    id: "state.home",
    label: "Home",
    component: "StatePage",
    handlerName: "onHome",
    expectedDisabledLogic: "Always enabled on state pages.",
    expectedBehavior: "Returns the active tab to the Horalix start page.",
  },
  {
    id: "settings.back",
    label: "Close settings",
    component: "SettingsView",
    handlerName: "handleCloseSettings",
    shortcut: "Esc",
    expectedDisabledLogic: "Always enabled when settings is open.",
    expectedBehavior: "Returns to the active browser tab.",
  },
  {
    id: "settings.clear-data",
    label: "Clear browsing data",
    component: "SettingsView",
    handlerName: "handleClearBrowsingData",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Clears native WebView data, session tabs, and blocker counters.",
  },
  {
    id: "settings.clear-stats",
    label: "Clear blocker statistics",
    component: "SettingsView",
    handlerName: "handleClearBlockerStats",
    expectedDisabledLogic: "Always enabled.",
    expectedBehavior: "Resets frontend blocker counters.",
  },
  {
    id: "dev.create-1000-tabs",
    label: "Create 1000 test tabs",
    component: "DevTools",
    handlerName: "handleCreate1000Tabs",
    shortcut: "window.__HORALIX_DEV__.create1000Tabs()",
    expectedDisabledLogic: "Dev-only API.",
    expectedBehavior: "Creates 1000 sleeping fake tabs for stress testing.",
  },
];

export function registerButton(entry: {
  id: string;
  label: string;
  component: string;
  handler: (() => unknown) | null | undefined;
  disabled?: boolean;
  shortcut?: string;
}) {
  registry.set(entry.id, {
    id: entry.id,
    label: entry.label,
    component: entry.component,
    handlerName: entry.handler?.name || "anonymous",
    handlerExists: typeof entry.handler === "function",
    disabled: Boolean(entry.disabled),
    shortcut: entry.shortcut,
  });
  exposeRegistry();
  return () => {
    registry.delete(entry.id);
    exposeRegistry();
  };
}

export function useButtonRegistration(entry: Parameters<typeof registerButton>[0]) {
  useEffect(
    () => registerButton(entry),
    [entry.id, entry.label, entry.component, entry.handler, entry.disabled, entry.shortcut],
  );
}

export function getRegisteredButtons() {
  return Array.from(registry.values());
}

export function clearButtonRegistryForTests() {
  registry.clear();
  exposeRegistry();
}

function exposeRegistry() {
  if (typeof window === "undefined") return;
  window.__HORALIX_BUTTONS__ = getRegisteredButtons();
}

declare global {
  interface Window {
    __HORALIX_BUTTONS__?: ButtonRegistryEntry[];
    __HORALIX_DEV__?: {
      create1000Tabs: () => void;
      buttons: () => ButtonRegistryEntry[];
    };
  }
}
