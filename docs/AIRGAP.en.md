> [🇰🇷 한국어](AIRGAP.md) | 🇺🇸 **English**

# 🔌 Air-Gapped (Closed-Network) Operation Guide — the on-device boundary

> **The short answer:** model inference is 100% on-device. **With the "installable (local backend) +
> local Ollama" combination, everything — scan → judgment → interpretation → history — keeps working
> with the cable unplugged.** The internet is needed only for the initial import.

## 1. Data boundary by configuration (which combo is truly air-gapped)

| Combination | Do originals leave the device? | Air-gap | Notes |
|---|---|---|---|
| **Installable + Ollama** (recommended) | **Never** | ✅ fully supported | Rules, AI judgment, interpretation, history — all on-device |
| Extension + cloud backend + direct Ollama | Rule-scan content goes to the cloud | ❌ | A **convenience mode** where only interpretation is local — not air-gapped |
| Extension alone (no backend) | Never | ✅ | agscan.js rules only (no AI judgment) |

## 2. When the internet is needed — one-time provisioning only

1. **The Ollama installer** (macOS zip / Windows zip / Linux tar.zst — admin-free paths exist)
2. **The model file**, ~2.5GB (default: Qwen3 4B · unsloth 4-bit)
3. **Backend dependencies** — Python packages (FastAPI etc.). Pre-fetch with
   `pip download -r requirements.txt -d wheels/`, or copy the whole venv

After that, operation is **zero-network**. Updates come in the same way.

## 3. Import procedure (USB transfer)

```bash
# ── Prepare outside (with internet) ──
# ① repo + dependencies
git clone https://github.com/LCO-L/AgentGuard && cd AgentGuard
pip download -r requirements.txt -d wheels/
# ② Ollama installer for your OS — https://ollama.com/download
# ③ the model GGUF directly (HuggingFace: unsloth/Qwen3-4B-Instruct-2507-GGUF, Q4_K_M)

# ── Install inside the closed network ──
pip install --no-index --find-links wheels/ -r requirements.txt
# After installing Ollama:
cat > Modelfile <<'EOF'
FROM ./Qwen3-4B-Instruct-2507-Q4_K_M.gguf
EOF
ollama create qwen3-4b-local -f Modelfile     # create the model from a local file — no registry needed
AG_OLLAMA_MODEL=qwen3-4b-local python app.py  # http://localhost:8000
```

## 4. How to verify (for procurement/security review demos)

1. Cut the network (airplane mode / unplug / block all outbound at the firewall)
2. `python app.py` → open the dashboard → run every demo chip → confirm 🔴/🟢 verdicts
3. Settings → on-device connection test → confirm `✓ Connected` (judgment via local Ollama)
4. Confirm history accumulating locally in `/audit`
5. (Optional) `AG_AI_PROVIDER=off python scripts/bench_scenarios.py` — reproduce the benchmark fully offline

## 5. Also worth knowing

- **The no-storage principle holds locally too** — originals and masking mappings never enter history (metadata only)
- Worried about cloud fallback? Pin `AG_AI_PROVIDER=ollama` — Claude/OpenRouter are never even attempted
- The browser extension stays inside the same boundary by pointing its backend address at `http://localhost:8000`
- Enterprise angle: this configuration *is* the **on-prem deployment** — a single backend + Ollama, one day to install
