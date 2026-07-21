import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "x-content-planner",
    time: new Date().toISOString(),
    features: {
      xSync: config.enableXSync,
      xPosting: config.enableXPosting,
      ai: Boolean(config.xai.apiKey),
    },
  });
}
