<p align="center">
  <img src="assets/icon.png" alt="Horalix Web" width="84" />
</p>

<h2 align="center">Horalix Web</h2>

<p align="center">
  <strong>A premium Windows-first privacy browser built with Tauri v2, React 19, Rust, and WebView2.</strong>
</p>

---

Horalix Web is a desktop browser shell with real WebView2 rendering, a fast React chrome, privacy-first defaults, private tabs, sleeping tabs, and bundled ad/tracker blocking.

The Rust headless automation engine remains in the repository for scraping, CDP compatibility, and future power privacy features, but desktop pages are rendered by WebView2 for real browser compatibility.

## Features

- Real WebView2 page rendering, not iframe browsing
- Custom Horalix browser chrome
- Tabs, private tabs, duplicate tab, restore closed tab, drag reorder, and pinned tabs
- Address/search bar with robust URL normalization
- Shared URL engine for toolbar and start-page omniboxes
- Designed start, loading, blocked, error, sleeping, and settings states
- Sleeping tab model for huge tab counts
- Default live WebView cache size of 3
- Private tabs excluded from persistence
- Maximum privacy mode by default
- Bundled MV3 WebView2 blocker extension
- Top-level tracker blocking and dangerous protocol blocking
- Per-site temporary privacy allowlist
- Auto System/Light/Dark theme
- Developer button registry exposed at `window.__HORALIX_BUTTONS__`
- 1000-tab stress action at `window.__HORALIX_DEV__.create1000Tabs()`

## Install

Windows builds are published at:

https://github.com/Kerim-Sabic/horalixweb/releases

Latest v3.0.1 hotfix assets:

```bash
curl -LO https://github.com/Kerim-Sabic/horalixweb/releases/latest/download/Horalix-Web-v3.0.1.exe
curl -LO https://github.com/Kerim-Sabic/horalixweb/releases/latest/download/Horalix-Web-v3.0.1-Setup.exe
```

Windows uses the installed Evergreen WebView2 runtime.

## Development

```bash
npm install
npm run dev
npm run tauri:dev
```

## Build

```bash
npm run build
npm test
npm run tauri:build
```

The Tauri build creates:

- `target/release/horalix-web.exe`
- `target/release/bundle/nsis/Horalix Web_3.0.1_x64-setup.exe`

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd+L | Focus omnibox |
| Ctrl/Cmd+T | New tab |
| Ctrl/Cmd+W | Close active tab |
| Ctrl/Cmd+R | Reload |
| Esc | Stop loading, close panels, or blur input |
| Alt+Left | Back |
| Alt+Right | Forward |
| Alt+Home | Home |
| Ctrl/Cmd+Shift+N | New private tab |
| Ctrl/Cmd+Shift+T | Restore closed tab |
| Ctrl/Cmd+1 through Ctrl/Cmd+8 | Switch to tab 1-8 |
| Ctrl/Cmd+9 | Switch to last tab |
| Ctrl/Cmd+Tab | Next tab |
| Ctrl/Cmd+Shift+Tab | Previous tab |
| Ctrl/Cmd+, | Settings |

## Privacy Model

Horalix Web uses layered privacy controls:

- URL engine blocks dangerous protocols before navigation.
- Frontend classifier blocks known ad/tracker hosts before top-level navigation.
- Rust native layer blocks known tracker hosts for WebView navigation.
- Bundled WebView2 MV3 extension uses declarativeNetRequest rules where supported.
- Cosmetic cleanup hides common ad containers.
- YouTube uses playback-safe blocking: core video/static hosts stay allowed, while ad overlays, promoted slots, skip buttons, and ad telemetry receive best-effort mitigation.
- Popups/new windows are denied by default.

See [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md).

## Tab Sleeping Model

Tab records are cheap metadata. Horalix keeps only the active tab plus a small live WebView cache alive. Inactive tabs outside the cache become sleeping tabs and are restored on selection.

Private tabs are never serialized into session storage.

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Limitations

Horalix Web does not claim impossible browser guarantees:

- WebView2 extension support depends on the installed WebView2 runtime.
- Full subresource interception from Rust is not available through the portable Tauri API used here.
- YouTube ad blocking is best-effort and intentionally prioritizes working video playback over rules that would break `googlevideo.com` media delivery.
- WebView history availability is approximated in frontend state.

See [docs/TAURI_WEBVIEW_LIMITATIONS.md](docs/TAURI_WEBVIEW_LIMITATIONS.md).

## QA Docs

- [Initial audit](docs/INITIAL_AUDIT.md)
- [Button QA matrix](docs/BUTTON_QA_MATRIX.md)
- [Performance model](docs/PERFORMANCE.md)
- [Privacy model](docs/PRIVACY_MODEL.md)
- [Tauri/WebView limitations](docs/TAURI_WEBVIEW_LIMITATIONS.md)

## Headless Tooling

The repository still includes the Horalix Rust automation crates and CLI for scraping/CDP workflows. Those tools are separate from the visual desktop browser and can be built with Cargo.

```bash
cargo build --release
cargo test --workspace
```

## Roadmap

- Import EasyList/EasyPrivacy into the extension build pipeline
- Add richer WebView history state if exposed safely
- Add OS-level external-open integration
- Add installer/update polish
- Add end-to-end desktop smoke tests
