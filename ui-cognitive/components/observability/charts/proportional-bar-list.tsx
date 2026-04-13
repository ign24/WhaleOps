type BarItem = {
  label: string;
  count: number;
};

type ProportionalBarListProps = {
  items: BarItem[];
  emptyMessage?: string;
  variant?: "default" | "error";
};

const fmtInt = (value: number): string =>
  new Intl.NumberFormat("es-ES").format(value);

export const ProportionalBarList = ({
  items,
  emptyMessage = "Sin datos.",
  variant = "default",
}: ProportionalBarListProps) => {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const maxCount = items[0].count;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const opacity =
          variant === "error" && maxCount > 0
            ? 0.3 + 0.7 * (item.count / maxCount)
            : 1;

        return (
          <div key={item.label} className="rounded-lg border border-[var(--border)] p-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="font-semibold">{fmtInt(item.count)}</span>
            </div>
            <div
              className="h-2 rounded-full"
              style={{ background: "color-mix(in srgb, var(--text-primary) 10%, transparent)" }}
            >
              <div
                data-testid="bar-fill"
                className="h-2 rounded-full transition-[width] duration-200"
                style={{
                  width: `${Math.max(4, pct)}%`,
                  backgroundColor:
                    variant === "error"
                      ? "var(--error)"
                      : "#3b82f6",
                  opacity,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
