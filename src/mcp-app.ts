import { App } from "@modelcontextprotocol/ext-apps";

type Point = { x: number; y: number };
type Series = { name: string; color: string | null; points: Point[] };

const canvas = document.getElementById("chart") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const metaEl = document.getElementById("meta") as HTMLDivElement;
const yMinInput = document.getElementById("y-min") as HTMLInputElement | null;
const yMaxInput = document.getElementById("y-max") as HTMLInputElement | null;
const yResetButton = document.getElementById("y-reset") as HTMLButtonElement | null;

const app = new App({ name: "Line Chart App", version: "1.0.0" });
let lastSeries: Series[] = [];
const palette = ["#f06449", "#0b7a75", "#3d5a80", "#f4b942", "#6d597a"];

function parsePoints(payload: unknown): Point[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const points = (payload as { points?: unknown }).points;
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

function parseSeries(payload: unknown): Series[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const series = (payload as { series?: unknown }).series;
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const name =
        typeof (item as { name?: unknown }).name === "string"
          ? (item as { name?: string }).name!
          : `Series ${index + 1}`;
      const color =
        typeof (item as { color?: unknown }).color === "string"
          ? (item as { color?: string }).color!
          : null;
      const points = parsePoints({ points: (item as { points?: unknown }).points });
      return { name, color, points };
    })
    .filter((item): item is Series => item !== null);
}

function decodeResult(result: unknown): Series[] {
  const content = (result as { content?: Array<{ type: string; text?: string }> })
    .content;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return [];
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const parsedSeries = parseSeries(payload);
    if (parsedSeries.length > 0) {
      return parsedSeries;
    }
    const points = parsePoints(payload);
    return points.length > 0
      ? [{ name: "Series 1", color: null, points }]
      : [];
  } catch {
    return [];
  }
}

function scaleCanvas(): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function parseAxisInput(input: HTMLInputElement | null): number | null {
  if (!input) {
    return null;
  }
  const trimmed = input.value.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function getYAxisOverrides(): { min: number | null; max: number | null } {
  return {
    min: parseAxisInput(yMinInput),
    max: parseAxisInput(yMaxInput),
  };
}

function drawChart(series: Series[]): void {
  const ctx = scaleCanvas();
  if (!ctx) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  const allPoints = series.flatMap((item) => item.points);
  if (allPoints.length === 0) {
    statusEl.textContent = "No points provided";
    metaEl.textContent = "Provide at least two points";
    return;
  }

  statusEl.textContent = `Rendering ${series.length} series`;
  let metaText = `Total points: ${allPoints.length} · ${series
    .map((item) => item.name)
    .join(", ")}`;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  const yOverrides = getYAxisOverrides();
  const hasMinOverride = yOverrides.min !== null;
  const hasMaxOverride = yOverrides.max !== null;
  if (hasMinOverride) {
    minY = yOverrides.min!;
  }
  if (hasMaxOverride) {
    maxY = yOverrides.max!;
  }
  if (hasMinOverride && hasMaxOverride && minY >= maxY) {
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
    metaText += " · Invalid Y range, using auto";
  }

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  metaEl.textContent = metaText;

  const padding = 44;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const mapX = (value: number) =>
    padding + ((value - minX) / (maxX - minX)) * plotWidth;
  const mapY = (value: number) =>
    height - padding - ((value - minY) / (maxY - minY)) * plotHeight;

  ctx.strokeStyle = "#101820";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.fillStyle = "#5a6772";
  ctx.font = "12px Space Grotesk";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const tickCount = 5;
  for (let i = 0; i <= tickCount; i += 1) {
    const t = i / tickCount;
    const yValue = minY + (maxY - minY) * (1 - t);
    const y = padding + plotHeight * t;
    ctx.beginPath();
    ctx.moveTo(padding - 6, y);
    ctx.lineTo(padding, y);
    ctx.strokeStyle = "#101820";
    ctx.stroke();
    ctx.fillText(yValue.toFixed(2), padding - 10, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= tickCount; i += 1) {
    const t = i / tickCount;
    const xValue = minX + (maxX - minX) * t;
    const x = padding + plotWidth * t;
    ctx.beginPath();
    ctx.moveTo(x, height - padding);
    ctx.lineTo(x, height - padding + 6);
    ctx.strokeStyle = "#101820";
    ctx.stroke();
    ctx.fillText(xValue.toFixed(2), x, height - padding + 10);
  }

  series.forEach((item, index) => {
    const color = item.color ?? palette[index % palette.length];
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.beginPath();
    item.points.forEach((point, pointIndex) => {
      const x = mapX(point.x);
      const y = mapY(point.y);
      if (pointIndex === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    item.points.forEach((point, pointIndex) => {
      const x = mapX(point.x);
      const y = mapY(point.y);
      ctx.beginPath();
      ctx.arc(x, y, pointIndex === 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function handleToolResult(result: unknown) {
  lastSeries = decodeResult(result);
  drawChart(lastSeries);
}

app.ontoolresult = handleToolResult;
app.connect();
drawChart([]);

if (yMinInput) {
  yMinInput.addEventListener("input", () => {
    drawChart(lastSeries);
  });
}

if (yMaxInput) {
  yMaxInput.addEventListener("input", () => {
    drawChart(lastSeries);
  });
}

if (yResetButton) {
  yResetButton.addEventListener("click", () => {
    if (yMinInput) {
      yMinInput.value = "";
    }
    if (yMaxInput) {
      yMaxInput.value = "";
    }
    drawChart(lastSeries);
  });
}

window.addEventListener("resize", () => {
  drawChart(lastSeries);
});
