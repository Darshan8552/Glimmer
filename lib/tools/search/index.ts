import { tool } from "ai";
import { z } from "zod";
import type { SearchProvider } from "./provider";
import { createTavilyProvider } from "./tavily";

let provider: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (!provider) {
    provider = createTavilyProvider(process.env.TAVILY_API_KEY || undefined);
  }
  return provider;
}

export function setSearchProvider(next: SearchProvider | null) {
  provider = next;
}

export const webSearch = tool({
  description:
    "Search the web for current or external facts the model does not know. " +
    "Use when the question needs up-to-date information, recent events, or " +
    "specific real-world data. Returns ranked titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().min(3).max(300),
    maxResults: z.number().int().min(1).max(5).default(5),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const { results } = await getSearchProvider().search(query, maxResults);
      if (results.length === 0) return "No results found.";
      return results
        .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`)
        .join("\n\n");
    } catch (e) {
      return `Web search is unavailable right now: ${e instanceof Error ? e.message : "request failed"}`;
    }
  },
});

export const chatTools = { webSearch };
