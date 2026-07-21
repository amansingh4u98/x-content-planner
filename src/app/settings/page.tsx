import { Suspense } from "react";
import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading settings…</p>}>
      <SettingsClient />
    </Suspense>
  );
}
