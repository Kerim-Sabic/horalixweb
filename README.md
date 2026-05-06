<p align="center">
  <img src="assets/icon.png" alt="Horalix Web" width="80" />
</p>

<h2 align="center">Horalix Web</h2>

<p align="center">
  <strong>A Windows-first desktop browser with a fast Rust automation engine.</strong><br>
  Real WebView2 rendering for everyday browsing, plus lightweight headless tooling for agents and scraping.
</p>

---

Horalix Web is a desktop browser shell backed by WebView2 for real page rendering. The Rust headless engine remains available for web scraping and AI agent automation. It runs JavaScript via V8, supports the Chrome DevTools Protocol, and can act as a lightweight replacement for headless Chrome in automation workflows.

## Desktop Browser

The Horalix Web desktop app lives in `src-tauri/` and the React browser chrome lives in `src/`.

```bash
npm install
npm run tauri:dev
```

The app includes tabs, an address/search bar, navigation controls, private tabs, maximum ad/tracker blocking, clear-data controls, Horalix branding, auto light/dark chrome, and WebView2-backed page views on Windows.

### Horalix Web 0.2.0

Version 0.2.0 is the first polished Windows desktop release. It ships the corrected Windows icon set, a cleaner Apple-inspired browser shell, faster WebView2 prewarming, and bundled maximum blocking for ads, trackers, popups, and common annoyances.

### Why Horalix Web tooling over headless Chrome?

Designed for automation at scale, not desktop browsing.

| Metric       | Horalix Web tooling | Headless Chrome |
|--------------|--------------|------------------|
| Memory       | **30 MB**    | 200+ MB          |
| Binary size  | **70 MB**    | 300+ MB          |
| Anti-detect  | **Built-in** | None          |
| Page load    | **85 ms**    | ~500 ms          |
| Startup      | **Instant**  | ~2s              |
| Puppeteer    | **Yes**      | Yes              |
| Playwright   | **Yes**      | Yes              |

## What's next

I'm working on **Horalix Cloud**, the hosted version with managed infrastructure, residential proxies, and dedicated support. For people who want the engine without operating it themselves.

The open-source engine stays Apache-2.0, fully featured. No feature gating, ever.

