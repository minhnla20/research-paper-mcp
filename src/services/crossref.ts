import axios from "axios";
import { ResearchPaper } from "../types/paper.js";

export class CrossRefService {
  private baseUrl = "https://api.crossref.org/works";

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    const params = {
      query,
      rows: String(maxResults),
      sort: "score",
      order: "desc",
    } as const;
    const { data } = await axios.get(this.baseUrl, { params });
    const items = data?.message?.items || [];
    const papers: ResearchPaper[] = items.map((i: any) => {
      const title = Array.isArray(i.title) ? (i.title[0] || "").trim() : (i.title || "").trim();
      const authors = Array.isArray(i.author)
        ? i.author.map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean)
        : [];
      const year = Number(i.issued?.['date-parts']?.[0]?.[0] || i.created?.['date-parts']?.[0]?.[0] || new Date().getUTCFullYear());
      const doi: string | undefined = i.DOI;
      const url = i.URL || (doi ? `https://doi.org/${doi}` : "");
      const journal = Array.isArray(i['container-title']) ? i['container-title'][0] : i['container-title'];
      const publishedDate = new Date(`${year}-01-01`);
      return {
        id: doi ? `crossref:${doi}` : `crossref:${title}`,
        title,
        authors,
        year,
        source: 'crossref',
        journal,
        doi,
        url,
        isOpenAccess: false,
        keywords: [],
        abstract: undefined,
        citationCount: typeof i['is-referenced-by-count'] === 'number' ? i['is-referenced-by-count'] : undefined,
        publishedDate,
      } as ResearchPaper;
    });
    return papers;
  }
}

