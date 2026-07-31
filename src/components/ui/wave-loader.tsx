type WaveLoaderProps = {
  className?: string;
  barClassName?: string;
};

export function WaveLoader({
  className = "",
  barClassName = "bg-scenario",
}: WaveLoaderProps) {
  return (
    <div className={["flex items-center justify-center gap-1", className].join(" ")}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={[
            "h-4 w-1 rounded-full animate-wave-bar",
            barClassName,
          ].join(" ")}
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}
