# Horalix Web Button QA Matrix

Status legend: PASS means the control is visible where appropriate, calls a real handler, has an accessible label, and has hover/focus/disabled styling.

## Window

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `window.minimize` | Minimize | `WindowControls` / `src/App.tsx` | Minimize native window | `handleMinimizeWindow` | Enabled in Tauri; disabled in web preview | Alt+Space then N | PASS | v3.0.1 uses native Rust command plus explicit Tauri permission |
| `window.maximize` | Maximize/restore | `WindowControls` / `src/App.tsx` | Toggle native maximized state | `handleToggleMaximizeWindow` | Enabled in Tauri; disabled in web preview | Alt+Space then X | PASS | v3.0.1 uses native Rust command plus explicit Tauri permission |
| `window.close` | Close window | `WindowControls` / `src/App.tsx` | Close native window | `handleCloseWindow` | Enabled in Tauri; disabled in web preview | Alt+F4 | PASS | v3.0.1 uses native Rust command plus explicit Tauri permission |

## Tabs

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tabs.new` | New tab | `TabStrip` / `src/App.tsx` | Create new start tab | `handleNewTab` | Always enabled | Ctrl/Cmd+T | PASS | Honors background-tab setting |
| `tabs.private` | New private tab | `TabStrip` / `src/App.tsx` | Create private non-persisted tab | `handleNewPrivateTab` | Always enabled | Ctrl/Cmd+Shift+N | PASS | Private tabs are excluded from persistence |
| `tabs.select.{id}` | Select tab | `TabItem` / `src/App.tsx` | Activate selected tab | `handleSelect` | Always enabled for rendered tabs | Ctrl/Cmd+1-9, Ctrl/Cmd+Tab | PASS | Memoized tab item |
| `tabs.close.{id}` | Close tab | `TabItem` / `src/App.tsx` | Close selected tab | `handleClose` | Always enabled | Ctrl/Cmd+W for active tab | PASS | Last tab creates replacement start tab |
| `tabs.close-active` | Close active tab | App shortcut / `src/App.tsx` | Close active tab | `handleCloseActiveTab` | Always enabled | Ctrl/Cmd+W | PASS | Not a dead visible icon |
| `tabs.overflow` | Hidden tabs | `TabStrip` / `src/App.tsx` | Open hidden-tab menu | `onOverflowToggle` | Visible only when tab strip is windowed | None | PASS | Prevents rendering all 1000 tabs |
| `tabs.duplicate` | Duplicate tab | `Toolbar` / `src/App.tsx` | Create duplicate tab | `handleDuplicateTab` | Disabled if no active tab | None | PASS | Preserves private flag |
| `tabs.restore` | Restore closed tab | `Toolbar` / `src/App.tsx` | Restore last closed normal tab | `handleRestoreClosedTab` | Disabled when closed list is empty | Ctrl/Cmd+Shift+T | PASS | Private closed tabs are not persisted |
| `tab.pin.active` | Pin active tab | `TabItem` / `src/App.tsx` | Toggle active tab pin state | `handlePin` | Visible for active tab | None | PASS | Implemented statefully |
| Drag reorder | Reorder tabs | `TabItem` / `src/App.tsx` | Drag one tab over another | `onReorder` | Rendered tabs only | Mouse drag | PASS | Reducer action preserves active tab |

## Toolbar

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `nav.back` | Back | `Toolbar` / `src/App.tsx` | Navigate WebView history back | `handleBack` | Disabled unless `canGoBack` | Alt+Left | PASS | WebView history availability is approximated |
| `nav.forward` | Forward | `Toolbar` / `src/App.tsx` | Navigate WebView history forward | `handleForward` | Disabled unless `canGoForward` | Alt+Right | PASS | WebView history availability is approximated |
| `nav.reload` | Reload | `Toolbar` / `src/App.tsx` | Reload current page | `handleReload` | Visible when not loading | Ctrl/Cmd+R | PASS | Uses native reload or submit path |
| `nav.stop` | Stop loading | `Toolbar` / `src/App.tsx` | Stop current load | `handleStopLoading` | Visible only while loading | Esc | PASS | Native command calls `window.stop()` |
| `nav.home` | Home | `Toolbar` / `src/App.tsx` | Open Horalix start page | `handleHome` | Always enabled | Alt+Home | PASS | Uses internal start URL |
| `security.lock` | Security/lock indicator | `Toolbar` / `src/App.tsx` | Open site info panel | `handleToggleSiteInfo` | Always enabled | None | PASS | Shows HTTPS/internal state |
| `omnibox.submit` | Open address | `Toolbar` / `src/App.tsx` | Normalize and open/search/block | `handleOmniboxSubmit` | Invalid input shows validation | Enter | PASS | Shared URL engine |
| `privacy.shield` | Privacy shield | `Toolbar` / `src/App.tsx` | Open shield panel | `handleToggleShield` | Always enabled | None | PASS | Shows current-site counts |
| `theme.toggle` | Theme | `Toolbar` / `src/App.tsx` | Cycle System/Light/Dark | `handleCycleTheme` | Always enabled | None | PASS | Persists immediately |
| `settings.open` | Settings | `Toolbar` / `src/App.tsx` | Open settings view | `handleOpenSettings` | Always enabled | Ctrl/Cmd+, | PASS | Replaces old dead more menu |

## Start Page

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `start.submit` | Start open/search | `StartPage` / `src/App.tsx` | Open/search with shared URL engine | `handleStartSubmit` | Always enabled | Enter | PASS | Same navigation path as toolbar |
| `start.search` | Search | `StartPage` / `src/App.tsx` | Open default search provider | `handleOpenSearch` | Always enabled | None | PASS | Opens DuckDuckGo home by default |
| `start.github` | GitHub | `StartPage` / `src/App.tsx` | Open GitHub | `handleOpenGithub` | Always enabled | None | PASS | Opens `https://github.com` |
| `start.example` | Example | `StartPage` / `src/App.tsx` | Open safe example site | `handleOpenExample` | Always enabled | None | PASS | Opens `https://example.com` |
| `start.private` | Private | `StartPage` / `src/App.tsx` | Create private tab | `onCreatePrivate` | Always enabled | None | PASS | Private tab not persisted |
| `start.settings` | Settings | `StartPage` / `src/App.tsx` | Open settings | `onOpenSettings` | Always enabled | None | PASS | Same view as toolbar settings |
| `start.restore-recent` | Restore recent | `StartPage` / `src/App.tsx` | Restore last closed tab | `onRestoreClosed` | Disabled with no closed tabs | Ctrl/Cmd+Shift+T | PASS | Recent list opens real URLs |

