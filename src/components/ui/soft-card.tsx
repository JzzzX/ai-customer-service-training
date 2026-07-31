import type { CSSProperties, ReactNode } from "react";

type SoftCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  style?: CSSProperties;
};

export function SoftCard({
  children,
  className = "",
  hover = true,
  gradient = false,
  style,
}: SoftCardProps) {
  return (
    <div
      className={[
        "rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-soft)] transition-all duration-300 sm:p-7",
        gradient ? "bg-gradient-to-br from-surface to-surface-muted" : "",
        hover
          ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
          : "",
        className,
      ].join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}
