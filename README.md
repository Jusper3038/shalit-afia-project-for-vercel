# Welcome to your  project

## Run locally

Install dependencies:

```powershell
npm.cmd install
```

Start the Vite dev server:

```powershell
npm.cmd run dev
```

Local app URL:

```text
http://127.0.0.1:4173
```

## Ollama setup for customers anywhere

The chatbot now calls a server route at `/api/ollama`, and that server route needs a public Ollama URL in `OLLAMA_BASE_URL`.

The easiest setup is:

1. Install Ollama on the machine that will run the model.
2. Pull a model:

```powershell
ollama pull llama3.1:8b
```

3. Start Ollama locally.
4. Expose it with a tunnel so it has a public HTTPS URL.

Example with Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"
```

5. Copy the public tunnel URL.
6. Add that URL to your Vercel environment variables as `OLLAMA_BASE_URL`.
7. Keep `OLLAMA_MODEL=llama3.1:8b` unless you want a different model.

Important:

- `OLLAMA_BASE_URL` goes in Vercel, not in the browser.
- Do not point it at `localhost` for production.
- The app will call your public tunnel, and the tunnel forwards to Ollama on your machine.

If you want to use a VPS instead, the same app code works. You would just set `OLLAMA_BASE_URL` to the VPS URL instead of a tunnel URL.
