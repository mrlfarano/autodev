// server/agent/prompt.js — Build structured prompts for the agent LLM

/**
 * Build a structured prompt for the agent LLM.
 *
 * @param {object} opts
 * @param {string} opts.projectName - Name of the project
 * @param {string} opts.language - Primary language (e.g. "javascript", "python")
 * @param {string} opts.framework - Framework in use (e.g. "nextjs", "express")
 * @param {string} opts.tree - Directory tree listing
 * @param {Array<{path: string, content: string}>} opts.keyFiles - Key source files
 * @param {Array<object>} opts.history - Past experiment results
 * @param {object} opts.metrics - Current metric values
 * @param {string} opts.aggressiveness - "conservative" | "balanced" | "aggressive"
 * @param {string} opts.creativity - "safe" | "moderate" | "experimental"
 * @returns {string} The assembled prompt
 */
export function buildPrompt({
  projectName,
  language,
  framework,
  tree,
  keyFiles,
  history,
  metrics,
  aggressiveness,
  creativity,
}) {
  const sections = [
    buildSystemSection(),
    buildContextSection({ projectName, language, framework, tree, keyFiles }),
    buildHistorySection({ history, metrics }),
    buildInstructionSection({ aggressiveness, creativity }),
  ];

  return sections.join("\n\n");
}

// ── Section builders ──

function buildSystemSection() {
  return `## SYSTEM

You are an autonomous app development agent. Respond with ONLY a JSON object with the following shape:

{
  "description": "Short description of the change",
  "category": "Category of the change (e.g. refactor, feature, fix, perf, test)",
  "changes": [
    {
      "path": "relative/path/to/file",
      "action": "create" | "modify" | "delete",
      "content": "full file content (for create/modify) or empty string (for delete)"
    }
  ]
}

Do NOT include any text outside the JSON object. Do NOT wrap it in markdown code blocks.`;
}

function buildContextSection({ projectName, language, framework, tree, keyFiles }) {
  const parts = [`## CONTEXT`];
  parts.push(`Project: ${projectName}`);
  parts.push(`Language: ${language}`);
  if (framework) {
    parts.push(`Framework: ${framework}`);
  }

  if (tree) {
    parts.push(`\nDirectory tree:\n\`\`\`\n${tree}\n\`\`\``);
  }

  if (keyFiles && keyFiles.length > 0) {
    parts.push(`\nKey source files:`);
    for (const file of keyFiles) {
      parts.push(`\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``);
    }
  }

  return parts.join("\n");
}

function buildHistorySection({ history, metrics }) {
  const parts = [`## SCORING HISTORY`];

  if (history && history.length > 0) {
    parts.push(`\nLast ${history.length} experiments:`);
    for (const entry of history) {
      const num = entry.experiment ?? entry.id ?? "?";
      const score = entry.score ?? "N/A";
      const status = entry.status ?? "unknown";
      const desc = entry.description ?? "";
      parts.push(`- Experiment #${num}: score=${score}, status=${status}${desc ? `, ${desc}` : ""}`);
    }
  } else {
    parts.push(`\nNo prior experiments.`);
  }

  if (metrics && Object.keys(metrics).length > 0) {
    parts.push(`\nCurrent metrics:`);
    for (const [key, value] of Object.entries(metrics)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  return parts.join("\n");
}

function buildInstructionSection({ aggressiveness, creativity }) {
  const parts = [`## INSTRUCTION`];

  // Aggressiveness guidance
  switch (aggressiveness) {
    case "conservative":
      parts.push(
        `Aggressiveness: conservative — Make small, safe, incremental changes. ` +
        `Prefer minor refactors and targeted fixes. Avoid large structural changes.`
      );
      break;
    case "aggressive":
      parts.push(
        `Aggressiveness: aggressive — Make bold, sweeping changes. ` +
        `Feel free to restructure code, add new features, or make large refactors. ` +
        `Maximize potential score improvement even if it risks regression.`
      );
      break;
    default:
      parts.push(
        `Aggressiveness: balanced — Make moderate changes. ` +
        `Balance between safety and impact. Reasonable refactors and improvements are fine.`
      );
      break;
  }

  // Creativity guidance
  switch (creativity) {
    case "safe":
      parts.push(
        `Creativity: safe — Stick to well-known patterns and conventional approaches. ` +
        `Do not introduce novel abstractions or unusual techniques.`
      );
      break;
    case "experimental":
      parts.push(
        `Creativity: experimental — Try novel approaches, unconventional patterns, ` +
        `and creative solutions. Explore new ideas even if they are unproven.`
      );
      break;
    default:
      parts.push(
        `Creativity: moderate — Use established patterns but allow some creative latitude. ` +
        `You may introduce new patterns if they clearly improve the code.`
      );
      break;
  }

  parts.push(
    `\nPropose a single coherent change that improves the project. ` +
    `Focus on improving the scoring metrics shown above.`
  );

  return parts.join("\n");
}
