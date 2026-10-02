import { downloadPdf } from "../utils/pdf-utils.js";
import { ResearchPaper } from "../types/paper.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function fetchPdf(args: {
  paper?: {
    id?: string;
    title?: string;
    pdfUrl?: string;
    [key: string]: unknown;
  };
  paperId?: string;
  pdfUrl?: string;
  saveLocation?: string;
}): Promise<{ savedPath?: string; sizeBytes?: number }> {
  const { paper, paperId, saveLocation } = args;

  let downloadUrl = args.pdfUrl || paper?.pdfUrl;

  // If downloadUrl not provided, resolve paper by ID
  if (!downloadUrl) {
    const idToLookup = paperId || paper?.id;
    if (idToLookup) {
      const { ArxivService } = await import("../services/arxiv.js");
      const arxivService = new ArxivService();
      const resolved = await arxivService.getById(idToLookup);
      downloadUrl = resolved?.pdfUrl;
    }
  }

  if (!downloadUrl) {
    throw new Error(
      "No PDF URL found for this paper. Please provide a paper with `pdfUrl`, a direct `pdfUrl`, or a valid `paperId` (e.g. arXiv ID)."
    );
  }

  const data = await downloadPdf(downloadUrl);
  if (saveLocation) {
    const dir = path.dirname(saveLocation);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(saveLocation, data);
    return { savedPath: saveLocation, sizeBytes: data.byteLength };
  }
  return { sizeBytes: data.byteLength };
}
