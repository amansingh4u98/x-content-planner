"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { buildIntentUrl, formatThreadCopyAll } from "@/lib/x/intent";
import type { PostStatus } from "@/lib/posts/transitions";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";

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
  const [canPost, setCanPost] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [p, t, h, x] = await Promise.all([
      fetch(`/api/posts/${id}`).then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/x/status").then((r) => r.json()),
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
    setCanPost(Boolean(x.canPost));
  }

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  const intent = useMemo(() => buildIntentUrl(body), [body]);
  const charCount = body.length;
  const overLimit = charCount > 280;

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

  async function publishToX() {
    if (
      !window.confirm(
        "Post this single draft to X now? This cannot be undone here."
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "X publish failed");
      setPost(data.post);
      setStatus("posted");
      setMsg("Posted to X");
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
      if (!res.ok)
        throw new Error(data.message || data.error || "Polish failed");
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
      if (!res.ok)
        throw new Error(data.message || data.error || "Rewrite failed");
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
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <Alert tone="danger">{error}</Alert>
        <Link href="/board">
          <Button variant="secondary">Back to board</Button>
        </Link>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner /> Loading editor…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/board"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-sky-300"
        >
          <ArrowLeft size={14} /> Board
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {post.xPostId && (
            <a
              href={`https://x.com/i/status/${post.xPostId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-400 hover:underline"
            >
              View on X
            </a>
          )}
        </div>
      </div>

      {(msg || error) && (
        <Alert tone={error ? "danger" : "success"}>{error || msg}</Alert>
      )}

      <Card className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional short label"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select
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
            </Select>
          </div>
          <div>
            <Label>Topic</Label>
            <Select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              <option value="">None</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
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
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">Body</Label>
            <span
              className={`text-xs tabular-nums ${
                overLimit ? "font-medium text-amber-400" : "text-zinc-500"
              }`}
            >
              {charCount}
              <span className="text-zinc-600"> / 280</span>
            </span>
          </div>
          <Textarea
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post…"
            className="font-[inherit] leading-relaxed"
          />
          {overLimit && (
            <p className="mt-1.5 text-xs text-amber-400/90">
              Over standard 280 chars — fine for Premium long-form; Intent may
              fail for very long text.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Thread parts</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setThread((t) => [...t, ""])}
            >
              <Plus size={14} /> Part
            </Button>
          </div>
          {thread.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-600">
              No thread parts — single post mode.
            </p>
          )}
          {thread.map((part, i) => (
            <div
              key={i}
              className="mb-2 rounded-xl border border-white/10 bg-black/15 p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-medium text-zinc-400">
                  Part {i + 1}/{thread.length}
                  <span className="ml-2 tabular-nums text-zinc-600">
                    {part.length} chars
                  </span>
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(part)}
                  >
                    <Copy size={12} />
                  </Button>
                  {buildIntentUrl(part).url && (
                    <a
                      href={buildIntentUrl(part).url!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button type="button" variant="ghost" size="sm">
                        <ExternalLink size={12} />
                      </Button>
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setThread((t) => t.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </Button>
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

        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <Button onClick={() => save()} disabled={busy} loading={busy}>
            Save
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !aiOk}
            onClick={polish}
            title={aiOk ? "Polish with Grok" : "Set XAI_API_KEY"}
          >
            <Sparkles size={14} /> Polish
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
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
            <Rocket size={15} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Ready to post</h2>
            <p className="text-xs text-zinc-500">
              Draft-first: copy or open X Intent. Threads never use a single
              Intent URL.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => copyText(body)}>
            <Copy size={14} /> Copy body
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-400 to-sky-600 px-3.5 py-2 text-sm font-medium text-white shadow-[0_8px_24px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 hover:from-sky-300 hover:to-sky-500"
            >
              <ExternalLink size={14} /> Open in X
            </a>
          ) : (
            <Button variant="ghost" disabled title="URL too long for Intent">
              Open in X (too long — copy only)
            </Button>
          )}
          {status !== "posted" && (
            <Button
              onClick={publishToX}
              disabled={
                busy || !canPost || thread.length > 0 || !body.trim()
              }
              title={
                canPost
                  ? "Posts this single draft directly to X"
                  : "Reconnect X with posting permission and enable X posting"
              }
            >
              Post to X now
            </Button>
          )}
          {status !== "posted" && (
            <Button variant="secondary" onClick={markPosted} disabled={busy}>
              Mark posted
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
