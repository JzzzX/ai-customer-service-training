type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  color?: "brand" | "scenario" | "success" | "warning";
  showShimmer?: boolean;
  className?: string;
};

const colors = {
  brand: "bg-brand",
  scenario: "bg-scenario",
  success: "bg-success",
  warning: "bg-warning",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  color = "brand",
  showShimmer = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      aria-label={label ?? `进度 ${Math.round(percentage)}%`}
      className={[
        "h-2 w-full overflow-hidden rounded-full bg-surface-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={[
          "relative h-full rounded-full transition-all duration-700 ease-out",
          colors[color],
        ].join(" ")}
        style={{ width: `${Math.max(percentage, 4)}%` }}
      >
        {showShimmer && percentage > 0 ? (
          <span className="absolute inset-0 block overflow-hidden rounded-full">
            <span
              className="block h-full w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{
                animation: "shimmer 2s infinite",
              }}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
