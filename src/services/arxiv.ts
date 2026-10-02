import axios from "axios";
import { parseStringPromise } from "xml2js";
import { ResearchPaper } from "../types/paper.js";

export class ArxivService {
  private baseUrl = "http://export.arxiv.org/api/query";

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    const searchQuery = `search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}`;
    const { data } = await axios.get(`${this.baseUrl}?${searchQuery}`, { responseType: "text" });
    return this.parseArxivXML(data as string);
  }

  private async parseArxivXML(xml: string): Promise<ResearchPaper[]> {
    const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
    const entries = parsed?.feed?.entry ? (Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry]) : [];
    const papers: ResearchPaper[] = entries.map((e: any): ResearchPaper => {
      const links = Array.isArray(e.link) ? e.link : [e.link].filter(Boolean);
      const pdfLink = links.find((l: any) => l.type === "application/pdf")?.href;
      const id = typeof e.id === "string" ? e.id : e.id?._;
      const title = (e.title || "").trim().replace(/\s+/g, " ");
      const authorsArr = e.author ? (Array.isArray(e.author) ? e.author : [e.author]) : [];
      const authors = authorsArr.map((a: any) => a.name).filter(Boolean);
      const published = e.published ? new Date(e.published) : new Date();
      const year = published.getUTCFullYear();
      return {
        id: id || `arxiv:${title}`,
        title,
        authors,
        year,
        source: 'arxiv',
        url: e.id,
        pdfUrl: pdfLink,
        abstract: (e.summary || "").trim(),
        isOpenAccess: true,
        keywords: [],
        publishedDate: published,
      };
    });
    return papers;
  }
}

