"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";

type TrendAreaChartProps = {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  title: string;
  sloThreshold?: number;
  yAxisFormatter?: (value: number) => string;
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

export const TrendAreaChart = ({
  data,
  dataKey,
  title,
  sloThreshold,
  yAxisFormatter,
}: TrendAreaChartProps) => {
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
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
          {sloThreshold !== undefined ? (
            <ReferenceLine
              y={sloThreshold}
              stroke={theme.warning}
              strokeDasharray="6 3"
              label={{
                value: `SLO ${sloThreshold}%`,
                position: "right",
                fill: theme.warning,
                fontSize: 11,
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={theme.success}
            fill={theme.success}
            fillOpacity={0.15}
            strokeWidth={2}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
