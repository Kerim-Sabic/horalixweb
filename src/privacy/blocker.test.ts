import { describe, expect, it } from "vitest";

import { classifyNavigation } from "./blocker";
import { createPrivacyStats, incrementPrivacyStats, totalPrivacyStats } from "./stats";

describe("privacy blocker", () => {
  it("blocks known trackers", () => {
    const decision = classifyNavigation("https://www.google-analytics.com/analytics.js");
    expect(decision.blocked).toBe(true);
    expect(decision.category).toBe("tracker");
  });

  it("blocks known ad hosts", () => {
    const decision = classifyNavigation("https://stats.g.doubleclick.net/pagead/id");
    expect(decision.blocked).toBe(true);
    expect(decision.category).toBe("ad");
  });

  it("allows allowlisted hosts", () => {
    const decision = classifyNavigation("https://doubleclick.net/", undefined, ["doubleclick.net"]);
    expect(decision.blocked).toBe(false);
  });

  it("blocks dangerous protocols", () => {
    const decision = classifyNavigation("javascript:alert(1)");
    expect(decision.blocked).toBe(true);
    expect(decision.category).toBe("dangerous");
  });

  it("increments stats", () => {
    const stats = incrementPrivacyStats(createPrivacyStats(), "tracker");
    expect(stats.trackers).toBe(1);
    expect(totalPrivacyStats(stats)).toBe(1);
  });
});
