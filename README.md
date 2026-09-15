# @openplugins/token-balance

OpenCode sidebar plugin that displays token balances and quotas for DeepSeek, OpenCode Go, and OpenCode Zen in a single unified panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Credits balance in USD with usage percentage bar
- **OpenCode Go** — 5-hour rolling, weekly, and monthly quotas with countdown
- **OpenCode Zen** — Availability status with bar indicator
- **Collapsible** — Click "Quota" to expand/collapse
- **Auto-refresh** — Updates every 60 seconds

## Preview

```
▼ Quota

🐳 DeepSeek
Total balance               USD 7.48
████████████████████████████  94%

🐙 OpenCode Go
Five-hour                    1h
██████████████████████████░   97% left
Weekly                    5d 7h
██████████████████████░░░░   90% left
Monthly                  27d 9h
████████████████████████░░   94% left

⚡ OpenCode Zen
Disponibles                 ahora
████████████████████████████
```

## Quick Start

### 1. Install

```bash
npm install -g @openplugins/token-balance
```

### 2. Configure providers

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@openplugins/token-balance"],
  "provider": {
    "deepseek": {},
    "opencode-go": {
      "apiKey": "{env:OPENCODE_GO_API_KEY}"
    }
  }
}
```

### 3. Set DeepSeek max balance (optional)

Edit `~/.config/opencode/tui.json`:

```json
{
  "plugin": [["@openplugins/token-balance", { "deepseekMaxBalance": 8 }]]
}
```

Or use the command `/set-max-balance` inside OpenCode.

### 4. Restart OpenCode

```bash
opencode
```

## Provider Setup

### DeepSeek

The plugin reads your API key from `auth.json`:

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/opencode/auth.json` |
| macOS | `~/.local/share/opencode/auth.json` |
| Windows | `%APPDATA%\opencode\auth.json` |

Structure:

```json
{
  "deepseek": {
    "type": "api_key",
    "key": "sk-your-deepseek-key"
  }
}
```

Or configure via CLI:

```bash
opencode auth login -p deepseek
```

**Error messages:**

| Message | Meaning | Fix |
|---------|---------|-----|
| `sin API key` | No API key found | Run `opencode auth login -p deepseek` |
| `error 401` | Invalid key | Check your key at platform.deepseek.com |
| `error de conexion` | Network issue | Check your internet connection |

### OpenCode Go

The plugin reads your API key from `auth.json`:

| Key checked | Path |
|-------------|------|
| `opencode-go.key` | Primary |
| `opencode.key` | Fallback |

Structure:

```json
{
  "opencode-go": {
    "type": "api_key",
    "key": "your-opencode-go-key"
  }
}
```

Or configure via CLI:

```bash
opencode auth login -p opencode-go
```

**Error messages:**

| Message | Meaning | Fix |
|---------|---------|-----|
| `sin API key` | No API key found | Run `opencode auth login -p opencode-go` |
| `error 401` | Invalid key | Re-login with `opencode auth login` |
| `sin datos` | API returned empty | Wait and retry, or check account status |

### OpenCode Zen

The plugin reads billing config from `opencode.json`:

| Platform | Path |
|----------|------|
| Linux | `~/.config/opencode/opencode-quota/opencode.json` |
| macOS | `~/Library/Application Support/opencode/opencode-quota/opencode.json` |
| Windows | `%APPDATA%\opencode\opencode-quota\opencode.json` |

Structure:

```json
{
  "workspaceId": "your-workspace-id",
  "authCookie": "your-auth-cookie"
}
```

This is automatically configured when you enable OpenCode Zen billing via `/zen-free`.

**How to get your authCookie:**

1. Open OpenCode in your browser
2. Open DevTools (F12) → Application → Cookies
3. Find the `auth` cookie for `opencode.ai`
4. Copy the value and paste it into the config file

**Error messages:**

| Message | Meaning | Fix |
|---------|---------|-----|
| `sin datos` | Config missing or auth failed | Run `/zen-free` to auto-configure |

## Commands

| Command | Description |
|---------|-------------|
| `/quota-toggle` | Collapse/expand the Quota panel |
| `/set-max-balance` | Set DeepSeek max USD for percentage calculation |

## Configuration Reference

### `tui.json`

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["@openplugins/token-balance", {
      "deepseekMaxBalance": 8
    }]
  ]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `deepseekMaxBalance` | number | `0` | Total USD loaded in DeepSeek (for % calculation). If 0, no bar is shown. |

### Priority

Plugin option (`tui.json`) > KV store (`/set-max-balance`).

If `deepseekMaxBalance` is set in `tui.json`, it takes precedence over the value set via `/set-max-balance`.

## Troubleshooting

### Sidebar not showing

1. Verify plugin is installed: `npm list -g @openplugins/token-balance`
2. Check `opencode.json` has `"plugin": ["@openplugins/token-balance"]`
3. Restart OpenCode

### Bars not showing

- **DeepSeek**: Set `deepseekMaxBalance` in `tui.json` or run `/set-max-balance`
- **OpenCode Go**: Bars always show when API responds with data
- **OpenCode Zen**: Requires billing to be active

### Colors not showing

Ensure your terminal supports true color (24-bit). Most modern terminals do.

## Security

- **No tokens stored** — credentials read from existing OpenCode config
- **No telemetry** — zero external tracking
- **Read-only** — plugin never modifies your config files

## License

MIT
