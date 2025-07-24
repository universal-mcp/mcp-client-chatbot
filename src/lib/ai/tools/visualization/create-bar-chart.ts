import { tool as createTool } from "ai";

import { z } from "zod";

export const createBarChartTool = createTool({
  description: "Create a bar chart with multiple data series",
  parameters: z.object({
    data: z
      .array(
        z.object({
          xAxisLabel: z.string(),
          series: z.array(
            z.object({
              seriesName: z.string(),
              value: z.number(),
            }),
          ),
        }),
      )
      .describe("Chart data with x-axis labels and series values"),
    title: z.string(),
    description: z.string().optional(),
    yAxisLabel: z.string().optional().describe("Label for Y-axis"),
  }),
  execute: async () => {
    return "Success";
  },
});
