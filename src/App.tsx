import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Check,
  Copy,
  EyeOff,
  Globe2,
  Home,
  Lock,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelTopClose,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearBrowserData,
  closeBrowserTab,
  createBrowserTab,
  disableSiteBlocking,
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
} from "./browser/native";
import {
  createTabId,
  createWebviewLabel,
  displayUrl,
  faviconForUrl,
  resolveNavigationInput,
} from "./browser/navigation";
import type { BrowserBounds, BrowserTab, NativeTabEvent } from "./browser/types";

const PRODUCT_NAME = "Horalix Web";
const HOME_ADDRESS = "https://duckduckgo.com/";
const THEME_STORAGE_KEY = "horalix-web-theme";

type ThemeMode = "system" | "light" | "dark";

function createTab(isPrivate = false, url = ""): BrowserTab {
  const id = createTabId();

  return {
    id,
    webviewLabel: createWebviewLabel(id),
    title: url ? displayUrl(url) : "New Tab",
    url,
    address: url,
    status: "new",
    isPrivate,
    isPinned: false,
    hasWebview: false,
    canGoBack: false,
    canGoForward: false,
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
    blockedCount: 0,
    blockingDisabled: false,
  };
}

export default function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab()]);
  const [closedTabs, setClosedTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>(() => "");
  const [addressValue, setAddressValue] = useState("");
  const [browserBounds, setBrowserBounds] = useState<BrowserBounds | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode());
  const [shieldOpen, setShieldOpen] = useState(false);
  const [siteOverrides, setSiteOverrides] = useState<Set<string>>(() => new Set());

  const addressRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );
  const shouldShowActiveWebview =
    Boolean(activeTab?.hasWebview) && (activeTab?.status === "loading" || activeTab?.status === "ready");
  const activeHost = activeTab?.url ? hostForUrl(activeTab.url) : "";
  const activeSiteOverride = Boolean(activeHost && siteOverrides.has(activeHost));

  const updateTab = useCallback((id: string, update: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...update } : tab)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!activeTabId && tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (activeTab) {
      setAddressValue(activeTab.address || activeTab.url);
    }
  }, [activeTab?.id, activeTab?.address, activeTab?.url]);

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
    if (!isTauriRuntime || !browserBounds || !activeTab || activeTab.hasWebview || activeTab.status !== "new") {
      return;
    }

    const timer = window.setTimeout(() => {
      void prewarmBrowserTab({
        label: activeTab.webviewLabel,
        bounds: browserBounds,
        isPrivate: activeTab.isPrivate,
      }).then(() => {
        updateTab(activeTab.id, { hasWebview: true });
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    activeTab?.hasWebview,
    activeTab?.id,
    activeTab?.isPrivate,
    activeTab?.status,
    activeTab?.webviewLabel,
    browserBounds,
    updateTab,
  ]);

  useEffect(() => {
    if (!isTauriRuntime || !browserBounds) return;

    const labels = tabs.filter((tab) => tab.hasWebview).map((tab) => tab.webviewLabel);
    const activeLabel = shouldShowActiveWebview ? activeTab?.webviewLabel ?? null : null;
    if (activeLabel) {
      void resizeBrowserTab(activeLabel, browserBounds);
    }
    void setActiveBrowserTab(activeLabel, labels);
  }, [activeTab?.webviewLabel, browserBounds, shouldShowActiveWebview, tabs]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    const applyEvent = (event: NativeTabEvent) => {
      setTabs((current) =>
        current.map((tab) => {
          if (tab.webviewLabel !== event.label) return tab;

          const title = cleanTitle(event.title || tab.title || displayUrl(event.url));
          const nextHistory =
            event.status === "ready" && event.url && event.url !== tab.history[tab.historyIndex]
              ? [...tab.history.slice(0, tab.historyIndex + 1), event.url]
              : tab.history;
          const host = hostForUrl(event.url || tab.url);

          return {
            ...tab,
            title,
            url: event.url || tab.url,
            address: event.url || tab.address,
            status: event.status,
            error: event.status === "blocked" ? "Blocked by Horalix Maximum Blocking." : undefined,
            history: nextHistory,
            historyIndex: nextHistory.length ? nextHistory.length - 1 : tab.historyIndex,
            canGoBack: nextHistory.length > 1,
            canGoForward: false,
            blockedCount: Math.max(tab.blockedCount, event.blockedCount ?? 0),
            blockingDisabled: Boolean(host && siteOverrides.has(host)),
          };
        }),
      );
    };

    let unsubscribeTab: (() => void) | undefined;
    let unsubscribeTitle: (() => void) | undefined;
    let unsubscribePrivacy: (() => void) | undefined;

    void onNativeTabEvent(applyEvent).then((fn) => {
      unsubscribeTab = fn;
    });
    void onNativeTitleEvent(({ label, title }) => {
      setTabs((current) =>
        current.map((tab) => (tab.webviewLabel === label ? { ...tab, title: cleanTitle(title) } : tab)),
      );
    }).then((fn) => {
      unsubscribeTitle = fn;
    });
    void onNativePrivacyEvent(({ label, blockedCount }) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.webviewLabel === label ? { ...tab, blockedCount: Math.max(tab.blockedCount, blockedCount) } : tab,
        ),
      );
    }).then((fn) => {
      unsubscribePrivacy = fn;
    });

    return () => {
      unsubscribeTab?.();
      unsubscribeTitle?.();
      unsubscribePrivacy?.();
    };
  }, [siteOverrides]);

  const submitNavigation = useCallback(
    async (tab: BrowserTab, value: string) => {
      const normalized = resolveNavigationInput(value.trim());
      const targetHost = hostForUrl(normalized);
      const blockingDisabled = Boolean(targetHost && siteOverrides.has(targetHost));

      updateTab(tab.id, {
        address: normalized,
        url: normalized,
        title: displayUrl(normalized),
        status: "loading",
        error: undefined,
        blockingDisabled,
      });

      if (!isTauriRuntime || !browserBounds) {
        updateTab(tab.id, {
          status: "ready",
          hasWebview: false,
          history: [normalized],
          historyIndex: 0,
        });
        return;
      }

      try {
        const decision = tab.hasWebview
          ? await navigateBrowserTab({ label: tab.webviewLabel, input: normalized })
          : await createBrowserTab({
              label: tab.webviewLabel,
              input: normalized,
              bounds: browserBounds,
              isPrivate: tab.isPrivate,
            });

        updateTab(tab.id, {
          url: decision.url,
          address: decision.url,
          hasWebview: tab.hasWebview || !decision.blocked,
          status: decision.blocked ? "blocked" : "loading",
          error: decision.reason ?? undefined,
          blockedCount: Math.max(tab.blockedCount, decision.blockedCount ?? 0),
        });
      } catch (error) {
        updateTab(tab.id, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [browserBounds, siteOverrides, updateTab],
  );

  const addTab = useCallback(
    (isPrivate = false, url = "") => {
      const tab = createTab(isPrivate, url);
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);
      if (url) {
        window.setTimeout(() => {
          void submitNavigation(tab, url);
        }, 0);
      }
      return tab;
    },
    [submitNavigation],
  );

  const handleAddressSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeTab) {
      void submitNavigation(activeTab, addressValue);
    }
  };

  const closeTab = useCallback(
    (id: string) => {
      const tab = tabs.find((candidate) => candidate.id === id);
      if (!tab) return;

      if (tab.hasWebview && isTauriRuntime) {
        void closeBrowserTab(tab.webviewLabel);
      }

      setClosedTabs((current) => [tab, ...current].slice(0, 10));
      setTabs((current) => {
        if (current.length === 1) return [createTab(tab.isPrivate)];
        const index = current.findIndex((candidate) => candidate.id === id);
        const next = current.filter((candidate) => candidate.id !== id);
        if (activeTabId === id) {
          setActiveTabId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? "");
        }
        return next;
      });
    },
    [activeTabId, tabs],
  );

  const duplicateTab = (tab: BrowserTab) => {
    addTab(tab.isPrivate, tab.url || HOME_ADDRESS);
  };

  const restoreClosedTab = () => {
    const [last, ...rest] = closedTabs;
    if (!last) return;
    setClosedTabs(rest);
    addTab(last.isPrivate, last.url || HOME_ADDRESS);
  };

  const navigateHome = () => {
    if (activeTab) void submitNavigation(activeTab, HOME_ADDRESS);
  };

  const reloadActiveTab = () => {
    if (!activeTab) return;
    if (activeTab.hasWebview && isTauriRuntime && activeTab.status !== "new") {
      void reloadBrowserTab(activeTab.webviewLabel);
    } else if (activeTab.url) {
      void submitNavigation(activeTab, activeTab.url);
    }
  };

  const goBack = () => {
    if (activeTab?.hasWebview && isTauriRuntime) {
      void goBackBrowserTab(activeTab.webviewLabel);
    }
  };

  const goForward = () => {
    if (activeTab?.hasWebview && isTauriRuntime) {
      void goForwardBrowserTab(activeTab.webviewLabel);
    }
  };

  const disableBlockingForSite = async () => {
    if (!activeTab || !activeHost) return;
    setSiteOverrides((current) => new Set(current).add(activeHost));
    updateTab(activeTab.id, { blockingDisabled: true });
    if (isTauriRuntime && activeTab.hasWebview) {
      await disableSiteBlocking(activeTab.webviewLabel, activeHost);
    }
  };

  const clearData = async () => {
    const labels = tabs.filter((tab) => tab.hasWebview).map((tab) => tab.webviewLabel);
    if (isTauriRuntime) {
      await clearBrowserData(labels);
    }
    setSiteOverrides(new Set());
    setTabs((current) =>
      current.map((tab) => ({
        ...tab,
        status: tab.status === "ready" ? "new" : tab.status,
        error: undefined,
        blockedCount: 0,
        blockingDisabled: false,
      })),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (!isMod) return;

    if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      addressRef.current?.focus();
      addressRef.current?.select();
    }
    if (event.key.toLowerCase() === "t" && !event.shiftKey) {
      event.preventDefault();
      addTab(false);
    }
    if (event.key.toLowerCase() === "n" && event.shiftKey) {
      event.preventDefault();
      addTab(true);
    }
    if (event.key.toLowerCase() === "w") {
      event.preventDefault();
      if (activeTab) closeTab(activeTab.id);
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      reloadActiveTab();
    }
    if (event.key.toLowerCase() === "t" && event.shiftKey) {
      event.preventDefault();
      restoreClosedTab();
    }
  };

  const visibleChromeTitle = activeTab?.title || PRODUCT_NAME;

  return (
    <div className="app-shell" data-theme={themeMode} onKeyDown={handleKeyDown}>
      <header className="browser-chrome">
        <div className="titlebar" data-tauri-drag-region>
          <div className="brand-lockup" data-tauri-drag-region>
            <img className="brand-mark" src="/icon.png" alt="" />
            <span>{PRODUCT_NAME}</span>
          </div>
          <div className="window-title" data-tauri-drag-region>
            {visibleChromeTitle}
          </div>
          <WindowControls />
        </div>

        <div className="tab-row">
          <div className="tabs" role="tablist" aria-label="Open tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${tab.id === activeTab?.id ? "active" : ""} ${tab.isPinned ? "pinned" : ""}`}
                role="tab"
                aria-selected={tab.id === activeTab?.id}
                draggable
                onDragStart={() => setDraggedTabId(tab.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedTabId || draggedTabId === tab.id) return;
                  setTabs((current) => reorderTabs(current, draggedTabId, tab.id));
                  setDraggedTabId(null);
                }}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.title}
                type="button"
              >
                <span className={`tab-status ${tab.status}`} />
                <img className="tab-favicon" src={tab.url ? faviconForUrl(tab.url) : "/icon.png"} alt="" />
                <span className="tab-title">{tab.isPinned ? "" : tab.title}</span>
                {tab.isPrivate ? <EyeOff size={13} aria-hidden="true" /> : null}
                <span
                  className="tab-close"
                  role="button"
                  tabIndex={-1}
                  title="Close tab"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
          <button className="icon-button" type="button" title="New tab" onClick={() => addTab(false)}>
            <Plus size={17} />
          </button>
          <button className="icon-button" type="button" title="Private tab" onClick={() => addTab(true)}>
            <EyeOff size={16} />
          </button>
        </div>

        <div className="toolbar">
          <div className="toolbar-group">
            <button className="icon-button" type="button" title="Back" onClick={goBack} disabled={!activeTab?.canGoBack}>
              <ArrowLeft size={18} />
            </button>
            <button className="icon-button" type="button" title="Forward" onClick={goForward} disabled={!activeTab?.canGoForward}>
              <ArrowRight size={18} />
            </button>
            <button className="icon-button" type="button" title="Reload" onClick={reloadActiveTab}>
              <RefreshCw size={17} />
            </button>
            <button className="icon-button" type="button" title="Home" onClick={navigateHome}>
              <Home size={17} />
            </button>
          </div>

          <form className="address-bar" onSubmit={handleAddressSubmit}>
            <Lock size={15} className="address-lock" />
            <input
              ref={addressRef}
              value={addressValue}
              onChange={(event) => setAddressValue(event.target.value)}
              placeholder="Search or enter address"
              spellCheck={false}
            />
            <button className="go-button" type="submit" title="Go">
              <Search size={16} />
            </button>
          </form>

          <div className="toolbar-group end">
            <div className="shield-wrap">
              <button
                className={`icon-button shield-button ${activeSiteOverride ? "paused" : ""}`}
                type="button"
                title="Privacy shield"
                onClick={() => setShieldOpen((open) => !open)}
              >
                <Shield size={17} />
                {activeTab?.blockedCount ? <span className="shield-count">{activeTab.blockedCount}</span> : null}
              </button>
              {shieldOpen ? (
                <ShieldPanel
                  host={activeHost}
                  blockedCount={activeTab?.blockedCount ?? 0}
                  disabled={activeSiteOverride}
                  onDisable={() => void disableBlockingForSite()}
                  onClose={() => setShieldOpen(false)}
                />
              ) : null}
            </div>
            <button className="icon-button wide-only" type="button" title="Duplicate tab" onClick={() => activeTab && duplicateTab(activeTab)}>
              <Copy size={16} />
            </button>
            <button
              className="icon-button wide-only"
              type="button"
              title="Pin tab"
              onClick={() => activeTab && updateTab(activeTab.id, { isPinned: !activeTab.isPinned })}
            >
              <Pin size={16} />
            </button>
            <button className="icon-button wide-only" type="button" title="Restore tab" onClick={restoreClosedTab}>
              <RotateCcw size={16} />
            </button>
            <button className="icon-button wide-only" type="button" title="Clear browsing data" onClick={() => void clearData()}>
              <Brush size={16} />
            </button>
            <ThemeSwitch value={themeMode} onChange={setThemeMode} />
            <button className="icon-button compact-menu" type="button" title="More">
              <MoreHorizontal size={17} />
            </button>
          </div>
        </div>
      </header>

      <main ref={contentRef} className="content-host">
        {!shouldShowActiveWebview ? (
          <StartSurface
            tab={activeTab}
            onNavigate={(value) => activeTab && void submitNavigation(activeTab, value)}
            onPrivate={() => addTab(true)}
          />
        ) : (
          <div className="webview-plate" aria-hidden="true" />
        )}
      </main>
    </div>
  );
}

