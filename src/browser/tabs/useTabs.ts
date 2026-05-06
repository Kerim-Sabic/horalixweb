import { useCallback, useEffect, useMemo, useReducer } from "react";

import { loadTabsSession, saveTabsSession } from "./persistence";
import { createBrowserTab, createInitialTabsState, tabsReducer } from "./reducer";
import { selectActiveTab, selectVisibleTabs } from "./selectors";
import type { BrowserTab, TabCreateOptions } from "./types";

type UseTabsOptions = {
  restoreSession: boolean;
  liveTabCacheSize: number;
  sleepingTabsEnabled: boolean;
};

export function useTabs(options: UseTabsOptions) {
  const [state, dispatch] = useReducer(tabsReducer, undefined, () => {
    const restored = options.restoreSession ? loadTabsSession() : null;
    return {
      ...(restored ?? createInitialTabsState()),
      liveTabCacheSize: options.liveTabCacheSize,
      sleepingTabsEnabled: options.sleepingTabsEnabled,
    };
  });

  useEffect(() => {
    dispatch({ type: "set-live-cache-size", value: options.liveTabCacheSize });
  }, [options.liveTabCacheSize]);

  useEffect(() => {
    dispatch({ type: "set-sleeping-enabled", value: options.sleepingTabsEnabled });
  }, [options.sleepingTabsEnabled]);

  useEffect(() => {
    if (!options.restoreSession) return;
    let timeout = 0;
    let idleId = 0;
    const persist = () => saveTabsSession(state);

    timeout = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(persist, { timeout: 800 });
      } else {
        persist();
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [options.restoreSession, state]);

  const activeTab = useMemo(() => selectActiveTab(state), [state]);
  const visibleTabs = useMemo(() => selectVisibleTabs(state), [state]);

  const createTab = useCallback((tabOptions: TabCreateOptions = {}, activate = true) => {
    const tab = createBrowserTab(tabOptions);
    dispatch({ type: "create", tab, activate });
    return tab;
  }, []);

  const createManyTabs = useCallback((tabs: BrowserTab[], activateId?: string) => {
    dispatch({ type: "create-many", tabs, activateId });
  }, []);

  const closeTab = useCallback((id: string) => dispatch({ type: "close", id }), []);
  const switchTab = useCallback((id: string) => dispatch({ type: "switch", id }), []);
  const updateTab = useCallback((id: string, patch: Partial<BrowserTab>) => dispatch({ type: "update", id, patch }), []);
  const sleepTab = useCallback((id: string) => dispatch({ type: "sleep", id }), []);

  return {
    state,
    dispatch,
    activeTab,
    visibleTabs,
    createTab,
    createManyTabs,
    closeTab,
    switchTab,
    updateTab,
    sleepTab,
  };
}
