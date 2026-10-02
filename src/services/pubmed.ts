import axios from "axios";
import { ResearchPaper } from "../types/paper.js";

interface PubMedSearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

interface PubMedSummaryResponse {
  result?: {
    uids?: string[];
    [uid: string]: any;
  };
}

export class PubMedService {
  private esearchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  private esummaryUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

  async search(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    const ids = await this.searchIds(query, maxResults);
    if (ids.length === 0) return [];
    const summaries = await this.fetchSummaries(ids);
    return this.mapSummariesToPapers(summaries);
  }

  private async searchIds(query: string, maxResults: number): Promise<string[]> {
    const params = {
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: String(maxResults),
    } as const;
    const { data } = await axios.get<PubMedSearchResponse>(this.esearchUrl, { params });
    return data?.esearchresult?.idlist || [];
  }

  private async fetchSummaries(ids: string[]): Promise<PubMedSummaryResponse> {
    const params = {
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
    } as const;
    const { data } = await axios.get<PubMedSummaryResponse>(this.esummaryUrl, { params });
    return data || {};
  }

  private mapSummariesToPapers(summary: PubMedSummaryResponse): ResearchPaper[] {
    const uids = summary.result?.uids || [];
    const papers: ResearchPaper[] = uids.map((uid) => {
      const item = summary.result?.[uid] || {};
      const title: string = (item.title || "").trim();
      const authors = Array.isArray(item.authors)
        ? item.authors.map((a: any) => a.name).filter(Boolean)
        : [];
      const pubdate: string = item.pubdate || `${new Date().getUTCFullYear()}`;
      const year = Number((pubdate.match(/\d{4}/) || [String(new Date().getUTCFullYear())])[0]);
      const journal: string | undefined = item.fulljournalname || item.source;
      const doi: string | undefined = Array.isArray(item.articleids)
        ? (item.articleids.find((id: any) => id.idtype === "doi")?.value)
        : undefined;
      const url = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${uid}/`;
      const publishedDate = new Date(`${year}-01-01`);
      return {
        id: `pubmed:${uid}`,
        title,
        authors,
        year,
        source: 'pubmed',
        journal,
        doi,
        url,
        isOpenAccess: false,
        keywords: [],
        abstract: undefined,
        citationCount: undefined,
        publishedDate,
      } as ResearchPaper;
    });
    return papers;
  }
}

