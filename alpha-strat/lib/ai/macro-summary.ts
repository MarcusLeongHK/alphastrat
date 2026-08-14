import { generateCompletion } from "./client";
import type { MacroCategory } from "@/lib/market/rss";

export interface MacroSummaryResult {
  categories: { id: string; summary: string }[];
  macroOutlook: string;
}

const MACRO_SYSTEM_PROMPT = `You are a macro-economic analyst writing for sophisticated investors. Given recent news headlines grouped by category, produce a JSON response with:

1. "categories" — an array where each entry has "id" (matching the category ID provided) and "summary" (a thorough 4-6 sentence analysis of that category's headlines — not a list of headlines, but what they mean for markets. Cover the key themes, name specific data points or events, explain why they matter for positioning, and flag the risks or catalysts to watch)
2. "macroOutlook" — a 5-7 sentence cross-category synthesis connecting themes across all categories, identifying contradictions between policy signals and market data, noting sector rotation implications, and highlighting what sophisticated investors should be positioning for or hedging against

Write with conviction. Be specific about implications — name sectors, asset classes, and directional calls where the data supports them. No hedging language like "could potentially" or "it remains to be seen." Every sentence should add signal, not filler.

Respond with valid JSON only, no markdown fences.`;

function buildMacroUserPrompt(categories: MacroCategory[]): string {
  const sections = categories
    .filter((c) => c.articles.length > 0)
    .map((c) => {
      const headlines = c.articles
        .slice(0, 10)
        .map((a) => `- ${a.title}`)
        .join("\n");
      return `## ${c.label} (${c.id})\n${headlines}`;
    })
    .join("\n\n");

  return sections || "No recent headlines available across any category.";
}

export async function generateMacroSummary(
  categories: MacroCategory[]
): Promise<MacroSummaryResult> {
  const hasArticles = categories.some((c) => c.articles.length > 0);
  if (!hasArticles) {
    return {
      categories: categories.map((c) => ({ id: c.id, summary: "" })),
      macroOutlook: "",
    };
  }

  try {
    const userPrompt = buildMacroUserPrompt(categories);
    const raw = await generateCompletion(MACRO_SYSTEM_PROMPT, userPrompt, "gemini");

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as MacroSummaryResult;

    if (!parsed.categories || !parsed.macroOutlook) {
      console.warn("[macro-summary] unexpected AI response shape");
      return {
        categories: categories.map((c) => ({ id: c.id, summary: "" })),
        macroOutlook: "",
      };
    }

    return parsed;
  } catch (err) {
    console.warn("[macro-summary] AI generation failed:", err instanceof Error ? err.message : err);
    return {
      categories: categories.map((c) => ({ id: c.id, summary: "" })),
      macroOutlook: "",
    };
  }
}
