import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";

export function Button({
  className,
  variant = "default",
  size = "md",
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
        size === "sm" && "min-h-8 px-2.5 py-1.5 text-xs",
        size === "md" && "min-h-9 px-3.5 py-2 text-sm",
        size === "lg" && "min-h-11 px-4 py-2.5 text-sm",
        variant === "default" &&
          "bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_8px_24px_rgba(2,132,199,0.24)] hover:-translate-y-0.5 hover:from-sky-300 hover:to-sky-500 active:translate-y-0",
        variant === "secondary" &&
          "border border-white/10 bg-white/[0.06] text-zinc-100 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1] active:translate-y-0",
        variant === "danger" &&
          "border border-red-400/20 bg-red-500/15 text-red-100 hover:bg-red-500/25",
        variant === "ghost" &&
          "bg-transparent text-zinc-300 hover:bg-white/[0.07] hover:text-white",
        variant === "success" &&
          "border border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/10 placeholder:text-zinc-500 outline-none transition focus:border-sky-400/70 focus:bg-black/30 focus:ring-4 focus:ring-sky-400/10",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/10 placeholder:text-zinc-500 outline-none transition focus:border-sky-400/70 focus:bg-black/30 focus:ring-4 focus:ring-sky-400/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("select-field", className)} {...props}>
      {children}
    </select>
  );
}

export function Card({
  className,
  children,
  hover,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.17)] backdrop-blur-md",
        hover &&
          "transition duration-200 hover:border-white/15 hover:bg-white/[0.04]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium",
        tone === "neutral" &&
          "border-white/[0.08] bg-white/[0.06] text-zinc-300",
        tone === "success" &&
          "border-emerald-400/20 bg-emerald-500/12 text-emerald-300",
        tone === "warning" &&
          "border-amber-400/20 bg-amber-500/12 text-amber-300",
        tone === "danger" && "border-red-400/20 bg-red-500/12 text-red-300",
        tone === "info" && "border-sky-400/20 bg-sky-500/12 text-sky-300",
        tone === "purple" &&
          "border-violet-400/20 bg-violet-500/12 text-violet-300",
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "purple"
> = {
  idea: "neutral",
  drafting: "info",
  ready: "success",
  scheduled: "purple",
  posted: "info",
  archived: "neutral",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cls = `status-${status}`;
  return (
    <Badge
      tone={STATUS_TONE[status] ?? "neutral"}
      className={cn("status-badge capitalize", cls, className)}
    >
      <span className={cn("status-dot", cls)} />
      {status}
    </Badge>
  );
}

export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium tracking-wide text-zinc-400",
        className
      )}
    >
      {children}
    </label>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center">
      {icon && (
        <div className="mb-1 grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 size-24 rounded-full blur-2xl",
          tone === "success" && "bg-emerald-500/15",
          tone === "warning" && "bg-amber-500/15",
          tone === "info" && "bg-sky-500/15",
          tone === "neutral" && "bg-white/5"
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.7rem] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="mt-1.5 text-base font-semibold tracking-tight text-zinc-100">
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
        </div>
        {icon && (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed",
        tone === "info" &&
          "border-sky-400/20 bg-sky-500/10 text-sky-100",
        tone === "success" &&
          "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
        tone === "warning" &&
          "border-amber-400/20 bg-amber-500/10 text-amber-100",
        tone === "danger" &&
          "border-red-400/20 bg-red-500/10 text-red-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-sky-400", className)}
      aria-hidden
    />
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-2",
        className
      )}
    >
      <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
        {children}
      </h2>
      {action}
    </div>
  );
}
