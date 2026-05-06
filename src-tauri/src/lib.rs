use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use tauri::webview::{NewWindowResponse, PageLoadEvent, Webview, WebviewBuilder};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};
use url::Url;

const HOME_URL: &str = "https://duckduckgo.com/";
const SEARCH_URL: &str = "https://duckduckgo.com/?q=";

#[derive(Debug, Deserialize)]
struct BrowserBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TabEvent {
    label: String,
    url: String,
    title: Option<String>,
    status: TabStatus,
    blocked_count: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PrivacyEvent {
    label: String,
    blocked_count: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
enum TabStatus {
    Loading,
    Ready,
    Blocked,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NavigationDecision {
    url: String,
    blocked: bool,
    reason: Option<String>,
    blocked_count: u32,
}

#[tauri::command]
fn resolve_navigation_input(input: String) -> Result<NavigationDecision, String> {
    let url = normalize_navigation_input(&input)?;
    let blocked = is_blocked_top_level(&url);

    Ok(NavigationDecision {
        url: url.to_string(),
        blocked,
        reason: blocked.then(|| "Blocked by the Horalix privacy list".to_string()),
        blocked_count: 0,
    })
}

#[tauri::command]
async fn prewarm_browser_tab(
    app: tauri::AppHandle,
    label: String,
    bounds: BrowserBounds,
    is_private: bool,
) -> Result<(), String> {
    validate_label(&label)?;
    if app.get_webview(&label).is_some() {
        return Ok(());
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window was not found".to_string())?;
    let navigation_app = app.clone();
    let load_app = app.clone();
    let page_title_app = app.clone();
    let document_title_app = app.clone();
    let popup_app = app.clone();
    let label_for_navigation = label.clone();
    let label_for_load = label.clone();
    let label_for_page_title = label.clone();
    let label_for_document_title = label.clone();
    let label_for_popup = label.clone();

    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(about_blank()))
        .incognito(is_private)
        .enable_clipboard_access()
        .disable_drag_drop_handler()
        .initialization_script(HORALIX_INIT_SCRIPT)
        .on_navigation(move |next_url| {
            let is_blocked = is_blocked_top_level(next_url);
            let status = if is_blocked {
                increment_blocked_count(&navigation_app, &label_for_navigation);
                TabStatus::Blocked
            } else {
                TabStatus::Loading
            };
            emit_tab_event(
                &navigation_app,
                &label_for_navigation,
                next_url,
                None,
                status,
            );
            !is_blocked
        })
        .on_new_window(move |url, _features| {
            increment_blocked_count(&popup_app, &label_for_popup);
            if is_blocked_top_level(&url) {
                return NewWindowResponse::Deny;
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |webview, payload| {
            let status = match payload.event() {
                PageLoadEvent::Started => TabStatus::Loading,
                PageLoadEvent::Finished => TabStatus::Ready,
            };
            emit_tab_event(&load_app, &label_for_load, payload.url(), None, status);

            if matches!(payload.event(), PageLoadEvent::Finished) {
                let title_app = page_title_app.clone();
                let label = label_for_page_title.clone();
                let url = payload.url().to_string();
                let _ = webview.eval_with_callback(
                    "JSON.stringify({ title: document.title, hidden: window.__HORALIX_WEB__?.blockedCount?.() ?? 0 })",
                    move |payload| {
                        let payload = payload.trim_matches('"').replace("\\\"", "\"");
                        let parsed: serde_json::Value =
                            serde_json::from_str(&payload).unwrap_or_default();
                        let title = parsed
                            .get("title")
                            .and_then(|value| value.as_str())
                            .unwrap_or_default()
                            .to_string();
                        let hidden = parsed
                            .get("hidden")
                            .and_then(|value| value.as_u64())
                            .unwrap_or(0) as u32;
                        merge_blocked_count(&title_app, &label, hidden);
                        let title = title.trim_matches('"').to_string();
                        let parsed_url = Url::parse(&url).unwrap_or_else(|_| about_blank());
                        emit_tab_event(&title_app, &label, &parsed_url, Some(title), TabStatus::Ready);
                    },
                );
            }
        })
        .on_document_title_changed(move |_webview, title| {
            let _ = document_title_app.emit(
                "horalix://tab-title",
                serde_json::json!({
                    "label": label_for_document_title.clone(),
                    "title": title,
                }),
            );
        });

    if let Some(extension_root) = extension_root(&app) {
        builder = builder
            .browser_extensions_enabled(true)
            .extensions_path(extension_root);
    }

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|e| e.to_string())?;
    webview.hide().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_browser_tab(
    app: tauri::AppHandle,
    label: String,
    input: String,
    bounds: BrowserBounds,
    is_private: bool,
) -> Result<NavigationDecision, String> {
    validate_label(&label)?;
    let url = normalize_navigation_input(&input)?;
    let blocked = is_blocked_top_level(&url);
    if blocked {
        increment_blocked_count(&app, &label);
        emit_tab_event(&app, &label, &url, None, TabStatus::Blocked);
        return Ok(NavigationDecision {
            url: url.to_string(),
            blocked: true,
            reason: Some("Blocked by the Horalix privacy list".to_string()),
            blocked_count: blocked_count(&label),
        });
    }

    if let Some(webview) = app.get_webview(&label) {
        resize_webview(&webview, &bounds)?;
        webview.show().map_err(|e| e.to_string())?;
        webview.navigate(url.clone()).map_err(|e| e.to_string())?;
        emit_tab_event(&app, &label, &url, None, TabStatus::Loading);
        return Ok(NavigationDecision {
            url: url.to_string(),
            blocked: false,
            reason: None,
            blocked_count: blocked_count(&label),
        });
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window was not found".to_string())?;
    let navigation_app = app.clone();
    let load_app = app.clone();
    let page_title_app = app.clone();
    let document_title_app = app.clone();
    let popup_app = app.clone();
    let label_for_navigation = label.clone();
    let label_for_load = label.clone();
    let label_for_page_title = label.clone();
    let label_for_document_title = label.clone();
    let label_for_popup = label.clone();

    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(url.clone()))
        .incognito(is_private)
        .enable_clipboard_access()
        .disable_drag_drop_handler()
        .initialization_script(HORALIX_INIT_SCRIPT)
        .on_navigation(move |next_url| {
            let is_blocked = is_blocked_top_level(next_url);
            let status = if is_blocked {
                increment_blocked_count(&navigation_app, &label_for_navigation);
                TabStatus::Blocked
            } else {
                TabStatus::Loading
            };
            emit_tab_event(
                &navigation_app,
                &label_for_navigation,
                next_url,
                None,
                status,
            );
            !is_blocked
        })
        .on_new_window(move |url, _features| {
            increment_blocked_count(&popup_app, &label_for_popup);
            let _ = popup_app.emit(
                "horalix://privacy-event",
                PrivacyEvent {
                    label: label_for_popup.clone(),
                    blocked_count: blocked_count(&label_for_popup),
                },
            );
            if is_blocked_top_level(&url) {
                return NewWindowResponse::Deny;
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |webview, payload| {
            let status = match payload.event() {
                PageLoadEvent::Started => TabStatus::Loading,
                PageLoadEvent::Finished => TabStatus::Ready,
            };
            emit_tab_event(&load_app, &label_for_load, payload.url(), None, status);

            if matches!(payload.event(), PageLoadEvent::Finished) {
                let title_app = page_title_app.clone();
                let label = label_for_page_title.clone();
                let url = payload.url().to_string();
                let _ = webview.eval_with_callback(
                    "JSON.stringify({ title: document.title, hidden: window.__HORALIX_WEB__?.blockedCount?.() ?? 0 })",
                    move |payload| {
                    let payload = payload.trim_matches('"').replace("\\\"", "\"");
                    let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap_or_default();
                    let title = parsed
                        .get("title")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let hidden = parsed
                        .get("hidden")
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0) as u32;
                    merge_blocked_count(&title_app, &label, hidden);
                    let title = title.trim_matches('"').to_string();
                    let parsed_url = Url::parse(&url).unwrap_or_else(|_| about_blank());
                    emit_tab_event(&title_app, &label, &parsed_url, Some(title), TabStatus::Ready);
                });
            }
        })
        .on_document_title_changed(move |_webview, title| {
            let _ = document_title_app.emit(
                "horalix://tab-title",
                serde_json::json!({
                    "label": label_for_document_title.clone(),
                    "title": title,
                }),
            );
        });

    if let Some(extension_root) = extension_root(&app) {
        builder = builder
            .browser_extensions_enabled(true)
            .extensions_path(extension_root);
    }

    window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|e| e.to_string())?;

    emit_tab_event(&app, &label, &url, None, TabStatus::Loading);

    Ok(NavigationDecision {
        url: url.to_string(),
        blocked: false,
        reason: None,
        blocked_count: blocked_count(&label),
    })
}

#[tauri::command]
async fn navigate_browser_tab(
    app: tauri::AppHandle,
    label: String,
    input: String,
) -> Result<NavigationDecision, String> {
    validate_label(&label)?;
    let url = normalize_navigation_input(&input)?;
    let blocked = is_blocked_top_level(&url);
    if blocked {
        increment_blocked_count(&app, &label);
        emit_tab_event(&app, &label, &url, None, TabStatus::Blocked);
        return Ok(NavigationDecision {
            url: url.to_string(),
            blocked: true,
            reason: Some("Blocked by the Horalix privacy list".to_string()),
            blocked_count: blocked_count(&label),
        });
    }

    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview {label} was not found"))?;
    webview.navigate(url.clone()).map_err(|e| e.to_string())?;
    emit_tab_event(&app, &label, &url, None, TabStatus::Loading);

    Ok(NavigationDecision {
        url: url.to_string(),
        blocked: false,
        reason: None,
        blocked_count: blocked_count(&label),
    })
}

#[tauri::command]
async fn resize_browser_tab(
    app: tauri::AppHandle,
    label: String,
    bounds: BrowserBounds,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        resize_webview(&webview, &bounds)?;
    }
    Ok(())
}

#[tauri::command]
async fn set_active_browser_tab(
    app: tauri::AppHandle,
    active_label: Option<String>,
    labels: Vec<String>,
) -> Result<(), String> {
    for label in labels {
        if let Some(webview) = app.get_webview(&label) {
            if active_label.as_deref() == Some(label.as_str()) {
                webview.show().map_err(|e| e.to_string())?;
                webview.set_focus().map_err(|e| e.to_string())?;
            } else {
                webview.hide().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn close_browser_tab(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn reload_browser_tab(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview {label} was not found"))?;
    webview.reload().map_err(|e| e.to_string())
}

#[tauri::command]
async fn go_back_browser_tab(app: tauri::AppHandle, label: String) -> Result<(), String> {
    eval_on_tab(&app, &label, "history.back()")
}

#[tauri::command]
async fn go_forward_browser_tab(app: tauri::AppHandle, label: String) -> Result<(), String> {
    eval_on_tab(&app, &label, "history.forward()")
}

#[tauri::command]
async fn disable_site_blocking(
    app: tauri::AppHandle,
    label: String,
    host: String,
) -> Result<(), String> {
    validate_label(&label)?;
    let host = normalize_host(&host).ok_or_else(|| "Invalid site host".to_string())?;
    allow_site_for_session(host);
    if let Some(webview) = app.get_webview(&label) {
        webview
            .eval("window.postMessage({ type: 'HORALIX_DISABLE_SITE_BLOCKING' }, '*')")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn clear_browser_data(app: tauri::AppHandle, labels: Vec<String>) -> Result<(), String> {
    for label in labels {
        if let Some(webview) = app.get_webview(&label) {
            webview.clear_all_browsing_data().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn emit_tab_event(
    app: &tauri::AppHandle,
    label: &str,
    url: &Url,
    title: Option<String>,
    status: TabStatus,
) {
    let _ = app.emit(
        "horalix://tab-event",
        TabEvent {
            label: label.to_string(),
            url: url.to_string(),
            title,
            status,
            blocked_count: blocked_count(label),
        },
    );
}

fn resize_webview(webview: &Webview, bounds: &BrowserBounds) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)))
        .map_err(|e| e.to_string())
}

fn eval_on_tab(app: &tauri::AppHandle, label: &str, js: &str) -> Result<(), String> {
    let webview = app
        .get_webview(label)
        .ok_or_else(|| format!("Webview {label} was not found"))?;
    webview.eval(js).map_err(|e| e.to_string())
}

fn validate_label(label: &str) -> Result<(), String> {
    let valid = !label.is_empty()
        && label
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '/' | ':' | '_'));
    if valid {
        Ok(())
    } else {
        Err("Invalid webview label".to_string())
    }
}

fn extension_root(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("extensions"));
        candidates.push(resource_dir.join("src-tauri").join("extensions"));
    }
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("src-tauri").join("extensions"));
        candidates.push(current_dir.join("extensions"));
    }

    candidates
        .into_iter()
        .find(|path| path.join("horalix-blocker").join("manifest.json").is_file())
}

fn normalize_navigation_input(input: &str) -> Result<Url, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Url::parse(HOME_URL).map_err(|e| e.to_string());
    }

    if let Ok(url) = Url::parse(trimmed) {
        if matches!(url.scheme(), "http" | "https" | "about") {
            return Ok(url);
        }
    }

    if looks_like_host(trimmed) {
        return Url::parse(&format!("https://{trimmed}")).map_err(|e| e.to_string());
    }

    Url::parse(&format!("{SEARCH_URL}{}", encode_query(trimmed))).map_err(|e| e.to_string())
}

fn looks_like_host(value: &str) -> bool {
    !value.contains(char::is_whitespace)
        && (value.contains('.')
            || value.eq_ignore_ascii_case("localhost")
            || value.starts_with("127."))
}

fn encode_query(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['+'],
            other => {
                let hex = format!("%{other:02X}");
                hex.chars().collect()
            }
        })
        .collect()
}

