// Ask the LLM to suggest 2-3 interactions for a page.
// Falls back to simple scroll if LLM unavailable or returns bad data.

export async function planInteractions(provider, pageHtml, experimentDescription) {
  if (!provider || !provider.propose) {
    return []; // No provider available, use scroll fallback
  }

  const prompt = `You are helping capture a demo GIF of a web app. Given this page HTML and recent change description, suggest 2-3 simple interactions to showcase the app.

Recent change: "${experimentDescription}"

Page HTML (truncated):
${pageHtml.slice(0, 3000)}

Respond with ONLY a JSON array:
[
  { "action": "scroll", "page": "/" },
  { "action": "click", "selector": "css selector" },
  { "action": "fill", "selector": "input selector", "value": "demo text" }
]

Valid actions: scroll (with optional page URL), click (with selector), fill (with selector + value).
Keep it simple -- 2-3 actions max.`;

  try {
    const result = await provider.propose(prompt);

    // Try to extract JSON array from the response
    const text = typeof result === 'string' ? result : result?.description ?? '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (a) => a && typeof a.action === 'string' && ['scroll', 'click', 'fill'].includes(a.action)
        );
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Simplified version that doesn't need an LLM -- just generates sensible defaults
export function defaultInteractions() {
  return [
    { action: 'scroll', page: '/' },
  ];
}
