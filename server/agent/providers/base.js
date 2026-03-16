// server/agent/providers/base.js — Base provider class

/**
 * Abstract base class for LLM providers.
 * Subclasses must implement propose() and test().
 */
export class BaseProvider {
  /**
   * @param {object} config — provider-specific configuration
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Send a prompt to the LLM and return a structured proposal.
   * @param {string} prompt
   * @returns {Promise<{description: string, category: string, changes: Array}>}
   */
  async propose(prompt) {
    throw new Error("propose() not implemented");
  }

  /**
   * Verify that the provider credentials / connection work.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async test() {
    throw new Error("test() not implemented");
  }
}
