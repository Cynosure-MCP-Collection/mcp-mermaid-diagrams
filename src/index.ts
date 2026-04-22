#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

// ── Config ─────────────────────────────────────────────────────────────────────

/** Kroki.io is a free open-source API for rendering diagrams (self-hostable). */
const KROKI_BASE = 'https://kroki.io';
const DEFAULT_OUTPUT_DIR = path.join(tmpdir(), 'cynosure-mcp', 'mermaid-diagrams');

function getOutputDir(): string {
    return process.env.MERMAID_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ensureOutputDir(): string {
    const dir = getOutputDir();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function generateFilename(prefix: string): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${ts}.png`;
}

async function saveImage(data: Buffer, prefix: string): Promise<string> {
    const dir = ensureOutputDir();
    const filename = generateFilename(prefix);
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, data);
    return filepath;
}

/**
 * Render a Mermaid diagram to PNG using the Kroki API.
 * Kroki accepts the diagram source as the POST body and returns
 * the rendered image directly.
 */
async function renderMermaid(
    code: string,
    theme: string,
    bgColor: string,
): Promise<{ ok: true; data: Buffer } | { ok: false; error: string }> {
    // Wrap in %%{init}%% directive to set theme and background
    let themedCode = code.trim();
    if (!themedCode.startsWith('%%{') && theme !== 'default') {
        themedCode = `%%{init: {'theme': '${theme}', 'themeVariables': {'background': '${bgColor}'}}}%%\n${themedCode}`;
    }

    try {
        const res = await fetch(`${KROKI_BASE}/mermaid/png`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: themedCode,
        });

        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return { ok: true, data: Buffer.from(arrayBuffer) };
        }

        const errorText = await res.text();
        return { ok: false, error: `Rendering failed (${res.status}): ${errorText}` };
    } catch (err) {
        return { ok: false, error: `Failed to connect to rendering service: ${(err as Error).message}` };
    }
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = new McpServer({
    name: 'Mermaid Diagrams',
    version: '1.0.0',
    title: 'Mermaid Diagrams',
    description: 'Render Mermaid.js diagrams to images. Supports flowcharts, sequence diagrams, Gantt charts, class diagrams, state diagrams, ER diagrams, pie charts, and more.',
    icons: [{ src: 'https://raw.githubusercontent.com/andreasjhagen/OpenAgent-MCPs/main/mcp-mermaid-diagrams/icon.png', mimeType: 'image/png' }],
});

// ── Tool: render_diagram ───────────────────────────────────────────────────────

server.registerTool(
    'render_diagram',
    {
        description: [
            'Render a Mermaid.js diagram to a PNG image. Returns the image inline for display in the chat.',
            '',
            'Supported diagram types:',
            '- Flowcharts: graph TD / graph LR',
            '- Sequence diagrams: sequenceDiagram',
            '- Class diagrams: classDiagram',
            '- State diagrams: stateDiagram-v2',
            '- ER diagrams: erDiagram',
            '- Gantt charts: gantt',
            '- Pie charts: pie',
            '- Mind maps: mindmap',
            '- Timeline: timeline',
            '- Git graphs: gitGraph',
            '- Block diagrams: block-beta',
            '',
            'Example usage:',
            '  code: "graph TD\\n    A[Start] --> B{Decision}\\n    B -->|Yes| C[OK]\\n    B -->|No| D[Cancel]"',
        ].join('\n'),
        inputSchema: {
            code: z.string().min(1).max(50000).describe(
                'Mermaid diagram source code. Must start with a valid diagram type keyword (graph, sequenceDiagram, classDiagram, etc.)'
            ),
            theme: z.enum(['default', 'dark', 'forest', 'neutral']).default('default').describe(
                'Mermaid theme to apply. Use "dark" for dark backgrounds.'
            ),
            background_color: z.string().default('white').describe(
                'Background color for the diagram (CSS color value, e.g. "white", "#1e1e2e", "transparent")'
            ),
        },
    },
    async (params) => {
        const result = await renderMermaid(params.code, params.theme, params.background_color);

        if (!result.ok) {
            return { content: [{ type: 'text', text: result.error }] };
        }

        const filepath = await saveImage(result.data, 'mermaid-diagram');
        return {
            content: [
                { type: 'text', text: `Diagram rendered and saved to: ${filepath}` },
                { type: 'image', data: result.data.toString('base64'), mimeType: 'image/png' },
            ],
        };
    }
);

// ── Start ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error('Failed to start Mermaid Diagrams MCP:', err);
    process.exit(1);
});
