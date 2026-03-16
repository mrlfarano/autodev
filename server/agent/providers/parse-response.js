// server/agent/providers/parse-response.js — Parse LLM output into structured proposal

const VALID_ACTIONS = new Set(["create", "modify", "delete"]);

/**
 * Validate that a single change object has all required fields.
 * Returns true if valid, false otherwise.
 */
function isValidChange(change) {
  if (!change || typeof change !== "object") return false;
  if (typeof change.path !== "string" || change.path.length === 0) return false;
  if (!VALID_ACTIONS.has(change.action)) return false;
  if (typeof change.content !== "string") return false;
  return true;
}

/**
 * Validate a parsed proposal object has the required top-level shape
 * and all changes are well-formed.
 */
function validateProposal(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.description !== "string") return null;
  if (typeof obj.category !== "string") return null;
  if (!Array.isArray(obj.changes)) return null;
  if (obj.changes.length === 0) return null;

  for (const change of obj.changes) {
    if (!isValidChange(change)) return null;
  }

  return {
    description: obj.description,
    category: obj.category,
    changes: obj.changes.map((c) => ({
      path: c.path,
      action: c.action,
      content: c.content,
    })),
  };
}

/**
 * Try to parse a string as JSON directly.
 */
function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Extract JSON from a markdown code block (```json ... ``` or ``` ... ```).
 */
function extractFromCodeBlock(text) {
  const pattern = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const match = text.match(pattern);
  if (match) {
    return tryParseJSON(match[1].trim());
  }
  return undefined;
}

/**
 * Extract JSON embedded anywhere in text by finding the first { and last }.
 */
function extractFromText(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return tryParseJSON(text.slice(start, end + 1));
}

/**
 * Parse raw LLM output into a structured proposal.
 *
 * Handles:
 *  1. Clean JSON string
 *  2. JSON inside markdown code blocks
 *  3. JSON embedded in surrounding text
 *
 * Returns { description, category, changes[] } or null if unparseable.
 */
export function parseResponse(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;

  const trimmed = raw.trim();

  // Strategy 1: direct JSON parse
  const direct = tryParseJSON(trimmed);
  if (direct !== undefined) {
    return validateProposal(direct);
  }

  // Strategy 2: extract from markdown code block
  const fromBlock = extractFromCodeBlock(trimmed);
  if (fromBlock !== undefined) {
    return validateProposal(fromBlock);
  }

  // Strategy 3: extract JSON object embedded in text
  const fromText = extractFromText(trimmed);
  if (fromText !== undefined) {
    return validateProposal(fromText);
  }

  return null;
}
