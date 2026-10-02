import fs from "node:fs/promises";
import path from "node:path";
import { ResearchPaper } from "../types/paper.js";

export async function saveToWorkspace(args: {
  papers: ResearchPaper[];
  workspace: "notion" | "owncloud" | "local";
  workspaceConfig?: Record<string, unknown>;
}): Promise<{ saved: number }> {
  const { papers, workspace, workspaceConfig } = args;
  switch (workspace) {
    case "local": {
      const baseDir = String(workspaceConfig?.baseDir || "./workspace");
      await fs.mkdir(baseDir, { recursive: true });
      for (const p of papers) {
        const file = path.join(baseDir, `${p.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
        await fs.writeFile(file, JSON.stringify(p, null, 2), "utf-8");
      }
      return { saved: papers.length };
    }
    case "notion":
    case "owncloud":
      // Phase 4: implement real integrations
      return { saved: 0 };
    default:
      return { saved: 0 };
  }
}

