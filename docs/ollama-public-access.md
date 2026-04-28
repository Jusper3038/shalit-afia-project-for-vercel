# Ollama Public Access

This project uses Ollama through the `/api/ollama` server route.

## Recommended setup

Use a tunnel so Ollama stays on your machine and still gets a public URL.

### 1. Install Ollama

Download and install Ollama on the machine that will run the model:

https://docs.ollama.com/

### 2. Pull a model

```powershell
ollama pull llama3.1:8b
```

### 3. Start Ollama

Open Ollama or run the server the normal way for your platform.

### 4. Start a tunnel

```powershell
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"
```

Cloudflare Tunnel will print a public HTTPS address. That is the value to use for `OLLAMA_BASE_URL`.

### 5. Set Vercel env vars

Add these to the Vercel project:

- `OLLAMA_BASE_URL` = your tunnel URL
- `OLLAMA_MODEL` = `llama3.1:8b` or another model you have pulled

### 6. Redeploy

After the env vars are added, redeploy the Vercel project.

## Notes

- Do not use `localhost` for production.
- If the tunnel is down, the chatbot will fall back to the built-in clinic logic.
- If you later move Ollama to a VPS, you can keep the same app code and only change `OLLAMA_BASE_URL`.
