# @openplugins/token-balance

OpenCode sidebar plugin that displays token balances and quotas for multiple providers in a single unified panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Balance in USD with a usage percentage bar
- **OpenCode Go** — 5-hour rolling, weekly, and monthly quotas with countdown and remaining percentage
- **OpenCode Zen** — Availability status with a full bar indicator

## Installation

```bash
npm install -g @openplugins/token-balance
```

## Configuration

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["@openplugins/token-balance"]
}
```

That's it! The plugin automatically detects which providers you have configured and shows only the available sections.

## How It Looks

```
▼ Quota

🐳 DeepSeek
Total balance                 USD 7.48
████████████████████████░░         94%

🐙 OpenCode Go
Five-hour                          59m
███████████████████████░░░    88% left
Weekly                           5d 6h
██████████████████████░░░░    86% left
Monthly                         27d 9h
████████████████████████░░    93% left

⚡ OpenCode Zen
Disponibles                      ahora
██████████████████████████
```

## Provider Setup

### DeepSeek

The plugin reads your DeepSeek API key from `~/.local/share/opencode/auth.json` → `deepseek.key`.

Or configure via:

```bash
opencode auth login -p deepseek
```

### OpenCode Go

The plugin reads your OpenCode Go API key from `~/.local/share/opencode/auth.json` → `opencode-go.key` (or `opencode.key`).

Or configure via:

```bash
opencode auth login -p opencode-go
```

### OpenCode Zen

The plugin reads your Zen billing config from `~/.config/opencode/opencode-quota/opencode.json`.

This is automatically configured when you enable OpenCode Zen billing.

## Refresh

The sidebar auto-refreshes every 60 seconds.

## Security

- **No tokens are stored in the plugin** — credentials are read from your existing OpenCode config
- **No telemetry** — zero external tracking

## License

MIT
