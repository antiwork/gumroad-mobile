import fs from "fs";
import path from "path";

describe("@tanstack/query-core build compatibility", () => {
  it("legacy build uses __private helpers instead of native private fields", () => {
    const legacyPath = path.resolve(
      __dirname,
      "../node_modules/@tanstack/query-core/build/legacy/queryObserver.js",
    );
    const content = fs.readFileSync(legacyPath, "utf8");
    // The legacy build uses tslib __privateGet/__privateSet helpers
    expect(content).toContain("__privateGet");
    // It must NOT contain native # private field access (this.#field)
    expect(content).not.toMatch(/this\.#[a-zA-Z]/);
  });

  it("modern build uses native private fields (incompatible with babel loose)", () => {
    const modernPath = path.resolve(
      __dirname,
      "../node_modules/@tanstack/query-core/build/modern/queryObserver.js",
    );
    const content = fs.readFileSync(modernPath, "utf8");
    // The modern build uses native # private fields
    expect(content).toMatch(/this\.#[a-zA-Z]/);
  });

  it("metro.config.js overrides resolution for @tanstack/query-core", () => {
    const configPath = path.resolve(__dirname, "../metro.config.js");
    const content = fs.readFileSync(configPath, "utf8");
    // Verify the resolveRequest override exists to redirect query-core
    expect(content).toContain('moduleName === "@tanstack/query-core"');
    expect(content).toContain('unstable_conditionNames: ["require"]');
  });
});
