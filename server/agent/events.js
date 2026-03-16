// server/agent/events.js — SSE event emitter for agent status broadcasting

import { EventEmitter } from "node:events";

/**
 * Agent event emitter that broadcasts SSE-formatted messages to connected clients.
 */
export class AgentEvents extends EventEmitter {
  constructor() {
    super();
    /** @type {Set<import("node:http").ServerResponse>} */
    this.clients = new Set();
  }

  /**
   * Register an SSE client response object.
   * Automatically removes the client when the connection closes.
   *
   * @param {import("node:http").ServerResponse} res
   */
  addClient(res) {
    this.clients.add(res);
    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  /**
   * Format an SSE message string.
   *
   * @param {string} eventType - The SSE event type
   * @param {*} data - Data to serialize as JSON
   * @returns {string} SSE-formatted message
   */
  formatSSE(eventType, data) {
    return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * Broadcast an SSE event to all connected clients and emit it locally.
   *
   * @param {string} eventType - The SSE event type
   * @param {*} data - Data to broadcast
   */
  broadcast(eventType, data) {
    const message = this.formatSSE(eventType, data);
    for (const client of this.clients) {
      client.write(message);
    }
    this.emit(eventType, data);
  }

  /**
   * Emit a status event.
   * @param {*} data
   */
  emitStatus(data) {
    this.broadcast("status", data);
  }

  /**
   * Emit a score event.
   * @param {*} data
   */
  emitScore(data) {
    this.broadcast("score", data);
  }

  /**
   * Emit a metrics event.
   * @param {*} data
   */
  emitMetrics(data) {
    this.broadcast("metrics", data);
  }

  /**
   * Emit a log line event.
   * @param {string} line
   */
  emitLog(line) {
    this.broadcast("log", { message: line });
  }

  /**
   * Emit an experiment-complete event.
   * @param {*} data
   */
  emitExperimentComplete(data) {
    this.broadcast("experiment-complete", data);
  }

  /**
   * Emit a stats event.
   * @param {*} data
   */
  emitStats(data) {
    this.broadcast("stats", data);
  }
}