fn is_blocked_top_level(url: &Url) -> bool {
    if is_site_allowed_for_session(url) {
        return false;
    }

    url.host_str()
        .map(horalix_net::is_tracker_blocked)
        .unwrap_or(false)
}

fn normalize_host(host: &str) -> Option<String> {
    let host = host.trim().trim_matches('.').to_ascii_lowercase();
    if host.is_empty()
        || host
            .chars()
            .any(|ch| !(ch.is_ascii_alphanumeric() || matches!(ch, '-' | '.')))
    {
        None
    } else {
        Some(host)
    }
}

fn site_allowlist() -> &'static RwLock<HashSet<String>> {
    static ALLOWLIST: OnceLock<RwLock<HashSet<String>>> = OnceLock::new();
    ALLOWLIST.get_or_init(|| RwLock::new(HashSet::new()))
}

fn allow_site_for_session(host: String) {
    if let Ok(mut allowlist) = site_allowlist().write() {
        allowlist.insert(host);
    }
}

fn is_site_allowed_for_session(url: &Url) -> bool {
    let Some(host) = url.host_str().and_then(normalize_host) else {
        return false;
    };
    site_allowlist()
        .read()
        .map(|allowlist| allowlist.contains(&host))
        .unwrap_or(false)
}

fn tab_block_counts() -> &'static RwLock<HashMap<String, u32>> {
    static COUNTS: OnceLock<RwLock<HashMap<String, u32>>> = OnceLock::new();
    COUNTS.get_or_init(|| RwLock::new(HashMap::new()))
}

