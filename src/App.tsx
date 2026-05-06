import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  EyeOff,
  Globe2,
  Home,
  Lock,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  PanelTopClose,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  clearBrowserData,
  closeBrowserTab,
  createBrowserTab as createNativeBrowserTab,
  disableSiteBlocking as disableNativeSiteBlocking,
  goBackBrowserTab,
  goForwardBrowserTab,
  isTauriRuntime,
  navigateBrowserTab,
  onNativePrivacyEvent,
  onNativeTabEvent,
  onNativeTitleEvent,
  prewarmBrowserTab,
  reloadBrowserTab,
  resizeBrowserTab,
  setActiveBrowserTab,
  stopBrowserTab,
} from "./browser/native";
import type { BrowserBounds, NativeTabEvent } from "./browser/types";
import {
  FALLBACK_HOME_URL,
  INTERNAL_START_URL,
  faviconForUrl,
  getDisplayUrl,
  getOriginLabel,
  normalizeUrlInput,
} from "./browser/url";
import { createBrowserTab as createTabRecord } from "./browser/tabs/reducer";
import { selectHiddenTabCount, selectLiveTabs, selectTotalBlocked } from "./browser/tabs/selectors";
import type { BrowserTab } from "./browser/tabs/types";
import { useTabs } from "./browser/tabs/useTabs";
import { useButtonRegistration } from "./dev/buttonRegistry";
import { addAllowlistHost, getHostFromUrl, removeAllowlistHost } from "./privacy/allowlist";
import { classifyNavigation } from "./privacy/blocker";
import { incrementPrivacyStats } from "./privacy/stats";
import { getSearchEngine } from "./settings/defaults";
import { loadSettings, saveSettings } from "./settings/persistence";
import type { AppSettings, ThemeMode } from "./settings/types";

