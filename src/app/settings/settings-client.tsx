"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, Label, Textarea } from "@/components/ui";

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

  async function load() {
    const [x, h] = await Promise.all([
      fetch("/api/x/status").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setStatus(x);
    setHealth(h);
    setSummary(x.voice?.summary ?? "");
    setStyleNotes(x.voice?.styleNotes ?? "");
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-400">
          X connection, voice profile, and feature flags (via env).
        </p>
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium">X account</h2>
        {status?.connected ? (
          <div className="space-y-2 text-sm">
            <p>
              Connected as <strong>@{status.username}</strong>
            </p>
            <p className="text-zinc-500">
              Scopes: {(status.scopes ?? []).join(", ") || "—"}
            </p>
            <p className="text-zinc-500">
              Can API-post:{" "}
              {status.canPost ? (
                <Badge className="bg-emerald-900 text-emerald-200">yes</Badge>
              ) : (
                <Badge>no (draft-first)</Badge>
              )}
            </p>
            <p className="text-zinc-500">
              Last sync:{" "}
              {status.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleString()
                : "never"}
              {status.partialSync ? " (partial)" : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={sync} disabled={busy}>
                Sync timeline
              </Button>
              <a href="/api/auth/x/start?intent=posting">
                <Button type="button" variant="secondary" disabled={busy}>
                  Reconnect with posting
                </Button>
              </a>
              <Button variant="danger" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-zinc-400">
              Not connected. Requires X developer app credentials in{" "}
              <code className="text-zinc-300">.env</code> (see README). You can
              still plan offline and use AI with voice notes.
            </p>
            <a href="/api/auth/x/start">
              <Button type="button" disabled={busy}>
                Connect X
              </Button>
            </a>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium">Voice profile</h2>
        <p className="text-xs text-zinc-500">
          Used as context for Grok drafts. Edit manually anytime, or rebuild
          from synced tweets when AI + X are available.
        </p>
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveVoice} disabled={busy}>
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

      <Card className="space-y-2 text-sm">
        <h2 className="text-sm font-medium">Feature flags (env)</h2>
        <ul className="space-y-1 text-zinc-400">
          <li>
            AI:{" "}
            {health?.features?.ai ? (
              <span className="text-emerald-400">on</span>
            ) : (
              <span className="text-amber-400">off (XAI_API_KEY)</span>
            )}
          </li>
          <li>ENABLE_X_SYNC: {String(health?.features?.xSync ?? false)}</li>
          <li>
            ENABLE_X_POSTING: {String(health?.features?.xPosting ?? false)}
          </li>
        </ul>
      </Card>

      {(msg || error) && (
        <p className={`text-sm ${error ? "text-red-400" : "text-emerald-400"}`}>
          {error || msg}
        </p>
      )}
    </div>
  );
}
