"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";

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
  const [aiEnabled, setAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [t, h] = await Promise.all([
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setTopics(t.topics ?? []);
    setAiEnabled(Boolean(h.features?.ai));
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
    setError("");
  }

  async function createTopic() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Create failed");
      setName("");
      await load();
      if (data.topic) select(data.topic);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTopic() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/topics/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          angles: angles
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
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
    try {
      const res = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selected.id,
          count: 5,
          seed: ideaSeed || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");
      setIdeas(data.ideas ?? []);
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
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selected.id,
          idea,
          format: "single",
          save: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft failed");
      if (data.post?.id) router.push(`/posts/${data.post.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Topics</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Organize angles and notes. Seeded: AI, Software Engineering, Cricket,
          Football.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New topic name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={createTopic} disabled={busy}>
              Add
            </Button>
          </div>
          <ul className="space-y-1">
            {topics.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => select(t)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selected?.id === t.id
                      ? "border-sky-600 bg-sky-950/40"
                      : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ background: t.color ?? "#64748b" }}
                  />
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2 space-y-4">
          {!selected && (
            <p className="text-sm text-zinc-500">Select a topic to edit.</p>
          )}
          {selected && (
            <>
              <div>
                <h2 className="text-lg font-medium">{selected.name}</h2>
                <p className="text-sm text-zinc-500">
                  {selected.description}
                </p>
                <Badge className="mt-2">{selected.slug}</Badge>
              </div>
              <div>
                <Label>Notes (sources, angles, constraints)</Label>
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div>
                <Label>Angles (one per line)</Label>
                <Textarea
                  rows={3}
                  value={angles}
                  onChange={(e) => setAngles(e.target.value)}
                />
              </div>
              <Button onClick={saveTopic} disabled={busy} variant="secondary">
                Save topic
              </Button>

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-medium">AI ideas → draft</h3>
                {!aiEnabled && (
                  <p className="mt-1 text-xs text-amber-400">
                    AI disabled — add XAI_API_KEY to .env and restart.
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Optional seed direction"
                    value={ideaSeed}
                    onChange={(e) => setIdeaSeed(e.target.value)}
                    disabled={!aiEnabled}
                  />
                  <Button
                    onClick={generateIdeas}
                    disabled={busy || !aiEnabled}
                  >
                    Generate ideas
                  </Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {ideas.map((idea) => (
                    <li
                      key={idea}
                      className="flex items-start justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                    >
                      <span className="text-sm">{idea}</span>
                      <Button
                        variant="secondary"
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
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
