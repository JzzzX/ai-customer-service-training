import type { ReactNode } from "react";

type BadgeVariant =
  | "brand"
  | "scenario"
  | "success"
  | "warning"
  | "danger"
  | "warm"
  | "muted";

const variants: Record<BadgeVariant, string> = {
  brand: "bg-brand-soft text-brand-ink",
  scenario: "bg-scenario-soft text-scenario-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  warm: "bg-warm-soft text-warm",
  muted: "bg-surface-muted text-ink-faint",
};

type SoftBadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function SoftBadge({
  children,
  variant = "muted",
  className = "",
}: SoftBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
