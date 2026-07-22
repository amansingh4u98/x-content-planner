"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  LayoutDashboard,
  Lightbulb,
  PanelsTopLeft,
  Settings2,
  Sparkles,
} from "lucide-react";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/topics", label: "Topics", icon: Lightbulb },
  { href: "/board", label: "Board", icon: PanelsTopLeft },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07090f]/72 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2.5 font-semibold tracking-tight text-white"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-sky-400 via-sky-500 to-violet-500 shadow-lg shadow-sky-500/25 transition group-hover:shadow-sky-400/40">
              <Sparkles size={15} strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">
              Content{" "}
              <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">
                Studio
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 md:flex"
            aria-label="Main"
          >
            {LINKS.map((l) => {
              const Icon = l.icon;
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-all",
                    active
                      ? "bg-white/[0.12] text-white shadow-sm ring-1 ring-white/10"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  )}
                >
                  <Icon size={14} strokeWidth={active ? 2.25 : 2} />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Compact nav for small tablets */}
          <nav
            className="flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 md:hidden"
            aria-label="Main"
          >
            {LINKS.map((l) => {
              const Icon = l.icon;
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  title={l.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm transition-all",
                    active
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  )}
                >
                  <Icon size={15} />
                  <span className="sr-only sm:not-sr-only sm:inline">
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#07090f]/88 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-2xl md:hidden"
        aria-label="Mobile"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {LINKS.map((l) => {
            const Icon = l.icon;
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium transition",
                  active ? "text-sky-300" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition",
                    active && "bg-sky-500/15 ring-1 ring-sky-400/25"
                  )}
                >
                  <Icon size={16} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="truncate">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
