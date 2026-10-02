import axios from "axios";
import { parseStringPromise } from "xml2js";
import { ResearchPaper } from "../types/paper.js";

export class ArxivService {
  private baseUrl = "https://export.arxiv.org/api/query";

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    const searchQuery = `search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}`;
    const { data } = await axios.get(`${this.baseUrl}?${searchQuery}`, { responseType: "text" });
    return this.parseArxivXML(data as string);
  }

  async getById(arxivId: string): Promise<ResearchPaper | undefined> {
    const cleanId = arxivId.replace(/^(arxiv:)?(abs\/)?/, "").trim();
    try {
      const { data } = await axios.get(`${this.baseUrl}?id_list=${encodeURIComponent(cleanId)}`, { responseType: "text" });
      const papers = await this.parseArxivXML(data as string);
      return papers[0];
    } catch {
      return undefined;
    }
  }

  private async parseArxivXML(xml: string): Promise<ResearchPaper[]> {
    const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
    const entries = parsed?.feed?.entry ? (Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry]) : [];
    const papers: ResearchPaper[] = entries
      .filter((e: any) => e.title && !e.title.toLowerCase().includes("error"))
      .map((e: any): ResearchPaper => {
        const links = Array.isArray(e.link) ? e.link : [e.link].filter(Boolean);
        const pdfLink = links.find((l: any) => l.type === "application/pdf")?.href || 
                        links.find((l: any) => l.title === "pdf")?.href;
        const id = typeof e.id === "string" ? e.id : e.id?._;
        const title = (e.title || "").trim().replace(/\s+/g, " ");
        const authorsArr = e.author ? (Array.isArray(e.author) ? e.author : [e.author]) : [];
        const authors = authorsArr.map((a: any) => a.name).filter(Boolean);
        const published = e.published ? new Date(e.published) : new Date();
        const year = published.getUTCFullYear();

        // Extract categories as keywords
        const categories = Array.isArray(e.category) ? e.category : [e.category].filter(Boolean);
        const keywords = categories.map((c: any) => c.term || c.scheme).filter(Boolean);

        return {
          id: id || `arxiv:${cleanArxivId(id || title)}`,
          title,
          authors,
          year,
          source: 'arxiv',
          url: id,
          pdfUrl: pdfLink,
          abstract: (e.summary || "").trim().replace(/\s+/g, " "),
          isOpenAccess: true,
          keywords,
          publishedDate: published,
        };
      });
    return papers;
  }
}

function cleanArxivId(val: string): string {
  const match = val.match(/\d{4}\.\d{4,5}(v\d+)?/);
  return match ? match[0] : val;
}
