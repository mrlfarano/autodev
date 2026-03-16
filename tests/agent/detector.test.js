import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectTools, detectTool, TOOLS } from "../../server/agent/detector.js";

describe("detectTools", () => {
  it("returns an array of tool results", async () => {
    const results = await detectTools();
    assert.ok(Array.isArray(results), "results should be an array");
    assert.equal(results.length, TOOLS.length);
  });

  it("each result has name, available, version, and path fields", async () => {
    const results = await detectTools();
    for (const result of results) {
      assert.equal(typeof result.name, "string", "name should be a string");
      assert.equal(
        typeof result.available,
        "boolean",
        "available should be a boolean"
      );
      assert.ok(
        result.version === null || typeof result.version === "string",
        "version should be string or null"
      );
      assert.ok(
        result.path === null || typeof result.path === "string",
        "path should be string or null"
      );
    }
  });

  it("includes all default tool names", async () => {
    const results = await detectTools();
    const names = results.map((r) => r.name);
    for (const tool of TOOLS) {
      assert.ok(names.includes(tool), `should include ${tool}`);
    }
  });

  it("accepts a custom tool list", async () => {
    const results = await detectTools(["docker"]);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "docker");
  });

  it("detects docker as available", async () => {
    // Docker is commonly installed; verify the structure even if not present
    const results = await detectTools(["docker"]);
    const docker = results[0];
    assert.equal(docker.name, "docker");
    // On CI or machines without docker, available may be false — just check shape
    assert.equal(typeof docker.available, "boolean");
    if (docker.available) {
      // If docker is found, version or path should be non-null
      const hasInfo = docker.version !== null || docker.path !== null;
      assert.ok(hasInfo, "available docker should have version or path");
    }
  });
});

describe("detectTool", () => {
  it("returns unavailable for a nonexistent tool", async () => {
    const result = await detectTool("__nonexistent_tool_xyz__");
    assert.equal(result.name, "__nonexistent_tool_xyz__");
    assert.equal(result.available, false);
    assert.equal(result.version, null);
    assert.equal(result.path, null);
  });
});
