# MCP Apps Chart

Draws a sequential line chart from an array of `{ x, y }` points using MCP Apps.

## Tools

`draw-line-chart`

### Line input

```json
{
  "title": "Weekly trend",
  "points": [
    { "x": 2, "y": 3 },
    { "x": 7, "y": 7 }
  ]
}
```

### Line multiple series

```json
{
  "series": [
    {
      "name": "Alpha",
      "color": "#f06449",
      "points": [
        { "x": 1, "y": 2 },
        { "x": 3, "y": 5 }
      ]
    },
    {
      "name": "Beta",
      "color": "#0b7a75",
      "points": [
        { "x": 1, "y": 1 },
        { "x": 3, "y": 4 }
      ]
    }
  ]
}
```

`draw-bar-chart`

### Bar input

```json
{
  "title": "Sales by month",
  "labels": ["1月", "2月", "3月"],
  "datasets": [
    {
      "name": "店舗A",
      "data": [120, 150, 90]
    },
    {
      "name": "店舗B",
      "data": [100, 130, 110]
    }
  ]
}
```

## Development

```bash
npm install
npm run build
npm start
```

Start a host (e.g. `examples/basic-host` from the MCP Apps repo) and call the
`draw-line-chart` or `draw-bar-chart` tool to render the View.
