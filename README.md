# MCP Apps Chart

Draws a sequential line chart from an array of `{ x, y }` points using MCP Apps.

## Tool

`draw-line-chart`

### Input

```json
{
  "points": [
    { "x": 2, "y": 3 },
    { "x": 7, "y": 7 }
  ]
}
```

### Multiple series

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

## Development

```bash
npm install
npm run build
npm start
```

Start a host (e.g. `examples/basic-host` from the MCP Apps repo) and call the
`draw-line-chart` tool to render the View.
