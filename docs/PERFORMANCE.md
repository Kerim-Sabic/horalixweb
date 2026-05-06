# Horalix Web Performance Model

## Goals

Horalix Web is optimized for fast shell startup, responsive typing, instant tab selection, and large tab counts without keeping every page alive.

## Tab Sleeping Model

Tabs are lightweight records by default. A tab stores metadata:

- ID and WebView label
- URL and display URL
- title and favicon
- status
- privacy flags
- blocked counters
- timestamps

Sleeping tabs do not keep a live WebView. They render a designed sleeping state and wake only when selected or navigated.

Private tabs use the same cheap record model but are excluded from session persistence.

## Live WebView Cache

The default live cache size is 3. The tab reducer tracks `liveTabIds`, and inactive tabs outside the cache are marked sleeping.

The native WebView surface is only shown for the active ready/loading tab. Inactive child webviews are hidden, and tabs that leave the live cache are closed through the native bridge.

Pinned tabs are prioritized in the UI, but pinning does not force unbounded WebView memory usage.

## 1000-Tab Stress Model

`window.__HORALIX_DEV__.create1000Tabs()` creates 1000 fake sleeping tabs for development stress testing.

The tab strip uses `selectVisibleTabs` to render a bounded window instead of all records. The active tab, pinned tabs, and a nearby tab window remain visible while the remaining count is exposed through the overflow control.

Reducer tests verify that adding 1000 tab records remains reasonable and that the live cache stays bounded.

## Render Minimization

- Omnibox input is local UI state, not persisted tab state while typing.
- Tab items are `React.memo` components.
- Tab operations are reducer actions, not scattered broad state mutations.
- Selectors compute active, visible, live, and persistable tabs.
- Settings panels are rendered only when opened.
- Persistence is debounced and scheduled with `requestIdleCallback` when available.

## Blocker Performance

Frontend privacy classification uses `Set` membership and suffix hostname matching. It avoids expensive regex work during render.

The heavy request blocking path remains in the bundled WebView2 MV3 extension through declarative rules, which are evaluated by the browser engine rather than React.

## CSS / Animation

The UI uses short 120-180ms transitions on cheap properties only. Reduced-motion users get near-zero transition duration through `prefers-reduced-motion`.
