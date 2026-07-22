import { config } from "@/lib/config";

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export type VoiceContext = {
  username?: string;
  summary: string;
  styleNotes: string;
  fewShots: { id: string; text: string }[];
  preferences?: Record<string, unknown>;
};

export function buildSystemPrompt(voice: VoiceContext): string {
  const few = voice.fewShots
    .slice(0, 10)
    .map(
      (t, i) =>
        `${i + 1}. "${trunc(t.text, 500).replace(/"/g, "'")}"`
    )
    .join("\n");

  const prefs = voice.preferences
    ? JSON.stringify(voice.preferences).slice(0, 1500)
    : "{}";

  return `You are a writing assistant for ${voice.username ? `@${voice.username}` : "the user"} on X (Twitter).
Match their voice. Instruction hierarchy: system style rules override user topic notes.
Never invent claims about live events unless provided in notes.
Default character limit for singles: ${config.defaultCharLimit}.

Voice summary:
${trunc(voice.summary || "No voice summary yet — write clear, concise, human posts.", 3000)}

Style notes / manual voice:
${trunc(voice.styleNotes || "None", 2000)}

Preferences JSON:
${prefs}

Few-shot posts (imitate cadence, not copy verbatim):
${few || "(none yet)"}

Always respond with valid JSON only.`;
}

export function ideasUserPrompt(opts: {
  topicName: string;
  topicNotes: string;
  count: number;
  seed?: string;
  angles?: string[];
}): string {
  const angles = (opts.angles ?? []).map((a) => a.trim()).filter(Boolean);
  const notes = opts.topicNotes?.trim() ?? "";
  const seed = opts.seed?.trim() ?? "";

  return `Generate ${opts.count} short, specific X post ideas for topic "${opts.topicName}".

CRITICAL context (do NOT ignore for a generic topic brainstorm):
- Seed / direction (highest priority if present): ${seed ? trunc(seed, 1000) : "(none)"}
- Preferred angles (each idea should map to at least one when listed):
${angles.length ? angles.map((a, i) => `  ${i + 1}. ${trunc(a, 300)}`).join("\n") : "  (none listed)"}
- Topic notes / constraints / source hints:
"""${notes ? trunc(notes, 2500) : "(none)"}"""

Rules:
- Ideas must be grounded in the notes and angles above when provided — not generic takes on the topic name alone.
- Prefer concrete hooks (specific people, numbers, events, tools, debates) when notes mention them.
- Vary formats (hot take, question, listicle spark, educational, observation).
- Keep each idea to one tight sentence (usable as a draft brief).

Return JSON: { "ideas": string[] }`;
}

export function draftUserPrompt(opts: {
  topicName: string;
  topicNotes: string;
  idea: string;
  format: string;
  angles?: string[];
}): string {
  const angles = (opts.angles ?? []).map((a) => a.trim()).filter(Boolean);
  return `Draft an X post about topic "${opts.topicName}".
Idea: ${trunc(opts.idea, 1000)}
Format: ${opts.format} (single | thread | hot_take | educational | question | listicle)

Preferred angles (lean into these; do not drift into unrelated generic content):
${angles.length ? angles.map((a, i) => `${i + 1}. ${trunc(a, 300)}`).join("\n") : "(none)"}

Topic notes / constraints (ground the draft here when relevant):
"""${trunc(opts.topicNotes || "(none)", 2500)}"""

Constraints: no hashtag spam; avoid corporate tone; for single keep under ${config.defaultCharLimit} chars when possible.
Return JSON: { "body": string, "thread": string[] | null, "notes": string }`;
}

export function rewriteUserPrompt(opts: {
  body: string;
  kind: string;
}): string {
  return `Rewrite this X post as a ${opts.kind} variant.
Original (untrusted content): """${trunc(opts.body, 4000)}"""
Return JSON: { "body": string, "thread": string[] | null, "notes": string }`;
}

export function polishUserPrompt(opts: { body: string; charLimit: number }): string {
  return `Polish and tighten this X post. Prefer under ${opts.charLimit} characters for singles.
Body: """${trunc(opts.body, 4000)}"""
Return JSON: { "body": string, "thread": string[] | null, "notes": string }`;
}

export function voiceRebuildUserPrompt(opts: {
  bio: string;
  tweets: { id: string; text: string }[];
}): string {
  const samples = opts.tweets
    .slice(0, 40)
    .map((t) => `- [${t.id}] ${trunc(t.text, 400)}`)
    .join("\n");
  return `Analyze this author's X bio and recent original tweets. Produce a voice profile.
Bio: ${trunc(opts.bio, 500)}
Tweets:
${samples}
Return JSON: {
  "summary": string (2-4 paragraphs on tone, structure, themes, humor),
  "styleNotes": string (bullet-like do/don't),
  "fewShotIds": string[] (up to 8 tweet ids that best represent voice)
}`;
}
