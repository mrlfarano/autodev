// server/containers/ports.js — Port allocator for experiment containers

/**
 * Monotonically increasing port allocator.
 * Hands out sequential ports starting from a base and tracks which are active.
 */
export class PortAllocator {
  /**
   * @param {number} basePort  First port to allocate (default 3401)
   */
  constructor(basePort = 3401) {
    this.base = basePort;
    this.nextPort = basePort;
    this.activePorts = new Set();
  }

  /** Allocate the next sequential port. */
  next() {
    const port = this.nextPort++;
    this.activePorts.add(port);
    return port;
  }

  /** Release a previously allocated port. */
  release(port) {
    this.activePorts.delete(port);
  }

  /** Number of ports currently in use. */
  activeCount() {
    return this.activePorts.size;
  }

  /** Check whether a specific port is currently active. */
  isActive(port) {
    return this.activePorts.has(port);
  }
}
