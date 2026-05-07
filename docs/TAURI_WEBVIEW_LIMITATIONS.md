# Tauri / WebView2 Limitations

Horalix Web uses Tauri v2 and Windows WebView2 for real page rendering. This gives Chromium-quality layout, JavaScript, media, and site compatibility without writing a custom rendering engine.

## What Works

- Real web pages are rendered in native WebView2 child webviews.
- Sites that block iframes are not loaded in an iframe.
- Private tabs use WebView incognito mode.
- WebView2 extension loading is enabled for the bundled Horalix blocker.
- The shield can report whether extension resources are present and whether content scripts marked the active page as loaded.
- Native navigation, reload, history back/forward, resize, focus, hide, close, clear-data, and titlebar window controls are wired.
- Popups/new windows are denied by default.

## Current Limitations

Tauri/WebView2 does not expose the complete Chrome browser API surface that Chrome, Edge, or Brave use internally.

Important gaps:

- Full subresource interception from Rust is not available through the portable high-level Tauri API used here.
- WebView2 extension behavior depends on the installed WebView2 runtime version.
- Back/forward availability is approximated in frontend state because WebView2 history length is not exposed as a simple cross-platform event in this app.
- `window.stop()` is used for Stop loading because there is no richer stop API in the current native bridge.
- WebView2 browser extensions are not identical to Chrome extension support in every edge case.
- YouTube ad blocking is best-effort only. Horalix keeps YouTube media hosts allowed and does not force video seek/playback speed because those approaches break normal watch-page playback.
- External-open behavior is intentionally conservative and not wired to an OS opener plugin yet.

## v3.1.0 Recovery Fixes

The custom titlebar keeps drag regions only on non-button titlebar areas. The minimize, maximize/restore, and close buttons call dedicated Rust commands, and the Tauri capability file grants the explicit window permissions those controls need.

Release builds use Rust's Windows GUI subsystem attribute so launching `horalix-web.exe` does not open a separate console window. The build remains unsigned, so Windows SmartScreen can still warn until the project uses trusted code signing or Microsoft Store distribution.

## Design Decision

The current Rust headless engine is not used to paint desktop pages. Its speed comes partly from avoiding layout and painting, so using it as the visual browser renderer would be a regression in site compatibility.

For v1 desktop browsing, WebView2 remains the real renderer. The Rust engine remains useful for automation, scraping, future privacy analysis, and agent workflows.
