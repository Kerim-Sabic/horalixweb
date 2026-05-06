import { describe, expect, it } from "vitest";

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
});