function ShieldPanel({
  host,
  blockedCount,
  disabled,
  onDisable,
  onClose,
}: {
  host: string;
  blockedCount: number;
  disabled: boolean;
  onDisable: () => void;
  onClose: () => void;
}) {
  return (
    <div className="shield-panel" role="dialog" aria-label="Privacy shield">
      <div className="shield-panel-header">
        <div>
          <span className="panel-kicker">Maximum</span>
          <strong>{host || "New tab"}</strong>
        </div>
        <button className="panel-close" type="button" title="Close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="shield-meter">
        <Shield size={18} />
        <span>{disabled ? "Paused for this site" : `${blockedCount} blocked`}</span>
      </div>
      <button className="panel-action" type="button" onClick={onDisable} disabled={!host || disabled}>
        {disabled ? <Check size={15} /> : <Zap size={15} />}
        <span>{disabled ? "Override active" : "Disable for site"}</span>
      </button>
    </div>
  );
}

function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}) {
  const modes: Array<{ value: ThemeMode; label: string; icon: typeof Monitor }> = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.value}
            className={value === mode.value ? "selected" : ""}
            type="button"
            title={mode.label}
            onClick={() => onChange(mode.value)}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

function StartSurface({
  tab,
  onNavigate,
  onPrivate,
}: {
  tab?: BrowserTab;
  onNavigate: (value: string) => void;
  onPrivate: () => void;
}) {
  const [value, setValue] = useState("");
  const hasError = tab?.status === "blocked" || tab?.status === "error";

  return (
    <section className="start-surface">
      <div className="start-logo-wrap">
        <img className="start-logo" src="/icon.png" alt="" />
      </div>
      <div className="start-copy">
        <p className="eyebrow">{hasError ? "Stopped" : "Ready"}</p>
        <h1>{hasError ? tab?.error ?? "Page could not open" : PRODUCT_NAME}</h1>
      </div>
      <form
        className="start-search"
        onSubmit={(event) => {
          event.preventDefault();
          onNavigate(value);
        }}
      >
        <Search size={18} />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search privately or enter a website"
          spellCheck={false}
        />
        <button type="submit">Open</button>
      </form>
      <div className="quick-actions">
        <button type="button" onClick={() => onNavigate("https://duckduckgo.com")}>
          <Search size={16} />
          <span>Search</span>
        </button>
        <button type="button" onClick={() => onNavigate("https://github.com")}>
          <Globe2 size={16} />
          <span>GitHub</span>
        </button>
        <button type="button" onClick={() => onNavigate("https://example.com")}>
          <Globe2 size={16} />
          <span>Example</span>
        </button>
        <button type="button" onClick={onPrivate}>
          <EyeOff size={16} />
          <span>Private</span>
        </button>
      </div>
    </section>
  );
}

function WindowControls() {
  const minimize = async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  };

  const maximize = async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  };

  const close = async () => {
    if (!isTauriRuntime) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };

  return (
    <div className="window-controls">
      <button type="button" title="Minimize" onClick={() => void minimize()}>
        <Minus size={15} />
      </button>
      <button type="button" title="Maximize" onClick={() => void maximize()}>
        <Maximize2 size={14} />
      </button>
      <button className="close-window" type="button" title="Close" onClick={() => void close()}>
        <PanelTopClose size={15} />
      </button>
    </div>
  );
}

function reorderTabs(tabs: BrowserTab[], draggedId: string, targetId: string) {
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
  const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return tabs;

  const next = [...tabs];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

function cleanTitle(value: string) {
  return value.replace(/^"|"$/g, "").trim() || "Untitled";
}

function hostForUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function readThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}
