"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { buildIntentUrl, formatThreadCopyAll } from "@/lib/x/intent";
import type { PostStatus } from "@/lib/posts/transitions";

type Post = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  topicId: string | null;
  threadJson: string | null;
  format: string | null;
  scheduledFor: string | null;
  xPostId: string | null;
};

type Topic = { id: string; name: string };

export default function PostEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<Post | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [thread, setThread] = useState<string[]>([]);
  const [status, setStatus] = useState<PostStatus>("drafting");
  const [topicId, setTopicId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [aiOk, setAiOk] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [p, t, h] = await Promise.all([
      fetch(`/api/posts/${id}`).then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    if (!p.post) {
      setError("Post not found");
      return;
    }
    setPost(p.post);
    setTitle(p.post.title ?? "");
    setBody(p.post.body ?? "");
    setStatus(p.post.status);
    setTopicId(p.post.topicId ?? "");
    setScheduledFor(
      p.post.scheduledFor
        ? new Date(p.post.scheduledFor).toISOString().slice(0, 16)
        : ""
    );
    try {
      setThread(JSON.parse(p.post.threadJson ?? "[]"));
    } catch {
      setThread([]);
    }
    setTopics(t.topics ?? []);
    setAiOk(Boolean(h.features?.ai));
  }

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  const intent = useMemo(() => buildIntentUrl(body), [body]);
  const charCount = body.length;

  async function save(extra?: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const payload: Record<string, unknown> = {
        title: title || null,
        body,
        topicId: topicId || null,
        status,
        thread: thread.length ? thread : null,
        ...extra,
      };
      if (status === "scheduled" || extra?.status === "scheduled") {
        if (scheduledFor) {
          payload.scheduledFor = new Date(scheduledFor).toISOString();
        }
      }
      if (status === "ready" && scheduledFor === "") {
        // ok
      }
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Save failed");
      }
      setPost(data.post);
      setStatus(data.post.status);
      setMsg("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markPosted() {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${id}/mark-posted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPost(data.post);
      setStatus("posted");
      setMsg("Marked as posted");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMsg("Copied to clipboard");
  }

  async function polish() {
    if (!aiOk) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Polish failed");
      setBody(data.draft.body);
      if (data.draft.thread) setThread(data.draft.thread);
      setMsg("Polished — save to keep");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rewrite(kind: string) {
    if (!aiOk) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rewrite failed");
      setBody(data.draft.body);
      if (data.draft.thread) setThread(data.draft.thread);
      else if (kind !== "thread") setThread([]);
      setMsg(`Rewrote as ${kind} — save to keep`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !post) {
    return (
      <p className="text-red-400">
        {error} — <Link href="/board">Back to board</Link>
      </p>
    );
  }
  if (!post) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/board" className="text-sm text-sky-400">
          ← Board
        </Link>
        <Badge>{status}</Badge>
      </div>

      <Card className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as PostStatus)}
            >
              {(
                [
                  "idea",
                  "drafting",
                  "ready",
                  "scheduled",
                  "posted",
                  "archived",
                ] as PostStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Topic</Label>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              <option value="">None</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {status === "scheduled" && (
          <div>
            <Label>Scheduled for</Label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>
        )}
        <div>
          <div className="mb-1 flex justify-between">
            <Label>Body</Label>
            <span
              className={`text-xs ${
                charCount > 280 ? "text-amber-400" : "text-zinc-500"
              }`}
            >
              {charCount} chars
            </span>
          </div>
          <Textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Thread parts</Label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setThread((t) => [...t, ""])}
            >
              + Part
            </Button>
          </div>
          {thread.map((part, i) => (
            <div key={i} className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Part {i + 1}/{thread.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-sky-400"
                    onClick={() => copyText(part)}
                  >
                    Copy
                  </button>
                  {buildIntentUrl(part).url && (
                    <a
                      className="text-sky-400"
                      href={buildIntentUrl(part).url!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Intent
                    </a>
                  )}
                  <button
                    type="button"
                    className="text-red-400"
                    onClick={() =>
                      setThread((t) => t.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
              <Textarea
                rows={3}
                value={part}
                onChange={(e) =>
                  setThread((t) =>
                    t.map((p, j) => (j === i ? e.target.value : p))
                  )
                }
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={busy}>
            Save
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !aiOk}
            onClick={polish}
            title={aiOk ? "Polish with Grok" : "Set XAI_API_KEY"}
          >
            Polish
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !aiOk}
            onClick={() => rewrite("hot_take")}
          >
            Hot take
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !aiOk}
            onClick={() => rewrite("educational")}
          >
            Educational
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !aiOk}
            onClick={() => rewrite("thread")}
          >
            As thread
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium">Ready to post</h2>
        <p className="text-xs text-zinc-500">
          Draft-first: copy to clipboard or open X Web Intent. Threads never use
          a single Intent URL.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => copyText(body)}>
            Copy body
          </Button>
          {thread.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => copyText(formatThreadCopyAll(thread))}
            >
              Copy full thread
            </Button>
          )}
          {intent.underBudget ? (
            <a
              href={intent.url!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Open in X
            </a>
          ) : (
            <Button variant="ghost" disabled title="URL too long for Intent">
              Open in X (too long — copy only)
            </Button>
          )}
          {status !== "posted" && (
            <Button variant="secondary" onClick={markPosted} disabled={busy}>
              Mark posted
            </Button>
          )}
        </div>
      </Card>

      {(msg || error) && (
        <p className={`text-sm ${error ? "text-red-400" : "text-emerald-400"}`}>
          {error || msg}
        </p>
      )}
    </div>
  );
}
