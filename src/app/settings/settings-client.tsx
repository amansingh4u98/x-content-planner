"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  PageHeader,
  SectionTitle,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  Link2,
  Mic2,
  RefreshCw,
  Shield,
  Unplug,
} from "lucide-react";

export function SettingsClient() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<{
    connected: boolean;
    username?: string;
    scopes?: string[];
    canPost?: boolean;
    lastSyncAt?: string | null;
    partialSync?: boolean;
    voice?: { summary: string; styleNotes: string; rebuiltAt: string | null };
  } | null>(null);
  const [health, setHealth] = useState<{
    features?: { ai?: boolean; xSync?: boolean; xPosting?: boolean };
  } | null>(null);
  const [summary, setSummary] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [x, h] = await Promise.all([
        fetch("/api/x/status").then((r) => r.json()),
        fetch("/api/health").then((r) => r.json()),
      ]);
      setStatus(x);
      setHealth(h);
      setSummary(x.voice?.summary ?? "");
      setStyleNotes(x.voice?.styleNotes ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
    const oauthErr = sp.get("oauth_error");
    const oauth = sp.get("oauth");
    if (oauthErr) setError(`OAuth: ${oauthErr}`);
    if (oauth === "connected") setMsg("X account connected");
  }, [sp]);

  async function saveVoice() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, styleNotes }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg("Voice notes saved");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/x/sync?force=1", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMsg(
        `Synced ${data.tweetsStored} tweets${
          data.voiceRebuildTriggered ? " · voice rebuilt" : ""
        }${data.partial ? " (partial)" : ""}`
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rebuildVoice() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/rebuild-voice", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rebuild failed");
      setMsg("Voice profile rebuilt from cached tweets");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect X? Tokens and cached tweets will be removed.")) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/auth/x/disconnect", { method: "POST" });
      setMsg("Disconnected");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner /> Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <PageHeader
        kicker="Preferences"
        title="Settings"
        description="X connection, voice profile, and feature flags from your environment."
      />

      {(msg || error) && (
        <Alert tone={error ? "danger" : "success"}>{error || msg}</Alert>
      )}

      <Card className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
            <Link2 size={16} />
          </span>
          <div>
            <SectionTitle className="mb-0">X account</SectionTitle>
            <p className="text-xs text-zinc-500">
              OAuth connect for timeline sync and optional posting.
            </p>
          </div>
        </div>

        {status?.connected ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="font-medium text-zinc-100">
                Connected as{" "}
                <span className="text-sky-300">@{status.username}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Scopes: {(status.scopes ?? []).join(", ") || "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {status.canPost ? (
                  <Badge tone="success">API post: yes</Badge>
                ) : (
                  <Badge tone="warning">API post: draft-first</Badge>
                )}
                <Badge tone="neutral">
                  Last sync:{" "}
                  {status.lastSyncAt
                    ? new Date(status.lastSyncAt).toLocaleString()
                    : "never"}
                  {status.partialSync ? " (partial)" : ""}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={sync} disabled={busy} loading={busy}>
                <RefreshCw size={14} /> Sync timeline
              </Button>
              <a href="/api/auth/x/start?intent=posting">
                <Button type="button" variant="secondary" disabled={busy}>
                  Reconnect with posting
                </Button>
              </a>
              <Button variant="danger" onClick={disconnect} disabled={busy}>
                <Unplug size={14} /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert tone="info">
              Not connected. Add X developer app credentials in{" "}
              <code className="text-sky-100">.env</code> (see README). You can
              still plan offline and use AI with manual voice notes.
            </Alert>
            <a href="/api/auth/x/start">
              <Button type="button" disabled={busy}>
                Connect X
              </Button>
            </a>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-violet-300">
            <Mic2 size={16} />
          </span>
          <div>
            <SectionTitle className="mb-0">Voice profile</SectionTitle>
            <p className="text-xs text-zinc-500">
              Context for Grok drafts — edit anytime or rebuild from tweets.
            </p>
          </div>
        </div>
        <div>
          <Label>Summary</Label>
          <Textarea
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Tone, structure habits, recurring themes…"
          />
        </div>
        <div>
          <Label>Style notes (manual voice)</Label>
          <Textarea
            rows={4}
            value={styleNotes}
            onChange={(e) => setStyleNotes(e.target.value)}
            placeholder="Do: dry humor. Don't: engagement bait…"
          />
        </div>
        {status?.voice?.rebuiltAt && (
          <p className="text-xs text-zinc-500">
            Last AI rebuild:{" "}
            {new Date(status.voice.rebuiltAt).toLocaleString()}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveVoice} disabled={busy} loading={busy}>
            Save voice
          </Button>
          <Button
            variant="secondary"
            onClick={rebuildVoice}
            disabled={busy || !health?.features?.ai}
          >
            Rebuild from tweets (AI)
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
            <Shield size={16} />
          </span>
          <SectionTitle className="mb-0">Feature flags (env)</SectionTitle>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <span className="text-zinc-400">AI (XAI_API_KEY)</span>
            {health?.features?.ai ? (
              <Badge tone="success">on</Badge>
            ) : (
              <Badge tone="warning">off</Badge>
            )}
          </li>
          <li className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <span className="text-zinc-400">ENABLE_X_SYNC</span>
            <Badge tone={health?.features?.xSync ? "success" : "neutral"}>
              {String(health?.features?.xSync ?? false)}
            </Badge>
          </li>
          <li className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <span className="text-zinc-400">ENABLE_X_POSTING</span>
            <Badge tone={health?.features?.xPosting ? "success" : "neutral"}>
              {String(health?.features?.xPosting ?? false)}
            </Badge>
          </li>
        </ul>
      </Card>
    </div>
  );
}
