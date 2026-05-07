type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

export const config = {
  runtime: "nodejs",
};

const buildSystemPrompt = (snapshot: string) =>
  [
    "You are Shalit Care Copilot, a calm clinic operations assistant for Shalit Afia.",
    "Help clinic owners and staff understand sales, stock, patients, payments, profit, and growth opportunities.",
    "Use the clinic snapshot and recent conversation for context.",
    "Be concise, practical, and friendly.",
    "Give clear next steps when the user asks for analysis.",
    "Do not invent data that is not in the snapshot.",
    "Prefer short paragraphs or bullets.",
    `Clinic snapshot:\n${snapshot || "No clinic snapshot was provided."}`,
  ].join(" ");

const normalizeMessages = (messages: unknown): ChatMessage[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message: unknown): message is ChatMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as ChatMessage;
      return (
        (candidate.role === "user" || candidate.role === "assistant" || candidate.role === "system") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-8);
};

const toGeminiRole = (role: ChatMessage["role"]) => (role === "assistant" ? "model" : "user");

const readBody = (body: unknown) => {
  if (typeof body !== "string") return body ?? {};

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Gemini API key is not configured. Set GEMINI_API_KEY in the Vercel project environment variables, then redeploy.",
    });
  }

  const body = readBody(req.body);
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const snapshot = typeof body.snapshot === "string" ? body.snapshot : "";
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const messages = normalizeMessages(body.messages);

  if (!prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const contents = [
    ...messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }],
    })),
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ];

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemPrompt(snapshot) }],
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 700,
          },
        }),
      },
    );

    const data = (await geminiResponse.json()) as GeminiResponse;

    if (!geminiResponse.ok) {
      return res.status(502).json({
        error: data.error?.message || `Gemini request failed with status ${geminiResponse.status}`,
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({ error: "Gemini returned an empty response." });
    }

    return res.status(200).json({ reply, model, provider: "gemini" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini error.";
    return res.status(502).json({ error: message });
  }
}
