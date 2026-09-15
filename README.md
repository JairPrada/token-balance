# @openplugins/token-balance

OpenCode sidebar plugin: DeepSeek, OpenCode Go, and OpenCode Zen balances in a single panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Credits balance in USD with usage bar
- **OpenCode Go** — 5-hour, weekly, and monthly quotas with countdown
- **OpenCode Zen** — Availability status
- **Multi-source auth** — env vars, opencode.json, or auth.json
- **Setup wizard** — `/tb-setup` for step-by-step configuration
- **Provider control** — Show/hide via config or `/toggle-provider`
- **Auto-refresh** — Updates every 60 seconds

## Preview

```
▼ Quota

🐳 DeepSeek
Total balance               USD 7.48
██████████████████████████  94%

🐙 OpenCode Go
Five-hour                    1h
████████████████████████░   97% left
Weekly                    5d 7h
████████████████████░░░░   90% left
Monthly                  27d 9h
██████████████████████░░   94% left

⚡ OpenCode Zen
Disponibles                 ahora
██████████████████████████
```

## Quick Start

```bash
# 1. Install
npm install -g @openplugins/token-balance

# 2. Add to ~/.config/opencode/opencode.json
{ "plugin": ["@openplugins/token-balance"] }

# 3. Restart opencode and run the wizard
/tb-setup
```

## Commands

| Command | Description |
|---------|-------------|
| `/tb-setup` | Setup wizard for all providers |
| `/quota-toggle` | Collapse/expand the Quota panel |
| `/set-max-balance` | Set DeepSeek max USD for percentage bar |
| `/toggle-provider` | Show or hide a provider |

## Agent Configuration Guide

**For AI agents:** Follow these steps when a user installs this plugin.

### 1. Verify installation

```bash
npm list -g @openplugins/token-balance
```

If not installed:
```bash
npm install -g @openplugins/token-balance
```

Add to `~/.config/opencode/opencode.json`:
```json
{ "plugin": ["@openplugins/token-balance"] }
```

### 2. Check existing config

Before asking for keys, check if already configured:

```bash
# Env vars
echo $DEEPSEEK_API_KEY $OPENCODE_API_KEY

# opencode.json
cat ~/.config/opencode/opencode.json | grep -A2 "provider"

# auth.json
cat ~/.local/share/opencode/auth.json 2>/dev/null
```

### 3. Configure missing providers

**DeepSeek:**
- "Do you have a DeepSeek API key? (platform.deepseek.com)"
- If yes → `/tb-setup` → Step 1
- If no → Create account at platform.deepseek.com

**OpenCode Go:**
- "Do you use OpenCode Go?"
- If yes → `/tb-setup` → Step 2
- If no → Skip

**OpenCode Zen:**
- "Do you use OpenCode Zen billing?"
- If yes → `/tb-setup` → Step 3 (cookie + workspace ID)
- If no → Skip

### 4. Verify

- ✅ Shows balance/quota = configured
- ❌ "sin API key" = key missing
- ❌ "sin configurar" = Zen cookie missing

### 5. Optional: DeepSeek max balance

Ask: "How much total USD did you load into DeepSeek?"
Then: `/set-max-balance` → enter amount

## Key Resolution

First match wins:

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Env var | `DEEPSEEK_API_KEY=sk-...` |
| 2 | opencode.json | `provider.deepseek.apiKey` |
| 3 | token-balance config | `apiKeys.deepseek` (from `/tb-setup`) |
| 4 | auth.json | `deepseek.key` |

### Environment Variables

| Provider | Var |
|----------|-----|
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenCode Go | `OPENCODE_API_KEY` |
| OpenCode Zen | `OPENCODE_API_KEY` |

### auth.json Paths

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/opencode/auth.json` |
| macOS | `~/Library/Application Support/opencode/auth.json` |
| Windows | `%LOCALAPPDATA%\opencode\auth.json` |

## Error Messages

| Message | Fix |
|---------|-----|
| `sin API key` | Run `/tb-setup` or configure env var/opencode.json |
| `error 401` | Invalid key → re-login |
| `error de conexion` | Network issue |
| `sin datos` | API returned empty → retry |
| `sin configurar` | Zen cookie missing → `/tb-setup` |

## Troubleshooting

**Sidebar not showing:**
1. `npm list -g @openplugins/token-balance`
2. Check `opencode.json` has plugin
3. Restart opencode

**Bars not showing:**
- DeepSeek: Set max balance via `/set-max-balance`
- Go: Shows when API responds
- Zen: Requires cookie config

## Security

- Credentials read from existing config (not stored by plugin)
- No telemetry
- Config writes only to `~/.config/opencode/token-balance/config.json`

## License

MIT
