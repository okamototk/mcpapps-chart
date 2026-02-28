import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import fs from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v3";

const DIST_DIR = path.join(import.meta.dirname, "dist");

type Point = { x: number | string; y: number; label?: string };
type SeriesType = "line" | "bar" | "pie";
type SeriesInput = {
  name?: string;
  color?: string;
  points?: unknown;
};
type DatasetInput = {
  name?: string;
  color?: string;
  data?: unknown;
};
type PieInput = {
  name?: string;
  color?: string;
  labels?: unknown;
  values?: unknown;
};
type Series = { name: string; color: string | null; points: Point[]; type: SeriesType };

function sanitizePoints(
  points: unknown,
  options: { allowStringX: boolean; allowNumberX: boolean },
): Point[] {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point): Point | null => {
      if (!point || typeof point !== "object") {
        return null;
      }
      const rawX = (point as { x?: unknown }).x;
      const y = Number((point as { y?: unknown }).y);
      const rawLabel = (point as { label?: unknown }).label;
      const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
      if (!Number.isFinite(y)) {
        return null;
      }
      if (options.allowNumberX && typeof rawX === "number" && Number.isFinite(rawX)) {
        return label ? { x: rawX, y, label } : { x: rawX, y };
      }
      if (options.allowStringX && typeof rawX === "string") {
        const xLabel = rawX.trim();
        if (!xLabel) {
          return null;
        }
        return { x: xLabel, y };
      }
      return null;
    })
    .filter((point): point is Point => point !== null);
}

function sanitizeSeries(
  input: unknown,
  type: SeriesType,
  options: { allowStringX: boolean; allowNumberX: boolean },
): Series[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((series, index) => {
      if (!series || typeof series !== "object") {
        return null;
      }
      const name =
        typeof (series as SeriesInput).name === "string"
          ? (series as SeriesInput).name!
          : `Series ${index + 1}`;
      const color =
        typeof (series as SeriesInput).color === "string"
          ? (series as SeriesInput).color!
          : null;
      const points = sanitizePoints((series as SeriesInput).points, options);
      return { name, color, points, type };
    })
    .filter((series): series is Series => series !== null);
}

function sanitizeLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => (typeof label === "string" ? label.trim() : ""))
    .filter((label) => label.length > 0);
}

function sanitizeTitle(title: unknown): string | null {
  if (typeof title !== "string") {
    return null;
  }
  const trimmed = title.trim();
  return trimmed ? trimmed : null;
}

function sanitizeDatasets(labels: string[], datasets: unknown): Series[] {
  if (labels.length === 0 || !Array.isArray(datasets)) {
    return [];
  }

  return datasets
    .map((dataset, index) => {
      if (!dataset || typeof dataset !== "object") {
        return null;
      }
      const name =
        typeof (dataset as DatasetInput).name === "string"
          ? (dataset as DatasetInput).name!
          : `Series ${index + 1}`;
      const color =
        typeof (dataset as DatasetInput).color === "string"
          ? (dataset as DatasetInput).color!
          : null;
      const rawData = (dataset as DatasetInput).data;
      if (!Array.isArray(rawData)) {
        return null;
      }
      const points: Point[] = [];
      labels.forEach((label, labelIndex) => {
        const y = Number(rawData[labelIndex]);
        if (!Number.isFinite(y)) {
          return;
        }
        points.push({ x: label, y });
      });
      return { name, color, points, type: "bar" };
    })
    .filter((series): series is Series => series !== null);
}

