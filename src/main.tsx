import { createRoot } from "react-dom/client";
import { createElement } from "react";
import "./index.css";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const root = createRoot(document.getElementById("root")!);
const renderStartupScreen = (title: string, message: string, showRetry = false) => {
  root.render(
    createElement(
      "main",
      {
        style: {
          boxSizing: "border-box",
          minHeight: "100vh",
          padding: "24px",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        },
      },
      createElement(
        "section",
        {
          style: {
            width: "min(100%, 520px)",
            padding: "32px",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            background: "white",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            lineHeight: 1.6,
            textAlign: "center",
          },
        },
        createElement("h1", { style: { margin: "0 0 12px", fontSize: "22px" } }, title),
        createElement("p", { style: { margin: 0, color: "#475569" } }, message),
        showRetry && createElement(
          "button",
          {
            type: "button",
            onClick: () => window.location.reload(),
            style: {
              marginTop: "20px",
              padding: "10px 16px",
              border: 0,
              borderRadius: "8px",
              background: "#0f172a",
              color: "white",
              font: "inherit",
              cursor: "pointer",
            },
          },
          "Reload app"
        )
      )
    )
  );
};
const missingSupabaseSettings = [
  ["VITE_SUPABASE_URL", SUPABASE_URL],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY],
].filter(([, value]) => !value);

if (missingSupabaseSettings.length > 0) {
  root.render(
    createElement(
      "main",
      {
        style: {
          boxSizing: "border-box",
          minHeight: "100vh",
          padding: "48px 24px",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        },
      },
      createElement(
        "section",
        {
          style: {
            boxSizing: "border-box",
            width: "min(100%, 620px)",
            padding: "32px",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            background: "white",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            lineHeight: 1.6,
          },
        },
        createElement("h1", { style: { margin: "0 0 12px", fontSize: "24px" } }, "Supabase setup required"),
        createElement(
          "p",
          null,
          "This project needs its Supabase connection settings before it can load. Add them to a .env.local file in the project folder, then restart the dev server."
        ),
        createElement(
          "pre",
          {
            style: {
              overflowX: "auto",
              padding: "16px",
              borderRadius: "8px",
              background: "#f1f5f9",
              fontSize: "14px",
            },
          },
          "VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key"
        ),
        createElement(
          "p",
          { style: { marginBottom: 0, color: "#475569", fontSize: "14px" } },
          "Use the project URL and publishable key from your Supabase project settings. Do not put a service role secret in this file."
        )
      )
    )
  );
} else {
  renderStartupScreen("Loading SHALIT AFIA…", "Connecting to your clinic workspace.");
  void import("./App.tsx").then(({ default: App }) => {
    root.render(createElement(App));
  }).catch((error: unknown) => {
    console.error("Application failed to start", error);
    renderStartupScreen(
      "The app could not start",
      "Check your connection, then reload the app. If the problem continues, contact your system owner.",
      true
    );
  });
}
