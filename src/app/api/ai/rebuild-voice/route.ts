import { NextResponse } from "next/server";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { isAiConfigured } from "@/lib/ai/client";
import { withDb } from "@/lib/db/bootstrap";
import { rebuildVoiceFromCache } from "@/lib/services/voice";

export const runtime = "nodejs";

export async function POST() {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }
  const limit = checkAiRateLimit();
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI_RATE_LIMIT", retryAfterMs: limit.retryAfterMs },
      { status: 429 }
    );
  }
  return withDb(async () => {
    const result = await rebuildVoiceFromCache();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  });
}
