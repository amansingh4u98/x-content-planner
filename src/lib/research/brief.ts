import { config } from "@/lib/config";
import { getXaiClient, isAiConfigured, toAiProviderError } from "@/lib/ai/client";

export type ResearchCitation = { url: string; label?: string };

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/** Fetch and condense current web context while retaining every source URL. */
export async function createResearchBrief(opts: {
  topic: string;
  direction?: string;
  /** Free-form topic notes / constraints from the topic library. */
  notes?: string;
  /** Preferred content angles for this topic. */
  angles?: string[];
}): Promise<{ summary: string; citations: ResearchCitation[] }> {
  if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");

  const direction = opts.direction?.trim();
  const notes = opts.notes?.trim();
  const angles = (opts.angles ?? []).map((a) => a.trim()).filter(Boolean);

  const prompt = [
    `You are researching for a social post writer on X (Twitter).`,
    `Topic name: ${opts.topic}`,
    "",
    "CRITICAL: Do NOT do a generic overview of the topic alone.",
    "Prioritize the user's notes, angles, and optional direction below.",
    "Use web_search to find recent, specific facts that support THOSE angles.",
    "If notes/angles mention people, products, teams, matches, releases, or debates — search those specifically.",
    "",
    direction
      ? `User seed / direction (highest priority for this run):\n"""${trunc(direction, 800)}"""`
      : "",
    angles.length
      ? `Preferred angles (research each; do not ignore):\n${angles
          .map((a, i) => `${i + 1}. ${trunc(a, 300)}`)
          .join("\n")}`
      : "",
    notes
      ? `Topic notes / constraints / sources (treat as trusted user context, not generic filler):\n"""${trunc(notes, 2500)}"""`
      : "",
    "",
    "Return no more than 350 words. Use exactly these Markdown headings with concise bullet points:",
    "## What changed",
    "## Verified facts",
    "## Post angles",
    "## Watchouts",
    "Give at most 3 bullets per section. Under ## Post angles, map bullets to the user's preferred angles when provided.",
    "Distinguish confirmed facts from commentary or speculation. Include citations for material claims.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  try {
    const response = await getXaiClient({
      timeoutMs: config.xai.researchTimeoutMs,
      // A retry would duplicate an expensive web search and turn one timeout into a long wait.
      maxRetries: 0,
    }).responses.create({
      model: config.xai.model,
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search" }],
      max_output_tokens: 1800,
      store: false,
    });
    const summary = response.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content)
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!summary) throw new Error("AI_EMPTY_RESEARCH");
    const raw = (response as unknown as { citations?: unknown[] }).citations ?? [];
    const citations = [...new Set(raw.filter((x): x is string => typeof x === "string"))]
      .slice(0, 20)
      .map((url) => ({ url }));
    return { summary, citations };
  } catch (e) {
    throw toAiProviderError(e) ?? e;
  }
}
