import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { AgentEvents } from "../../server/agent/events.js";

describe("AgentEvents", () => {
  it("is an EventEmitter", () => {
    const events = new AgentEvents();
    assert.ok(events instanceof EventEmitter);
  });

  it("starts with an empty clients set", () => {
    const events = new AgentEvents();
    assert.equal(events.clients.size, 0);
  });

  describe("formatSSE", () => {
    it("formats an SSE message with event type and JSON data", () => {
      const events = new AgentEvents();
      const result = events.formatSSE("status", { phase: "scoring" });
      assert.equal(result, 'event: status\ndata: {"phase":"scoring"}\n\n');
    });

    it("handles string data", () => {
      const events = new AgentEvents();
      const result = events.formatSSE("log", "hello world");
      assert.equal(result, 'event: log\ndata: "hello world"\n\n');
    });

    it("handles numeric data", () => {
      const events = new AgentEvents();
      const result = events.formatSSE("score", 42);
      assert.equal(result, "event: score\ndata: 42\n\n");
    });
  });

  describe("addClient / broadcast", () => {
    it("adds a client and broadcasts to it", () => {
      const events = new AgentEvents();
      const written = [];
      const fakeRes = new EventEmitter();
      fakeRes.write = (data) => written.push(data);

      events.addClient(fakeRes);
      assert.equal(events.clients.size, 1);

      events.broadcast("status", { phase: "idle" });
      assert.equal(written.length, 1);
      assert.equal(written[0], 'event: status\ndata: {"phase":"idle"}\n\n');
    });

    it("removes client on close", () => {
      const events = new AgentEvents();
      const fakeRes = new EventEmitter();
      fakeRes.write = () => {};

      events.addClient(fakeRes);
      assert.equal(events.clients.size, 1);

      fakeRes.emit("close");
      assert.equal(events.clients.size, 0);
    });

    it("broadcasts to multiple clients", () => {
      const events = new AgentEvents();
      const written1 = [];
      const written2 = [];
      const res1 = new EventEmitter();
      res1.write = (d) => written1.push(d);
      const res2 = new EventEmitter();
      res2.write = (d) => written2.push(d);

      events.addClient(res1);
      events.addClient(res2);

      events.broadcast("score", { value: 85 });
      assert.equal(written1.length, 1);
      assert.equal(written2.length, 1);
    });

    it("emits event locally on broadcast", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("status", (data) => received.push(data));

      events.broadcast("status", { phase: "running" });
      assert.equal(received.length, 1);
      assert.deepEqual(received[0], { phase: "running" });
    });
  });

  describe("helper methods", () => {
    it("emitStatus broadcasts a status event", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("status", (data) => received.push(data));

      events.emitStatus({ phase: "scoring" });
      assert.deepEqual(received[0], { phase: "scoring" });
    });

    it("emitScore broadcasts a score event", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("score", (data) => received.push(data));

      events.emitScore({ value: 92 });
      assert.deepEqual(received[0], { value: 92 });
    });

    it("emitMetrics broadcasts a metrics event", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("metrics", (data) => received.push(data));

      events.emitMetrics({ coverage: 80 });
      assert.deepEqual(received[0], { coverage: 80 });
    });

    it("emitLog broadcasts a log event with message wrapper", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("log", (data) => received.push(data));

      events.emitLog("something happened");
      assert.deepEqual(received[0], { message: "something happened" });
    });

    it("emitExperimentComplete broadcasts an experiment-complete event", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("experiment-complete", (data) => received.push(data));

      events.emitExperimentComplete({ id: 5, score: 88 });
      assert.deepEqual(received[0], { id: 5, score: 88 });
    });

    it("emitStats broadcasts a stats event", () => {
      const events = new AgentEvents();
      const received = [];
      events.on("stats", (data) => received.push(data));

      events.emitStats({ total: 10, kept: 7 });
      assert.deepEqual(received[0], { total: 10, kept: 7 });
    });
  });
});
