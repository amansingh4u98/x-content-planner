"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { boardColumns, type PostStatus } from "@/lib/posts/transitions";
import { Badge, Button, Card } from "@/components/ui";

type Post = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  topicId: string | null;
  updatedAt: string;
};

type Topic = { id: string; name: string; color: string | null };

const LABELS: Record<string, string> = {
  idea: "Idea",
  drafting: "Drafting",
  ready: "Ready",
  scheduled: "Scheduled",
  posted: "Posted",
};

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterTopic, setFilterTopic] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const q = showArchived ? "?includeArchived=1" : "";
    const [p, t] = await Promise.all([
      fetch(`/api/posts${q}`).then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
    ]);
    setPosts(p.posts ?? []);
    setTopics(t.topics ?? []);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [showArchived]);

  const topicMap = useMemo(
    () => Object.fromEntries(topics.map((t) => [t.id, t])),
    [topics]
  );

  const columns = boardColumns();
  const filtered = posts.filter((p) =>
    filterTopic ? p.topicId === filterTopic : true
  );

  async function changeStatus(post: Post, status: PostStatus) {
    setBusyId(post.id);
    try {
      const body: Record<string, unknown> = { status };
      if (status === "scheduled") {
        // default schedule: tomorrow noon local
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(12, 0, 0, 0);
        body.scheduledFor = d.toISOString();
      }
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "Transition failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function createIdea() {
    const title = prompt("Quick idea?");
    if (!title?.trim()) return;
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: title,
        status: "idea",
        topicId: filterTopic || null,
      }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="text-sm text-zinc-400">
            Status changes via menu (drag-and-drop later).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archived
          </label>
          <Button onClick={createIdea}>+ Idea</Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = filtered.filter((p) => p.status === col);
          return (
            <div
              key={col}
              className="min-w-[240px] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/60"
            >
              <div className="border-b border-zinc-800 px-3 py-2 text-sm font-medium">
                {LABELS[col] ?? col}{" "}
                <span className="text-zinc-500">{items.length}</span>
              </div>
              <div className="space-y-2 p-2">
                {items.map((p) => (
                  <Card key={p.id} className="p-3">
                    <Link
                      href={`/posts/${p.id}`}
                      className="block text-sm font-medium hover:text-sky-400"
                    >
                      {p.title || p.body.slice(0, 60) || "Untitled"}
                    </Link>
                    {p.topicId && topicMap[p.topicId] && (
                      <Badge className="mt-1">
                        {topicMap[p.topicId].name}
                      </Badge>
                    )}
                    <div className="mt-2">
                      <label className="sr-only" htmlFor={`status-${p.id}`}>
                        Change status
                      </label>
                      <select
                        id={`status-${p.id}`}
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                        value={p.status}
                        disabled={busyId === p.id}
                        onChange={(e) =>
                          changeStatus(p, e.target.value as PostStatus)
                        }
                      >
                        {[...columns, "archived"].map((s) => (
                          <option key={s} value={s}>
                            {LABELS[s] ?? s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-zinc-600">
                    Empty
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
