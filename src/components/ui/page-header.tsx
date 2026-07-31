import Link from "next/link";
import type { ReactNode } from "react";

import { SoftBadge } from "./soft-badge";

type PageHeaderProps = {
  label?: string;
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
};

export function PageHeader({
  label,
  badge,
  title,
  description,
  backHref,
  backLabel = "返回",
  action,
}: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-5">
      <div className="animate-fade-in-up">
        <div className="flex flex-wrap items-center gap-2">
          {label ? (
            <p className="text-sm font-bold text-ink-faint">{label}</p>
          ) : null}
          {badge ? <SoftBadge variant="brand">{badge}</SoftBadge> : null}
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl leading-7 text-ink-soft">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action}
        {backHref ? (
          <Link
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            href={backHref}
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
