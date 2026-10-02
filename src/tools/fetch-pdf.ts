import { downloadPdf } from "../utils/pdf-utils.js";
import { ResearchPaper } from "../types/paper.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function fetchPdf(args: {
  paper: ResearchPaper;
  saveLocation?: string;
}): Promise<{ savedPath?: string; sizeBytes?: number }> {
  const { paper, saveLocation } = args;
  if (!paper.pdfUrl) {
    throw new Error("No PDF URL available for this paper");
  }
  const data = await downloadPdf(paper.pdfUrl);
  if (saveLocation) {
    const dir = path.dirname(saveLocation);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(saveLocation, data);
    return { savedPath: saveLocation, sizeBytes: data.byteLength };
  }
  return { sizeBytes: data.byteLength };
}

