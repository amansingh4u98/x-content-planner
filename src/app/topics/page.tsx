"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Plus,
  Sparkles,
} from "lucide-react";

type Topic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;
  anglesJson: string | null;
  color: string | null;
};

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [angles, setAngles] = useState("");
  const [ideaSeed, setIdeaSeed] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [research, setResearch] = useState<{
    id: string;
    summary: string;
    citationsJson: string;
  } | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [t, h] = await Promise.all([
        fetch("/api/topics").then((r) => r.json()),
        fetch("/api/health").then((r) => r.json()),
      ]);
      setTopics(t.topics ?? []);
      setAiEnabled(Boolean(h.features?.ai));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function select(t: Topic) {
    setSelected(t);
    setNotes(t.notes ?? "");
    setAngles(
      (() => {
        try {
          return (JSON.parse(t.anglesJson ?? "[]") as string[]).join("\n");
        } catch {
          return "";
        }
      })()
    );
    setIdeas([]);
    setResearch(null);
    setError("");
    setMsg("");
  }

  async function createTopic() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "Create failed");
      setName("");
      await load();
      if (data.topic) select(data.topic);
      setMsg("Topic created");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function parseAnglesFromForm(): string[] {
    return angles
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Persist current form notes/angles so reloads and other clients stay in sync. */
  async function persistTopicContext(): Promise<{
    notes: string;
    angles: string[];
  }> {
    if (!selected) throw new Error("No topic selected");
    const angleList = parseAnglesFromForm();
    const res = await fetch(`/api/topics/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, angles: angleList }),
    });
    if (!res.ok) throw new Error("Could not save topic notes/angles");
    return { notes, angles: angleList };
  }

  async function saveTopic() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await persistTopicContext();
      setMsg("Topic saved");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateIdeas() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const ctx = await persistTopicContext();
      const res = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selected.id,
          count: 5,
          seed: ideaSeed || undefined,
          notes: ctx.notes,
          angles: ctx.angles,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "AI failed");
      setIdeas(data.ideas ?? []);
      const grounded =
        ctx.angles.length || ctx.notes.trim()
          ? " using your notes/angles"
          : "";
      setMsg(`${(data.ideas ?? []).length} ideas generated${grounded}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function researchTopic() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const ctx = await persistTopicContext();
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selected.id,
          direction: ideaSeed || undefined,
          notes: ctx.notes,
          angles: ctx.angles,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "Research failed");
      setResearch(data.brief);
      const grounded =
        ctx.angles.length || ctx.notes.trim() || ideaSeed.trim()
          ? " focused on your notes/angles"
          : "";
      setMsg(`Research brief ready${grounded}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function draftFromIdea(idea: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const ctx = await persistTopicContext();
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selected.id,
          idea,
          format: "single",
          save: true,
          researchBriefId: research?.id,
          notes: ctx.notes,
          angles: ctx.angles,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "Draft failed");
      if (data.post?.id) router.push(`/posts/${data.post.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner /> Loading topics…
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        kicker="Library"
        title="Topics"
        description="Organize angles and notes. Generate ideas and research briefs that sound like you."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-1">
          <div className="flex gap-2">
            <Input
              placeholder="New topic name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTopic()}
            />
            <Button onClick={createTopic} disabled={busy || !name.trim()}>
              <Plus size={14} />
            </Button>
          </div>
          <ul className="space-y-1">
            {topics.map((t) => {
              const active = selected?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => select(t)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "border-sky-500/40 bg-sky-500/10 text-white shadow-sm shadow-sky-950/30"
                        : "border-transparent bg-white/[0.02] text-zinc-300 hover:border-white/10 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                      style={{ background: t.color ?? "#64748b" }}
                    />
                    <span className="truncate font-medium">{t.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {topics.length === 0 && (
            <EmptyState
              icon={<Lightbulb size={16} />}
              title="No topics"
              description="Add your first topic above."
            />
          )}
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          {!selected && (
            <EmptyState
              icon={<Lightbulb size={18} />}
              title="Select a topic"
              description="Pick a topic from the list to edit notes, angles, and run AI."
            />
          )}
          {selected && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {selected.description}
                    </p>
                  )}
                  <Badge className="mt-2" tone="info">
                    {selected.slug}
                  </Badge>
                </div>
                <Button
                  onClick={saveTopic}
                  disabled={busy}
                  loading={busy}
                  variant="secondary"
                  size="sm"
                >
                  Save topic
                </Button>
              </div>

              <div>
                <Label>Notes (sources, constraints, context)</Label>
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="People, products, events, or constraints the AI should ground on…"
                />
                <p className="mt-1.5 text-[0.7rem] text-zinc-500">
                  Used by Research, Generate ideas, and Draft — auto-saved when
                  you run those actions.
                </p>
              </div>
              <div>
                <Label>Angles (one per line)</Label>
                <Textarea
                  rows={3}
                  value={angles}
                  onChange={(e) => setAngles(e.target.value)}
                  placeholder={"Contrarian take\nBeginner explainer\nCase study"}
                />
                <p className="mt-1.5 text-[0.7rem] text-zinc-500">
                  Research and ideas will prioritize these over a generic topic
                  search.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-sky-500/[0.07] to-transparent p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
                    <Sparkles size={15} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">AI ideas → draft</h3>
                    <p className="text-xs text-zinc-500">
                      Generate angles, research, then draft in one click.
                    </p>
                  </div>
                </div>

                {!aiEnabled && (
                  <Alert tone="warning" className="mb-3">
                    AI disabled — add <code className="text-amber-100">XAI_API_KEY</code> to
                    .env and restart.
                  </Alert>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Optional seed direction"
                    value={ideaSeed}
                    onChange={(e) => setIdeaSeed(e.target.value)}
                    disabled={!aiEnabled}
                    className="sm:flex-1"
                  />
                  <Button
                    onClick={generateIdeas}
                    disabled={busy || !aiEnabled}
                    loading={busy}
                  >
                    Generate ideas
                  </Button>
                  <Button
                    onClick={researchTopic}
                    disabled={busy || !aiEnabled}
                    variant="secondary"
                  >
                    <FlaskConical size={14} /> Research
                  </Button>
                </div>

                {research && (
                  <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-950/30 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-300">
                      Research brief
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                      {research.summary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(() => {
                        try {
                          return (
                            JSON.parse(research.citationsJson) as Array<{
                              url: string;
                              label?: string;
                            }>
                          )
                            .slice(0, 8)
                            .map((citation) => (
                              <a
                                key={citation.url}
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.7rem] text-sky-300 hover:bg-sky-500/20"
                              >
                                {citation.label || "Source"}
                                <ExternalLink size={10} />
                              </a>
                            ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                <ul className="mt-3 space-y-2">
                  {ideas.map((idea) => (
                    <li
                      key={idea}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                    >
                      <span className="text-sm leading-relaxed text-zinc-200">
                        {idea}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || !aiEnabled}
                        onClick={() => draftFromIdea(idea)}
                      >
                        Draft
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {msg && <Alert tone="success">{msg}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </Card>
      </div>
    </div>
  );
}
