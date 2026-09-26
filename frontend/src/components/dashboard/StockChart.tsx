"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartDataPoint } from "@/lib/types";

interface StockChartProps {
  data: ChartDataPoint[];
}

export default function StockChart({ data }: StockChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-700">
            Stock Movement Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-slate-400 text-sm">
            No movement data available for the selected filters.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format "2025-07-16" → "07/16" for the x-axis
  const formatted = data.map((d) => ({
    ...d,
    date: d.date.slice(5).replace("-", "/"),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700">
          Stock Movement Trend — Last 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={formatted}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
            />
            <Bar
              dataKey="incoming"
              name="Incoming"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              barSize={18}
            />
            <Line
              type="monotone"
              dataKey="outgoing"
              name="Outgoing"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#f97316" }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
