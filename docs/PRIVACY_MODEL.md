# Horalix Web Privacy Model

## Default Posture

Horalix Web defaults to Maximum privacy mode:

- Block ads
- Block trackers
- Block dangerous protocols
- Deny popups/new windows
- Use private/incognito WebView mode for private tabs
- Never persist private tab metadata
- Allow per-site blocking disable until restart

## Blocking Layers

### 1. URL Engine

`src/browser/url.ts` blocks dangerous navigation protocols before native navigation:

- `javascript:`
- `data:`
- `vbscript:`
- `file:`
- non-blank `about:`
- `tauri:`

Malformed explicit URLs are converted to a clean validation state instead of crashing.

### 2. Frontend Privacy Classifier

`src/privacy/blocker.ts` classifies top-level navigations using compiled host sets and suffix matching.

The classifier supports:

- ad hosts
- analytics trackers
- social trackers
- allowlisted hosts
- dangerous protocol checks

### 3. Native Top-Level Blocking

`src-tauri/src/lib.rs` blocks known tracker hosts before top-level WebView navigation is allowed.

### 4. WebView2 MV3 Extension

The bundled extension under `src-tauri/extensions/horalix-blocker/` uses declarativeNetRequest rules for subresource blocking where WebView2 extension support is available.

### 5. Cosmetic Cleanup

The extension content script and native initialization script hide common ad containers after document start. These counts are tracked as cosmetic blocks, not guaranteed network blocks.

## Shield UI

The toolbar shield shows:

- active site
- total blocked count
- ads
- trackers
- cosmetic hides
- allow-this-site control
- manage rules shortcut

## Private Mode

Private tabs are excluded from:

- session persistence
- closed-tab persistence
- saved private URLs
- saved private titles
- saved private history

Native private tabs are created with WebView incognito mode.

## Limits And Honesty

Horalix Web blocks a useful set of ads and trackers, but it does not claim impossible guarantees.

Known limits:

- WebView2 extension support depends on runtime capability.
- Some sites may break under maximum blocking.
- YouTube ad blocking is best-effort only.
- Cosmetic hiding does not mean the original network request was blocked.
- Full EasyList/EasyPrivacy importing is planned but not implemented in this pass.
