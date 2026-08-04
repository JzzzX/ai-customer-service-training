import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "scenario";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "min-h-12 bg-brand px-6 text-white shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-button-hover)] active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  scenario:
    "min-h-12 bg-scenario px-6 text-white shadow-[0_4px_14px_rgba(138,160,200,0.28)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(138,160,200,0.35)] active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  secondary:
    "min-h-12 border-2 border-brand-border bg-brand-soft px-6 text-brand-ink hover:border-brand/40 hover:bg-brand-soft/80 active:scale-95 disabled:opacity-50",
  ghost:
    "min-h-12 px-5 text-ink-soft hover:bg-surface-muted hover:text-ink active:scale-95 disabled:opacity-50",
  danger:
    "min-h-12 bg-danger px-6 text-white shadow-[0_4px_14px_rgba(184,112,100,0.28)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(184,112,100,0.35)] active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "rounded-xl px-4 py-2 text-sm",
  md: "rounded-[var(--radius-control)] px-5 py-3",
  lg: "rounded-[var(--radius-control)] px-6 py-3.5 text-lg",
};

type SoftButtonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
};

export function SoftButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: SoftButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center font-bold transition-all duration-200",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

type SoftButtonLinkProps = {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function SoftButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
}: SoftButtonLinkProps) {
  return (
    <Link
      className={[
        "inline-flex items-center justify-center font-bold transition-all duration-200",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      href={href}
    >
      {children}
    </Link>
  );
}
