import { App } from "@modelcontextprotocol/ext-apps";

type Point = { x: number | null; y: number; label?: string };
type SeriesType = "line" | "bar";
type Series = { name: string; color: string | null; points: Point[]; type: SeriesType };

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
        return { x: null, y, label };
      }

      return null;
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
      const type =
        (item as { type?: unknown }).type === "bar"
          ? "bar"
          : (item as { type?: unknown }).type === "line"
            ? "line"
            : "line";
      return { name, color, points, type };
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
    const chartType =
      (payload as { chartType?: unknown }).chartType === "bar"
        ? "bar"
        : (payload as { chartType?: unknown }).chartType === "line"
          ? "line"
          : null;
    if (parsedSeries.length > 0) {
      return chartType
        ? parsedSeries.map((item) => ({ ...item, type: chartType }))
        : parsedSeries;
    }
    const points = parsePoints(payload);
    return points.length > 0
      ? [
          {
            name: "Series 1",
            color: null,
            points,
            type: chartType ?? "line",
          },
        ]
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

function formatAxisLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getBarLabel(point: Point): string | null {
  if (point.label) {
    return point.label;
  }
  if (typeof point.x === "number") {
    return formatAxisLabel(point.x);
  }
  return null;
}

function getBarCategories(barSeries: Series[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  barSeries.forEach((series) => {
    series.points.forEach((point) => {
      const label = getBarLabel(point);
      if (!label || seen.has(label)) {
        return;
      }
      seen.add(label);
      labels.push(label);
    });
  });
  return labels;
}

function drawChart(series: Series[]): void {
  const ctx = scaleCanvas();
  if (!ctx) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  const lineSeries = series.filter((item) => item.type === "line");
  const barSeries = series.filter((item) => item.type === "bar");
  const isBarOnly = barSeries.length > 0 && lineSeries.length === 0;
  const allPoints = series.flatMap((item) => item.points);
  if (allPoints.length === 0) {
    statusEl.textContent = "No points provided";
    metaEl.textContent = "Provide at least two points";
    return;
  }

  statusEl.textContent = `Rendering ${series.length} series`;
  const uniqueTypes = Array.from(new Set(series.map((item) => item.type)));
  const typeLabel =
    uniqueTypes.length === 1
      ? uniqueTypes[0] === "bar"
        ? "Bar"
        : "Line"
      : "Mixed";
  let metaText = `Total points: ${allPoints.length} · ${series
    .map((item) => item.name)
    .join(", ")} · ${typeLabel}`;

  const xs = allPoints
    .map((p) => p.x)
    .filter((x): x is number => typeof x === "number");
  const ys = allPoints.map((p) => p.y);
  let minX = xs.length > 0 ? Math.min(...xs) : 0;
  let maxX = xs.length > 0 ? Math.max(...xs) : 1;
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

  const hasBarSeries = barSeries.length > 0;
  if (hasBarSeries) {
    if (!hasMinOverride) {
      minY = Math.min(minY, 0);
    }
    if (!hasMaxOverride) {
      maxY = Math.max(maxY, 0);
    }
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
  const barCategories = getBarCategories(barSeries);
  const mapCategoryX = (index: number) =>
    padding + ((index + 0.5) / Math.max(1, barCategories.length)) * plotWidth;

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

  const barXs = hasBarSeries
    ? Array.from(
        new Set(
          series
            .flatMap((item) => item.points.map((point) => point.x))
            .filter((x): x is number => typeof x === "number"),
        ),
      ).sort((a, b) => a - b)
    : [];

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (isBarOnly && barCategories.length > 0) {
    const step = Math.ceil(barCategories.length / 12);
    barCategories.forEach((label, index) => {
      if (index % step !== 0) {
        return;
      }
      const x = mapCategoryX(index);
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 6);
      ctx.strokeStyle = "#101820";
      ctx.stroke();
      ctx.fillText(label, x, height - padding + 10);
    });
  } else if (hasBarSeries && barCategories.length > 0) {
    const step = Math.ceil(barXs.length / 12);
    barXs.forEach((xValue, index) => {
      if (index % step !== 0) {
        return;
      }
      const x = mapX(xValue);
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 6);
      ctx.strokeStyle = "#101820";
      ctx.stroke();
      ctx.fillText(formatAxisLabel(xValue), x, height - padding + 10);
    });
  } else {
    for (let i = 0; i <= tickCount; i += 1) {
      const t = i / tickCount;
      const xValue = minX + (maxX - minX) * t;
      const x = padding + plotWidth * t;
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 6);
      ctx.strokeStyle = "#101820";
      ctx.stroke();
      ctx.fillText(formatAxisLabel(xValue), x, height - padding + 10);
    }
  }

  lineSeries.forEach((item, index) => {
    const color = item.color ?? palette[index % palette.length];
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.beginPath();
    item.points.forEach((point, pointIndex) => {
      if (typeof point.x !== "number") {
        return;
      }
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
      if (typeof point.x !== "number") {
        return;
      }
      const x = mapX(point.x);
      const y = mapY(point.y);
      ctx.beginPath();
      ctx.arc(x, y, pointIndex === 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  if (barSeries.length > 0) {
    if (isBarOnly) {
      if (barCategories.length === 0) {
        return;
      }
      const groupWidth = plotWidth / barCategories.length;
      const barWidth = Math.min(42, (groupWidth * 0.7) / barSeries.length);
      const baselineY = mapY(0);
      const categoryIndex = new Map(
        barCategories.map((label, index) => [label, index]),
      );

      barSeries.forEach((item, seriesIndex) => {
        const color = item.color ?? palette[seriesIndex % palette.length];
        ctx.fillStyle = color;
        item.points.forEach((point) => {
          const label = getBarLabel(point);
          if (!label) {
            return;
          }
          const index = categoryIndex.get(label);
          if (index === undefined) {
            return;
          }
          const xOffset =
            (seriesIndex - (barSeries.length - 1) / 2) * barWidth;
          const x = mapCategoryX(index) + xOffset - barWidth / 2;
          const y = mapY(point.y);
          const height = baselineY - y;
          const barHeight = Math.abs(height);
          const barTop = height >= 0 ? y : baselineY;
          ctx.fillRect(x, barTop, barWidth, barHeight);
        });
      });
      return;
    }

    const barXs = Array.from(
      new Set(
        barSeries
          .flatMap((item) => item.points.map((point) => point.x))
          .filter((x): x is number => typeof x === "number"),
      ),
    ).sort((a, b) => a - b);
    if (barXs.length === 0) {
      return;
    }
    const deltas = barXs.slice(1).map((value, index) => value - barXs[index]);
    const minDelta = deltas.length > 0 ? Math.min(...deltas) : maxX - minX;
    const barBand =
      Number.isFinite(minDelta) && minDelta > 0
        ? (minDelta / (maxX - minX)) * plotWidth
        : plotWidth;
    const barWidth = Math.min(42, (barBand * 0.7) / barSeries.length);
    const baselineY = mapY(0);

    barSeries.forEach((item, seriesIndex) => {
      const color = item.color ?? palette[seriesIndex % palette.length];
      ctx.fillStyle = color;
      barXs.forEach((xValue) => {
        const point = item.points.find(
          (p) => typeof p.x === "number" && p.x === xValue,
        );
        if (!point) {
          return;
        }
        const xOffset =
          (seriesIndex - (barSeries.length - 1) / 2) * barWidth;
        const x = mapX(xValue) + xOffset - barWidth / 2;
        const y = mapY(point.y);
        const height = baselineY - y;
        const barHeight = Math.abs(height);
        const barTop = height >= 0 ? y : baselineY;
        ctx.fillRect(x, barTop, barWidth, barHeight);
      });
    });
  }
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
