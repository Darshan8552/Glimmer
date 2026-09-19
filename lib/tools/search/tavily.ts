import type { SearchProvider, SearchResponse, SearchResult } from "./provider";

const TAVILY_URL = "https://api.tavily.com/search";
const TIMEOUT_MS = 15000;
const MAX_SNIPPET_CHARS = 500;

interface TavilyItem {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
}

interface TavilyBody {
  results?: unknown;
}

function toResult(item: TavilyItem): SearchResult | null {
  if (typeof item.url !== "string" || item.url.length === 0) return null;
  const title = typeof item.title === "string" && item.title.length > 0 ? item.title : item.url;
  const snippet =
    typeof item.content === "string" ? item.content.slice(0, MAX_SNIPPET_CHARS) : "";
  const score = typeof item.score === "number" ? item.score : undefined;
  return { title, url: item.url, snippet, score };
}

export function createTavilyProvider(apiKey?: string): SearchProvider {
  return {
    name: "tavily",
    async search(query: string, maxResults: number): Promise<SearchResponse> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      } else {
        headers["X-Tavily-Access-Mode"] = "keyless";
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(TAVILY_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query,
            max_results: maxResults,
            search_depth: "basic",
            include_answer: false,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as TavilyBody;
        const results: SearchResult[] = [];
        if (Array.isArray(data.results)) {
          for (const item of data.results) {
            if (results.length >= maxResults) break;
            if (!item || typeof item !== "object") continue;
            const parsed = toResult(item as TavilyItem);
            if (parsed) results.push(parsed);
          }
        }
        return { results };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
