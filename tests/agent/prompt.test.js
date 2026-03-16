import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../../server/agent/prompt.js";

describe("buildPrompt", () => {
  const baseOpts = {
    projectName: "my-app",
    language: "javascript",
    framework: "nextjs",
    tree: "src/\n  index.js\n  utils.js",
    keyFiles: [{ path: "src/index.js", content: "console.log('hello');" }],
    history: [
      { experiment: 1, score: 72, status: "kept", description: "refactored utils" },
      { experiment: 2, score: 65, status: "reverted", description: "added caching" },
    ],
    metrics: { bundle_size: 300, test_coverage: 80 },
    aggressiveness: "balanced",
    creativity: "moderate",
  };

  it("includes project name in output", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("my-app"), "should contain project name");
  });

  it("includes language in output", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("javascript"), "should contain language");
  });

  it("includes framework in output", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("nextjs"), "should contain framework");
  });

  it("includes JSON response format instructions", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes('"action"'), "should describe the changes format");
    assert.ok(prompt.includes('"create"'), "should mention create action");
    assert.ok(prompt.includes('"modify"'), "should mention modify action");
    assert.ok(prompt.includes('"delete"'), "should mention delete action");
  });

  it("includes key file content", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("src/index.js"), "should include key file path");
    assert.ok(prompt.includes("console.log('hello');"), "should include key file content");
  });

  it("includes history entries", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("Experiment #1"), "should include experiment number");
    assert.ok(prompt.includes("score=72"), "should include score");
    assert.ok(prompt.includes("reverted"), "should include status");
    assert.ok(prompt.includes("refactored utils"), "should include description");
  });

  it("includes metric values", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("bundle_size"), "should include metric name");
    assert.ok(prompt.includes("300"), "should include metric value");
    assert.ok(prompt.includes("test_coverage"), "should include coverage metric");
    assert.ok(prompt.includes("80"), "should include coverage value");
  });

  it("shows 'No prior experiments' when history is empty", () => {
    const prompt = buildPrompt({ ...baseOpts, history: [] });
    assert.ok(prompt.includes("No prior experiments"), "should indicate no history");
  });

  it("adjusts instruction for conservative aggressiveness", () => {
    const prompt = buildPrompt({ ...baseOpts, aggressiveness: "conservative" });
    assert.ok(prompt.includes("conservative"), "should mention conservative");
    assert.ok(prompt.includes("small"), "should advise small changes");
  });

  it("adjusts instruction for aggressive aggressiveness", () => {
    const prompt = buildPrompt({ ...baseOpts, aggressiveness: "aggressive" });
    assert.ok(prompt.includes("aggressive"), "should mention aggressive");
    assert.ok(prompt.includes("bold"), "should advise bold changes");
  });

  it("adjusts instruction for balanced aggressiveness", () => {
    const prompt = buildPrompt({ ...baseOpts, aggressiveness: "balanced" });
    assert.ok(prompt.includes("balanced"), "should mention balanced");
    assert.ok(prompt.includes("moderate"), "should advise moderate changes");
  });

  it("adjusts instruction for safe creativity", () => {
    const prompt = buildPrompt({ ...baseOpts, creativity: "safe" });
    assert.ok(prompt.includes("safe"), "should mention safe");
    assert.ok(prompt.includes("conventional"), "should advise conventional approaches");
  });

  it("adjusts instruction for experimental creativity", () => {
    const prompt = buildPrompt({ ...baseOpts, creativity: "experimental" });
    assert.ok(prompt.includes("experimental"), "should mention experimental");
    assert.ok(prompt.includes("novel"), "should advise novel approaches");
  });

  it("includes directory tree", () => {
    const prompt = buildPrompt(baseOpts);
    assert.ok(prompt.includes("src/\n  index.js"), "should include the tree");
  });

  it("works without optional fields", () => {
    const prompt = buildPrompt({
      projectName: "minimal",
      language: "python",
      framework: "",
      tree: "",
      keyFiles: [],
      history: [],
      metrics: {},
      aggressiveness: "balanced",
      creativity: "moderate",
    });
    assert.ok(prompt.includes("minimal"), "should include project name");
    assert.ok(prompt.includes("python"), "should include language");
    assert.ok(typeof prompt === "string", "should return a string");
  });
});
