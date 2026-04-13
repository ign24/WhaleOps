type SegmentedBarProps = {
  completed: number;
  failed: number;
  running: number;
};

export const SegmentedBar = ({ completed, failed, running }: SegmentedBarProps) => {
  const total = completed + failed + running;

  if (total === 0) {
    return <p className="text-xs text-muted">Sin actividad</p>;
  }

  const segments = [
    { count: completed, color: "var(--success)", label: "completados" },
    { count: failed, color: "var(--error)", label: "con error" },
    { count: running, color: "var(--warning)", label: "en curso" },
  ].filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            data-testid="segment"
            className="h-full transition-[width] duration-200"
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 text-[11px] text-muted">
        {segments.map((segment) => (
          <span key={segment.label}>
            {segment.count} {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
};
