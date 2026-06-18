#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

// ── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_OUTPUT_DIR = path.join(tmpdir(), 'cynosure-mcp', 'mermaid-diagrams');
const DEFAULT_RENDER_WIDTH = 1600;
const DEFAULT_RENDER_HEIGHT = 1200;
const DEFAULT_RENDER_SCALE = 2;

const execFile = promisify(execFileCallback);
const require = createRequire(import.meta.url);
const mermaidCliPath = path.join(path.dirname(require.resolve('@mermaid-js/mermaid-cli')), 'cli.js');

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
 * Render Mermaid text to a PNG image buffer using the Mermaid CLI.
 */
async function renderMermaid(
    code: string,
    theme: string,
    bgColor: string,
    width: number,
    height: number,
    scale: number,
): Promise<{ ok: true; data: Buffer } | { ok: false; error: string }> {
    const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'cynosure-mermaid-'));
    const inputPath = path.join(tempDir, 'input.mmd');
    const outputPath = path.join(tempDir, 'output.png');

    try {
        fs.writeFileSync(inputPath, code.trim(), 'utf8');

        await execFile(
            process.execPath,
            [
                mermaidCliPath,
                '--input',
                inputPath,
                '--output',
                outputPath,
                '--outputFormat',
                'png',
                '--theme',
                theme,
                '--backgroundColor',
                bgColor,
                '--width',
                String(width),
                '--height',
                String(height),
                '--scale',
                String(scale),
                '--quiet',
            ],
            { maxBuffer: 10 * 1024 * 1024 }
        );

        return { ok: true, data: fs.readFileSync(outputPath) };
    } catch (err) {
        const error = err as Error & { stderr?: string | Buffer };
        const stderr = error.stderr?.toString().trim();
        return { ok: false, error: `Rendering failed: ${stderr || error.message}` };
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = new McpServer({
    name: 'Mermaid Diagrams',
    version: '1.0.0',
    title: 'Mermaid Diagrams',
    description: 'Render Mermaid.js diagrams to images. Supports flowcharts, sequence diagrams, Gantt charts, class diagrams, state diagrams, ER diagrams, pie charts, and more.',
    icons: [{ src: 'https://raw.githubusercontent.com/andreasjhagen/Cynosure-MCPs/main/mcp-mermaid-diagrams/icon.png', mimeType: 'image/png' }],
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
            width: z.number().int().min(320).max(8000).default(DEFAULT_RENDER_WIDTH).describe(
                'Viewport width in pixels. Larger values make complex diagrams less cramped.'
            ),
            height: z.number().int().min(240).max(8000).default(DEFAULT_RENDER_HEIGHT).describe(
                'Viewport height in pixels. Larger values make complex diagrams less cramped.'
            ),
            scale: z.number().min(1).max(4).default(DEFAULT_RENDER_SCALE).describe(
                'Puppeteer scale factor for PNG output. Higher values increase pixel density.'
            ),
        },
    },
    async (params) => {
        const result = await renderMermaid(
            params.code,
            params.theme,
            params.background_color,
            params.width,
            params.height,
            params.scale
        );

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
