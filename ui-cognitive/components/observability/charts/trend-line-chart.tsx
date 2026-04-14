"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";

type TrendLineChartProps = {
  data: Array<Record<string, unknown>>;
  dataKeys: string[];
  title: string;
  yAxisFormatter?: (value: number) => string;
};

const COLORS_ORDER = ["accent", "warning", "success", "error"] as const;

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

export const TrendLineChart = ({
  data,
  dataKeys,
  title,
  yAxisFormatter,
}: TrendLineChartProps) => {
  const theme = useChartTheme();

  if (data.length < 3) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted">Datos insuficientes para tendencias</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 11, fill: theme.textPrimary }}
            stroke={theme.border}
          />
          <YAxis
            tick={{ fontSize: 11, fill: theme.textPrimary }}
            stroke={theme.border}
            tickFormatter={yAxisFormatter}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatTime(label as number)}
          />
          {dataKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={theme[COLORS_ORDER[index % COLORS_ORDER.length]]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
