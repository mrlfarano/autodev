import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { applyChanges, revertLastCommit, getCurrentCommit } from "../../server/agent/apply.js";

describe("applyChanges", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "autodev-apply-test-"));
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: "pipe" });
    // Create an initial commit so HEAD exists
    writeFileSync(join(tempDir, "README.md"), "# Test\n");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: "pipe" });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a new file and commits", () => {
    applyChanges(tempDir, [
      { path: "src/hello.js", action: "create", content: "export const x = 1;\n" },
    ], "add hello");

    const content = readFileSync(join(tempDir, "src/hello.js"), "utf-8");
    assert.equal(content, "export const x = 1;\n");

    // Verify git committed
    const log = execSync("git log --oneline", { cwd: tempDir, encoding: "utf-8" });
    assert.ok(log.includes("experiment: add hello"), "should have the commit message");
  });

  it("creates files in nested directories", () => {
    applyChanges(tempDir, [
      { path: "a/b/c/deep.txt", action: "create", content: "deep content" },
    ], "deep create");

    const content = readFileSync(join(tempDir, "a/b/c/deep.txt"), "utf-8");
    assert.equal(content, "deep content");
  });

  it("modifies an existing file", () => {
    writeFileSync(join(tempDir, "existing.txt"), "old content");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "add existing"', { cwd: tempDir, stdio: "pipe" });

    applyChanges(tempDir, [
      { path: "existing.txt", action: "modify", content: "new content" },
    ], "modify existing");

    const content = readFileSync(join(tempDir, "existing.txt"), "utf-8");
    assert.equal(content, "new content");
  });

  it("deletes a file", () => {
    writeFileSync(join(tempDir, "to-delete.txt"), "bye");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "add file to delete"', { cwd: tempDir, stdio: "pipe" });

    applyChanges(tempDir, [
      { path: "to-delete.txt", action: "delete", content: "" },
    ], "remove file");

    assert.equal(existsSync(join(tempDir, "to-delete.txt")), false);
  });

  it("handles multiple changes in one call", () => {
    writeFileSync(join(tempDir, "modify-me.txt"), "original");
    writeFileSync(join(tempDir, "delete-me.txt"), "gone");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "setup"', { cwd: tempDir, stdio: "pipe" });

    applyChanges(tempDir, [
      { path: "new-file.txt", action: "create", content: "brand new" },
      { path: "modify-me.txt", action: "modify", content: "modified" },
      { path: "delete-me.txt", action: "delete", content: "" },
    ], "multi change");

    assert.equal(readFileSync(join(tempDir, "new-file.txt"), "utf-8"), "brand new");
    assert.equal(readFileSync(join(tempDir, "modify-me.txt"), "utf-8"), "modified");
    assert.equal(existsSync(join(tempDir, "delete-me.txt")), false);

    // Should be a single commit
    const log = execSync("git log --oneline", { cwd: tempDir, encoding: "utf-8" });
    assert.ok(log.includes("experiment: multi change"));
  });

  it("throws on unknown action", () => {
    assert.throws(
      () => applyChanges(tempDir, [{ path: "x.txt", action: "rename", content: "" }], "bad"),
      /Unknown action/
    );
  });
});

describe("revertLastCommit", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "autodev-revert-test-"));
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: "pipe" });
    writeFileSync(join(tempDir, "base.txt"), "base content");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: "pipe" });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reverts to the previous commit", () => {
    // Make a second commit
    writeFileSync(join(tempDir, "extra.txt"), "extra");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "add extra"', { cwd: tempDir, stdio: "pipe" });

    assert.equal(existsSync(join(tempDir, "extra.txt")), true);

    revertLastCommit(tempDir);

    assert.equal(existsSync(join(tempDir, "extra.txt")), false);
    // base.txt should still exist
    assert.equal(readFileSync(join(tempDir, "base.txt"), "utf-8"), "base content");
  });
});

describe("getCurrentCommit", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "autodev-commit-test-"));
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: "pipe" });
    writeFileSync(join(tempDir, "file.txt"), "content");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: "pipe" });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns a short commit hash", () => {
    const hash = getCurrentCommit(tempDir);
    assert.ok(typeof hash === "string", "should be a string");
    assert.ok(hash.length >= 7, "short hash should be at least 7 chars");
    assert.ok(/^[0-9a-f]+$/.test(hash), "should be hex characters");
  });

  it("changes after a new commit", () => {
    const hash1 = getCurrentCommit(tempDir);
    writeFileSync(join(tempDir, "file2.txt"), "more");
    execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "second"', { cwd: tempDir, stdio: "pipe" });
    const hash2 = getCurrentCommit(tempDir);
    assert.notEqual(hash1, hash2, "hash should change after new commit");
  });
});
