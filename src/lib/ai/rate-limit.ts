import { config } from "@/lib/config";

type Bucket = { timestamps: number[] };

const globalBucket = globalThis as unknown as { __aiBucket?: Bucket };

function bucket(): Bucket {
  if (!globalBucket.__aiBucket) {
    globalBucket.__aiBucket = { timestamps: [] };
  }
  return globalBucket.__aiBucket;
}

export function checkAiRateLimit(): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const { maxRequests, windowMs } = config.aiRateLimit;
  const b = bucket();
  b.timestamps = b.timestamps.filter((t) => now - t < windowMs);
  if (b.timestamps.length >= maxRequests) {
    const oldest = b.timestamps[0]!;
    return { ok: false, retryAfterMs: windowMs - (now - oldest) };
  }
  b.timestamps.push(now);
  return { ok: true };
}
