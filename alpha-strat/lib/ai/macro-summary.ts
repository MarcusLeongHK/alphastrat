import { generateCompletion } from "./client";
import type { MacroCategory } from "@/lib/market/rss";

export interface MacroOutlook {
  sentimentLabel: "Bullish" | "Cautious" | "Bearish" | "Mixed";
  headline: string;
  keyDrivers: string[];
}

export interface MacroSummaryResult {
  categories: { id: string; oneLiner: string; summary: string }[];
  macroOutlook: MacroOutlook;
}

const MACRO_SYSTEM_PROMPT = `You are a macro-economic analyst writing for sophisticated investors. Given recent news headlines grouped by category, produce a JSON response with:

1. "categories" — an array where each entry has:
   - "id" (matching the category ID provided)
   - "oneLiner" (one sentence headline-style summary of the category, max 15 words)
   - "summary" (a thorough 4-6 sentence analysis — not a list of headlines, but what they mean for markets)
2. "macroOutlook" — an object with:
   - "sentimentLabel": one of "Bullish", "Cautious", "Bearish", or "Mixed"
   - "headline": one sentence cross-category synthesis (max 20 words)
   - "keyDrivers": array of 3-5 short phrases (2-5 words each) identifying the key macro drivers

Write with conviction. Be specific about implications. No hedging language. Every sentence should add signal.

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
      categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
      macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
    };
  }

  try {
    const userPrompt = buildMacroUserPrompt(categories);
    const raw = await generateCompletion(MACRO_SYSTEM_PROMPT, userPrompt, "gemini");

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as MacroSummaryResult;

    if (!parsed.categories || !parsed.macroOutlook || typeof parsed.macroOutlook === "string") {
      console.warn("[macro-summary] unexpected AI response shape");
      return {
        categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
        macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
      };
    }

    return parsed;
  } catch (err) {
    console.warn("[macro-summary] AI generation failed:", err instanceof Error ? err.message : err);
    return {
      categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
      macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
    };
  }
}
