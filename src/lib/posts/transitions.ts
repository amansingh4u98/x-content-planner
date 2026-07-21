import { z } from "zod";

export const POST_STATUSES = [
  "idea",
  "drafting",
  "ready",
  "scheduled",
  "posted",
  "archived",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const PostStatusSchema = z.enum(POST_STATUSES);

/** Allowed transitions: from -> set of to */
const ALLOWED: Record<PostStatus, ReadonlySet<PostStatus>> = {
  idea: new Set(["drafting", "archived"]),
  drafting: new Set(["idea", "ready", "archived"]),
  ready: new Set(["drafting", "scheduled", "posted", "archived"]),
  scheduled: new Set(["ready", "posted", "archived"]),
  posted: new Set(["archived"]),
  archived: new Set(["idea", "drafting"]),
};

export type TransitionResult =
  | {
      ok: true;
      status: PostStatus;
      scheduledFor: Date | null;
      postedAt: Date | null;
    }
  | { ok: false; error: string; code: string };

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.has(to) ?? false;
}

export function applyStatusTransition(opts: {
  from: PostStatus;
  to: PostStatus;
  scheduledFor?: Date | null;
  postedAt?: Date | null;
  now?: Date;
}): TransitionResult {
  const now = opts.now ?? new Date();
  const { from, to } = opts;

  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Cannot transition from ${from} to ${to}`,
      code: "INVALID_TRANSITION",
    };
  }

  let scheduledFor =
    opts.scheduledFor === undefined ? null : opts.scheduledFor;
  let postedAt = opts.postedAt === undefined ? null : opts.postedAt;

  if (to === "scheduled") {
    if (!scheduledFor) {
      return {
        ok: false,
        error: "scheduled status requires scheduledFor",
        code: "SCHEDULE_DATE_REQUIRED",
      };
    }
  }

  if (from === "scheduled" && to === "ready") {
    // MVP: clear date when unschedule
    scheduledFor = null;
  }

  if (to === "posted") {
    postedAt = postedAt ?? now;
  }

  if (to !== "scheduled" && to !== "ready" && to !== "posted") {
    // leave schedule as-is unless clearing via scheduled→ready (handled above)
  }

  if (to === "archived" || to === "idea" || to === "drafting") {
    // no forced clear of schedule/post fields except unschedule path
  }

  return { ok: true, status: to, scheduledFor, postedAt };
}

export function boardColumns(): PostStatus[] {
  return ["idea", "drafting", "ready", "scheduled", "posted"];
}
