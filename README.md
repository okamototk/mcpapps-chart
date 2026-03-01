# MCP Apps Chart

Draws a sequential line chart from an array of `{ x, y }` points using MCP Apps.

## Tools

`draw-line-chart`

### Sample prompt

```
Draw a line chart titled "Weekly trend" with points (2, 3) and (7, 7).
```

### Sample prompt

```
Draw a multi-series line chart with two series: Alpha (#f06449) points (1, 2) and (3, 5), and Beta (#0b7a75) points (1, 1) and (3, 4).
```

`draw-bar-chart`

### Sample prompt

```
Draw a bar chart titled "Sales by month" with labels 1月, 2月, 3月 and two datasets: 店舗A [120, 150, 90] and 店舗B [100, 130, 110].
```

`draw-pie-chart`

### Sample prompt

```
Draw a pie chart titled "Category share" with labels Alpha, Beta, Gamma and values 45, 30, 25.
```

## Development

```bash
npm install
npm run build
npm start
```

Start a host (e.g. `examples/basic-host` from the MCP Apps repo) and call the
`draw-line-chart` or `draw-bar-chart` tool to render the View.

## Clone and build

```bash
git clone https://github.com/okamototk/mcpapps-chart.git
cd mcpapps-chart
npm install
npm run build
```

## VS Code Copilot (MCP)

Create `.vscode/mcp.json` in the repo:

```json
{
  "servers": {
    "mcp-app-chart": {
      "command": "npx",
      "args": ["-y", "/Users/USERNAME/work/mcpapps-chart", "--stdio"]
    }
  }
}
```

Then restart VS Code, open Copilot Chat, and select the `mcp-app-chart` server.

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpapps-chart": {
      "command": "npx",
      "args": ["-y" ,"/Users/USERNAME/work/mcpapps-chart" ,"--stdio"]
    }
  }
}
```

Restart Claude Desktop and select the `mcpapps-chart` server.

## Windows guide

Use an absolute path to the repo with escaped backslashes (or forward slashes).

VS Code `.vscode/mcp.json` example:

```json
{
  "servers": {
    "mcp-app-chart": {
      "command": "npx",
      "args": ["-y", "C:\\Users\\USERNAME\\work\\mcpapps-chart", "--stdio"]
    }
  }
}
```

Claude Desktop config location:

`C:\\Users\\USERNAME\\AppData\\Roaming\\Claude\\claude_desktop_config.json`

Claude Desktop config example:

```json
{
  "mcpServers": {
    "mcpapps-chart": {
      "command": "npx",
      "args": ["-y" ,"C:\\Users\\USERNAME\\work\\mcpapps-chart" ,"--stdio"]
    }
  }
}
```
