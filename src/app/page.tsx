"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";

type Post = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  topicId: string | null;
};

type Topic = { id: string; name: string; color: string | null };

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [xStatus, setXStatus] = useState<{
    connected: boolean;
    username?: string;
    canPost?: boolean;
  } | null>(null);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [p, t, x, h] = await Promise.all([
      fetch("/api/posts").then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/x/status").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setPosts(p.posts ?? []);
    setTopics(t.topics ?? []);
    setXStatus(x);
    setAiOk(Boolean(h.features?.ai));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function quickCapture() {
    if (!idea.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: idea.slice(0, 120),
          body: idea,
          status: "idea",
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setIdea("");
      setMsg("Idea captured → Board");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = posts.filter((p) => p.status === "ready" || p.status === "scheduled");
  const drafting = posts.filter((p) => p.status === "drafting" || p.status === "idea");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plan posts that fit your voice — draft-first, localhost-first.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-zinc-500">X account</div>
          <div className="mt-1 font-medium">
            {xStatus?.connected ? (
              <>
                @{xStatus.username}{" "}
                <Badge className="ml-1">connected</Badge>
              </>
            ) : (
              <>
                Not connected{" "}
                <Link href="/settings" className="text-sky-400 underline">
                  Settings
                </Link>
              </>
            )}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-zinc-500">AI (Grok)</div>
          <div className="mt-1 font-medium">
            {aiOk ? (
              <span className="text-emerald-400">Configured</span>
            ) : (
              <span className="text-amber-400">
                Set XAI_API_KEY in .env
              </span>
            )}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-zinc-500">Pipeline</div>
          <div className="mt-1 font-medium">
            {drafting.length} in progress · {ready.length} ready
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-zinc-200">Quick capture</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Idea, hot take, or note…"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickCapture()}
          />
          <Button onClick={quickCapture} disabled={busy || !idea.trim()}>
            Save idea
          </Button>
        </div>
        {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Ready / scheduled</h2>
            <Link href="/board" className="text-xs text-sky-400">
              Open board
            </Link>
          </div>
          <ul className="space-y-2">
            {ready.length === 0 && (
              <li className="text-sm text-zinc-500">Nothing ready yet.</li>
            )}
            {ready.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.id}`}
                  className="block rounded-lg border border-zinc-800 px-3 py-2 hover:border-zinc-600"
                >
                  <div className="flex items-center gap-2">
                    <Badge>{p.status}</Badge>
                    <span className="truncate text-sm">
                      {p.title || p.body.slice(0, 80) || "Untitled"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Topics</h2>
            <Link href="/topics" className="text-xs text-sky-400">
              Manage
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Link
                key={t.id}
                href={`/topics`}
                className="rounded-full border border-zinc-700 px-3 py-1 text-sm"
                style={{ borderColor: t.color ?? undefined }}
              >
                {t.name}
              </Link>
            ))}
            {topics.length === 0 && (
              <p className="text-sm text-zinc-500">Seeding topics…</p>
            )}
          </div>
          <div className="mt-4 space-y-1 text-xs text-zinc-500">
            <p>1. Capture ideas or use AI drafts on Topics / Board</p>
            <p>2. Polish in the editor → mark Ready</p>
            <p>3. Copy or Open Intent to post on X</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
