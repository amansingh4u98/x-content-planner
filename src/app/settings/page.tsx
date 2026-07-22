import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { SettingsClient } from "./settings-client";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading settings…
        </div>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
