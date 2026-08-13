type Provider = "groq" | "gemini";

interface ProviderConfig {
  url: string;
  apiKey: string | undefined;
  buildBody: (system: string, user: string) => Record<string, unknown>;
  extractText: (json: Record<string, unknown>) => string;
}

function getProviderConfig(provider: Provider): ProviderConfig {
  const configs: Record<Provider, ProviderConfig> = {
    groq: {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY,
      buildBody: (system, user) => ({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      extractText: (json) => {
        const choices = json.choices as Array<{
          message: { content: string };
        }>;
        return choices?.[0]?.message?.content ?? "";
      },
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      apiKey: process.env.GEMINI_API_KEY,
      buildBody: (system, user) => ({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.3,
        },
      }),
      extractText: (json) => {
        const candidates = json.candidates as Array<{
          content: { parts: Array<{ text: string }> };
        }>;
        return candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      },
    },
  };

  return configs[provider];
}

export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  provider: Provider = "groq"
): Promise<string> {
  const config = getProviderConfig(provider);

  if (!config.apiKey) {
    throw new Error(
      `Missing API key for ${provider}. Set ${provider === "groq" ? "GROQ_API_KEY" : "GEMINI_API_KEY"} in your .env file.`
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "groq") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(config.buildBody(systemPrompt, userPrompt)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider} API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return config.extractText(json);
}
