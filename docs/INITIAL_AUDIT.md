# Horalix Web Initial Audit

Date: 2026-05-06

## Baseline Verification

Required baseline commands were run before source changes:

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | Installed from `package-lock.json`; 0 vulnerabilities reported. |
| `npm run build` | PASS | TypeScript and Vite production build completed. |
| `npm run tauri:build` | PASS | Tauri built `target\release\horalix-web.exe` and NSIS setup executable. |

## Package Manager

The project uses npm. Evidence:

- `package.json`
- `package-lock.json`
- npm scripts: `dev`, `build`, `preview`, `tauri`, `tauri:dev`, `tauri:build`

## Current Architecture

Horalix Web currently has two browser layers:

- Desktop visual browser: Tauri v2 app in `src-tauri/` with real Windows WebView2 child webviews.
- Headless automation engine: Rust crates under `crates/horalix-*` for DOM, JS, CDP, networking, scraping, and automation.

The desktop app is the user-facing browser. The headless engine is useful as a sidecar for automation and privacy tooling, but it does not paint visual pages.

## Tauri Configuration

Primary file: `src-tauri/tauri.conf.json`

- Product name: `Horalix Web`
- Identifier: `com.horalix.web`
- Version: `0.2.0`
- Window: custom undecorated main window, 1280x820, minimum 900x620
- Bundle target: NSIS
- Icons: generated Windows icon set including `icon.ico`
- Resources: bundles `src-tauri/extensions/`

## Rust Backend Files

Primary desktop backend:

- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`

Current backend behavior:

- Creates positioned child webviews with `WebviewBuilder`.
- Uses WebView2 incognito mode for private tabs.
- Enables bundled browser extension loading when the extension folder is found.
- Blocks top-level navigations to known tracker hosts.
- Denies popup/new-window requests.
- Emits tab, title, and privacy events to React.
- Supports resize, activate/hide, close, reload, back, forward, clear-data, and session site allowlisting.

Privacy extension:

- `src-tauri/extensions/horalix-blocker/manifest.json`
- `src-tauri/extensions/horalix-blocker/background.js`
- `src-tauri/extensions/horalix-blocker/content.js`
- `src-tauri/extensions/horalix-blocker/rules.json`

## React Entry Points

- `src/main.tsx` mounts the React app.
- `src/App.tsx` currently owns nearly all app logic and UI.
- `src/browser/native.ts` wraps Tauri commands/events.
- `src/browser/navigation.ts` contains basic URL/search normalization.
- `src/browser/types.ts` defines current frontend tab/native event types.

## App Shell

Current shell structure is in `src/App.tsx`:

- Custom titlebar
- Tab row
- Toolbar
- Address bar
- Privacy shield popover
- Theme segmented control
- Start surface
- WebView placeholder plate when native child webview is visible

The shell is functional but too centralized. UI controls, state transitions, keyboard shortcuts, persistence, privacy state, and native WebView orchestration all live in one component.

## Tab State

Current tab state fields:

- `id`
- `webviewLabel`
- `title`
- `url`
- `address`
- `status`
- `isPrivate`
- `isPinned`
- `hasWebview`
- `canGoBack`
- `canGoForward`
- `history`
- `historyIndex`
- `blockedCount`
- `blockingDisabled`
- optional `error`

Current tab state is held in React `useState` inside `App.tsx`. There is no reducer, selector layer, session schema, tab sleeping policy, live-WebView cache policy, or virtualization.

## Browser / WebView Implementation

Real page rendering is done by WebView2 child webviews created from Rust. Web content is not rendered in iframes.

Current frontend-to-native bridge:

- `create_browser_tab`
- `prewarm_browser_tab`
- `navigate_browser_tab`
- `resize_browser_tab`
- `set_active_browser_tab`
- `close_browser_tab`
- `reload_browser_tab`
- `go_back_browser_tab`
- `go_forward_browser_tab`
- `disable_site_blocking`
- `clear_browser_data`

The current app prewarms one active new-tab webview after first layout and hides inactive webviews.

## Buttons And Controls

Visible controls found:

- Window: minimize, maximize/restore, close
- Tab strip: select tab, close tab, new tab, private tab
- Toolbar: back, forward, reload, home, omnibox submit, privacy shield, duplicate tab, pin tab, restore tab, clear browsing data, theme selector, compact more menu
- Shield panel: close, disable for site
- Start page: main open button, Search, GitHub, Example, Private

Current issues:

- Compact "More" menu is visible at smaller widths but has no handler.
- Reload does not switch to Stop while loading.
- Close-tab control is a nested span with `role="button"` inside a button, which is poor accessibility.
- Several buttons rely on `title` instead of explicit `aria-label`.
- Settings controls are absent.
- Button behavior is not centrally registered or testable.
- Keyboard shortcut coverage is incomplete.

## CSS / Styling

Current styling is in a single file:

- `src/styles.css`

Current design strengths:

- Correct app icon usage.
- Compact browser chrome.
- Light/dark variables.
- Translucent top bar.

Current design weaknesses:

- Monolithic styling makes the design system hard to extend.
- Naming uses older GitHub-like color variables instead of the requested product tokens.
- Start page is too sparse for a premium production browser.
- Settings, error, blocked, and sleeping states are not fully designed.
- Tab strip is not virtualized and can only hide overflow.
- Focus/pressed/disabled states are incomplete across all controls.

## Persistence

Current persistence is limited:

- Theme is stored in `localStorage` under `horalix-web-theme`.
- Tabs/session/settings/blocker allowlist are not schema-persisted.
- There is no migration-safe parsing.
- Private tabs are not persisted because no session persistence exists, but that guarantee needs explicit architecture and tests.

## Privacy / Ad Blocking

Current privacy implementation:

- Rust top-level navigation checks via `horalix_net::is_tracker_blocked`.
- MV3 extension with `declarativeNetRequest` static rules.
- Cosmetic ad hiding through a content script and Rust initialization script.
- Popup/new-window requests are denied.
- Per-site temporary allowlisting is supported for the current runtime session.

Current limitations:

- Tauri/WebView2 does not expose a complete Chrome-style browser API surface to React.
- The current Rust desktop layer does not have portable full subresource interception for every external request.
- WebView2 extension support depends on the installed WebView2 runtime.
- YouTube ad blocking cannot be guaranteed without fragile playback-breaking behavior.
- Privacy statistics are currently approximate: they combine top-level/native events and cosmetic hidden-count signals.

## Performance Risks

- `App.tsx` re-renders the tab list and toolbar from broad state updates.
- Omnibox input is global to `App.tsx`, so typing can trigger more rendering than necessary.
- There is no reducer-level cheap model for 1000 tab records.
- There is no sleeping-tab state or explicit live-WebView LRU cache size.
- Every tab is rendered in the DOM; no tab-strip virtualization/windowing.
- WebView lifecycle is only "has webview / no webview"; no policy controls.
- Persistence writes are not debounced because full session persistence is absent.

## Files That Need Refactor

Required or recommended refactor targets:

- `src/App.tsx`
- `src/styles.css`
- `src/browser/navigation.ts`
- `src/browser/types.ts`
- `src/browser/native.ts`
- `src-tauri/src/lib.rs`
- `README.md`

New modules needed:

- `src/browser/url.ts`
- `src/browser/tabs/types.ts`
- `src/browser/tabs/reducer.ts`
- `src/browser/tabs/selectors.ts`
- `src/browser/tabs/persistence.ts`
- `src/browser/tabs/useTabs.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/persistence.ts`
- `src/privacy/types.ts`
- `src/privacy/rules.ts`
- `src/privacy/blocker.ts`
- `src/privacy/allowlist.ts`
- `src/privacy/stats.ts`
- `src/dev/buttonRegistry.ts`
- Split style files under `src/styles/`

## Summary

The baseline app is a working WebView2 browser shell, not a fake iframe demo. It builds successfully and has a credible native foundation. The main work is now frontend architecture, product-grade UI, explicit settings/session persistence, strict button QA, fast tab state management, and clearer privacy guarantees around what WebView2 can and cannot block.
