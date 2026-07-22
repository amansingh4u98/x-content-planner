"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SectionTitle,
  Spinner,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Lightbulb,
  PanelsTopLeft,
  Sparkles,
  UserCircle2,
} from "lucide-react";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function quickCapture() {
    if (!idea.trim()) return;
    setBusy(true);
    setMsg("");
    setError("");
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
      setMsg("Idea captured — find it on the Board");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = posts.filter(
    (p) => p.status === "ready" || p.status === "scheduled"
  );
  const drafting = posts.filter(
    (p) => p.status === "drafting" || p.status === "idea"
  );
  const posted = posts.filter((p) => p.status === "posted");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner /> Loading studio…
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-8">
      <PageHeader
        kicker="Home"
        title="Content Studio"
        description="Capture ideas, draft in your voice, and ship posts with a clear pipeline."
        actions={
          <Link href="/board">
            <Button variant="secondary" size="sm">
              Open board <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="X account"
          tone={xStatus?.connected ? "success" : "warning"}
          icon={<UserCircle2 size={16} />}
          value={
            xStatus?.connected ? (
              <span className="flex flex-wrap items-center gap-2">
                @{xStatus.username}
                <Badge tone="success">connected</Badge>
              </span>
            ) : (
              <span className="text-amber-200/90">Not connected</span>
            )
          }
          hint={
            !xStatus?.connected ? (
              <Link href="/settings" className="text-sky-400 hover:underline">
                Connect in Settings →
              </Link>
            ) : xStatus.canPost ? (
              "API posting available"
            ) : (
              "Draft-first mode"
            )
          }
        />
        <StatCard
          label="AI (Grok)"
          tone={aiOk ? "success" : "warning"}
          icon={<Bot size={16} />}
          value={
            aiOk ? (
              <span className="text-emerald-300">Ready</span>
            ) : (
              <span className="text-amber-200/90">Not configured</span>
            )
          }
          hint={aiOk ? "Drafts & polish available" : "Set XAI_API_KEY in .env"}
        />
        <StatCard
          label="Pipeline"
          tone="info"
          icon={<PanelsTopLeft size={16} />}
          value={
            <span>
              {drafting.length}{" "}
              <span className="font-normal text-zinc-400">in progress</span>
              {" · "}
              {ready.length}{" "}
              <span className="font-normal text-zinc-400">ready</span>
            </span>
          }
          hint={`${posted.length} posted`}
        />
      </div>

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
              <Sparkles size={15} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Quick capture
              </h2>
              <p className="text-xs text-zinc-500">
                Drop a thought — polish it later on the board.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Idea, hot take, or note…"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickCapture()}
              className="sm:flex-1"
              aria-label="Quick idea"
            />
            <Button
              onClick={quickCapture}
              disabled={busy || !idea.trim()}
              loading={busy}
            >
              Save idea
            </Button>
          </div>
          {msg && (
            <Alert tone="success" className="mt-3">
              {msg}{" "}
              <Link href="/board" className="underline">
                Open board
              </Link>
            </Alert>
          )}
          {error && (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            action={
              <Link
                href="/board"
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Open board
              </Link>
            }
          >
            Ready / scheduled
          </SectionTitle>
          {ready.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="Nothing ready yet"
              description="Move drafts to Ready on the board when they’re shippable."
              action={
                <Link href="/board">
                  <Button size="sm" variant="secondary">
                    Go to board
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {ready.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/posts/${p.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 transition hover:border-sky-500/30 hover:bg-sky-500/[0.06]"
                  >
                    <StatusBadge status={p.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-200 group-hover:text-white">
                      {p.title || p.body.slice(0, 80) || "Untitled"}
                    </span>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-zinc-600 transition group-hover:text-sky-400"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                href="/topics"
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Manage
              </Link>
            }
          >
            Topics
          </SectionTitle>
          {topics.length === 0 ? (
            <EmptyState
              icon={<Lightbulb size={18} />}
              title="No topics yet"
              description="Topics are seeded on first DB init."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <Link
                  key={t.id}
                  href="/topics"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: t.color ?? "#64748b" }}
                  />
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-zinc-500">
              Workflow
            </p>
            {[
              "Capture ideas or generate with AI on Topics",
              "Polish in the editor → mark Ready",
              "Copy, Open Intent, or Post to X when ready",
            ].map((step, i) => (
              <div
                key={step}
                className="flex items-start gap-2.5 text-xs text-zinc-400"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[0.65rem] font-semibold text-sky-300">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
