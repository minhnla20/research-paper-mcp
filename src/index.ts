import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

export function createMcpServer(): McpServer {
  const mcp = new McpServer(
    { name: "research-paper", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // 1. Search papers across academic databases
  mcp.tool(
    "search_papers",
    "Search for research papers across multiple academic databases",
    {
      query: z.string(),
      filters: z
        .object({
          yearFrom: z.number().optional(),
          yearTo: z.number().optional(),
          openAccessOnly: z.boolean().optional(),
          maxResults: z.number().optional(),
          sortBy: z.enum(["relevance", "date", "citations"]).optional(),
        })
        .passthrough()
        .optional(),
    },
    async ({ query, filters }) => {
      const mod = await import("./tools/search-papers.js");
      const { papers } = await mod.searchPapers({ query, filters: filters || {} });
      return { content: [{ type: "text", text: JSON.stringify({ papers }, null, 2) }] };
    }
  );

  // 2. Generate AI summary via LMStudio SDK
  mcp.tool(
    "generate_summary",
    "Generate AI-powered summary for a research paper",
    {
      paperId: z.string().describe("ID of the paper (e.g. from search_papers, or an arXiv ID like 2312.00752)"),
      summaryType: z.enum(["brief", "detailed", "methodology", "findings"]).optional().describe("Type of summary desired"),
      useFullPaper: z.boolean().optional().describe("If true, downloads paper PDF and summarizes from the full text rather than only the abstract"),
    },
    async ({ paperId, summaryType, useFullPaper }) => {
      const mod = await import("./tools/generate-summary.js");
      const { summary } = await mod.generateSummary({ paperId, summaryType, useFullPaper });
      return { content: [{ type: "text", text: summary }] };
    }
  );

  // 3. Export paper citations
  mcp.tool(
    "export_citations",
    "Export paper citations in various formats",
    {
      papers: z
        .array(
          z
            .object({
              title: z.string().describe("Paper title"),
              authors: z.array(z.string()).describe("Authors of the paper"),
              year: z.number().describe("Publication year"),
              doi: z.string().optional().describe("Digital Object Identifier"),
              journal: z.string().optional().describe("Journal or conference name"),
            })
            .passthrough()
        )
        .describe("List of paper objects to format citations for"),
      format: z.enum(["bibtex", "apa", "ieee", "mla"]).optional().describe("Citation format (default: bibtex)"),
    },
    async ({ papers, format = "bibtex" }) => {
      const mod = await import("./tools/export-citations.js");
      const { citations } = await mod.exportCitations({ papers: papers as any, format });
      return { content: [{ type: "text", text: citations.join("\n\n") }] };
    }
  );

  // 4. Download PDF
  mcp.tool(
    "fetch_pdf",
    "Download PDF of a research paper if available",
    {
      paper: z
        .object({
          id: z.string().optional().describe("Paper ID or arXiv ID"),
          title: z.string().optional().describe("Paper title"),
          pdfUrl: z.string().optional().describe("Direct URL to the PDF"),
        })
        .passthrough()
        .optional()
        .describe("Paper object containing pdfUrl or id"),
      paperId: z.string().optional().describe("Optional paper ID or arXiv ID (e.g. 2312.00752)"),
      pdfUrl: z.string().optional().describe("Optional direct URL to the PDF file"),
      saveLocation: z.string().optional().describe("Optional local file path to save the PDF (e.g. ./downloads/paper.pdf)"),
    },
    async ({ paper, paperId, pdfUrl, saveLocation }) => {
      const mod = await import("./tools/fetch-pdf.js");
      const result = await mod.fetchPdf({ paper, paperId, pdfUrl, saveLocation });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 5. Save to workspace
  mcp.tool(
    "save_to_workspace",
    "Save research results to external workspace",
    {
      papers: z
        .array(
          z
            .object({
              id: z.string().describe("Paper ID"),
              title: z.string().describe("Paper title"),
            })
            .passthrough()
        )
        .describe("List of paper objects to save"),
      workspace: z.enum(["notion", "owncloud", "local"]).default("local").describe("Workspace destination"),
      workspaceConfig: z
        .object({
          baseDir: z.string().optional().describe("Directory path for local workspace (default: ./workspace)"),
          apiKey: z.string().optional().describe("Optional API key for Notion / remote storage"),
          databaseId: z.string().optional().describe("Optional database ID for Notion"),
        })
        .passthrough()
        .optional()
        .describe("Workspace configuration options"),
    },
    async ({ papers, workspace, workspaceConfig }) => {
      const mod = await import("./tools/save-workspace.js");
      const result = await mod.saveToWorkspace({ papers: papers as any, workspace, workspaceConfig });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return mcp;
}

/**
 * Common Web-Standards request handler used by both Cloudflare Worker and Node.js
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(request.url);

  // Health check / info endpoint for browser inspection or verification
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/event-stream")) {
      return new Response(
        JSON.stringify(
          {
            name: "research-paper",
            status: "ready",
            transport: "mcp-streamable-http",
            version: "1.0.0",
            endpoints: {
              mcp: url.pathname === "/" ? url.href : `${url.origin}/`,
            },
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
  }

  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Attach CORS headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: error?.message || String(error),
        },
        id: null,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  }
}

// Cloudflare Workers entry point export
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    return handleMcpRequest(request);
  },
};

// Node.js local runner (when running directly: node dist/index.js or pnpm dev)
const isNode = typeof process !== "undefined" && process.release?.name === "node";
const isDirectRun = isNode && (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
);

if (isDirectRun) {
  import("dotenv/config").catch(() => {});
  import("node:http").then(({ default: http }) => {
    function nodeToWebRequest(req: import("node:http").IncomingMessage): Request {
      const protocol = (req.socket as any).encrypted ? "https" : "http";
      const host = req.headers.host || "localhost:3000";
      const url = new URL(req.url || "/", `${protocol}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

      const init: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = new ReadableStream({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(chunk));
            req.on("end", () => controller.close());
            req.on("error", (err) => controller.error(err));
          },
        });
        (init as any).duplex = "half";
      }

      return new Request(url.toString(), init);
    }

    async function sendWebResponse(webRes: Response, nodeRes: import("node:http").ServerResponse): Promise<void> {
      nodeRes.statusCode = webRes.status;
      for (const [key, val] of webRes.headers.entries()) {
        nodeRes.setHeader(key, val);
      }

      if (!webRes.body) {
        nodeRes.end();
        return;
      }

      const reader = webRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          nodeRes.write(value);
        }
      } finally {
        nodeRes.end();
      }
    }

    const port = Number(process.env.PORT) || 3000;
    const server = http.createServer(async (req, res) => {
      const webReq = nodeToWebRequest(req);
      const webRes = await handleMcpRequest(webReq);
      await sendWebResponse(webRes, res);
    });

    server.listen(port, () => {
      console.log(`Research Paper Fetcher MCP Server (Streamable HTTP) listening on http://localhost:${port}/`);
    });
  });
}
