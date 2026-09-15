# @openplugins/token-balance

OpenCode sidebar plugin that displays token balances and quotas for DeepSeek, OpenCode Go, and OpenCode Zen in a single unified panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Features

- **DeepSeek** — Credits balance in USD with usage percentage bar
- **OpenCode Go** — 5-hour rolling, weekly, and monthly quotas with countdown
- **OpenCode Zen** — Availability status with bar indicator
- **Multi-source auth** — Resolves API keys from env vars, opencode.json, or auth.json
- **Setup wizard** — Interactive `/tb-setup` command for step-by-step configuration
- **Provider control** — Show/hide providers via config or command
- **Collapsible** — Click "Quota" to expand/collapse
- **Auto-refresh** — Updates every 60 seconds
- **Cross-platform** — Linux, macOS, Windows

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

### 3. Restart OpenCode

```bash
opencode
```

### 4. Run the setup wizard

Type `/tb-setup` in the OpenCode prompt. The wizard guides you through configuring each provider step by step.

## Agent Configuration Guide

**For AI agents:** When a user installs this plugin, follow these steps to configure it:

### Step 1: Verify installation

Check if the plugin is installed and the sidebar is visible. If not, run:

```bash
npm install -g @openplugins/token-balance
```

Then add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@openplugins/token-balance"]
}
```

### Step 2: Check existing configuration

Before asking the user for keys, check if providers are already configured:

```bash
# Check env vars
echo $DEEPSEEK_API_KEY
echo $OPENCODE_API_KEY

# Check opencode.json for provider config
cat ~/.config/opencode/opencode.json | grep -A2 "provider"

# Check auth.json
cat ~/.local/share/opencode/auth.json 2>/dev/null
```

If a provider is already configured, skip to the next one.

### Step 3: Configure missing providers

For each missing provider, ask the user:

**DeepSeek:**
- Question: "Do you have a DeepSeek API key? You can get one at platform.deepseek.com"
- If yes: Ask them to run `/tb-setup` in OpenCode and enter the key at Step 1
- If no: Suggest they create an account at platform.deepseek.com

**OpenCode Go:**
- Question: "Do you use OpenCode Go? The key is usually the same as your OPENCODE_API_KEY"
- If yes: Ask them to run `/tb-setup` in OpenCode and enter the key at Step 2
- If no: They can skip this provider

**OpenCode Zen:**
- Question: "Do you use OpenCode Zen billing? This requires extracting a cookie from your browser"
- If yes: Guide them through these steps:
  1. Open opencode.ai in their browser
  2. Log in to their account
  3. Press F12 → Application → Cookies
  4. Find the `auth` cookie for opencode.ai
  5. Copy the value
  6. Run `/tb-setup` in OpenCode and paste the cookie at Step 3
  7. Enter the workspace ID (found in the URL: opencode.ai/workspace/wrk_XXXXX/...)
- If no: They can skip this provider

### Step 4: Verify configuration

After the user completes `/tb-setup`, check the sidebar:
- ✅ Provider shows balance/quota = configured correctly
- ❌ Provider shows "sin API key" = key not found
- ❌ Provider shows "sin configurar" = Zen cookie not configured

### Step 5: Optional - Set DeepSeek max balance

If the user wants a percentage bar for DeepSeek, ask:
- "How much total USD did you load into DeepSeek? (e.g., 8 for $8)"
- Then run `/set-max-balance` in OpenCode and enter the amount

## Key Resolution

The plugin resolves API keys from 4 sources (first match wins):

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Environment variable | `DEEPSEEK_API_KEY=sk-...` |
| 2 | opencode.json config | `provider.deepseek.apiKey` |
| 3 | token-balance config | `apiKeys.deepseek` (from `/tb-setup`) |
| 4 | auth.json | `deepseek.key` |

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

Zen requires a manual cookie configuration. The setup wizard (`/tb-setup`) guides you through this, or you can configure manually.

### Config File

Create `~/.config/opencode/token-balance/config.json`:

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
6. Paste it into the config file above (or use `/tb-setup`)

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
| `/tb-setup` | Step-by-step setup wizard for all providers |
| `/quota-toggle` | Collapse/expand the Quota panel |
| `/set-max-balance` | Set DeepSeek max USD for percentage calculation |
| `/toggle-provider` | Show or hide a provider in the sidebar |

## Error Messages

| Message | Provider | Meaning | Fix |
|---------|----------|---------|-----|
| `sin API key` | DeepSeek / Go | No API key found in any source | Run `/tb-setup` or configure via env var, opencode.json, or `opencode auth login` |
| `error 401` | DeepSeek / Go | Invalid API key | Check your key or re-login |
| `error de conexion` | DeepSeek / Go | Network issue | Check your internet connection |
| `sin datos` | DeepSeek / Go | API returned empty data | Wait and retry |
| `sin configurar` | Zen | Cookie not configured | Run `/tb-setup` and paste your auth cookie |

## Troubleshooting

### Sidebar not showing

1. Verify plugin is installed: `npm list -g @openplugins/token-balance`
2. Check `opencode.json` has `"plugin": ["@openplugins/token-balance"]`
3. Restart OpenCode

### Provider shows "sin API key"

Run `/tb-setup` to configure the provider, or check manually:

1. **Env var** — Is the env var set? Check with `echo $DEEPSEEK_API_KEY`
2. **opencode.json** — Is `provider.<name>.apiKey` configured?
3. **auth.json** — Did you run `opencode auth login -p <provider>`?

### Bars not showing

- **DeepSeek**: Set `deepseekMaxBalance` via `/set-max-balance` or in config
- **OpenCode Go**: Bars show when API responds with data
- **OpenCode Zen**: Requires cookie configuration via `/tb-setup`

### Colors not showing

Ensure your terminal supports true color (24-bit). Most modern terminals do.

## Security

- **Credentials read from existing config** — no tokens stored by the plugin itself
- **No telemetry** — zero external tracking
- **Config writes** — the `/tb-setup` wizard writes to `~/.config/opencode/token-balance/config.json` only

## License

MIT
