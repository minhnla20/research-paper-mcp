import axios from "axios";
import { ResearchPaper } from "../types/paper.js";

export class SpringerService {
  private baseUrl = "https://api.springernature.com/metadata/json";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    if (!this.apiKey) return [];
    const params = {
      q: query,
      p: String(maxResults),
      api_key: this.apiKey,
    } as const;
    const { data } = await axios.get(this.baseUrl, { params });
    const records = Array.isArray(data?.records) ? data.records : [];
    const papers: ResearchPaper[] = records.map((r: any) => {
      const title = (r.title || "").trim();
      const authors = Array.isArray(r.creators)
        ? r.creators.map((c: any) => c.creator).filter(Boolean)
        : [];
      const year = Number(r.publicationDate?.slice(0, 4) || r.publicationDate || new Date().getUTCFullYear());
      const url = Array.isArray(r.url) ? (r.url.find((u: any) => u.format === 'html')?.value || r.url[0]?.value || '') : r.url || '';
      const pdfUrl = Array.isArray(r.url) ? (r.url.find((u: any) => u.format === 'pdf')?.value) : undefined;
      const publishedDate = r.publicationDate ? new Date(r.publicationDate) : new Date(`${year}-01-01`);
      return {
        id: r.doi ? `springer:${r.doi}` : `springer:${title}`,
        title,
        authors,
        year,
        source: 'springer',
        journal: r.publicationName,
        doi: r.doi,
        url,
        pdfUrl,
        abstract: r.abstract,
        isOpenAccess: Boolean(r.openaccess) || false,
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        citationCount: undefined,
        publishedDate,
      } as ResearchPaper;
    });
    return papers;
  }
}

