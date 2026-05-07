export const config = {
  runtime: "nodejs",
};

export default function handler(_req: unknown, res: any) {
  const configured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

  return res.status(configured ? 200 : 503).json({
    provider: "gemini",
    configured,
    requiredEnvironmentVariable: "GEMINI_API_KEY",
    message: configured
      ? "Gemini is configured for this deployment."
      : "Gemini is not configured. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.",
  });
}
