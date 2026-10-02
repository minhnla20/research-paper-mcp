import { ResearchPaper } from "../types/paper.js";

function formatBibTeX(p: ResearchPaper): string {
  const key = (p.doi || `${p.authors?.[0] || 'unknown'}_${p.year}_${p.title.slice(0,20)}`).replace(/[^a-zA-Z0-9_:\-]/g, "");
  return `@article{${key},\n  title={${p.title}},\n  author={${p.authors.join(' and ')}},\n  year={${p.year}},\n  journal={${p.journal ?? ''}},\n  doi={${p.doi ?? ''}}\n}`;
}

export async function exportCitations(args: {
  papers: ResearchPaper[];
  format: "bibtex" | "apa" | "ieee" | "mla";
}): Promise<{ citations: string[] }> {
  const { papers, format } = args;
  const citations = papers.map((p) => {
    switch (format) {
      case "bibtex":
        return formatBibTeX(p);
      case "apa":
        return `${p.authors.join(', ')} (${p.year}). ${p.title}. ${p.journal ?? ''}. ${p.doi ?? ''}`.trim();
      case "ieee":
        return `${p.authors.join(', ')}, "${p.title}," ${p.journal ?? ''}, ${p.year}. ${p.doi ?? ''}`.trim();
      case "mla":
        return `${p.authors.join(', ')}. "${p.title}." ${p.journal ?? ''}, ${p.year}. ${p.doi ?? ''}`.trim();
      default:
        return formatBibTeX(p);
    }
  });
  return { citations };
}

