type GaugeIndicatorProps = {
  value: number;
  label: string;
};

const getLevel = (value: number): "ok" | "warning" | "critical" => {
  if (value === 0) return "ok";
  if (value <= 2) return "warning";
  return "critical";
};

const LEVEL_COLORS = {
  ok: "var(--success)",
  warning: "var(--warning)",
  critical: "var(--error)",
} as const;

export const GaugeIndicator = ({ value, label }: GaugeIndicatorProps) => {
  const level = getLevel(value);
  const color = LEVEL_COLORS[level];

  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p className="text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div
          data-testid="gauge"
          data-level={level}
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
};
