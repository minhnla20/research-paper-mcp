import { ResearchPaper } from "../types/paper.js";
import { downloadPdf } from "../utils/pdf-utils.js";

// In-memory cache for fast lookup after search
const paperCache = new Map<string, ResearchPaper>();

export function cachePaper(paper: ResearchPaper) {
  paperCache.set(paper.id, paper);
  // Also index by raw ID (e.g. without arxiv: prefix or url)
  if (paper.id.includes("arxiv:")) {
    const raw = paper.id.replace("arxiv:", "");
    paperCache.set(raw, paper);
  }
}

/**
 * Retrieves a paper by ID either from in-memory cache or by on-demand lookup
 */
async function getPaperById(paperId: string): Promise<ResearchPaper | undefined> {
  const cleanId = paperId.trim();
  if (paperCache.has(cleanId)) return paperCache.get(cleanId);

  // If paper ID has arxiv prefix or matches an arXiv ID pattern, fetch on-demand from arXiv API
  const arxivMatch = cleanId.match(/(\d{4}\.\d{4,5}(v\d+)?)/);
  if (cleanId.startsWith("arxiv:") || cleanId.includes("arxiv.org") || arxivMatch) {
    const id = arxivMatch ? arxivMatch[1] : cleanId.replace(/^arxiv:/, "");
    try {
      const { ArxivService } = await import("../services/arxiv.js");
      const arxivService = new ArxivService();
      const paper = await arxivService.getById(id);
      if (paper) {
        cachePaper(paper);
        return paper;
      }
    } catch {
      // ignore fetch errors and fall through
    }
  }

  return undefined;
}

/**
 * Attempts to extract full text or text excerpt from paper's PDF if available
 */
async function extractTextFromPdf(pdfUrl: string): Promise<string | undefined> {
  try {
    const pdfData = await downloadPdf(pdfUrl);
    const pdfParseModule = await import("pdf-parse");
    const PDFParse = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default || pdfParseModule;
    
    // Support class-based PDFParse or function-based depending on version
    if (typeof PDFParse === "function" && PDFParse.prototype?.extractText) {
      const parser = new PDFParse({ data: pdfData });
      const textResult = await parser.extractText();
      return textResult?.text?.trim();
    } else if (typeof PDFParse === "function") {
      const res = await PDFParse(Buffer.from(pdfData));
      return res?.text?.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function generateSummary(args: {
  paperId: string;
  summaryType?: "brief" | "detailed" | "methodology" | "findings";
  useFullPaper?: boolean;
}): Promise<{ summary: string }> {
  const { paperId, summaryType = "brief", useFullPaper = false } = args;
  const paper = await getPaperById(paperId);
  if (!paper) {
    throw new Error(
      `Paper with ID "${paperId}" not found. Please search for it first using search_papers or provide a valid arXiv ID (e.g. 2312.00752).`
    );
  }

  // If useFullPaper is requested and paper has a PDF, attempt to extract the full text
  if (useFullPaper && paper.pdfUrl && !paper.fullText) {
    const extracted = await extractTextFromPdf(paper.pdfUrl);
    if (extracted && extracted.length > 500) {
      paper.fullText = extracted;
    }
  }

  const { LMStudioService } = await import("../services/lmstudio-client.js");
  const lmStudio = new LMStudioService();
  const summary = await lmStudio.generateSummary(paper, summaryType);
  return { summary };
}