function sanitizePieSeries(input: unknown): Series[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const labels = sanitizeLabels((input as PieInput).labels);
  const values = (input as PieInput).values;
  if (labels.length === 0 || !Array.isArray(values)) {
    return [];
  }

  const points: Point[] = [];
  labels.forEach((label, index) => {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) {
      return;
    }
    points.push({ x: label, y: value });
  });

  const name =
    typeof (input as PieInput).name === "string"
      ? (input as PieInput).name!
      : "Series 1";
  const color =
    typeof (input as PieInput).color === "string"
      ? (input as PieInput).color!
      : null;

  return [{ name, color, points, type: "pie" }];
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Chart MCP App Server",
    version: "1.0.0",
  });

  const resourceUri = "ui://line-chart/mcp-app.html";
  const lineInputSchema = {
    title: z.string().describe("Chart title shown in the UI.").optional(),
    points: z
      .array(z.object({ x: z.number(), y: z.number() }))
      .describe("Array of points with numeric x and y values.")
      .optional(),
    series: z
      .array(
        z.object({
          name: z.string().optional(),
          color: z.string().optional(),
          points: z.array(z.object({ x: z.number(), y: z.number() })),
        }),
      )
      .describe("Multiple line series with their own points.")
      .optional(),
  } as unknown as ZodRawShapeCompat;

  const barInputSchema = {
    title: z.string().describe("Chart title shown in the UI.").optional(),
    labels: z
      .array(z.string())
      .describe("Ordered x-axis labels for bar charts.")
      .optional(),
    datasets: z
      .array(
        z.object({
          name: z.string().optional(),
          color: z.string().optional(),
          data: z.array(z.number()),
        }),
      )
      .describe("Bar datasets aligned to the labels array.")
      .optional(),
  } as unknown as ZodRawShapeCompat;

  const pieInputSchema = {
    title: z.string().describe("Chart title shown in the UI.").optional(),
    name: z.string().describe("Series name for the pie chart.").optional(),
    color: z.string().describe("Base color for the pie chart.").optional(),
    labels: z.array(z.string()).describe("Slice labels.").optional(),
    values: z.array(z.number()).describe("Slice values.").optional(),
  } as unknown as ZodRawShapeCompat;

  registerAppTool(
    server,
    "draw-line-chart",
    {
      title: "Draw Line Chart",
      description:
        "Draws a connected line chart from points or multiple series.",
      inputSchema: lineInputSchema,
      _meta: { ui: { resourceUri } },
    },
    async (
      args: { title?: unknown; points?: unknown; series?: unknown },
      _extra: unknown,
    ) => {
      const { title, points, series } = args;
      const sanitizedTitle = sanitizeTitle(title);
      const sanitizedSeries = sanitizeSeries(series, "line", {
        allowStringX: false,
        allowNumberX: true,
      });
      const sanitizedPoints = sanitizePoints(points, {
        allowStringX: false,
        allowNumberX: true,
      });
      const payloadBase =
        sanitizedSeries.length > 0
          ? { chartType: "line", series: sanitizedSeries }
          : {
              chartType: "line",
              series: [
                {
                  name: "Series 1",
                  color: null,
                  points: sanitizedPoints,
                  type: "line",
                },
              ],
            };
      const payload = sanitizedTitle
        ? { ...payloadBase, title: sanitizedTitle }
        : payloadBase;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "draw-bar-chart",
    {
      title: "Draw Bar Chart",
      description: "Draws a bar chart from labels and datasets.",
      inputSchema: barInputSchema,
      _meta: { ui: { resourceUri } },
    },
    async (
      args: { title?: unknown; labels?: unknown; datasets?: unknown },
      _extra: unknown,
    ) => {
      const { title, labels, datasets } = args;
      const sanitizedTitle = sanitizeTitle(title);
      const sanitizedLabels = sanitizeLabels(labels);
      const sanitizedDatasets = sanitizeDatasets(sanitizedLabels, datasets);
      const sanitizedSeries = sanitizedDatasets;
      const payloadBase =
        sanitizedSeries.length > 0
          ? { chartType: "bar", series: sanitizedSeries }
          : {
              chartType: "bar",
              series: [
                {
                  name: "Series 1",
                  color: null,
                  points: [],
                  type: "bar",
                },
              ],
            };
      const payload = sanitizedTitle
        ? { ...payloadBase, title: sanitizedTitle }
        : payloadBase;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "draw-pie-chart",
    {
      title: "Draw Pie Chart",
      description: "Draws a pie chart from labels and values.",
      inputSchema: pieInputSchema,
      _meta: { ui: { resourceUri } },
    },
    async (
      args: { title?: unknown; name?: unknown; color?: unknown; labels?: unknown; values?: unknown },
      _extra: unknown,
    ) => {
      const { title, name, color, labels, values } = args;
      const sanitizedTitle = sanitizeTitle(title);
      const sanitizedSeries = sanitizePieSeries({ name, color, labels, values });
      const payloadBase =
        sanitizedSeries.length > 0
          ? { chartType: "pie", series: sanitizedSeries }
          : {
              chartType: "pie",
              series: [
                {
                  name: "Series 1",
                  color: null,
                  points: [],
                  type: "pie",
                },
              ],
            };
      const payload = sanitizedTitle
        ? { ...payloadBase, title: sanitizedTitle }
        : payloadBase;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    },
  );

  return server;
}
