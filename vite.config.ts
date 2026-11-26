import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiRequest, ApiResponse } from "./api/http";

const vendorChunkGroups: Record<string, string[]> = {
  supabase: ["@supabase"],
  charts: ["recharts"],
  query: ["@tanstack"],
  router: ["react-router", "@remix-run"],
  icons: ["lucide-react"],
};

const readRequestBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const localApiPlugin = (): Plugin => ({
  name: "local-api-routes",
  configureServer(server) {
    type LocalApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<unknown>;
    const handlers: Record<string, () => Promise<{ default: LocalApiHandler }>> = {
      "/api/gemini": () => import("./api/gemini"),
      "/api/ollama": () => import("./api/ollama"),
    };

    server.middlewares.use(async (req, res, next) => {
      const pathname = req.url?.split("?")[0] || "";
      const loadHandler = handlers[pathname];

      if (!loadHandler) {
        next();
        return;
      }

      try {
        const body = await readRequestBody(req);
        const { default: handler } = await loadHandler();
        const response = {
          statusCode: 200,
          setHeader: (name: string, value: string) => res.setHeader(name, value),
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(payload: unknown) {
            sendJson(res, this.statusCode, payload);
          },
        };

        await handler({ ...req, body }, response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local API route failed.";
        sendJson(res, 500, { error: message });
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    server: {
      host: "::",
      port: 4173,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger(), localApiPlugin()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("/node_modules/pdfjs-dist/")) return "invoice-pdf";
            if (id.includes("/node_modules/tesseract.js/") || id.includes("/node_modules/tesseract.js-core/")) return "invoice-ocr";

            for (const [chunkName, markers] of Object.entries(vendorChunkGroups)) {
              if (markers.some((marker) => id.includes(marker))) {
                return chunkName;
              }
            }

            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
  };
});
