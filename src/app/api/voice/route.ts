import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDb, DEFAULT_PROFILE_ID } from "@/lib/db/bootstrap";
import { getDb } from "@/lib/db/client";
import { voiceProfiles } from "@/lib/db/schema";
import { nowDate } from "@/lib/utils";

export const runtime = "nodejs";

const PatchSchema = z.object({
  summary: z.string().max(8000).optional(),
  styleNotes: z.string().max(8000).optional(),
});

export async function GET() {
  return withDb(() => {
    const voice = getDb()
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
      .get();
    return NextResponse.json({ voice });
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = PatchSchema.parse(await req.json());
    return withDb(() => {
      const db = getDb();
      const voice = db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.profileId, DEFAULT_PROFILE_ID))
        .get();
      if (!voice) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      db.update(voiceProfiles)
        .set({
          summary: body.summary ?? voice.summary,
          styleNotes: body.styleNotes ?? voice.styleNotes,
          rebuiltAt: nowDate(),
        })
        .where(eq(voiceProfiles.id, voice.id))
        .run();
      const updated = db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.id, voice.id))
        .get();
      return NextResponse.json({ voice: updated });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
