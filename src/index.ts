import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// MCP server bootstrap with tool metadata. Tool implementations are stubbed for now.
const mcp = new McpServer(
  { name: "research-paper", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Register tools with input schemas and callbacks
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
    return { content: [{ type: "json", json: { papers } }] } as any;
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

mcp.tool(
  "fetch_pdf",
  "Download PDF of a research paper if available",
  {
    paper: z.any(),
    saveLocation: z.string().optional(),
  },
  async ({ paper, saveLocation }) => {
    const mod = await import("./tools/fetch-pdf.js");
    const result = await mod.fetchPdf({ paper, saveLocation });
    return { content: [{ type: "json", json: result }] } as any;
  }
);

mcp.tool(
  "save_to_workspace",
  "Save research results to external workspace",
  {
    papers: z.array(z.any()),
    workspace: z.enum(["notion", "owncloud", "local"]).default("local"),
    workspaceConfig: z.record(z.any()).optional(),
  },
  async ({ papers, workspace, workspaceConfig }) => {
    const mod = await import("./tools/save-workspace.js");
    const result = await mod.saveToWorkspace({ papers, workspace, workspaceConfig });
    return { content: [{ type: "json", json: result }] } as any;
  }
);

const transport = new StdioServerTransport();
await mcp.connect(transport);
// Keep the process alive when started directly without an MCP client managing stdio lifecycle
if (process.stdin.isTTY) {
  process.stdin.resume();
}