fn blocked_count(label: &str) -> u32 {
    tab_block_counts()
        .read()
        .ok()
        .and_then(|counts| counts.get(label).copied())
        .unwrap_or(0)
}

fn increment_blocked_count(app: &tauri::AppHandle, label: &str) {
    let count = {
        let mut counts = match tab_block_counts().write() {
            Ok(counts) => counts,
            Err(_) => return,
        };
        let count = counts.entry(label.to_string()).or_insert(0);
        *count = count.saturating_add(1);
        *count
    };
    let _ = app.emit(
        "horalix://privacy-event",
        PrivacyEvent {
            label: label.to_string(),
            blocked_count: count,
        },
    );
}

fn merge_blocked_count(app: &tauri::AppHandle, label: &str, hidden_count: u32) {
    let count = {
        let mut counts = match tab_block_counts().write() {
            Ok(counts) => counts,
            Err(_) => return,
        };
        let count = counts.entry(label.to_string()).or_insert(0);
        *count = (*count).max(hidden_count);
        *count
    };
    let _ = app.emit(
        "horalix://privacy-event",
        PrivacyEvent {
            label: label.to_string(),
            blocked_count: count,
        },
    );
}

fn about_blank() -> Url {
    Url::parse("about:blank").expect("about:blank is a valid URL")
}

