> [🇰🇷 한국어](ONDEVICE_OLLAMA.md) | 🇺🇸 **English**

# 🖥️ On-Device AI (Ollama) — Setup & Troubleshooting

> Runs AgentGuard's layer 2 (intent analysis), interpretation, and chat **inside your computer, no internet**.
> The heart of on-device mode is that originals and prompts never leave the device.
> **Even without Ollama**, every feature works identically via the offline rule engine (Ollama only raises quality).
> For fully air-gapped import & verification, see [`AIRGAP.en.md`](AIRGAP.en.md).

## 1. Install (3 steps)

```bash
# 1) Install Ollama — https://ollama.com  (or)
curl -fsSL https://ollama.com/install.sh | sh

# 2) Run the server (usually auto-starts after install; otherwise)
ollama serve      # http://localhost:11434

# 3) Pull the model (first time only, small 4-bit ~2.5GB)
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

### 🟢 The easiest path — one button (no manual install)

Press **[Run on-device]** in `/settings` and everything below proceeds **automatically on click** (with a progress bar):

1. **Install Ollama** — via `brew` if present; otherwise the **official build is downloaded directly** (`~/.agentguard/`) → *no Homebrew required*
2. **`ollama serve` starts automatically**
3. **Qwen3 4B (unsloth 4bit, ~2.5GB) auto-pull** — if a chat model is already downloaded, it starts with that immediately (no extra download)
4. **Ready** → scan on-device

> 100% automatic for the installable version (running on your own machine). On cloud deployments success varies with GPU/permission limits.
> If you launch with `./install.sh` in a terminal, this button completes with local permissions.

## 2. Turning it on in AgentGuard

1. Open `/settings` (or the engine badge at the dashboard's top right)
2. Select the **🖥️ On-device (Ollama)** card
3. **[Connection test]** → ready when you see `✓ Connected · NNms · qwen3:8b`
4. The model dropdown **auto-loads installed models** (↻ button)

> Settings are stored only in the browser (localStorage) and shared by the dashboard, editor, and widget.
> The Chrome extension selects `on-device` separately in its popup, along with the server address.

## 3. What the code already handles (nothing for you to do)

| Item | Handling |
|---|---|
| **qwen3 thinking tokens** | `think: false` disables reasoning and returns only the answer (prevents empty responses). Falls back to the `thinking` field on older Ollama |
| **Long input truncation** | `num_ctx=8192` (tunable via `AG_OLLAMA_NUM_CTX`) — findings/document text won't be cut off |
| **Automatic model selection** | If the configured model (`qwen3:8b`) is missing, an installed chat model is used automatically (8B-class preferred), embedding models excluded |
| **Model not installed (404)** | One automatic retry with another installed model |
| **JSON parsing** | Even with code fences or chatter mixed in, `extract_json` leniently extracts the first JSON object |
| **Connection failure** | Automatic fallback to the offline rule engine (demo never stalls) |

## 4. Environment variables

```bash
AG_AI_PROVIDER=ollama                 # default reasoning engine (request headers take precedence)
AG_OLLAMA_URL=http://localhost:11434  # Ollama address
AG_OLLAMA_MODEL=hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M  # default model (small 4-bit ~2.5GB)
AG_OLLAMA_NUM_CTX=8192               # context length (raise for long documents)
AG_AI_TIMEOUT=20                     # seconds; raise if a large model's first response is slow
```

## 5. Troubleshooting

| Symptom | Cause · fix |
|---|---|
| Connection test `✗ failed` | Check that `ollama serve` is running and the port (11434). For remote hosts set `AG_OLLAMA_URL` |
| Judgments only show `⚙️ offline rules` | Ollama not connected → it fell back to rules. Start with the connection test above |
| Empty or weird responses | Usually the thinking issue → the code handles it with `think:false`. If it persists, reinstall via `ollama pull qwen3:8b` |
| Very slow first response | Model cold start. Raise `AG_AI_TIMEOUT` or use a smaller model (`qwen3:4b`) |
| Nonsense judgments on long documents | Raise `AG_OLLAMA_NUM_CTX=16384` |
| Out of memory | Pick a smaller model (`qwen3:4b`, `llama3.2:3b`) — auto-detected in settings |

## 6. Recommended models

| Use | Model | Notes |
|---|---|---|
| Default (on-device) | `hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M` | Qwen3 4B Instruct · 4bit ~2.5GB · good Korean & JSON · fast because non-thinking |
| Faster/lighter | `llama3.2:3b`, `qwen2.5:1.5b` | speed & memory first |
| Higher quality | `qwen2.5:7b`, `qwen3:8b` and up | when memory allows |

> AgentGuard auto-detects whichever model is installed. You can switch to cloud (Claude · OpenRouter) anytime,
> and even with none of the three it still works on offline rules.
