import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Brush,
  ChevronsUpDown,
  Copy,
  EyeOff,
  Globe2,
  Home,
  Lock,
  Maximize2,
  Minus,
  PanelTopClose,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearBrowserData,
  closeBrowserTab,
  createBrowserTab,
  goBackBrowserTab,
  goForwardBrowserTab,
  isTauriRuntime,
  navigateBrowserTab,
  onNativeTabEvent,
  onNativeTitleEvent,
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
  };
}

export default function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab()]);
  const [closedTabs, setClosedTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>(() => "");
  const [addressValue, setAddressValue] = useState("");
  const [browserBounds, setBrowserBounds] = useState<BrowserBounds | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );
  const shouldShowActiveWebview =
    Boolean(activeTab?.hasWebview) && activeTab?.status !== "blocked" && activeTab?.status !== "error";

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

    const updateBounds = () => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBrowserBounds({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(contentRef.current);
    window.addEventListener("resize", updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime || !browserBounds) return;

    const labels = tabs.filter((tab) => tab.hasWebview).map((tab) => tab.webviewLabel);
    const activeLabel = shouldShowActiveWebview ? activeTab?.webviewLabel ?? null : null;
    void setActiveBrowserTab(activeLabel, labels);

    for (const tab of tabs) {
      if (tab.hasWebview) {
        void resizeBrowserTab(tab.webviewLabel, browserBounds);
      }
    }
  }, [
    activeTab?.id,
    activeTab?.webviewLabel,
    browserBounds,
    shouldShowActiveWebview,
    tabs,
  ]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    const applyEvent = (event: NativeTabEvent) => {
      setTabs((current) =>
        current.map((tab) => {
          if (tab.webviewLabel !== event.label) return tab;

          const title = event.title || tab.title || displayUrl(event.url);
          const nextHistory =
            event.status === "ready" && event.url && event.url !== tab.history[tab.historyIndex]
              ? [...tab.history.slice(0, tab.historyIndex + 1), event.url]
              : tab.history;

          return {
            ...tab,
            title,
            url: event.url || tab.url,
            address: event.url || tab.address,
            status: event.status,
            error: event.status === "blocked" ? "Blocked by the Horalix privacy list." : undefined,
            history: nextHistory,
            historyIndex: nextHistory.length ? nextHistory.length - 1 : tab.historyIndex,
            canGoBack: nextHistory.length > 1,
            canGoForward: false,
          };
        }),
      );
    };

    let unsubscribeTab: (() => void) | undefined;
    let unsubscribeTitle: (() => void) | undefined;

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

    return () => {
      unsubscribeTab?.();
      unsubscribeTitle?.();
    };
  }, []);

  const updateTab = useCallback((id: string, update: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...update } : tab)));
  }, []);

  const submitNavigation = useCallback(
    async (tab: BrowserTab, value: string) => {
      const input = value.trim();
      const normalized = resolveNavigationInput(input);

      updateTab(tab.id, {
        address: normalized,
        url: normalized,
        title: displayUrl(normalized),
        status: "loading",
        error: undefined,
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
          hasWebview: !decision.blocked,
          status: decision.blocked ? "blocked" : "loading",
          error: decision.reason ?? undefined,
        });
      } catch (error) {
        updateTab(tab.id, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [browserBounds, updateTab],
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
    if (activeTab.hasWebview && isTauriRuntime) {
      void reloadBrowserTab(activeTab.webviewLabel);
    } else if (activeTab.url) {
      void submitNavigation(activeTab, activeTab.url);
    }
  };

  const goBack = () => {
    if (!activeTab) return;
    if (activeTab.hasWebview && isTauriRuntime) {
      void goBackBrowserTab(activeTab.webviewLabel);
    }
  };

  const goForward = () => {
    if (!activeTab) return;
    if (activeTab.hasWebview && isTauriRuntime) {
      void goForwardBrowserTab(activeTab.webviewLabel);
    }
  };

  const clearData = async () => {
    const labels = tabs.filter((tab) => tab.hasWebview).map((tab) => tab.webviewLabel);
    if (isTauriRuntime) {
      await clearBrowserData(labels);
    }
    setTabs((current) =>
      current.map((tab) => ({
        ...tab,
        status: tab.status === "ready" ? "new" : tab.status,
        error: undefined,
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
    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      addTab(false);
    }
    if (event.key.toLowerCase() === "w") {
      event.preventDefault();
      if (activeTab) closeTab(activeTab.id);
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      reloadActiveTab();
    }
    if (event.shiftKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      restoreClosedTab();
    }
  };

  const visibleChromeTitle = activeTab?.title || PRODUCT_NAME;

  return (
    <div className="app-shell" onKeyDown={handleKeyDown}>
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
            <button className="icon-button" type="button" title="Back" onClick={goBack}>
              <ArrowLeft size={18} />
            </button>
            <button className="icon-button" type="button" title="Forward" onClick={goForward}>
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
            <Shield size={17} className="address-privacy" />
            <input
              ref={addressRef}
              value={addressValue}
              onChange={(event) => setAddressValue(event.target.value)}
              placeholder="Search or enter address"
              spellCheck={false}
            />
            <button className="go-button" type="submit" title="Go">
              <Search size={17} />
            </button>
          </form>

          <div className="toolbar-group">
            <button className="icon-button" type="button" title="Duplicate tab" onClick={() => activeTab && duplicateTab(activeTab)}>
              <Copy size={16} />
            </button>
            <button className="icon-button" type="button" title="Pin tab" onClick={() => activeTab && updateTab(activeTab.id, { isPinned: !activeTab.isPinned })}>
              <Pin size={16} />
            </button>
            <button className="icon-button" type="button" title="Restore tab" onClick={restoreClosedTab}>
              <RotateCcw size={16} />
            </button>
            <button className="icon-button" type="button" title="Clear browsing data" onClick={() => void clearData()}>
              <Brush size={16} />
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

      <footer className="status-strip">
        <div className="status-item">
          <Lock size={13} />
          <span>No telemetry</span>
        </div>
        <div className="status-item">
          <Shield size={13} />
          <span>Tracker list active</span>
        </div>
        <div className="status-item">
          <ChevronsUpDown size={13} />
          <span>{isTauriRuntime ? "WebView2 renderer" : "Design preview"}</span>
        </div>
      </footer>
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
      <img className="start-logo" src="/icon.png" alt="" />
      <div className="start-copy">
        <p className="eyebrow">{hasError ? "Navigation stopped" : "Private by default"}</p>
        <h1>{hasError ? tab?.error ?? "This page could not open." : PRODUCT_NAME}</h1>
        <p>
          {hasError
            ? "The current page is not shown in a WebView. Choose another address or open a clean private tab."
            : "A fast Windows browser shell with real WebView2 rendering and the Rust automation engine kept as a sidecar."}
        </p>
      </div>
      <form
        className="start-search"
        onSubmit={(event) => {
          event.preventDefault();
          onNavigate(value);
        }}
      >
        <Globe2 size={18} />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search privately or enter a website"
          spellCheck={false}
        />
        <button type="submit">Open</button>
      </form>
      <div className="quick-actions">
        <button type="button" onClick={() => onNavigate("https://example.com")}>
          <Globe2 size={16} />
          <span>Example</span>
        </button>
        <button type="button" onClick={() => onNavigate("https://duckduckgo.com")}>
          <Search size={16} />
          <span>Search</span>
        </button>
        <button type="button" onClick={onPrivate}>
          <EyeOff size={16} />
          <span>Private</span>
        </button>
        <button type="button" onClick={() => onNavigate("https://github.com")}>
          <Sparkles size={16} />
          <span>Build</span>
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
