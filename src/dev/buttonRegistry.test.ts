import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { BUTTON_QA_DEFINITIONS, clearButtonRegistryForTests, getRegisteredButtons, registerButton } from "./buttonRegistry";

describe("button registry", () => {
  it("has no duplicate documented IDs", () => {
    const ids = BUTTON_QA_DEFINITIONS.map((button) => button.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("documents labels and handlers", () => {
    for (const button of BUTTON_QA_DEFINITIONS) {
      expect(button.id).toBeTruthy();
      expect(button.label).toBeTruthy();
      expect(button.handlerName).toBeTruthy();
      expect(button.expectedBehavior).toBeTruthy();
    }
  });

  it("registers buttons with real handlers", () => {
    clearButtonRegistryForTests();
    registerButton({
      id: "test.button",
      label: "Test",
      component: "Test",
      handler: function handleTest() {
        return undefined;
      },
    });
    expect(getRegisteredButtons()).toEqual([
      expect.objectContaining({
        id: "test.button",
        handlerExists: true,
        label: "Test",
      }),
    ]);
  });

  it("grants explicit native permissions for custom window controls", () => {
    const capability = JSON.parse(
      readFileSync(new URL("../../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
    ) as { permissions: string[] };

    expect(capability.permissions).toContain("core:window:allow-close");
    expect(capability.permissions).toContain("core:window:allow-minimize");
    expect(capability.permissions).toContain("core:window:allow-toggle-maximize");
    expect(capability.permissions).toContain("core:window:allow-start-dragging");
  });

  it("uses the Windows GUI subsystem in release so no console opens", () => {
    const main = readFileSync(new URL("../../src-tauri/src/main.rs", import.meta.url), "utf8");
    expect(main).toContain('cfg_attr(not(debug_assertions), windows_subsystem = "windows")');
  });
});
