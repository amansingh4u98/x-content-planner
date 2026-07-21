"use client";

import Link from "next/link";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";

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

  async function load() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-zinc-400">
            Week view by scheduled date. Past-due stays until you move it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            ← Prev
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            Today
          </Button>
          <Button
            variant="secondary"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            Next →
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day) => {
          const items = postsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <Card
              key={day.toISOString()}
              className={`min-h-[140px] p-2 ${
                isToday ? "border-sky-700" : ""
              }`}
            >
              <div className="mb-2 text-xs font-medium text-zinc-400">
                {format(day, "EEE d MMM")}
              </div>
              <ul className="space-y-1">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/posts/${p.id}`}
                      className="block rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs hover:border-sky-700"
                    >
                      <Badge className="mb-0.5">{p.status}</Badge>
                      <div className="line-clamp-2">
                        {p.title || p.body.slice(0, 40)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUnscheduledReady}
            onChange={(e) => setShowUnscheduledReady(e.target.checked)}
          />
          Show unscheduled ready
        </label>
        {showUnscheduledReady && (
          <ul className="mt-3 space-y-1">
            {unscheduledReady.length === 0 && (
              <li className="text-sm text-zinc-500">None</li>
            )}
            {unscheduledReady.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.id}`}
                  className="text-sm text-sky-400 hover:underline"
                >
                  {p.title || p.body.slice(0, 60)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