const PRODUCT_NAME = "Horalix Web";
type AppView = "browser" | "settings";
type ValidationState = { tone: "danger" | "warning"; message: string } | null;

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const searchEngine = useMemo(() => getSearchEngine(settings), [settings]);
  const tabsApi = useTabs({
    restoreSession: settings.tabs.restorePreviousSession,
    liveTabCacheSize: settings.tabs.liveTabCacheSize,
    sleepingTabsEnabled: settings.tabs.sleepingTabsEnabled,
  });
  const { state, dispatch, activeTab, visibleTabs, createTab, createManyTabs, closeTab, switchTab, updateTab } = tabsApi;

  const [appView, setAppView] = useState<AppView>("browser");
  const [omniboxValue, setOmniboxValue] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [validation, setValidation] = useState<ValidationState>(null);
  const [browserBounds, setBrowserBounds] = useState<BrowserBounds | null>(null);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [siteInfoOpen, setSiteInfoOpen] = useState(false);
  const [tabOverflowOpen, setTabOverflowOpen] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(state.tabs);
  const liveLabelsRef = useRef(new Set<string>());
  const hydratingLabelsRef = useRef(new Set<string>());

  const hiddenTabCount = selectHiddenTabCount(state, visibleTabs);
  const activeHost = activeTab?.url ? getHostFromUrl(activeTab.url) : "";
  const activeOrigin = activeTab?.url ? getOriginLabel(activeTab.url) : "New Tab";
  const totalBlocked = selectTotalBlocked(activeTab);
  const shouldShowActiveWebview =
    appView === "browser" &&
    Boolean(activeTab?.hasLiveWebview) &&
    (activeTab?.status === "loading" || activeTab?.status === "ready");
  const liveLabels = useMemo(() => selectLiveTabs(state).map((tab) => tab.webviewLabel), [state]);

  useEffect(() => {
    tabsRef.current = state.tabs;
  }, [state.tabs]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!isEditingAddress) {
      setOmniboxValue(activeTab?.url ? activeTab.displayUrl : "");
    }
  }, [activeTab?.displayUrl, activeTab?.id, activeTab?.url, isEditingAddress]);

  useEffect(() => {
    if (!contentRef.current) return;

    let frame = 0;
    const updateBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = contentRef.current?.getBoundingClientRect();
        if (!rect) return;
        const next = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        };
        setBrowserBounds((current) =>
          current &&
          current.x === next.x &&
          current.y === next.y &&
          current.width === next.width &&
          current.height === next.height
            ? current
            : next,
        );
      });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(contentRef.current);
    window.addEventListener("resize", updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime) return;

    const desired = new Set(liveLabels);
    for (const label of liveLabelsRef.current) {
      if (!desired.has(label)) {
        void closeBrowserTab(label);
      }
    }
    liveLabelsRef.current = desired;
  }, [liveLabels]);

  useEffect(() => {
    if (!isTauriRuntime || !browserBounds) return;
    const activeLabel = shouldShowActiveWebview ? activeTab?.webviewLabel ?? null : null;
    if (activeLabel) {
      void resizeBrowserTab(activeLabel, browserBounds);
    }
    void setActiveBrowserTab(activeLabel, liveLabels);
  }, [activeTab?.webviewLabel, browserBounds, liveLabels, shouldShowActiveWebview]);

  useEffect(() => {
    if (!isTauriRuntime || !browserBounds || appView !== "browser" || !activeTab) return;
    if (activeTab.hasLiveWebview || hydratingLabelsRef.current.has(activeTab.webviewLabel)) return;

    const label = activeTab.webviewLabel;

    if (activeTab.status === "start") {
      hydratingLabelsRef.current.add(label);
      const timer = window.setTimeout(() => {
        void prewarmBrowserTab({
          label,
          bounds: browserBounds,
          isPrivate: activeTab.isPrivate,
        })
          .then(() => updateTab(activeTab.id, { hasLiveWebview: true }))
          .finally(() => hydratingLabelsRef.current.delete(label));
      }, 120);
      return () => window.clearTimeout(timer);
    }

    if ((activeTab.status === "sleeping" || activeTab.status === "ready") && activeTab.url) {
      hydratingLabelsRef.current.add(label);
      dispatch({
        type: "navigate-start",
        id: activeTab.id,
        url: activeTab.url,
        displayUrl: activeTab.displayUrl,
        title: activeTab.title,
        favicon: activeTab.favicon,
      });
      void createNativeBrowserTab({
        label,
        input: activeTab.url,
        bounds: browserBounds,
        isPrivate: activeTab.isPrivate,
      })
        .then((decision) => {
          if (decision.blocked) {
            dispatch({
              type: "navigation-blocked",
              id: activeTab.id,
              url: decision.url,
              displayUrl: getDisplayUrl(decision.url),
              reason: decision.reason ?? "Blocked by Horalix Maximum Blocking.",
            });
          }
        })
        .catch((error) => {
          dispatch({
            type: "navigation-error",
            id: activeTab.id,
            message: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => hydratingLabelsRef.current.delete(label));
    }
  }, [activeTab, appView, browserBounds, dispatch, updateTab]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    const applyEvent = (event: NativeTabEvent) => {
      const tab = tabsRef.current.find((candidate) => candidate.webviewLabel === event.label);
      if (!tab || event.url === "about:blank") return;

      const title = cleanTitle(event.title || tab.title || getDisplayUrl(event.url));
      const displayUrl = getDisplayUrl(event.url);

      if (event.status === "blocked") {
        dispatch({
          type: "navigation-blocked",
          id: tab.id,
          url: event.url,
          displayUrl,
          reason: "Blocked by Horalix Maximum Blocking.",
        });
        return;
      }

      if (event.status === "ready") {
        dispatch({
          type: "navigation-ready",
          id: tab.id,
          url: event.url,
          displayUrl,
          title,
          favicon: faviconForUrl(event.url),
        });
        return;
      }

      dispatch({
        type: "update",
        id: tab.id,
        patch: {
          url: event.url,
          displayUrl,
          title,
          status: "loading",
          hasLiveWebview: true,
        },
      });
    };

    let unsubscribeTab: (() => void) | undefined;
    let unsubscribeTitle: (() => void) | undefined;
    let unsubscribePrivacy: (() => void) | undefined;

    void onNativeTabEvent(applyEvent).then((fn) => {
      unsubscribeTab = fn;
    });
    void onNativeTitleEvent(({ label, title }) => {
      const tab = tabsRef.current.find((candidate) => candidate.webviewLabel === label);
      if (tab) {
        dispatch({ type: "update", id: tab.id, patch: { title: cleanTitle(title) } });
      }
    }).then((fn) => {
      unsubscribeTitle = fn;
    });
    void onNativePrivacyEvent(({ label, blockedCount }) => {
      const tab = tabsRef.current.find((candidate) => candidate.webviewLabel === label);
      if (tab) {
        dispatch({
          type: "update",
          id: tab.id,
          patch: {
            blockStats: {
              ...tab.blockStats,
              cosmetic: Math.max(tab.blockStats.cosmetic, blockedCount),
            },
          },
        });
      }
    }).then((fn) => {
      unsubscribePrivacy = fn;
    });

    return () => {
      unsubscribeTab?.();
      unsubscribeTitle?.();
      unsubscribePrivacy?.();
    };
  }, [dispatch]);

  const updateSettings = useCallback((update: (current: AppSettings) => AppSettings) => {
    setSettings((current) => update(current));
  }, []);

  const createNormalTab = useCallback(
    (url = "") => {
      const activate = !settings.tabs.openNewTabsInBackground;
      const tab = createTab(
        {
          url,
          displayUrl: url ? getDisplayUrl(url) : "",
          title: url ? getDisplayUrl(url) : "New Tab",
          status: url ? "ready" : "start",
        },
        activate,
      );
      if (!activate) {
        setValidation({ tone: "warning", message: "New tab opened in the background." });
      }
      return tab;
    },
    [createTab, settings.tabs.openNewTabsInBackground],
  );

  const createPrivateTab = useCallback(() => {
    const tab = createTab({ isPrivate: true }, true);
    setAppView("browser");
    setValidation(null);
    return tab;
  }, [createTab]);

  const submitNavigation = useCallback(
    async (tab: BrowserTab, rawValue: string) => {
      const normalized = normalizeUrlInput(rawValue, searchEngine);
      setValidation(null);
      setShieldOpen(false);
      setSiteInfoOpen(false);
      setAppView("browser");

      if (normalized.kind === "start") {
        if (tab.hasLiveWebview) {
          updateTab(tab.id, { hasLiveWebview: false });
        }
        dispatch({
          type: "update",
          id: tab.id,
          patch: {
            url: "",
            displayUrl: "",
            title: "New Tab",
            favicon: "/icon.png",
            status: "start",
            errorMessage: undefined,
            blockedReason: undefined,
            canGoBack: Boolean(tab.url),
            canGoForward: false,
          },
        });
        return;
      }

      if (normalized.kind === "blocked" || normalized.kind === "invalid") {
        const reason = normalized.reason;
        setValidation({ tone: "danger", message: reason });
        if (normalized.kind === "blocked") {
          dispatch({
            type: "navigation-blocked",
            id: tab.id,
            url: normalized.url,
            displayUrl: normalized.displayUrl,
            reason,
          });
        } else {
          dispatch({
            type: "navigation-error",
            id: tab.id,
            message: reason,
          });
        }
        return;
      }

      const privacyDecision = classifyNavigation(
        normalized.url,
        {
          enabled: settings.privacy.blockerEnabled,
          blockAds: settings.privacy.blockAds,
          blockTrackers: settings.privacy.blockTrackers,
          blockDangerousProtocols: settings.privacy.blockDangerousProtocols,
        },
        settings.privacy.allowlist,
      );

      if (privacyDecision.blocked) {
        const reason = privacyDecision.reason ?? "Blocked by Horalix Maximum Blocking.";
        setValidation({ tone: "warning", message: reason });
        dispatch({
          type: "navigation-blocked",
          id: tab.id,
          url: normalized.url,
          displayUrl: normalized.displayUrl,
          reason,
        });
        if (privacyDecision.category) {
          updateTab(tab.id, {
            blockStats: incrementPrivacyStats(tab.blockStats, privacyDecision.category),
          });
        }
        return;
      }

      dispatch({
        type: "navigate-start",
        id: tab.id,
        url: normalized.url,
        displayUrl: normalized.displayUrl,
        title: normalized.displayUrl || normalized.url,
        favicon: faviconForUrl(normalized.url),
      });
      dispatch({
        type: "update",
        id: tab.id,
        patch: {
          canGoBack: Boolean(tab.url && tab.url !== normalized.url),
          canGoForward: false,
        },
      });

      if (!isTauriRuntime || !browserBounds) {
        dispatch({
          type: "navigation-ready",
          id: tab.id,
          url: normalized.url,
          displayUrl: normalized.displayUrl,
          title: normalized.displayUrl || normalized.url,
          favicon: faviconForUrl(normalized.url),
        });
        return;
      }

      try {
        const decision = tab.hasLiveWebview
          ? await navigateBrowserTab({ label: tab.webviewLabel, input: normalized.url })
          : await createNativeBrowserTab({
              label: tab.webviewLabel,
              input: normalized.url,
              bounds: browserBounds,
              isPrivate: tab.isPrivate,
            });

        if (decision.blocked) {
          dispatch({
            type: "navigation-blocked",
            id: tab.id,
            url: decision.url,
            displayUrl: getDisplayUrl(decision.url),
            reason: decision.reason ?? "Blocked by Horalix Maximum Blocking.",
          });
        }
      } catch (error) {
        dispatch({
          type: "navigation-error",
          id: tab.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [browserBounds, dispatch, searchEngine, settings.privacy, updateTab],
  );

  const handleOmniboxSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      if (activeTab) {
        void submitNavigation(activeTab, omniboxValue);
        setIsEditingAddress(false);
      }
    },
    [activeTab, omniboxValue, submitNavigation],
  );

  const handleNewTab = useCallback(() => {
    const tab = createNormalTab();
    if (!settings.tabs.openNewTabsInBackground) {
      setAppView("browser");
      switchTab(tab.id);
    }
  }, [createNormalTab, settings.tabs.openNewTabsInBackground, switchTab]);

  const handleNewPrivateTab = useCallback(() => {
    createPrivateTab();
  }, [createPrivateTab]);

  const handleCloseTab = useCallback(
    (id: string) => {
      closeTab(id);
      setShieldOpen(false);
      setSiteInfoOpen(false);
    },
    [closeTab],
  );

  const handleCloseActiveTab = useCallback(() => {
    if (activeTab) handleCloseTab(activeTab.id);
  }, [activeTab, handleCloseTab]);

  const handleSwitchTab = useCallback(
    (id: string) => {
      setAppView("browser");
      setShieldOpen(false);
      setSiteInfoOpen(false);
      switchTab(id);
      dispatch({ type: "restore-sleeping", id });
    },
    [dispatch, switchTab],
  );

  const handleRestoreClosedTab = useCallback(() => {
    const [last] = state.closedTabs;
    if (!last) return;
    const restored = createTab(
      {
        url: last.url,
        displayUrl: last.displayUrl,
        title: last.title,
        favicon: last.favicon,
        isPrivate: false,
        status: last.url ? "sleeping" : "start",
      },
      true,
    );
    dispatch({ type: "clear-closed" });
    switchTab(restored.id);
  }, [createTab, dispatch, state.closedTabs, switchTab]);

  const handleDuplicateTab = useCallback(() => {
    if (!activeTab) return;
    const duplicate = createTab(
      {
        url: activeTab.url,
        displayUrl: activeTab.displayUrl,
        title: activeTab.title,
        favicon: activeTab.favicon,
        isPrivate: activeTab.isPrivate,
        status: activeTab.url ? "sleeping" : "start",
      },
      true,
    );
    switchTab(duplicate.id);
  }, [activeTab, createTab, switchTab]);

  const handleBack = useCallback(() => {
    if (!activeTab?.canGoBack || !activeTab.hasLiveWebview) return;
    dispatch({ type: "update", id: activeTab.id, patch: { status: "loading", canGoBack: false, canGoForward: true } });
    if (isTauriRuntime) void goBackBrowserTab(activeTab.webviewLabel);
  }, [activeTab, dispatch]);

  const handleForward = useCallback(() => {
    if (!activeTab?.canGoForward || !activeTab.hasLiveWebview) return;
    dispatch({ type: "update", id: activeTab.id, patch: { status: "loading", canGoBack: true, canGoForward: false } });
    if (isTauriRuntime) void goForwardBrowserTab(activeTab.webviewLabel);
  }, [activeTab, dispatch]);

  const handleReload = useCallback(() => {
    if (!activeTab || activeTab.status === "loading") return;
    if (activeTab.hasLiveWebview && isTauriRuntime) {
      dispatch({ type: "update", id: activeTab.id, patch: { status: "loading" } });
      void reloadBrowserTab(activeTab.webviewLabel);
    } else if (activeTab.url) {
      void submitNavigation(activeTab, activeTab.url);
    }
  }, [activeTab, dispatch, submitNavigation]);

  const handleStopLoading = useCallback(() => {
    if (!activeTab || activeTab.status !== "loading") return;
    if (activeTab.hasLiveWebview && isTauriRuntime) {
      void stopBrowserTab(activeTab.webviewLabel);
    }
    dispatch({
      type: "update",
      id: activeTab.id,
      patch: { status: activeTab.url ? "ready" : "start" },
    });
  }, [activeTab, dispatch]);

  const handleHome = useCallback(() => {
    if (activeTab) void submitNavigation(activeTab, INTERNAL_START_URL);
  }, [activeTab, submitNavigation]);

  const handleToggleShield = useCallback(() => {
    setShieldOpen((open) => !open);
    setSiteInfoOpen(false);
  }, []);

  const handleToggleSiteInfo = useCallback(() => {
    setSiteInfoOpen((open) => !open);
    setShieldOpen(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setAppView("settings");
    setShieldOpen(false);
    setSiteInfoOpen(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setAppView("browser");
  }, []);

  const handleCycleTheme = useCallback(() => {
    const order: ThemeMode[] = ["system", "light", "dark"];
    updateSettings((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        theme: order[(order.indexOf(current.appearance.theme) + 1) % order.length],
      },
    }));
  }, [updateSettings]);

  const handleAllowActiveSite = useCallback(() => {
    if (!activeHost) return;
    updateSettings((current) => ({
      ...current,
      privacy: {
        ...current.privacy,
        allowlist: addAllowlistHost(current.privacy.allowlist, activeHost),
      },
    }));
    if (activeTab?.hasLiveWebview && isTauriRuntime) {
      void disableNativeSiteBlocking(activeTab.webviewLabel, activeHost);
    }
  }, [activeHost, activeTab, updateSettings]);

  const handleClearBrowsingData = useCallback(async () => {
    if (isTauriRuntime) {
      await clearBrowserData(liveLabels);
    }
    updateSettings((current) => ({
      ...current,
      privacy: {
        ...current.privacy,
        allowlist: [],
      },
    }));
    for (const tab of state.tabs) {
      updateTab(tab.id, {
        blockStats: { ads: 0, trackers: 0, popups: 0, dangerous: 0, cosmetic: 0 },
        canGoBack: false,
        canGoForward: false,
      });
    }
  }, [liveLabels, state.tabs, updateSettings, updateTab]);

  const handleClearBlockerStats = useCallback(() => {
    for (const tab of state.tabs) {
      updateTab(tab.id, { blockStats: { ads: 0, trackers: 0, popups: 0, dangerous: 0, cosmetic: 0 } });
    }
  }, [state.tabs, updateTab]);

  const handleCreate1000Tabs = useCallback(() => {
    const tabs = Array.from({ length: 1000 }, (_, index) =>
      createTabRecord({
        url: `https://example.com/stress/${index + 1}`,
        displayUrl: `example.com/stress/${index + 1}`,
        title: `Stress Tab ${index + 1}`,
        status: "sleeping",
      }),
    );
    createManyTabs(tabs, tabs[0]?.id);
    setValidation({ tone: "warning", message: "Created 1000 sleeping stress tabs." });
  }, [createManyTabs]);

  useEffect(() => {
    window.__HORALIX_DEV__ = {
      create1000Tabs: handleCreate1000Tabs,
      buttons: () => window.__HORALIX_BUTTONS__ ?? [],
    };
  }, [handleCreate1000Tabs]);

  const handleGlobalKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isEditable =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      const isMod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isMod && key === "l") {
        event.preventDefault();
        addressRef.current?.focus();
        addressRef.current?.select();
        return;
      }

      if (event.key === "Escape") {
        if (shieldOpen || siteInfoOpen) {
          setShieldOpen(false);
          setSiteInfoOpen(false);
        } else if (appView === "settings") {
          handleCloseSettings();
        } else if (activeTab?.status === "loading") {
          handleStopLoading();
        } else if (isEditable) {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      if (isEditable && key === "w" && isMod) return;

      if (isMod && key === "t" && !event.shiftKey) {
        event.preventDefault();
        handleNewTab();
      } else if (isMod && key === "w") {
        event.preventDefault();
        handleCloseActiveTab();
      } else if (isMod && key === "r") {
        event.preventDefault();
        handleReload();
      } else if (isMod && key === "n" && event.shiftKey) {
        event.preventDefault();
        handleNewPrivateTab();
      } else if (isMod && key === "t" && event.shiftKey) {
        event.preventDefault();
        handleRestoreClosedTab();
      } else if (isMod && key === ",") {
        event.preventDefault();
        handleOpenSettings();
      } else if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        handleForward();
      } else if (isMod && event.key === "Tab") {
        event.preventDefault();
        const currentIndex = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
        const delta = event.shiftKey ? -1 : 1;
        const next = state.tabs[(currentIndex + delta + state.tabs.length) % state.tabs.length];
        if (next) handleSwitchTab(next.id);
      } else if (isMod && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const index = event.key === "9" ? state.tabs.length - 1 : Number(event.key) - 1;
        const next = state.tabs[index];
        if (next) handleSwitchTab(next.id);
      }
    },
    [
      activeTab?.status,
      appView,
      handleBack,
      handleCloseActiveTab,
      handleCloseSettings,
      handleForward,
      handleNewPrivateTab,
      handleNewTab,
      handleOpenSettings,
      handleReload,
      handleRestoreClosedTab,
      handleStopLoading,
      handleSwitchTab,
      shieldOpen,
      siteInfoOpen,
      state.activeTabId,
      state.tabs,
    ],
  );

  const productTitle = appView === "settings" ? "Settings" : activeTab?.title || PRODUCT_NAME;
  const activeSiteAllowed = Boolean(activeHost && settings.privacy.allowlist.includes(activeHost));

  return (
    <div
      className="app-shell"
      data-theme={settings.appearance.theme}
      data-density={settings.appearance.compactMode ? "compact" : "regular"}
      onKeyDown={handleGlobalKeyDown}
    >
      <header className="browser-chrome">
        <Titlebar productTitle={productTitle} />

        <TabStrip
          activeTabId={state.activeTabId}
          draggedTabId={draggedTabId}
          hiddenTabCount={hiddenTabCount}
          overflowOpen={tabOverflowOpen}
          tabs={state.tabs}
          visibleTabs={visibleTabs}
          onClose={handleCloseTab}
          onNewTab={handleNewTab}
          onNewPrivateTab={handleNewPrivateTab}
          onOverflowToggle={() => setTabOverflowOpen((open) => !open)}
          onPin={(tab) => dispatch({ type: "pin", id: tab.id, pinned: !tab.isPinned })}
          onReorder={(draggedId, targetId) => dispatch({ type: "reorder", draggedId, targetId })}
          onSelect={handleSwitchTab}
          onSetDragged={setDraggedTabId}
        />

        <Toolbar
          activeHost={activeHost}
          activeOrigin={activeOrigin}
          activeSiteAllowed={activeSiteAllowed}
          activeTab={activeTab}
          addressRef={addressRef}
          blockedCount={totalBlocked}
          omniboxValue={omniboxValue}
          shieldOpen={shieldOpen}
          siteInfoOpen={siteInfoOpen}
          theme={settings.appearance.theme}
          validation={validation}
          onAddressBlur={() => setIsEditingAddress(false)}
          onAddressChange={setOmniboxValue}
          onAddressFocus={() => {
            setIsEditingAddress(true);
            setOmniboxValue(activeTab?.url ?? "");
          }}
          onAllowSite={handleAllowActiveSite}
          onBack={handleBack}
          onCycleTheme={handleCycleTheme}
          onDuplicate={handleDuplicateTab}
          onForward={handleForward}
          onHome={handleHome}
          onOpenSettings={handleOpenSettings}
          onReload={handleReload}
          onRestoreClosed={handleRestoreClosedTab}
          onShieldToggle={handleToggleShield}
          onSiteInfoToggle={handleToggleSiteInfo}
          onStop={handleStopLoading}
          onSubmit={handleOmniboxSubmit}
          restoreDisabled={!state.closedTabs.length}
        />
      </header>

      <main ref={contentRef} className="content-host">
        {appView === "settings" ? (
          <SettingsView
            settings={settings}
            onChange={updateSettings}
            onClearBlockerStats={handleClearBlockerStats}
            onClearBrowsingData={() => void handleClearBrowsingData()}
            onClose={handleCloseSettings}
          />
        ) : shouldShowActiveWebview ? (
          <div className="webview-plate" aria-label="Web page is displayed in a native WebView2 surface" />
        ) : (
          <PageSurface
            activeTab={activeTab}
            closedTabs={state.closedTabs}
            settings={settings}
            validation={validation}
            onClearValidation={() => setValidation(null)}
            onCopyUrl={(value) => void copyText(value)}
            onCreatePrivate={handleNewPrivateTab}
            onNavigate={(value) => activeTab && void submitNavigation(activeTab, value)}
            onOpenSettings={handleOpenSettings}
            onRestoreClosed={handleRestoreClosedTab}
          />
        )}
      </main>
    </div>
  );
}

function Titlebar({ productTitle }: { productTitle: string }) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="brand-lockup" data-tauri-drag-region>
        <img className="brand-mark" src="/icon.png" alt="" />
        <span>{PRODUCT_NAME}</span>
      </div>
      <div className="window-title" data-tauri-drag-region>
        {productTitle}
      </div>
      <WindowControls />
    </div>
  );
}

