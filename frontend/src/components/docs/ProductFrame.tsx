import type { ReactNode } from "react";
import { FileText, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export function ProductFrame({
  surface,
  title,
  subtitle,
  children,
  variant = "card",
}: {
  surface: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  variant?: "card" | "fullBleed";
}) {
  if (variant === "fullBleed") {
    return (
      <section className="overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-panel">
        <header className="flex flex-col gap-3 border-b border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight text-foreground">
                {title}
              </div>
              <div className="mt-0.5 max-w-[72ch] text-[11.5px] leading-snug text-[var(--secondary-text)]">
                {subtitle}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
              <ShieldCheck className="h-3 w-3" />
              Governed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
              <FileText className="h-3 w-3 text-primary" />
              {surface}
            </span>
          </div>
        </header>

        <div className="bg-[var(--canvas)]">{children}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-panel">
      <header className="flex flex-col gap-3 border-b border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-foreground">
              ConnectAgent
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[var(--secondary-text)]">
              {surface}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
            <ShieldCheck className="h-3 w-3" />
            Governed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
            <LockKeyhole className="h-3 w-3 text-primary" />
            Permissions-aware
          </span>
        </div>
      </header>

      <div className="bg-[var(--canvas)] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 max-w-[64ch] text-[12.5px] leading-relaxed text-[var(--secondary-text)]">
              {subtitle}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
            <FileText className="h-3 w-3 text-primary" />
            Docs corpus
          </span>
        </div>

        <div className="min-h-[360px] overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {children}
        </div>
      </div>
    </section>
  );
}
