export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: 'arxiv' | 'ieee' | 'springer' | 'pubmed' | 'crossref';
  journal?: string;
  doi?: string;
  url: string;
  pdfUrl?: string;
  abstract?: string;
  summary?: string;
  citationCount?: number;
  isOpenAccess: boolean;
  keywords: string[];
  publishedDate: Date;
}

export interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  journals?: string[];
  openAccessOnly?: boolean;
  minCitations?: number;
  maxResults?: number;
  sortBy?: 'relevance' | 'date' | 'citations';
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sources?: string[];
}