function WindowControls() {
  const handleMinimizeWindow = useCallback(async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  }, []);

  const handleToggleMaximizeWindow = useCallback(async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  }, []);

  const handleCloseWindow = useCallback(async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  }, []);

  return (
    <div className="window-controls">
      <IconButton
        buttonId="window.minimize"
        className="window-button"
        component="WindowControls"
        label="Minimize"
        onClick={() => void handleMinimizeWindow()}
        shortcut="Alt+Space then N"
      >
        <Minus size={15} />
      </IconButton>
      <IconButton
        buttonId="window.maximize"
        className="window-button"
        component="WindowControls"
        label="Maximize or restore"
        onClick={() => void handleToggleMaximizeWindow()}
        shortcut="Alt+Space then X"
      >
        <Maximize2 size={14} />
      </IconButton>
      <IconButton
        buttonId="window.close"
        className="window-button close-window"
        component="WindowControls"
        label="Close window"
        onClick={() => void handleCloseWindow()}
        shortcut="Alt+F4"
      >
        <PanelTopClose size={15} />
      </IconButton>
    </div>
  );
}

function TabStrip({
  activeTabId,
  draggedTabId,
  hiddenTabCount,
  overflowOpen,
  tabs,
  visibleTabs,
  onClose,
  onNewPrivateTab,
  onNewTab,
  onOverflowToggle,
  onPin,
  onReorder,
  onSelect,
  onSetDragged,
}: {
  activeTabId: string;
  draggedTabId: string | null;
  hiddenTabCount: number;
  overflowOpen: boolean;
  tabs: BrowserTab[];
  visibleTabs: BrowserTab[];
  onClose: (id: string) => void;
  onNewPrivateTab: () => void;
  onNewTab: () => void;
  onOverflowToggle: () => void;
  onPin: (tab: BrowserTab) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onSelect: (id: string) => void;
  onSetDragged: (id: string | null) => void;
}) {
  const visibleIds = new Set(visibleTabs.map((tab) => tab.id));
  const hiddenTabs = tabs.filter((tab) => !visibleIds.has(tab.id));

  return (
    <div className="tab-row">
      <div className="tabs" role="tablist" aria-label="Open tabs">
        {visibleTabs.map((tab) => (
          <TabItem
            key={tab.id}
            active={tab.id === activeTabId}
            draggedTabId={draggedTabId}
            tab={tab}
            onClose={onClose}
            onPin={onPin}
            onReorder={onReorder}
            onSelect={onSelect}
            onSetDragged={onSetDragged}
          />
        ))}
      </div>
      {hiddenTabCount ? (
        <div className="tab-overflow-wrap">
          <IconButton
            buttonId="tabs.overflow"
            className="icon-button"
            component="TabStrip"
            label={`${hiddenTabCount} hidden tabs`}
            onClick={onOverflowToggle}
          >
            <ChevronDown size={16} />
          </IconButton>
          {overflowOpen ? (
            <div className="tab-overflow-panel" role="menu" aria-label="Hidden tabs">
              {hiddenTabs.map((tab) => (
                <button key={tab.id} type="button" aria-label={`Select hidden tab ${tab.title}`} onClick={() => onSelect(tab.id)}>
                  <img src={tab.favicon || "/icon.png"} alt="" />
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <IconButton buttonId="tabs.new" className="icon-button" component="TabStrip" label="New tab" onClick={onNewTab} shortcut="Ctrl/Cmd+T">
        <Plus size={17} />
      </IconButton>
      <IconButton
        buttonId="tabs.private"
        className="icon-button"
        component="TabStrip"
        label="New private tab"
        onClick={onNewPrivateTab}
        shortcut="Ctrl/Cmd+Shift+N"
      >
        <EyeOff size={16} />
      </IconButton>
    </div>
  );
}

const TabItem = memo(function TabItem({
  active,
  draggedTabId,
  tab,
  onClose,
  onPin,
  onReorder,
  onSelect,
  onSetDragged,
}: {
  active: boolean;
  draggedTabId: string | null;
  tab: BrowserTab;
  onClose: (id: string) => void;
  onPin: (tab: BrowserTab) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onSelect: (id: string) => void;
  onSetDragged: (id: string | null) => void;
}) {
  const handleSelect = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);
  const handleClose = useCallback(() => onClose(tab.id), [onClose, tab.id]);
  const handlePin = useCallback(() => onPin(tab), [onPin, tab]);

  useButtonRegistration({
    id: `tabs.select.${tab.id}`,
    label: `Select ${tab.title}`,
    component: "TabItem",
    handler: handleSelect,
    disabled: false,
  });
  useButtonRegistration({
    id: `tabs.close.${tab.id}`,
    label: `Close ${tab.title}`,
    component: "TabItem",
    handler: handleClose,
    disabled: false,
    shortcut: active ? "Ctrl/Cmd+W" : undefined,
  });

  return (
    <div
      className={`tab-card ${active ? "active" : ""} ${tab.isPinned ? "pinned" : ""} ${tab.isPrivate ? "private" : ""}`}
      draggable
      onDragStart={() => onSetDragged(tab.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        if (draggedTabId && draggedTabId !== tab.id) onReorder(draggedTabId, tab.id);
        onSetDragged(null);
      }}
    >
      <button
        className="tab-select"
        role="tab"
        aria-label={`Select ${tab.title}`}
        aria-selected={active}
        title={tab.title}
        type="button"
        onClick={handleSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSelect();
          }
        }}
      >
        <span className={`tab-status ${tab.status}`} aria-hidden="true" />
        <img className="tab-favicon" src={tab.favicon || "/icon.png"} alt="" />
        <span className="tab-title">{tab.isPinned ? "" : tab.title}</span>
        {tab.isPrivate ? <EyeOff size={13} aria-hidden="true" /> : null}
      </button>
      {active ? (
        <button className="tab-pin" type="button" aria-label={tab.isPinned ? "Unpin tab" : "Pin tab"} title={tab.isPinned ? "Unpin tab" : "Pin tab"} onClick={handlePin}>
          <Pin size={12} />
        </button>
      ) : null}
      <button className="tab-close-button" type="button" aria-label={`Close ${tab.title}`} title="Close tab" onClick={handleClose}>
        <X size={13} />
      </button>
    </div>
  );
});

function Toolbar({
  activeHost,
  activeOrigin,
  activeSiteAllowed,
  activeTab,
  addressRef,
  blockedCount,
  omniboxValue,
  shieldOpen,
  siteInfoOpen,
  theme,
  validation,
  onAddressBlur,
  onAddressChange,
  onAddressFocus,
  onAllowSite,
  onBack,
  onCycleTheme,
  onDuplicate,
  onForward,
  onHome,
  onOpenSettings,
  onReload,
  onRestoreClosed,
  onShieldToggle,
  onSiteInfoToggle,
  onStop,
  onSubmit,
  restoreDisabled,
}: {
  activeHost: string;
  activeOrigin: string;
  activeSiteAllowed: boolean;
  activeTab?: BrowserTab;
  addressRef: RefObject<HTMLInputElement | null>;
  blockedCount: number;
  omniboxValue: string;
  shieldOpen: boolean;
  siteInfoOpen: boolean;
  theme: ThemeMode;
  validation: ValidationState;
  onAddressBlur: () => void;
  onAddressChange: (value: string) => void;
  onAddressFocus: () => void;
  onAllowSite: () => void;
  onBack: () => void;
  onCycleTheme: () => void;
  onDuplicate: () => void;
  onForward: () => void;
  onHome: () => void;
  onOpenSettings: () => void;
  onReload: () => void;
  onRestoreClosed: () => void;
  onShieldToggle: () => void;
  onSiteInfoToggle: () => void;
  onStop: () => void;
  onSubmit: (event?: FormEvent) => void;
  restoreDisabled: boolean;
}) {
  const loading = activeTab?.status === "loading";
  useButtonRegistration({
    id: "omnibox.submit",
    label: "Open address",
    component: "Toolbar",
    handler: () => onSubmit(),
    disabled: false,
    shortcut: "Enter",
  });
  useButtonRegistration({
    id: "security.lock",
    label: "Site information",
    component: "Toolbar",
    handler: onSiteInfoToggle,
    disabled: false,
  });

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <IconButton buttonId="nav.back" className="icon-button" component="Toolbar" disabled={!activeTab?.canGoBack} label="Back" onClick={onBack} shortcut="Alt+Left">
          <ArrowLeft size={18} />
        </IconButton>
        <IconButton
          buttonId="nav.forward"
          className="icon-button"
          component="Toolbar"
          disabled={!activeTab?.canGoForward}
          label="Forward"
          onClick={onForward}
          shortcut="Alt+Right"
        >
          <ArrowRight size={18} />
        </IconButton>
        {loading ? (
          <IconButton buttonId="nav.stop" className="icon-button" component="Toolbar" label="Stop loading" onClick={onStop} shortcut="Esc">
            <Square size={15} />
          </IconButton>
        ) : (
          <IconButton buttonId="nav.reload" className="icon-button" component="Toolbar" label="Reload" onClick={onReload} shortcut="Ctrl/Cmd+R">
            <RefreshCw size={17} />
          </IconButton>
        )}
        <IconButton buttonId="nav.home" className="icon-button" component="Toolbar" label="Home" onClick={onHome} shortcut="Alt+Home">
          <Home size={17} />
        </IconButton>
      </div>

      <form className={`address-bar ${validation ? validation.tone : ""}`} onSubmit={onSubmit}>
        <button className="address-lock-button" type="button" aria-label="Site information" title="Site information" onClick={onSiteInfoToggle}>
          <Lock size={15} />
        </button>
        <input
          ref={addressRef}
          aria-label="Search or enter address"
          value={omniboxValue}
          onBlur={onAddressBlur}
          onChange={(event) => onAddressChange(event.target.value)}
          onFocus={onAddressFocus}
          placeholder="Search or enter address"
          spellCheck={false}
        />
        <button className="go-button" type="submit" aria-label="Open address" title="Open address">
          <Search size={16} />
        </button>
        {siteInfoOpen ? <SiteInfoPanel activeOrigin={activeOrigin} activeTab={activeTab} /> : null}
      </form>

      <div className="toolbar-group end">
        <div className="shield-wrap">
          <IconButton
            buttonId="privacy.shield"
            className={`icon-button shield-button ${activeSiteAllowed ? "paused" : ""}`}
            component="Toolbar"
            label="Privacy shield"
            onClick={onShieldToggle}
          >
            <Shield size={17} />
            {blockedCount ? <span className="shield-count">{blockedCount}</span> : null}
          </IconButton>
          {shieldOpen ? (
            <ShieldPanel
              activeHost={activeHost}
              activeSiteAllowed={activeSiteAllowed}
              activeTab={activeTab}
              blockedCount={blockedCount}
              onAllowSite={onAllowSite}
              onOpenSettings={onOpenSettings}
            />
          ) : null}
        </div>
        <IconButton buttonId="theme.toggle" className="icon-button" component="Toolbar" label={`Theme: ${theme}`} onClick={onCycleTheme}>
          {theme === "dark" ? <Moon size={16} /> : theme === "light" ? <Sun size={16} /> : <Monitor size={16} />}
        </IconButton>
        <IconButton buttonId="tabs.duplicate" className="icon-button" component="Toolbar" disabled={!activeTab} label="Duplicate tab" onClick={onDuplicate}>
          <Copy size={16} />
        </IconButton>
        <IconButton
          buttonId="tabs.restore"
          className="icon-button"
          component="Toolbar"
          disabled={restoreDisabled}
          label="Restore closed tab"
          onClick={onRestoreClosed}
          shortcut="Ctrl/Cmd+Shift+T"
        >
          <RotateCcw size={16} />
        </IconButton>
        <IconButton buttonId="settings.open" className="icon-button" component="Toolbar" label="Settings" onClick={onOpenSettings} shortcut="Ctrl/Cmd+comma">
          <Settings size={17} />
        </IconButton>
      </div>
    </div>
  );
}

function SiteInfoPanel({ activeOrigin, activeTab }: { activeOrigin: string; activeTab?: BrowserTab }) {
  return (
    <div className="site-info-panel" role="dialog" aria-label="Site information">
      <div className="panel-kicker">Connection</div>
      <strong>{activeOrigin}</strong>
      <p>{activeTab?.url?.startsWith("https://") ? "Encrypted HTTPS page." : activeTab?.url ? "Non-HTTPS or internal page." : "Internal Horalix start page."}</p>
    </div>
  );
}

function ShieldPanel({
  activeHost,
  activeSiteAllowed,
  activeTab,
  blockedCount,
  onAllowSite,
  onOpenSettings,
}: {
  activeHost: string;
  activeSiteAllowed: boolean;
  activeTab?: BrowserTab;
  blockedCount: number;
  onAllowSite: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="shield-panel" role="dialog" aria-label="Privacy shield">
      <div className="shield-panel-header">
        <div>
          <span className="panel-kicker">Maximum blocking</span>
          <strong>{activeHost || "New tab"}</strong>
        </div>
        <ShieldCheck size={20} />
      </div>
      <div className="shield-grid">
        <Metric label="Ads" value={activeTab?.blockStats.ads ?? 0} />
        <Metric label="Trackers" value={activeTab?.blockStats.trackers ?? 0} />
        <Metric label="Cosmetic" value={activeTab?.blockStats.cosmetic ?? 0} />
        <Metric label="Total" value={blockedCount} />
      </div>
      <button className="panel-action" type="button" aria-label="Allow this site until restart" disabled={!activeHost || activeSiteAllowed} onClick={onAllowSite}>
        {activeSiteAllowed ? <Check size={15} /> : <Zap size={15} />}
        <span>{activeSiteAllowed ? "Allowed for this site" : "Allow this site"}</span>
      </button>
      <button className="panel-secondary" type="button" aria-label="Manage privacy rules" onClick={onOpenSettings}>
        <SlidersHorizontal size={15} />
        <span>Manage rules</span>
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PageSurface({
  activeTab,
  closedTabs,
  settings,
  validation,
  onClearValidation,
  onCopyUrl,
  onCreatePrivate,
  onNavigate,
  onOpenSettings,
  onRestoreClosed,
}: {
  activeTab?: BrowserTab;
  closedTabs: BrowserTab[];
  settings: AppSettings;
  validation: ValidationState;
  onClearValidation: () => void;
  onCopyUrl: (value: string) => void;
  onCreatePrivate: () => void;
  onNavigate: (value: string) => void;
  onOpenSettings: () => void;
  onRestoreClosed: () => void;
}) {
  if (activeTab?.status === "blocked") {
    return (
      <StatePage
        icon={<Shield size={24} />}
        title="Navigation blocked"
        description={activeTab.blockedReason ?? "Horalix stopped this address before it could load."}
        url={activeTab.url}
          onCopyUrl={onCopyUrl}
          onHome={() => onNavigate(INTERNAL_START_URL)}
          onOpenExternal={openExternalSafe}
          onRetry={() => onNavigate(activeTab.url)}
        />
    );
  }

  if (activeTab?.status === "error") {
    return (
      <StatePage
        icon={<AlertTriangle size={24} />}
        title="Page could not open"
        description={activeTab.errorMessage ?? "The WebView could not complete this navigation."}
        url={activeTab.url}
        onCopyUrl={onCopyUrl}
        onHome={() => onNavigate(INTERNAL_START_URL)}
        onOpenExternal={openExternalSafe}
        onRetry={() => onNavigate(activeTab.url || FALLBACK_HOME_URL)}
      />
    );
  }

  if (activeTab?.status === "sleeping") {
    return (
      <StatePage
        icon={<Activity size={24} />}
        title="Tab is sleeping"
        description="This tab is stored as lightweight metadata. Opening it restores a live WebView only when needed."
        url={activeTab.url}
        primaryLabel="Wake tab"
        onCopyUrl={onCopyUrl}
        onHome={() => onNavigate(INTERNAL_START_URL)}
        onOpenExternal={openExternalSafe}
        onRetry={() => onNavigate(activeTab.url)}
      />
    );
  }

  return (
    <StartPage
      closedTabs={closedTabs}
      settings={settings}
      validation={validation}
      onClearValidation={onClearValidation}
      onCreatePrivate={onCreatePrivate}
      onNavigate={onNavigate}
      onOpenSettings={onOpenSettings}
      onRestoreClosed={onRestoreClosed}
    />
  );
}

function StartPage({
  closedTabs,
  settings,
  validation,
  onClearValidation,
  onCreatePrivate,
  onNavigate,
  onOpenSettings,
  onRestoreClosed,
}: {
  closedTabs: BrowserTab[];
  settings: AppSettings;
  validation: ValidationState;
  onClearValidation: () => void;
  onCreatePrivate: () => void;
  onNavigate: (value: string) => void;
  onOpenSettings: () => void;
  onRestoreClosed: () => void;
}) {
  const [value, setValue] = useState("");
  const searchName = getSearchEngine(settings).name;

  const handleStartSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      onNavigate(value);
    },
    [onNavigate, value],
  );
  const handleOpenSearch = useCallback(() => onNavigate(FALLBACK_HOME_URL), [onNavigate]);
  const handleOpenGithub = useCallback(() => onNavigate("https://github.com"), [onNavigate]);
  const handleOpenExample = useCallback(() => onNavigate("https://example.com"), [onNavigate]);
  useButtonRegistration({
    id: "start.submit",
    label: "Start page open or search",
    component: "StartPage",
    handler: () => handleStartSubmit(),
    disabled: false,
    shortcut: "Enter",
  });

  return (
    <section className="start-page">
      <div className="start-hero">
        <img className="start-mark" src="/icon.png" alt="" />
        <div className="status-row" aria-label="Horalix status">
          <span>
            <ShieldCheck size={14} />
            Protected
          </span>
          <span>
            <Zap size={14} />
            Fast
          </span>
          <span>
            <EyeOff size={14} />
            Private-ready
          </span>
        </div>
        <h1>{PRODUCT_NAME}</h1>
        <form className={`start-omnibox ${validation ? validation.tone : ""}`} onSubmit={handleStartSubmit}>
          <Search size={20} />
          <input
            aria-label="Search privately or enter a website"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              onClearValidation();
            }}
            placeholder={`Search with ${searchName} or enter a website`}
            spellCheck={false}
          />
          <button type="submit" aria-label="Open or search">
            Open
          </button>
        </form>
        {validation ? <p className={`validation ${validation.tone}`}>{validation.message}</p> : null}
      </div>

      <div className="start-grid">
        <QuickAction id="start.search" icon={<Search size={18} />} label="Search" onClick={handleOpenSearch} />
        <QuickAction id="start.github" icon={<Globe2 size={18} />} label="GitHub" onClick={handleOpenGithub} />
        <QuickAction id="start.example" icon={<Globe2 size={18} />} label="Example" onClick={handleOpenExample} />
        <QuickAction id="start.private" icon={<EyeOff size={18} />} label="Private" onClick={onCreatePrivate} />
        <QuickAction id="start.settings" icon={<Settings size={18} />} label="Settings" onClick={onOpenSettings} />
      </div>

      <div className="start-lower">
        <div className="privacy-card">
          <div>
            <span className="panel-kicker">Privacy shield</span>
            <strong>Maximum blocking is active</strong>
          </div>
          <p>Ads, trackers, dangerous protocols, popups, and common annoyance containers are blocked using native checks plus bundled WebView2 extension rules.</p>
        </div>
        <div className="recent-card">
          <div className="recent-header">
            <span className="panel-kicker">Recent</span>
            <button type="button" aria-label="Restore last closed tab" disabled={!closedTabs.length} onClick={onRestoreClosed}>
              <RotateCcw size={15} />
              Restore
            </button>
          </div>
          {closedTabs.length ? (
            closedTabs.slice(0, 4).map((tab) => (
              <button key={tab.id} className="recent-tab" type="button" aria-label={`Open recent tab ${tab.title}`} onClick={() => onNavigate(tab.url || FALLBACK_HOME_URL)}>
                <img src={tab.favicon || "/icon.png"} alt="" />
                <span>{tab.title}</span>
              </button>
            ))
          ) : (
            <p>No recent tabs yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function QuickAction({ id, icon, label, onClick }: { id: string; icon: ReactNode; label: string; onClick: () => void }) {
  useButtonRegistration({
    id,
    label,
    component: "StartPage",
    handler: onClick,
    disabled: false,
  });

  return (
    <button className="quick-action" type="button" aria-label={label} onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
    </button>
  );
}

function StatePage({
  description,
  icon,
  onCopyUrl,
  onHome,
  onOpenExternal,
  onRetry,
  primaryLabel = "Retry",
  title,
  url,
}: {
  description: string;
  icon: ReactNode;
  onCopyUrl: (value: string) => void;
  onHome: () => void;
  onOpenExternal: (value: string) => void;
  onRetry: () => void;
  primaryLabel?: string;
  title: string;
  url: string;
}) {
  useButtonRegistration({
    id: "state.retry",
    label: primaryLabel,
    component: "StatePage",
    handler: onRetry,
    disabled: false,
  });
  useButtonRegistration({
    id: "state.copy-url",
    label: "Copy URL",
    component: "StatePage",
    handler: () => onCopyUrl(url),
    disabled: !url,
  });
  useButtonRegistration({
    id: "state.open-external",
    label: "Open externally",
    component: "StatePage",
    handler: () => onOpenExternal(url),
    disabled: !isSafeExternalUrl(url),
  });
  useButtonRegistration({
    id: "state.home",
    label: "Return home",
    component: "StatePage",
    handler: onHome,
    disabled: false,
  });

  return (
    <section className="state-page">
      <div className="state-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {url ? <code>{url}</code> : null}
      <div className="state-actions">
        <button type="button" aria-label={primaryLabel} onClick={onRetry}>
          <RefreshCw size={16} />
          {primaryLabel}
        </button>
        <button type="button" aria-label="Copy URL" disabled={!url} onClick={() => onCopyUrl(url)}>
          <Copy size={16} />
          Copy URL
        </button>
        <button type="button" aria-label="Open externally" disabled={!isSafeExternalUrl(url)} onClick={() => onOpenExternal(url)}>
          <Globe2 size={16} />
          Open externally
        </button>
        <button type="button" aria-label="Return home" onClick={onHome}>
          <Home size={16} />
          Home
        </button>
      </div>
    </section>
  );
}

function SettingsView({
  settings,
  onChange,
  onClearBlockerStats,
  onClearBrowsingData,
  onClose,
}: {
  settings: AppSettings;
  onChange: (update: (current: AppSettings) => AppSettings) => void;
  onClearBlockerStats: () => void;
  onClearBrowsingData: () => void;
  onClose: () => void;
}) {
  const [allowHost, setAllowHost] = useState("");
  useButtonRegistration({
    id: "settings.clear-data",
    label: "Clear browsing data",
    component: "SettingsView",
    handler: onClearBrowsingData,
    disabled: false,
  });
  useButtonRegistration({
    id: "settings.clear-stats",
    label: "Clear blocker statistics",
    component: "SettingsView",
    handler: onClearBlockerStats,
    disabled: false,
  });

  return (
    <section className="settings-page" aria-label="Settings">
      <div className="settings-header">
        <div>
          <span className="panel-kicker">Preferences</span>
          <h1>Settings</h1>
        </div>
        <IconButton buttonId="settings.back" className="icon-button" component="SettingsView" label="Close settings" onClick={onClose} shortcut="Esc">
          <X size={17} />
        </IconButton>
      </div>

      <div className="settings-layout">
        <SettingsSection title="Appearance" description="System-aware chrome with restrained contrast.">
          <SegmentedControl
            label="Theme"
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
            value={settings.appearance.theme}
            onChange={(theme) =>
              onChange((current) => ({
                ...current,
                appearance: { ...current.appearance, theme: theme as ThemeMode },
              }))
            }
          />
          <ToggleRow
            checked={settings.appearance.compactMode}
            label="Compact mode"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                appearance: { ...current.appearance, compactMode: checked },
              }))
            }
          />
        </SettingsSection>

        <SettingsSection title="Search" description="Choose the provider used by every Horalix omnibox.">
          <SelectRow
            label="Search engine"
            value={settings.search.engine}
            options={[
              ["duckduckgo", "DuckDuckGo"],
              ["google", "Google"],
              ["brave", "Brave"],
              ["bing", "Bing"],
              ["custom", "Custom"],
            ]}
            onChange={(engine) =>
              onChange((current) => ({
                ...current,
                search: { ...current.search, engine: engine as AppSettings["search"]["engine"] },
              }))
            }
          />
          {settings.search.engine === "custom" ? (
            <label className="text-field">
              <span>Custom search URL</span>
              <input
                value={settings.search.customSearchUrl}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    search: { ...current.search, customSearchUrl: event.target.value },
                  }))
                }
                placeholder="https://example.com/search?q={searchTerms}"
              />
            </label>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Privacy" description="Maximum blocking is enabled by default.">
          <ToggleRow
            checked={settings.privacy.blockerEnabled}
            label="Privacy blocker"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                privacy: { ...current.privacy, blockerEnabled: checked },
              }))
            }
          />
          <ToggleRow
            checked={settings.privacy.blockAds}
            label="Block ads"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                privacy: { ...current.privacy, blockAds: checked },
              }))
            }
          />
          <ToggleRow
            checked={settings.privacy.blockTrackers}
            label="Block trackers"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                privacy: { ...current.privacy, blockTrackers: checked },
              }))
            }
          />
          <ToggleRow
            checked={settings.privacy.blockDangerousProtocols}
            label="Block dangerous protocols"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                privacy: { ...current.privacy, blockDangerousProtocols: checked },
              }))
            }
          />
          <form
            className="allowlist-form"
            onSubmit={(event) => {
              event.preventDefault();
              onChange((current) => ({
                ...current,
                privacy: { ...current.privacy, allowlist: addAllowlistHost(current.privacy.allowlist, allowHost) },
              }));
              setAllowHost("");
            }}
          >
            <input aria-label="Allowlist host" value={allowHost} onChange={(event) => setAllowHost(event.target.value)} placeholder="example.com" />
            <button type="submit" aria-label="Add allowlist host">
              Add
            </button>
          </form>
          <div className="allowlist-list">
            {settings.privacy.allowlist.length ? (
              settings.privacy.allowlist.map((host) => (
                <span key={host}>
                  {host}
                  <button
                    type="button"
                    aria-label={`Remove ${host} from allowlist`}
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        privacy: { ...current.privacy, allowlist: removeAllowlistHost(current.privacy.allowlist, host) },
                      }))
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            ) : (
              <p>No allowlisted sites.</p>
            )}
          </div>
          <div className="settings-actions">
            <button type="button" aria-label="Clear browsing data" onClick={onClearBrowsingData}>
              <Trash2 size={16} />
              Clear browsing data
            </button>
            <button type="button" aria-label="Clear blocker statistics" onClick={onClearBlockerStats}>
              <RotateCcw size={16} />
              Clear blocker stats
            </button>
          </div>
        </SettingsSection>

        <SettingsSection title="Tabs" description="Keep thousands of tabs cheap by sleeping inactive pages.">
          <ToggleRow
            checked={settings.tabs.restorePreviousSession}
            label="Restore previous session"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                tabs: { ...current.tabs, restorePreviousSession: checked },
              }))
            }
          />
          <ToggleRow
            checked={settings.tabs.sleepingTabsEnabled}
            label="Sleeping tabs"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                tabs: { ...current.tabs, sleepingTabsEnabled: checked },
              }))
            }
          />
          <label className="range-row">
            <span>Live tab cache size</span>
            <input
              type="range"
              min={1}
              max={12}
              value={settings.tabs.liveTabCacheSize}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  tabs: { ...current.tabs, liveTabCacheSize: Number(event.target.value) },
                }))
              }
            />
            <strong>{settings.tabs.liveTabCacheSize}</strong>
          </label>
          <ToggleRow
            checked={settings.tabs.openNewTabsInBackground}
            label="Open new tabs in background"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                tabs: { ...current.tabs, openNewTabsInBackground: checked },
              }))
            }
          />
        </SettingsSection>

        <SettingsSection title="About" description="Horalix Web 3.0.0">
          <ul className="shortcut-list">
            <li>Ctrl/Cmd+L focuses the omnibox</li>
            <li>Ctrl/Cmd+T opens a tab</li>
            <li>Ctrl/Cmd+W closes the active tab</li>
            <li>Ctrl/Cmd+Shift+N opens a private tab</li>
            <li>Alt+Left and Alt+Right navigate history</li>
            <li>Ctrl/Cmd+1-9 switches tabs</li>
          </ul>
        </SettingsSection>
      </div>
    </section>
  );
}

function SettingsSection({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <section className="settings-section">
      <div className="settings-section-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="settings-controls">{children}</div>
    </section>
  );
}

function ToggleRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SelectRow({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="select-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <div className="segmented-row">
      <span>{label}</span>
      <div className="segmented-control">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            aria-label={`Set ${label} to ${optionLabel}`}
            aria-pressed={value === optionValue}
            className={value === optionValue ? "selected" : ""}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconButton({
  buttonId,
  children,
  className,
  component,
  disabled,
  label,
  onClick,
  shortcut,
}: {
  buttonId: string;
  children: ReactNode;
  className: string;
  component: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  useButtonRegistration({
    id: buttonId,
    label,
    component,
    handler: onClick,
    disabled,
    shortcut,
  });

  return (
    <button className={className} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

async function copyText(value: string) {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}

function openExternalSafe(value: string) {
  if (!isSafeExternalUrl(value)) return;
  window.open(value, "_blank", "noopener,noreferrer");
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanTitle(value: string) {
  return value.replace(/^"|"$/g, "").trim() || "Untitled";
}
