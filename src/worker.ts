import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

function createServer(): McpServer {
  const mcp = new McpServer(
    { name: "research-paper", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Register tools
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

  mcp.tool(
    "generate_summary",
    "Generate AI-powered summary for a research paper",
    {
      paperId: z.string(),
      summaryType: z.enum(["brief", "detailed", "methodology", "findings"]).optional(),
    },
    async ({ paperId, summaryType }) => {
      const mod = await import("./tools/generate-summary.js");
      const { summary } = await mod.generateSummary({ paperId, summaryType });
      return { content: [{ type: "text", text: summary }] } as any;
    }
  );

  mcp.tool(
    "export_citations",
    "Export paper citations in various formats",
    {
      papers: z.array(z.any()),
      format: z.enum(["bibtex", "apa", "ieee", "mla"]).optional(),
    },
    async ({ papers, format = "bibtex" }) => {
      const mod = await import("./tools/export-citations.js");
      const { citations } = await mod.exportCitations({ papers, format });
      return { content: [{ type: "text", text: citations.join("\n\n") }] } as any;
    }
  );

  return mcp;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
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
          JSON.stringify({
            name: "research-paper",
            status: "ready",
            transport: "mcp-streamable-http",
            version: "1.0.0",
            endpoints: {
              mcp: url.pathname === "/" ? url.href : `${url.origin}/`,
            },
          }, null, 2),
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
      const server = createServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode: suitable for serverless Workers
      });
      await server.connect(transport);

      const response = await transport.handleRequest(request);

      // Clone response to attach CORS headers
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
  },
};
