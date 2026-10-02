import { LMStudioClient } from "@lmstudio/sdk";
import { ResearchPaper } from "../types/paper.js";

export class LMStudioService {
  private client: LMStudioClient;
  private modelKey: string;

  constructor(options?: { baseUrl?: string; model?: string }) {
    let baseUrl = options?.baseUrl || process.env.LMSTUDIO_BASE_URL;
    if (!baseUrl) {
      throw new Error("❌ LMStudio base URL is not configured. Please set LMSTUDIO_BASE_URL in your environment.");
    }

    // Normalize HTTP/HTTPS or raw host to WebSocket URL for @lmstudio/sdk if needed
    if (baseUrl.startsWith('https://')) {
      baseUrl = baseUrl.replace(/^https:\/\//, 'wss://');
    } else if (baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace(/^http:\/\//, 'ws://');
    } else if (!baseUrl.startsWith('ws://') && !baseUrl.startsWith('wss://')) {
      baseUrl = `wss://${baseUrl}`;
    }

    // Strip trailing /v1 or slashes as @lmstudio/sdk expects the root websocket base
    baseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '');

    this.modelKey = options?.model || process.env.LMSTUDIO_MODEL || 'google/gemma-4-e4b';
    this.client = new LMStudioClient({ baseUrl });
  }

  async generateSummary(
    paper: ResearchPaper,
    type: 'brief' | 'detailed' | 'methodology' | 'findings'
  ): Promise<string> {
    const prompt = this.buildSummaryPrompt(paper, type);

    try {
      const model = await this.client.llm.model(this.modelKey, { verbose: false });
      const prediction = await model.respond(
        [
          {
            role: 'system',
            content: 'You are an academic summarizer. Output only the final concise summary. Do not output internal thoughts or analysis.'
          },
          { role: 'user', content: prompt }
        ],
        {
          maxTokens: type === 'brief' ? 800 : 1500,
          temperature: 0.3,
        }
      );

      // Prefer nonReasoningContent from LMStudio SDK if model produces reasoning/thought tokens
      const text = (prediction.nonReasoningContent || prediction.content || '')
        .replace(/<\|channel\>thought[\s\S]*?(?:<channel\|>|<\|channel\>|$)/gi, '')
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .trim();

      return text;
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error occurred';
      throw new Error(`LMStudio SDK generation failed (model: ${this.modelKey}): ${errorMsg}`);
    }
  }

  private buildSummaryPrompt(paper: ResearchPaper, type: string): string {
    const content = paper.fullText 
      ? `Full Paper Text:\n${paper.fullText.slice(0, 12000)}\n\n[Abstract]:\n${paper.abstract ?? ''}`
      : `Abstract:\n${paper.abstract ?? 'No abstract provided'}`;
    const baseInfo = `Title: ${paper.title}\nAuthors: ${paper.authors.join(', ')}\n\n${content}`;
    switch (type) {
      case 'detailed':
        return `${baseInfo}\n\nProvide a comprehensive, detailed summary covering the problem, methodology, key findings, and technical implications:`;
      case 'methodology':
        return `${baseInfo}\n\nFocus specifically on summarizing the research methodology, system design, and experimental approach:`;
      case 'findings':
        return `${baseInfo}\n\nSummarize the key findings, benchmark results, and conclusions:`;
      case 'brief':
      default:
        return `${baseInfo}\n\nProvide a concise 2-3 sentence summary of this research paper's main contribution:`;
    }
  }
}