**[Get on the waitlist →](https://tally.so/r/gDWzdD)**

## Install

### Download

Grab the latest Windows build from [Releases](https://github.com/Kerim-Sabic/horalixweb/releases):

```bash
# Windows standalone executable
curl -LO https://github.com/Kerim-Sabic/horalixweb/releases/latest/download/Horalix-Web-0.2.0.exe

# Windows installer
curl -LO https://github.com/Kerim-Sabic/horalixweb/releases/latest/download/Horalix-Web-0.2.0-Setup.exe
```

No Chrome or Node.js is required for the desktop app. Windows uses the installed Evergreen WebView2 runtime.

### Build from source

```bash
git clone https://github.com/Kerim-Sabic/horalixweb.git
cd horalixweb
cargo build --release

# With stealth mode (anti-detection + tracker blocking)
cargo build --release --features stealth
```

Requires Rust 1.75+ ([rustup.rs](https://rustup.rs)). First build takes ~5 min (V8 compiles from source, cached after).

## Quick Start

### Fetch a page

```bash
# Get the page title
horalix fetch https://example.com --eval "document.title"

# Extract all links
horalix fetch https://example.com --dump links

# Render JavaScript and dump HTML
horalix fetch https://news.ycombinator.com --dump html

# Wait for dynamic content
horalix fetch https://example.com --wait-until networkidle0

# Bound navigation time for slow or broken pages
horalix fetch https://example.com --timeout 10
```

### Start the CDP server

```bash
horalix serve --port 9222

# With stealth mode (anti-detection + tracker blocking)
horalix serve --port 9222 --stealth
```

### Scrape in parallel

```bash
horalix scrape url1 url2 url3 ... \
  --concurrency 25 \
  --eval "document.querySelector('h1').textContent" \
  --format json
```

## Puppeteer / Playwright

### Puppeteer

```bash
npm install puppeteer-core
```

```javascript
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser',
});

const page = await browser.newPage();
await page.goto('https://news.ycombinator.com');

const stories = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.titleline > a'))
    .map(a => ({ title: a.textContent, url: a.href }))
);
console.log(stories);

await browser.disconnect();
```

### Playwright

```bash
npm install playwright-core
```

```javascript
import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP({
  endpointURL: 'ws://127.0.0.1:9222',
});

const page = await browser.newContext().then(ctx => ctx.newPage());
await page.goto('https://en.wikipedia.org/wiki/Web_scraping');
console.log(await page.title());

await browser.close();
```

### Form submission & login

```javascript
await page.goto('https://quotes.toscrape.com/login');
await page.evaluate(() => {
  document.querySelector('#username').value = 'admin';
  document.querySelector('#password').value = 'admin';
  document.querySelector('form').submit();
});
// Horalix Web tooling handles the POST, follows the 302 redirect, maintains cookies
```

## Benchmarks

Page load:

| Page | Horalix Web tooling | Chrome |
|------|---------|--------|
| Static HTML | **51 ms** | ~500 ms |
| JS + XHR + fetch | **84 ms** | ~800 ms |
| Dynamic scripts | **78 ms** | ~700 ms |

## Stealth Mode

Enable with `--features stealth`.

### Anti-fingerprinting
- Per-session fingerprint randomization (GPU, screen, canvas, audio, battery)
- Realistic `navigator.userAgentData` (Chrome 145, high-entropy values)
- `event.isTrusted = true` for dispatched events
- Hidden internal properties (`Object.keys(window)` safe)
- Native function masking (`Function.prototype.toString()` → `[native code]`)
- `navigator.webdriver = undefined` (matches real Chrome)

### Tracker Blocking
- 3,520 domains blocked
- Blocks analytics, ads, telemetry, and fingerprinting scripts
- Prevents trackers from loading entirely
- Enabled automatically with `--stealth`

## CDP API

Horalix Web tooling implements the Chrome DevTools Protocol for Puppeteer/Playwright compatibility.

| Domain | Methods |
|--------|---------|
| **Target** | createTarget, closeTarget, attachToTarget, createBrowserContext, disposeBrowserContext |
| **Page** | navigate, getFrameTree, addScriptToEvaluateOnNewDocument, lifecycleEvents |
| **Runtime** | evaluate, callFunctionOn, getProperties, addBinding |
| **DOM** | getDocument, querySelector, querySelectorAll, getOuterHTML, resolveNode |
| **Network** | enable, setCookies, getCookies, setExtraHTTPHeaders, setUserAgentOverride |
| **Fetch** | enable, continueRequest, fulfillRequest, failRequest (live interception) |
| **Storage** | getCookies, setCookies, deleteCookies |
| **Input** | dispatchMouseEvent, dispatchKeyEvent |
| **LP** | getMarkdown (DOM-to-Markdown conversion) |
## CLI Reference

### `horalix serve`

Start a CDP WebSocket server.

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `9222` | WebSocket port |
| `--proxy` | — | HTTP/SOCKS5 proxy URL |
| `--stealth` | off | Enable anti-detection + tracker blocking |
| `--workers` | `1` | Number of parallel worker processes |
| `--obey-robots` | off | Respect robots.txt |

### `horalix fetch <URL>`

Fetch and render a single page.

| Flag | Default | Description |
|------|---------|-------------|
| `--dump` | `html` | Output: `html`, `text`, or `links` |
| `--eval` | — | JavaScript expression to evaluate |
| `--wait-until` | `load` | Wait: `load`, `domcontentloaded`, `networkidle0` |
| `--timeout` | `30` | Maximum navigation time in seconds |
| `--selector` | — | Wait for CSS selector |
| `--stealth` | off | Anti-detection mode |
| `--quiet` | off | Suppress banner |

### `horalix scrape <URL...>`

Scrape multiple URLs in parallel with worker processes.

| Flag | Default | Description |
|------|---------|-------------|
| `--concurrency` | `10` | Parallel workers |
| `--eval` | — | JS expression per page |
| `--format` | `json` | Output: `json` or `text` |

## License

Apache 2.0

---
