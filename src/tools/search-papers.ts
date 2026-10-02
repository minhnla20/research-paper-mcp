import { ResearchPaper, SearchFilters } from "../types/paper.js";

// Placeholder service interfaces for Phase 1
interface PaperSearchService {
  search(query: string, maxResults: number): Promise<ResearchPaper[]>;
}

function applyFilters(papers: ResearchPaper[], filters: SearchFilters): ResearchPaper[] {
  const { yearFrom, yearTo, journals, openAccessOnly, minCitations } = filters;
  return papers.filter((p) => {
    if (typeof yearFrom === "number" && p.year < yearFrom) return false;
    if (typeof yearTo === "number" && p.year > yearTo) return false;
    if (openAccessOnly && !p.isOpenAccess) return false;
    if (typeof minCitations === "number" && (p.citationCount ?? 0) < minCitations) return false;
    if (journals && journals.length > 0 && p.journal && !journals.includes(p.journal)) return false;
    return true;
  });
}

function removeDuplicates(papers: ResearchPaper[]): ResearchPaper[] {
  const seen = new Map<string, ResearchPaper>();
  for (const paper of papers) {
    const key = paper.doi?.toLowerCase() || `${paper.title.toLowerCase()}::${paper.year}`;
    if (!seen.has(key)) seen.set(key, paper);
  }
  return Array.from(seen.values());
}

function sortResults(papers: ResearchPaper[], sortBy: SearchFilters["sortBy"]): ResearchPaper[] {
  const copy = papers.slice();
  switch (sortBy) {
    case "date":
      return copy.sort((a, b) => (b.publishedDate?.getTime?.() || 0) - (a.publishedDate?.getTime?.() || 0));
    case "citations":
      return copy.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    case "relevance":
    default:
      return copy; // keep incoming order as relevance proxy
  }
}

export async function searchPapers(args: {
  query: string;
  filters?: SearchFilters;
  services?: PaperSearchService[]; // for DI/testing
}): Promise<{ papers: ResearchPaper[] }> {
  const { query, filters = {}, services = [] } = args;
  const results: ResearchPaper[] = [];

  if (services.length === 0) {
    // Default services: arXiv + IEEE + Springer
    let ArxivCtor: new () => PaperSearchService;
    let IEEECtor: new (apiKey: string) => PaperSearchService;
    let SpringerCtor: new (apiKey: string) => PaperSearchService;
    let PubMedCtor: new () => PaperSearchService;
    let CrossRefCtor: new () => PaperSearchService;
    try {
      const mod = await import("../services/arxiv.js");
      ArxivCtor = mod.ArxivService as unknown as new () => PaperSearchService;
    } catch {
      ArxivCtor = class {
        async search(): Promise<ResearchPaper[]> { return []; }
      } as unknown as new () => PaperSearchService;
    }
    try {
      const mod = await import("../services/ieee.js");
      IEEECtor = mod.IEEEService as unknown as new (apiKey: string) => PaperSearchService;
    } catch {
      IEEECtor = class { constructor(_: string) {} async search(): Promise<ResearchPaper[]> { return []; } } as unknown as new (apiKey: string) => PaperSearchService;
    }
    try {
      const mod = await import("../services/springer.js");
      SpringerCtor = mod.SpringerService as unknown as new (apiKey: string) => PaperSearchService;
    } catch {
      SpringerCtor = class { constructor(_: string) {} async search(): Promise<ResearchPaper[]> { return []; } } as unknown as new (apiKey: string) => PaperSearchService;
    }
    try {
      const mod = await import("../services/pubmed.js");
      PubMedCtor = mod.PubMedService as unknown as new () => PaperSearchService;
    } catch {
      PubMedCtor = class { async search(): Promise<ResearchPaper[]> { return []; } } as unknown as new () => PaperSearchService;
    }
    try {
      const mod = await import("../services/crossref.js");
      CrossRefCtor = mod.CrossRefService as unknown as new () => PaperSearchService;
    } catch {
      CrossRefCtor = class { async search(): Promise<ResearchPaper[]> { return []; } } as unknown as new () => PaperSearchService;
    }
    const arxiv = new ArxivCtor();
    const ieee = new IEEECtor(process.env.IEEE_API_KEY || "");
    const springer = new SpringerCtor(process.env.SPRINGER_API_KEY || "");
    const pubmed = new PubMedCtor();
    const crossref = new CrossRefCtor();
    services.push(arxiv, ieee, springer, pubmed, crossref);
  }

  const maxResults = filters.maxResults || 20;
  const searchPromises = services.map((svc) => svc.search(query, maxResults));
  const allResults = await Promise.allSettled(searchPromises);

  for (const r of allResults) {
    if (r.status === "fulfilled") results.push(...r.value);
  }

  const filtered = applyFilters(results, filters);
  const deduped = removeDuplicates(filtered);
  const sorted = sortResults(deduped, filters.sortBy);

  return { papers: sorted };
}

