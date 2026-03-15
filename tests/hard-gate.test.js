import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runHardGate } from "../lib/hard-gate.js";

describe("runHardGate", () => {
  it("passes when all commands succeed", async () => {
    const result = await runHardGate(["node -e \"process.exit(0)\""], process.cwd());
    assert.equal(result.passed, true);
    assert.equal(result.outputs.length, 1);
  });

  it("fails on first failing command", async () => {
    const result = await runHardGate(
      ["node -e \"process.exit(0)\"", "node -e \"process.exit(1)\"", "node -e \"process.exit(0)\""],
      process.cwd()
    );
    assert.equal(result.passed, false);
    assert.ok(result.error.includes("exited with code 1"));
  });

  it("captures stdout from each command", async () => {
    const result = await runHardGate(
      ["node -e \"console.log('hello')\""],
      process.cwd()
    );
    assert.ok(result.outputs[0].stdout.includes("hello"));
  });

  it("records total build time", async () => {
    const result = await runHardGate(["node -e \"\""], process.cwd());
    assert.equal(typeof result.buildSeconds, "number");
    assert.ok(result.buildSeconds >= 0);
  });
});
