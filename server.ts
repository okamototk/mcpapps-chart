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

type Point = { x: number; y: number };
type SeriesInput = { name?: string; color?: string; points?: unknown };
type Series = { name: string; color: string | null; points: Point[] };

function sanitizePoints(points: unknown): Point[] {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => {
      if (!point || typeof point !== "object") {
        return null;
      }
      const x = Number((point as { x?: unknown }).x);
      const y = Number((point as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x, y };
    })
    .filter((point): point is Point => point !== null);
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
      return { name, color, points };
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
    points: z
      .array(z.object({ x: z.number(), y: z.number() }))
      .describe("Array of points with x and y values.")
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
    async (args: { points?: unknown; series?: unknown }, _extra: unknown) => {
      const { points, series } = args;
      const sanitizedSeries = sanitizeSeries(series);
      const sanitizedPoints = sanitizePoints(points);
      const payload =
        sanitizedSeries.length > 0
          ? { series: sanitizedSeries }
          : { series: [{ name: "Series 1", color: null, points: sanitizedPoints }] };
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
