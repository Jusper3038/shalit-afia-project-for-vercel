type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const buildSystemPrompt = (snapshot: string) =>
  [
    "You are a helpful clinic operations assistant for Shalit Afia.",
    "Your job is to help the owner understand sales, stock, patients, payments, profit, and growth opportunities.",
    "Be concise, practical, and friendly.",
    "Use the clinic snapshot and recent conversation for context.",
    "If a user asks for analysis, give actionable advice, not generic AI filler.",
    "If the data does not support a claim, say so plainly.",
    "Prefer short paragraphs or bullets.",
    `Clinic snapshot:\n${snapshot || "No clinic snapshot was provided."}`,
  ].join(" ");

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const snapshot = typeof body.snapshot === "string" ? body.snapshot : "";
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : process.env.OLLAMA_MODEL || "llama3.1:8b";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

  if (!prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const forwardMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(snapshot),
    },
    ...messages
      .filter((message: unknown): message is ChatMessage => {
        if (!message || typeof message !== "object") return false;
        const candidate = message as ChatMessage;
        return (
          (candidate.role === "user" || candidate.role === "assistant" || candidate.role === "system") &&
          typeof candidate.content === "string" &&
          candidate.content.trim().length > 0
        );
      })
      .slice(-6),
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: forwardMessages,
      }),
    });

    if (!ollamaResponse.ok) {
      const text = await ollamaResponse.text();
      return res.status(502).json({
        error: `Ollama request failed with status ${ollamaResponse.status}`,
        detail: text,
      });
    }

    const data = (await ollamaResponse.json()) as { message?: { content?: string } };
    const reply = data.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: "Ollama returned an empty response." });
    }

    return res.status(200).json({ reply, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ollama error.";
    return res.status(502).json({ error: message });
  }
}
