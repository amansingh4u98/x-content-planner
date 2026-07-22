"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { boardColumns, type PostStatus } from "@/lib/posts/transitions";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { Inbox, Plus } from "lucide-react";

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
  archived: "Archived",
};

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterTopic, setFilterTopic] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = showArchived ? "?includeArchived=1" : "";
      const [p, t] = await Promise.all([
        fetch(`/api/posts${q}`).then((r) => r.json()),
        fetch("/api/topics").then((r) => r.json()),
      ]);
      setPosts(p.posts ?? []);
      setTopics(t.topics ?? []);
    } finally {
      setLoading(false);
    }
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
    setError("");
    try {
      const body: Record<string, unknown> = { status };
      if (status === "scheduled") {
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
        setError(data.message || data.error || "Transition failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function createIdea() {
    if (!quickTitle.trim()) return;
    setError("");
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quickTitle.trim(),
        body: quickTitle.trim(),
        status: "idea",
        topicId: filterTopic || null,
      }),
    });
    if (!res.ok) {
      setError("Could not create idea");
      return;
    }
    setQuickTitle("");
    setShowQuick(false);
    await load();
  }

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        kicker="Pipeline"
        title="Board"
        description="Move posts through idea → draft → ready → scheduled → posted. Status changes via the menu on each card."
        actions={
          <>
            <Select
              className="w-auto min-w-[9rem]"
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              aria-label="Filter by topic"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Archived
            </label>
            <Button onClick={() => setShowQuick((v) => !v)} size="sm">
              <Plus size={14} /> Idea
            </Button>
          </>
        }
      />

      {showQuick && (
        <Card className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            autoFocus
            placeholder="What’s the idea?"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createIdea();
              if (e.key === "Escape") setShowQuick(false);
            }}
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button onClick={createIdea} disabled={!quickTitle.trim()}>
              Add
            </Button>
            <Button variant="ghost" onClick={() => setShowQuick(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading board…
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {columns.map((col) => {
            const items = filtered.filter((p) => p.status === col);
            return (
              <div
                key={col}
                className={`col-${col} min-w-[260px] flex-1 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <span className={`status-dot status-${col}`} />
                    {LABELS[col] ?? col}
                  </div>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[0.7rem] tabular-nums text-zinc-400">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  {items.map((p) => (
                    <Card
                      key={p.id}
                      className="p-3 transition hover:border-white/15"
                    >
                      <Link
                        href={`/posts/${p.id}`}
                        className="block text-sm font-medium leading-snug text-zinc-100 hover:text-sky-300"
                      >
                        {p.title || p.body.slice(0, 60) || "Untitled"}
                      </Link>
                      {p.body && p.title && (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          {p.body}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.topicId && topicMap[p.topicId] && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[0.65rem] text-zinc-400">
                            <span
                              className="size-1.5 rounded-full"
                              style={{
                                background:
                                  topicMap[p.topicId].color ?? "#64748b",
                              }}
                            />
                            {topicMap[p.topicId].name}
                          </span>
                        )}
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-2.5">
                        <label className="sr-only" htmlFor={`status-${p.id}`}>
                          Change status
                        </label>
                        <Select
                          id={`status-${p.id}`}
                          className="text-xs"
                          value={p.status}
                          disabled={busyId === p.id}
                          onChange={(e) =>
                            changeStatus(p, e.target.value as PostStatus)
                          }
                        >
                          {[...columns, "archived"].map((s) => (
                            <option key={s} value={s}>
                              Move to {LABELS[s] ?? s}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <EmptyState
                      icon={<Inbox size={16} />}
                      title="Empty"
                      description={`No ${LABELS[col]?.toLowerCase() ?? col} posts`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
