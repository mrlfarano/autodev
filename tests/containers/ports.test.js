import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PortAllocator } from "../../server/containers/ports.js";

describe("PortAllocator", () => {
  it("allocates sequential ports starting from the base", () => {
    const alloc = new PortAllocator(4000);
    assert.equal(alloc.next(), 4000);
    assert.equal(alloc.next(), 4001);
    assert.equal(alloc.next(), 4002);
  });

  it("uses default base port 3401", () => {
    const alloc = new PortAllocator();
    assert.equal(alloc.next(), 3401);
    assert.equal(alloc.next(), 3402);
  });

  it("tracks active ports", () => {
    const alloc = new PortAllocator(5000);
    alloc.next(); // 5000
    alloc.next(); // 5001
    assert.equal(alloc.isActive(5000), true);
    assert.equal(alloc.isActive(5001), true);
    assert.equal(alloc.isActive(5002), false);
  });

  it("releases ports correctly", () => {
    const alloc = new PortAllocator(5000);
    alloc.next(); // 5000
    alloc.next(); // 5001

    alloc.release(5000);
    assert.equal(alloc.isActive(5000), false);
    assert.equal(alloc.isActive(5001), true);
  });

  it("reports activeCount accurately", () => {
    const alloc = new PortAllocator(6000);
    assert.equal(alloc.activeCount(), 0);

    alloc.next(); // 6000
    assert.equal(alloc.activeCount(), 1);

    alloc.next(); // 6001
    assert.equal(alloc.activeCount(), 2);

    alloc.release(6000);
    assert.equal(alloc.activeCount(), 1);

    alloc.release(6001);
    assert.equal(alloc.activeCount(), 0);
  });

  it("release is idempotent for unknown ports", () => {
    const alloc = new PortAllocator(7000);
    alloc.release(9999); // should not throw
    assert.equal(alloc.activeCount(), 0);
  });

  it("continues incrementing after release", () => {
    const alloc = new PortAllocator(8000);
    alloc.next(); // 8000
    alloc.release(8000);
    // next port is still 8001, not 8000 — monotonically increasing
    assert.equal(alloc.next(), 8001);
  });
});
