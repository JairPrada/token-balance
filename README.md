# @openplugins/token-balance

OpenCode sidebar plugin that displays token balances and quotas for multiple providers in a single unified panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Balance (USD/CNY)
- **OpenCode Go** — 5-hour rolling, weekly, and monthly quotas with countdown
- **OpenCode Zen** — Billing balance, monthly budget usage
- **Zen Free Models** — Real-time availability of free models

## Installation

```bash
npm install -g @openplugins/token-balance
```

## Configuration

Add the plugin to your OpenCode TUI config:

### `~/.config/opencode/tui.json`

```json
{
  "plugin": ["@openplugins/token-balance"]
}
```

That's it! The plugin automatically detects which providers you have configured and shows only the available sections.

## How It Looks

```
🐳 DeepSeek
Total balance               USD 7.48
████████████████████████░        94%

🐙 OpenCode Go
Five-hour                         3h
████████████████████████░   97% left
Weekly                            5d
███████████████████████░░   90% left
Monthly                          27d
████████████████████████░   94% left

⚡ OpenCode Zen
Balance                USD 12.50
████████████████████████░   94%

★ Zen Free Models
Disponibles                    ahora
██████████████████████████
```

## Provider Setup

### DeepSeek

The plugin reads your DeepSeek API key from (in order):

1. Environment variable: `DEEPSEEK_API_KEY`
2. `opencode.json` → `provider.deepseek.apiKey`
3. `~/.local/share/opencode/auth.json` → `deepseek.key`

Or configure via:
```bash
opencode auth login -p deepseek
```

### OpenCode Go

The plugin reads your OpenCode Go API key from:

1. Environment variable: `OPENCODE_API_KEY`
2. `~/.local/share/opencode/auth.json` → `opencode-go.key` or `opencode.key`

Or configure via:
```bash
opencode auth login -p opencode-go
```

### OpenCode Zen

The plugin reads your Zen billing config from:

`~/.config/opencode/opencode-quota/opencode.json`

This is automatically configured when you enable OpenCode Zen billing.

### Zen Free Models

The plugin reads your OpenCode auth key from:

`~/.local/share/opencode/auth.json` → `opencode.key`

This is automatically configured when you sign in to OpenCode.

## Behavior

| Provider Status | What You See |
|----------------|--------------|
| All keys configured | Full panel with all 4 sections |
| Some keys missing | Only available sections shown |
| No keys configured | "No API key" message in each section |
| API error | Error message in the section |

## Refresh

The sidebar auto-refreshes every 60 seconds.

## Security

- **No tokens are stored in the plugin** — credentials are read from your existing OpenCode config
- **No network calls on startup** — only fetches when the sidebar is visible
- **No telemetry** — zero external tracking

## License

MIT
