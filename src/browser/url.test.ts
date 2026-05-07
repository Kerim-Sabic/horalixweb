import { describe, expect, it } from "vitest";

import {
  FALLBACK_HOME_URL,
  INTERNAL_START_URL,
  SEARCH_ENGINES,
  getOriginLabel,
  getSearchHomeUrl,
  isDangerousProtocol,
  isLikelyUrl,
  normalizeUrlInput,
} from "./url";

const engine = SEARCH_ENGINES.duckduckgo;

describe("url engine", () => {
  it("normalizes google.com to https://google.com/", () => {
    const nav = normalizeUrlInput("google.com", engine);
    expect(nav.kind).toBe("navigate");
    expect(nav.url).toBe("https://google.com/");
  });

  it("preserves explicit https URLs", () => {
    const nav = normalizeUrlInput(" https://google.com/search?q=test ", engine);
    expect(nav.kind).toBe("navigate");
    expect(nav.url).toBe("https://google.com/search?q=test");
  });

  it("preserves localhost ports", () => {
    expect(normalizeUrlInput("http://localhost:5173", engine).url).toBe("http://localhost:5173/");
    expect(normalizeUrlInput("localhost:3000", engine).url).toBe("https://localhost:3000/");
    expect(normalizeUrlInput("127.0.0.1:8000", engine).url).toBe("https://127.0.0.1:8000/");
  });

  it("treats search terms as a search URL", () => {
    const nav = normalizeUrlInput("best private browser", engine);
    expect(nav.kind).toBe("search");
    expect(nav.url).toBe("https://duckduckgo.com/?q=best+private+browser");
  });

  it("blocks dangerous protocols", () => {
    for (const input of ["javascript:alert(1)", "DATA:text/html,test", "vbscript:msgbox(1)", "file:///c:/secret.txt"]) {
      const nav = normalizeUrlInput(input, engine);
      expect(nav.kind).toBe("blocked");
      expect(nav.blocked).toBe(true);
      expect(isDangerousProtocol(input)).toBe(true);
    }
  });

  it("handles malformed input without throwing", () => {
    const nav = normalizeUrlInput("https://", engine);
    expect(nav.kind).toBe("invalid");
    expect(nav.blocked).toBe(true);
  });

  it("handles internal start URLs", () => {
    expect(normalizeUrlInput("", engine).url).toBe(INTERNAL_START_URL);
    expect(normalizeUrlInput("horalix://home", engine).url).toBe(INTERNAL_START_URL);
  });

  it("detects likely URLs and origins", () => {
    expect(isLikelyUrl("intranet.local")).toBe(true);
    expect(isLikelyUrl("hello world")).toBe(false);
    expect(getOriginLabel("https://github.com/Kerim-Sabic/horalixweb")).toBe("github.com");
  });

  it("opens the selected provider home for start quick search", () => {
    expect(getSearchHomeUrl(SEARCH_ENGINES.duckduckgo)).toBe(FALLBACK_HOME_URL);
    expect(getSearchHomeUrl(SEARCH_ENGINES.google)).toBe("https://www.google.com/");
    expect(getSearchHomeUrl(SEARCH_ENGINES.brave)).toBe("https://search.brave.com/");
  });
});