const HORALIX_INIT_SCRIPT: &str = r#"
(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  const selectors = [
    "[id^='ad-']",
    "[id*='-ad-']",
    "[id*='ads']",
    "[class^='ad-']",
    "[class*=' ad-']",
    "[class*=' ads']",
    "[class*='advert']",
    "[class*='sponsor']",
    "[aria-label*='advertisement' i]",
    "iframe[src*='doubleclick']",
    "iframe[src*='googlesyndication']"
  ];
  let hiddenCount = 0;
  const hideMatches = () => {
    for (const node of document.querySelectorAll(selectors.join(","))) {
      if (node.dataset?.horalixHidden === "true") continue;
      if (node.dataset) node.dataset.horalixHidden = "true";
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      hiddenCount += 1;
    }
  };
  const install = () => {
    hideMatches();
    new MutationObserver(hideMatches).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };
  if (document.documentElement) {
    install();
  } else {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  }
  window.__HORALIX_WEB__ = {
    privacy: "maximum",
    product: "Horalix Web",
    blockedCount: () => hiddenCount
  };
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            resolve_navigation_input,
            prewarm_browser_tab,
            create_browser_tab,
            navigate_browser_tab,
            resize_browser_tab,
            set_active_browser_tab,
            close_browser_tab,
            reload_browser_tab,
            go_back_browser_tab,
            go_forward_browser_tab,
            disable_site_blocking,
            clear_browser_data,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Horalix Web");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_terms_resolve_to_duckduckgo() {
        let url = normalize_navigation_input("rust browser").unwrap();
        assert_eq!(url.as_str(), "https://duckduckgo.com/?q=rust+browser");
    }

    #[test]
    fn host_without_scheme_resolves_to_https() {
        let url = normalize_navigation_input("example.com").unwrap();
        assert_eq!(url.as_str(), "https://example.com/");
    }

    #[test]
    fn tracker_hosts_are_blocked() {
        let url = Url::parse("https://www.google-analytics.com/analytics.js").unwrap();
        assert!(is_blocked_top_level(&url));
    }
}
