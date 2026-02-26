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

type Point = { x: number | string; y: number };
type SeriesType = "line" | "bar";
type SeriesInput = {
  name?: string;
  color?: string;
  points?: unknown;
  type?: unknown;
};
type Series = { name: string; color: string | null; points: Point[]; type: SeriesType };

function sanitizePoints(points: unknown): Point[] {
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
      if (!Number.isFinite(y)) {
        return null;
      }
      if (typeof rawX === "number" && Number.isFinite(rawX)) {
        return { x: rawX, y };
      }
      if (typeof rawX === "string") {
        const label = rawX.trim();
        if (!label) {
          return null;
        }
        return { x: label, y };
      }
      return null;
    })
    .filter((point): point is Point => point !== null);
}

function sanitizeSeriesType(value: unknown): SeriesType | null {
  if (value === "bar" || value === "line") {
    return value;
  }
  return null;
}

function sanitizeSeries(input: unknown): Series[] {
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
      const points = sanitizePoints((series as SeriesInput).points);
      const type = sanitizeSeriesType((series as SeriesInput).type) ?? "line";
      return { name, color, points, type };
    })
    .filter((series): series is Series => series !== null);
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Chart MCP App Server",
    version: "1.0.0",
  });

  const resourceUri = "ui://line-chart/mcp-app.html";
  const inputSchema = {
    chartType: z
      .enum(["line", "bar"])
      .describe("Chart type to render.")
      .optional(),
    points: z
      .array(z.object({ x: z.union([z.number(), z.string()]), y: z.number() }))
      .describe("Array of points with x and y values.")
      .optional(),
    series: z
      .array(
        z.object({
          name: z.string().optional(),
          color: z.string().optional(),
          type: z.enum(["line", "bar"]).optional(),
          points: z.array(
            z.object({ x: z.union([z.number(), z.string()]), y: z.number() }),
          ),
        }),
      )
      .describe("Multiple series with their own points.")
      .optional(),
  } as unknown as ZodRawShapeCompat;

  registerAppTool(
    server,
    "draw-line-chart",
    {
      title: "Draw Line Chart",
      description:
        "Draws a connected line chart from points or multiple series.",
      inputSchema,
      _meta: { ui: { resourceUri } },
    },
    async (
      args: { points?: unknown; series?: unknown; chartType?: unknown },
      _extra: unknown,
    ) => {
      const { points, series, chartType } = args;
      const sanitizedSeries = sanitizeSeries(series);
      const sanitizedPoints = sanitizePoints(points);
      const resolvedChartType = sanitizeSeriesType(chartType) ?? "line";
      const payload =
        sanitizedSeries.length > 0
          ? { chartType: resolvedChartType, series: sanitizedSeries }
          : {
              chartType: resolvedChartType,
              series: [
                {
                  name: "Series 1",
                  color: null,
                  points: sanitizedPoints,
                  type: resolvedChartType,
                },
              ],
            };
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
      description: "Draws a bar chart from points or multiple series.",
      inputSchema,
      _meta: { ui: { resourceUri } },
    },
    async (
      args: { points?: unknown; series?: unknown; chartType?: unknown },
      _extra: unknown,
    ) => {
      const { points, series, chartType } = args;
      const sanitizedSeries = sanitizeSeries(series);
      const sanitizedPoints = sanitizePoints(points);
      const resolvedChartType = sanitizeSeriesType(chartType) ?? "bar";
      const payload =
        sanitizedSeries.length > 0
          ? { chartType: resolvedChartType, series: sanitizedSeries }
          : {
              chartType: resolvedChartType,
              series: [
                {
                  name: "Series 1",
                  color: null,
                  points: sanitizedPoints,
                  type: resolvedChartType,
                },
              ],
            };
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
