import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseResponse } from "../../server/agent/providers/parse-response.js";

const VALID_PROPOSAL = {
  description: "Add a hello endpoint",
  category: "feature",
  changes: [
    { path: "src/index.js", action: "create", content: 'console.log("hello");' },
  ],
};

describe("parseResponse", () => {
  // ----------------------------------------------------------------
  // Clean JSON
  // ----------------------------------------------------------------
  describe("clean JSON", () => {
    it("parses a plain JSON string", () => {
      const raw = JSON.stringify(VALID_PROPOSAL);
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });

    it("parses JSON with extra whitespace", () => {
      const raw = "   \n" + JSON.stringify(VALID_PROPOSAL, null, 2) + "\n  ";
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });
  });

  // ----------------------------------------------------------------
  // Markdown code blocks
  // ----------------------------------------------------------------
  describe("markdown code blocks", () => {
    it("extracts JSON from ```json ... ``` block", () => {
      const raw = "Here is my proposal:\n```json\n" + JSON.stringify(VALID_PROPOSAL, null, 2) + "\n```\n";
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });

    it("extracts JSON from ``` ... ``` block without language tag", () => {
      const raw = "Result:\n```\n" + JSON.stringify(VALID_PROPOSAL) + "\n```";
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });
  });

  // ----------------------------------------------------------------
  // JSON embedded in text
  // ----------------------------------------------------------------
  describe("embedded in text", () => {
    it("extracts JSON surrounded by prose", () => {
      const raw =
        "Sure! Here is the proposal:\n\n" +
        JSON.stringify(VALID_PROPOSAL) +
        "\n\nLet me know if you need changes.";
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });

    it("extracts JSON when there is leading text only", () => {
      const raw = "My response: " + JSON.stringify(VALID_PROPOSAL);
      const result = parseResponse(raw);
      assert.deepEqual(result, VALID_PROPOSAL);
    });
  });

  // ----------------------------------------------------------------
  // Unparseable input
  // ----------------------------------------------------------------
  describe("unparseable input", () => {
    it("returns null for empty string", () => {
      assert.equal(parseResponse(""), null);
    });

    it("returns null for non-string input", () => {
      assert.equal(parseResponse(null), null);
      assert.equal(parseResponse(undefined), null);
      assert.equal(parseResponse(42), null);
    });

    it("returns null for plain text with no JSON", () => {
      assert.equal(parseResponse("I cannot help with that request."), null);
    });

    it("returns null for malformed JSON", () => {
      assert.equal(parseResponse('{ "description": "test", broken }'), null);
    });
  });

  // ----------------------------------------------------------------
  // Validation of required fields
  // ----------------------------------------------------------------
  describe("field validation", () => {
    it("returns null when description is missing", () => {
      const obj = { category: "fix", changes: [{ path: "a.js", action: "create", content: "" }] };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when category is missing", () => {
      const obj = { description: "x", changes: [{ path: "a.js", action: "create", content: "" }] };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when changes array is missing", () => {
      const obj = { description: "x", category: "fix" };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when changes array is empty", () => {
      const obj = { description: "x", category: "fix", changes: [] };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when a change has an invalid action", () => {
      const obj = {
        description: "x",
        category: "fix",
        changes: [{ path: "a.js", action: "rename", content: "" }],
      };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when a change is missing path", () => {
      const obj = {
        description: "x",
        category: "fix",
        changes: [{ action: "create", content: "hi" }],
      };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("returns null when a change is missing content", () => {
      const obj = {
        description: "x",
        category: "fix",
        changes: [{ path: "a.js", action: "create" }],
      };
      assert.equal(parseResponse(JSON.stringify(obj)), null);
    });

    it("accepts all three valid actions", () => {
      for (const action of ["create", "modify", "delete"]) {
        const obj = {
          description: "d",
          category: "c",
          changes: [{ path: "f.js", action, content: "x" }],
        };
        const result = parseResponse(JSON.stringify(obj));
        assert.notEqual(result, null, `action "${action}" should be valid`);
        assert.equal(result.changes[0].action, action);
      }
    });

    it("strips extra properties from changes", () => {
      const obj = {
        description: "d",
        category: "c",
        changes: [{ path: "f.js", action: "create", content: "x", extra: true }],
      };
      const result = parseResponse(JSON.stringify(obj));
      assert.equal(result.changes[0].extra, undefined);
    });
  });
});
