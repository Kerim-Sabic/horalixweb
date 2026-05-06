import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  BrowserBounds,
  NativePrivacyEvent,
  NativeTabEvent,
  NativeTitleEvent,
  NavigationDecision,
} from "./types";

export const isTauriRuntime = "__TAURI_INTERNALS__" in window;

export function createBrowserTab(args: {
  label: string;
  input: string;
  bounds: BrowserBounds;
  isPrivate: boolean;
}) {
  return invoke<NavigationDecision>("create_browser_tab", args);
}

export function prewarmBrowserTab(args: {
  label: string;
  bounds: BrowserBounds;
  isPrivate: boolean;
}) {
  return invoke<void>("prewarm_browser_tab", args);
}

export function navigateBrowserTab(args: { label: string; input: string }) {
  return invoke<NavigationDecision>("navigate_browser_tab", args);
}

export function resizeBrowserTab(label: string, bounds: BrowserBounds) {
  return invoke<void>("resize_browser_tab", { label, bounds });
}

export function setActiveBrowserTab(activeLabel: string | null, labels: string[]) {
  return invoke<void>("set_active_browser_tab", {
    activeLabel,
    labels,
  });
}

export function closeBrowserTab(label: string) {
  return invoke<void>("close_browser_tab", { label });
}

export function reloadBrowserTab(label: string) {
  return invoke<void>("reload_browser_tab", { label });
}

export function stopBrowserTab(label: string) {
  return invoke<void>("stop_browser_tab", { label });
}

export function goBackBrowserTab(label: string) {
  return invoke<void>("go_back_browser_tab", { label });
}

export function goForwardBrowserTab(label: string) {
  return invoke<void>("go_forward_browser_tab", { label });
}

export function disableSiteBlocking(label: string, host: string) {
  return invoke<void>("disable_site_blocking", { label, host });
}

export function clearBrowserData(labels: string[]) {
  return invoke<void>("clear_browser_data", { labels });
}

export function onNativeTabEvent(callback: (event: NativeTabEvent) => void) {
  return listen<NativeTabEvent>("horalix://tab-event", ({ payload }) => callback(payload));
}

export function onNativeTitleEvent(callback: (event: NativeTitleEvent) => void) {
  return listen<NativeTitleEvent>("horalix://tab-title", ({ payload }) => callback(payload));
}

export function onNativePrivacyEvent(callback: (event: NativePrivacyEvent) => void) {
  return listen<NativePrivacyEvent>("horalix://privacy-event", ({ payload }) => callback(payload));
}
