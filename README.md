# @cynosure-mcp/mermaid-diagrams

MCP server for rendering Mermaid.js diagrams to images — flowcharts, sequence diagrams, Gantt charts, and more.

## Installation

```bash
npx @cynosure-mcp/mermaid-diagrams
```

Or install globally:

```bash
npm install -g @cynosure-mcp/mermaid-diagrams
mermaid-diagrams
```

## Tools

| Tool             | Description                                        |
| ---------------- | -------------------------------------------------- |
| `render_diagram` | Render a Mermaid diagram definition to a PNG image |

### Supported Diagram Types

Flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, mind maps, timelines, git graphs, and block diagrams.

## Configuration

| Variable             | Required | Description                                                      |
| -------------------- | -------- | ---------------------------------------------------------------- |
| `MERMAID_OUTPUT_DIR` | No       | Directory to save rendered diagrams (default: OS temp directory) |

## MCP Config

```json
{
  "mcpServers": {
    "mermaid-diagrams": {
      "command": "npx",
      "args": ["@cynosure-mcp/mermaid-diagrams"]
    }
  }
}
```

## License

MIT
