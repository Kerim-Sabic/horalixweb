import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type DnrRule = {
  id: number;
  action: { type: string };
  condition: {
    resourceTypes?: string[];
    urlFilter?: string;
  };
};

const rules = JSON.parse(
  readFileSync(new URL("../../src-tauri/extensions/horalix-blocker/rules.json", import.meta.url), "utf8"),
) as DnrRule[];
const manifest = JSON.parse(
  readFileSync(new URL("../../src-tauri/extensions/horalix-blocker/manifest.json", import.meta.url), "utf8"),
) as { content_scripts: Array<{ js: string[]; matches: string[] }> };
const youtubeScript = readFileSync(
  new URL("../../src-tauri/extensions/horalix-blocker/youtube.js", import.meta.url),
  "utf8",
);
const contentScript = readFileSync(
  new URL("../../src-tauri/extensions/horalix-blocker/content.js", import.meta.url),
  "utf8",
);

function rulesFor(filter: string) {
  return rules.filter((rule) => rule.condition.urlFilter?.includes(filter));
}

describe("bundled declarativeNetRequest rules", () => {
  it("allows YouTube media hosts so video playback is protected", () => {
    const googleVideo = rulesFor("googlevideo.com");
    expect(googleVideo.some((rule) => rule.action.type === "allow" && rule.condition.resourceTypes?.includes("media"))).toBe(true);
    expect(googleVideo.some((rule) => rule.action.type === "block")).toBe(false);
    expect(rulesFor("ytimg.com").some((rule) => rule.action.type === "block")).toBe(false);
  });

  it("blocks YouTube ad and telemetry endpoints without blocking media hosts", () => {
    expect(rulesFor("ads.youtube.com").some((rule) => rule.action.type === "block")).toBe(true);
    expect(rulesFor("/pagead/").some((rule) => rule.action.type === "block")).toBe(true);
    expect(rulesFor("/api/stats/ads").some((rule) => rule.action.type === "block")).toBe(true);
    expect(rulesFor("/ptracking").some((rule) => rule.action.type === "block")).toBe(true);
    expect(rulesFor("/youtubei/v1/log_event").some((rule) => rule.action.type === "block")).toBe(false);
  });

  it("loads the YouTube-specific playback-safe content script", () => {
    const youtubeScript = manifest.content_scripts.find((script) => script.js.includes("youtube.js"));
    expect(youtubeScript?.matches).toContain("*://*.youtube.com/*");
    expect(youtubeScript?.matches).toContain("*://*.youtube-nocookie.com/*");
  });

  it("does not mutate YouTube playback timing or speed by default", () => {
    expect(youtubeScript).not.toContain("playbackRate");
    expect(youtubeScript).not.toContain("currentTime");
  });

  it("exposes blocker health markers for native diagnostics", () => {
    expect(contentScript).toContain("data-horalix-blocker");
    expect(youtubeScript).toContain("data-horalix-youtube");
  });
});
