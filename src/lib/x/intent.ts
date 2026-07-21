const INTENT_BASE = "https://x.com/intent/tweet";
const MAX_URL_LEN = 1800;

export function buildIntentUrl(text: string): {
  url: string | null;
  underBudget: boolean;
  encodedLength: number;
} {
  const encoded = encodeURIComponent(text);
  const url = `${INTENT_BASE}?text=${encoded}`;
  const underBudget = url.length < MAX_URL_LEN;
  return {
    url: underBudget ? url : null,
    underBudget,
    encodedLength: encoded.length,
  };
}

export function formatThreadCopyAll(parts: string[]): string {
  const n = parts.length;
  return parts
    .map((p, i) => `${i + 1}/${n}\n${p.trim()}`)
    .join("\n\n---\n\n");
}