## State Pages

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `state.retry` | Retry / Wake tab | `StatePage` / `src/App.tsx` | Retry failed/blocked URL or wake sleeping tab | `onRetry` | Always enabled on state pages | None | PASS | Uses normal navigation path |
| `state.copy-url` | Copy URL | `StatePage` / `src/App.tsx` | Copy current URL | `copyText` | Disabled with no URL | None | PASS | Uses Clipboard API |
| `state.open-external` | Open externally | `StatePage` / `src/App.tsx` | Open safe HTTP(S) URL outside app/web preview | `openExternalSafe` | Disabled for unsafe or empty URL | None | PASS | Conservative fallback via `window.open` |
| `state.home` | Home | `StatePage` / `src/App.tsx` | Return to Horalix start page | `onHome` | Always enabled | Alt+Home | PASS | Uses internal start URL |

## Settings

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `settings.back` | Close settings | `SettingsView` / `src/App.tsx` | Return to browser view | `onClose` | Enabled when settings is open | Esc | PASS | Registered button |
| Appearance theme selector | System/Light/Dark | `SettingsView` / `src/App.tsx` | Apply and persist theme | `SegmentedControl.onChange` | Always enabled | Keyboard focus | PASS | Uses CSS variables |
| Compact mode | Compact mode | `SettingsView` / `src/App.tsx` | Toggle compact shell density | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Applies immediately |
| Search engine selector | Google/DuckDuckGo/Brave/Bing/Custom | `SettingsView` / `src/App.tsx` | Change omnibox search provider | `SelectRow.onChange` | Always enabled | Keyboard focus | PASS | Shared URL engine consumes it |
| Custom search URL | Custom URL | `SettingsView` / `src/App.tsx` | Persist custom template | input `onChange` | Visible only for Custom | Keyboard focus | PASS | Supports `{searchTerms}` |
| Privacy blocker | Privacy blocker | `SettingsView` / `src/App.tsx` | Enable/disable frontend classifier | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Extension remains bundled |
| Block ads | Block ads | `SettingsView` / `src/App.tsx` | Toggle ad host blocking | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Applies before navigation |
| Block trackers | Block trackers | `SettingsView` / `src/App.tsx` | Toggle tracker host blocking | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Applies before navigation |
| Block dangerous protocols | Block dangerous protocols | `SettingsView` / `src/App.tsx` | Toggle dangerous protocol blocking | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | URL engine blocks by default |
| Allowlist add | Add allowlist host | `SettingsView` / `src/App.tsx` | Add host to allowlist | form `onSubmit` | Requires typed host | Enter | PASS | Normalizes host |
| Allowlist remove | Remove host | `SettingsView` / `src/App.tsx` | Remove host from allowlist | remove button `onClick` | Visible for existing hosts | Keyboard focus | PASS | Applies immediately |
| `settings.clear-data` | Clear browsing data | `SettingsView` / `src/App.tsx` | Clear native data and counters | `handleClearBrowsingData` | Always enabled | None | PASS | Calls Tauri command where available |
| `settings.clear-stats` | Clear blocker statistics | `SettingsView` / `src/App.tsx` | Reset blocker counters | `handleClearBlockerStats` | Always enabled | None | PASS | Frontend counters reset |
| Restore previous session | Restore previous session | `SettingsView` / `src/App.tsx` | Toggle session restore | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Private tabs excluded either way |
| Sleeping tabs | Sleeping tabs | `SettingsView` / `src/App.tsx` | Toggle sleeping model | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Updates reducer policy |
| Live cache size | Live tab cache size | `SettingsView` / `src/App.tsx` | Set live WebView cache size | range `onChange` | 1-12 | Keyboard focus | PASS | Default is 3 |
| Background tabs | Open new tabs in background | `SettingsView` / `src/App.tsx` | Toggle activation behavior | `ToggleRow.onChange` | Always enabled | Keyboard focus | PASS | Applies immediately |

## Developer QA

| Control ID | Label | Component/File | Expected Behavior | Handler | Disabled Logic | Shortcut | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dev.create-1000-tabs` | Create 1000 test tabs | Dev API / `src/App.tsx` | Create 1000 sleeping tabs | `handleCreate1000Tabs` | Dev-only global | `window.__HORALIX_DEV__.create1000Tabs()` | PASS | Used for stress checks |

## Automated Coverage

- `src/dev/buttonRegistry.test.ts` verifies documented button IDs are unique and documented.
- Runtime button registrations are exposed through `window.__HORALIX_BUTTONS__`.
- `src-tauri/capabilities/default.json` explicitly grants close, minimize, toggle-maximize, drag, and maximized-state permissions.
- The titlebar drag region excludes the window-control button area so clicks are not swallowed by native dragging.
- `npm test` passed the button registry smoke tests.
