# Installation Guide / Guía de instalación

## Requirements / Requisitos

- Claude Code (Desktop or CLI) — any recent version
- Git (for clone method)
- bash or PowerShell (for install scripts)
- No other runtime dependencies — `.vibe/` memory is plain Markdown

---

## Method 1 — Git clone (recommended)

```bash
# Clone the package
git clone <repo-url> vibecodeprotocols
cd vibecodeprotocols

# Install (macOS/Linux/WSL)
chmod +x scripts/install.sh
./scripts/install.sh

# Install (Windows PowerShell)
.\scripts\install.ps1
```

Optional: specify a custom install directory:
```bash
./scripts/install.sh ~/.claude/skills/my-skills
```

---

## Method 2 — Download zip

1. Download `vibecodeprotocols-<version>.zip`
2. Extract: `unzip vibecodeprotocols-<version>.zip`
3. Enter directory: `cd vibecodeprotocols`
4. Run installer (see Method 1 commands above)

---

## Method 3 — Manual copy

If scripts don't work on your system:

```bash
# Copy master skill
cp SKILL.md ~/.claude/skills/VibeCodeProtocols.md

# Copy sub-skills
mkdir -p ~/.claude/skills/vcp-skills
cp -r skills/. ~/.claude/skills/vcp-skills/

# Init .vibe/ in your project (run from project root)
mkdir -p .vibe/sessions .vibe/receipts .vibe/handoffs
cp templates/vibe/* .vibe/
```

---

## Post-install

1. **Restart Claude Code** — skills load at startup
2. **Verify** — in Claude Code, type `/` and look for `VibeCodeProtocols` in the list
3. **Initialize memory** — run from your project root:
   ```bash
   ./scripts/vibe-memory.sh init
   ```
   Or let VibeCodeProtocols create `.vibe/` automatically on first use.

---

## Uninstall

```bash
rm ~/.claude/skills/VibeCodeProtocols.md
rm -rf ~/.claude/skills/vcp-skills/
rm -rf ~/.claude/vcp-scripts/
# Keep .vibe/ in your project — it contains project memory
```

---

## Troubleshooting

**Skill not appearing in `/` menu:**
- Restart Claude Code completely
- Check that `VibeCodeProtocols.md` is in `~/.claude/skills/` (not a subdirectory)

**Sub-skills not found:**
- Verify `~/.claude/skills/vcp-skills/` contains all 10 `.md` files
- The orchestrator reads them via `Read` tool — path must be accessible

**`.vibe/` init failed:**
- Run `./scripts/vibe-memory.sh init` from your project root
- Or manually: `mkdir -p .vibe/sessions && cp templates/vibe/* .vibe/`
