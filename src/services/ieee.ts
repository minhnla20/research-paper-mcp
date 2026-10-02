import axios from "axios";
import { ResearchPaper } from "../types/paper.js";

export class IEEEService {
  private baseUrl = "https://ieeexploreapi.ieee.org/api/v1/search/articles";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    if (!this.apiKey) return [];
    const params = {
      apikey: this.apiKey,
      querytext: query,
      max_records: String(maxResults),
      start_record: "1",
      sort_order: "desc",
      sort_field: "article_number",
      format: "json",
    } as const;
    const { data } = await axios.get(this.baseUrl, { params });
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    const papers: ResearchPaper[] = articles.map((a: any) => {
      const title = (a.title || "").trim();
      const authors = Array.isArray(a.authors?.authors)
        ? a.authors.authors.map((au: any) => au.full_name).filter(Boolean)
        : [];
      const year = Number(a.publication_year || a.published_year || new Date().getUTCFullYear());
      const url = a.html_url || a.mdurl || a.pdf_url || "";
      const publishedDate = a.pdf_url || a.html_url ? new Date(`${year}-01-01`) : new Date(`${year}-01-01`);
      return {
        id: a.doi ? `ieee:${a.doi}` : `ieee:${a.article_number || title}`,
        title,
        authors,
        year,
        source: 'ieee',
        journal: a.publication_title,
        doi: a.doi,
        url,
        pdfUrl: a.pdf_url,
        abstract: a.abstract,
        isOpenAccess: Boolean(a.openaccess) || false,
        keywords: Array.isArray(a.index_terms?.ieee_terms?.terms)
          ? a.index_terms.ieee_terms.terms
          : [],
        citationCount: typeof a.citation_count === 'number' ? a.citation_count : undefined,
        publishedDate,
      } as ResearchPaper;
    });
    return papers;
  }
}

