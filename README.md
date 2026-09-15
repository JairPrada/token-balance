# @openplugins/token-balance

OpenCode sidebar plugin that displays token balances and quotas for DeepSeek, OpenCode Go, and OpenCode Zen in a single unified panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Credits balance in USD with usage percentage bar
- **OpenCode Go** — 5-hour rolling, weekly, and monthly quotas with countdown
- **OpenCode Zen** — Availability status with bar indicator
- **Multi-source auth** — Resolves API keys from env vars, opencode.json, or auth.json
- **Provider control** — Show/hide providers via config or command
- **Collapsible** — Click "Quota" to expand/collapse
- **Auto-refresh** — Updates every 60 seconds
- **Cross-platform** — Linux, macOS, Windows

## Preview

```
▼ Quota

🐳 DeepSeek
Total balance               USD 7.48
███████████████████████████  94%

🐙 OpenCode Go
Five-hour                    1h
█████████████████████████░   97% left
Weekly                    5d 7h
█████████████████████░░░░   90% left
Monthly                  27d 9h
███████████████████████░░   94% left

⚡ OpenCode Zen
Disponibles                 ahora
███████████████████████████
```

## Quick Start

### 1. Install

```bash
npm install -g @openplugins/token-balance
```

### 2. Add plugin to opencode.json

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@openplugins/token-balance"]
}
```

### 3. Configure your providers

The plugin auto-detects providers from your existing opencode config. If you already have DeepSeek, OpenCode Go, or OpenCode Zen configured, the plugin picks them up automatically.

### 4. Restart OpenCode

```bash
opencode
```

## Key Resolution

The plugin resolves API keys from 3 sources (first match wins):

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Environment variable | `DEEPSEEK_API_KEY=sk-...` |
| 2 | opencode.json config | `provider.deepseek.apiKey` |
| 3 | auth.json | `deepseek.key` |

### Supported Environment Variables

| Provider | Env Var |
|----------|---------|
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenCode Go | `OPENCODE_API_KEY` |
| OpenCode Zen | `OPENCODE_API_KEY` |

### opencode.json Config Format

```json
{
  "provider": {
    "deepseek": {
      "apiKey": "sk-your-deepseek-key"
    },
    "opencode-go": {
      "apiKey": "{env:OPENCODE_API_KEY}"
    }
  }
}
```

The `{env:VAR_NAME}` template syntax is supported and resolved at runtime.

### auth.json Paths

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/opencode/auth.json` |
| macOS | `~/Library/Application Support/opencode/auth.json` |
| Windows | `%LOCALAPPDATA%\opencode\auth.json` |

Structure:

```json
{
  "deepseek": { "type": "api", "key": "sk-your-deepseek-key" },
  "opencode-go": { "type": "api", "key": "your-opencode-go-key" }
}
```

You can also configure via CLI:

```bash
opencode auth login -p deepseek
opencode auth login -p opencode-go
```

## Provider Visibility Control

### Config File

Create `~/.config/opencode/token-balance/config.json`:

```json
{
  "providers": {
    "deepseek": true,
    "opencode-go": true,
    "opencode-zen": true
  }
}
```

Set a provider to `false` to hide it from the sidebar. If the file doesn't exist, all available providers are shown.

### Toggle Command

Use `/toggle-provider` inside OpenCode to toggle providers interactively:

1. Type `/toggle-provider` in the prompt
2. Enter the provider name: `deepseek`, `opencode-go`, or `opencode-zen`
3. The provider is toggled on/off

## OpenCode Zen Setup

Zen requires a manual cookie configuration. The plugin reads from `~/.config/opencode/token-balance/config.json`:

```json
{
  "zen": {
    "workspaceId": "your-workspace-id",
    "authCookie": "your-auth-cookie-value"
  }
}
```

### How to get your authCookie

1. Open [opencode.ai](https://opencode.ai) in your browser
2. Log in to your account
3. Open DevTools (F12) → Application → Cookies
4. Find the `auth` cookie for `opencode.ai`
5. Copy the value
6. Paste it into the config file above

If the cookie is missing or invalid, the Zen section shows "sin configurar".

## DeepSeek Max Balance (Optional)

Set the total USD loaded in DeepSeek to show a percentage bar:

### Via Command

```
/set-max-balance
```

Enter the total amount (e.g., `8` for $8).

### Via Config

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [["@openplugins/token-balance", { "deepseekMaxBalance": 8 }]]
}
```

Priority: plugin option > `/set-max-balance` command.

## Commands

| Command | Description |
|---------|-------------|
| `/quota-toggle` | Collapse/expand the Quota panel |
| `/set-max-balance` | Set DeepSeek max USD for percentage calculation |
| `/toggle-provider` | Show or hide a provider in the sidebar |

## Error Messages

| Message | Provider | Meaning | Fix |
|---------|----------|---------|-----|
| `sin API key` | DeepSeek / Go | No API key found in any source | Configure via env var, opencode.json, or `opencode auth login` |
| `error 401` | DeepSeek / Go | Invalid API key | Check your key or re-login |
| `error de conexion` | DeepSeek / Go | Network issue | Check your internet connection |
| `sin datos` | DeepSeek / Go | API returned empty data | Wait and retry |
| `sin configurar` | Zen | Cookie not configured | Set `zen.authCookie` in config |

## Troubleshooting

### Sidebar not showing

1. Verify plugin is installed: `npm list -g @openplugins/token-balance`
2. Check `opencode.json` has `"plugin": ["@openplugins/token-balance"]`
3. Restart OpenCode

### Provider shows "sin API key"

The plugin checks 3 sources in order:
1. **Env var** — Is the env var set? Check with `echo $DEEPSEEK_API_KEY`
2. **opencode.json** — Is `provider.<name>.apiKey` configured?
3. **auth.json** — Did you run `opencode auth login -p <provider>`?

### Bars not showing

- **DeepSeek**: Set `deepseekMaxBalance` via `/set-max-balance` or in config
- **OpenCode Go**: Bars show when API responds with data
- **OpenCode Zen**: Requires cookie configuration

### Colors not showing

Ensure your terminal supports true color (24-bit). Most modern terminals do.

## Security

- **No tokens stored** — credentials read from existing OpenCode config
- **No telemetry** — zero external tracking
- **Read-only** — plugin never modifies your config files

## License

MIT
