import type { ChartDataPoint } from "@/lib/types";

// Last 7 days of stock movement data (most recent last)
export const chartData: ChartDataPoint[] = [
  { date: "2025-07-10", incoming: 120, outgoing: 85  },
  { date: "2025-07-11", incoming: 95,  outgoing: 110 },
  { date: "2025-07-12", incoming: 200, outgoing: 60  },
  { date: "2025-07-13", incoming: 50,  outgoing: 145 },
  { date: "2025-07-14", incoming: 175, outgoing: 90  },
  { date: "2025-07-15", incoming: 30,  outgoing: 70  },
  { date: "2025-07-16", incoming: 160, outgoing: 125 },
];
