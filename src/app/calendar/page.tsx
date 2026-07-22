"use client";

import Link from "next/link";
import { addDays, format, startOfWeek, isSameDay, isBefore, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Post = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  scheduledFor: string | null;
};

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [showUnscheduledReady, setShowUnscheduledReady] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const unscheduledReady = posts.filter(
    (p) => p.status === "ready" && !p.scheduledFor
  );

  function postsForDay(day: Date) {
    return posts.filter((p) => {
      if (!p.scheduledFor) return false;
      const d =
        typeof p.scheduledFor === "string"
          ? new Date(p.scheduledFor)
          : p.scheduledFor;
      return isSameDay(d, day);
    });
  }

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(
    addDays(weekStart, 6),
    "MMM d, yyyy"
  )}`;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        kicker="Planning"
        title="Calendar"
        description="Week view by scheduled date. Past-due items stay until you move them."
        actions={
          <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      <p className="text-sm font-medium text-zinc-400">{weekLabel}</p>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading calendar…
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((day) => {
            const items = postsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
            return (
              <Card
                key={day.toISOString()}
                className={`min-h-[160px] p-2.5 transition ${
                  isToday
                    ? "border-sky-400/40 bg-sky-500/[0.07] shadow-[0_0_0_1px_rgba(56,189,248,0.12)]"
                    : isPast
                      ? "opacity-80"
                      : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`text-xs font-semibold ${
                      isToday ? "text-sky-300" : "text-zinc-400"
                    }`}
                  >
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`grid size-6 place-items-center rounded-lg text-[0.7rem] font-semibold tabular-nums ${
                      isToday
                        ? "bg-sky-500 text-white"
                        : "bg-white/[0.04] text-zinc-500"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {items.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/posts/${p.id}`}
                        className="block rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 transition hover:border-sky-400/40 hover:bg-sky-500/10"
                      >
                        <StatusBadge status={p.status} className="mb-1" />
                        <div className="line-clamp-2 text-[0.7rem] leading-snug text-zinc-200">
                          {p.title || p.body.slice(0, 40)}
                        </div>
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="py-4 text-center text-[0.65rem] text-zinc-600">
                      —
                    </li>
                  )}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="size-4 accent-sky-500"
            checked={showUnscheduledReady}
            onChange={(e) => setShowUnscheduledReady(e.target.checked)}
          />
          Show unscheduled ready posts
        </label>
        {showUnscheduledReady && (
          <div className="mt-3">
            {unscheduledReady.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={16} />}
                title="None waiting"
                description="Ready posts without a date show up here."
              />
            ) : (
              <ul className="space-y-1.5">
                {unscheduledReady.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/posts/${p.id}`}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-sky-500/30 hover:bg-sky-500/[0.06]"
                    >
                      <StatusBadge status="ready" />
                      <span className="truncate">
                        {p.title || p.body.slice(0, 60)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
