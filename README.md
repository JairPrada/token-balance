# @openplugins/token-balance

Plugin de sidebar para OpenCode que muestra tus saldos de DeepSeek, OpenCode Go y OpenCode Zen en un solo panel con auto-refresh cada 60 segundos.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Qué muestra

```
▼ Quota

🐳 DeepSeek
Total balance               USD 7.48
██████████████████████████  94%

🐙 OpenCode Go
Five-hour                    1h
████████████████████████    97% left
Weekly                    5d 7h
████████████████████░░░░   90% left
Monthly                  27d 9h
██████████████████████░░   94% left

⚡ OpenCode Zen
Disponibles                 ahora
██████████████████████████
```

Haz click en `▼ Quota` para colapsar/expandir el panel.

## Instalación

```bash
npm install -g @openplugins/token-balance
```

Agregar a `~/.config/opencode/opencode.json`:

```json
{ "plugin": ["@openplugins/token-balance"] }
```

Reiniciar opencode.

## Configuración

### Opción 1: Wizard (recomendado)

Ejecuta `/tb-setup` dentro de opencode. El wizard te guía paso a paso:

**Paso 1 — DeepSeek API Key**

1. Ve a [platform.deepseek.com](https://platform.deepseek.com) → API Keys
2. Crea una key (empieza con `sk-`)
3. Pégala en el wizard

**Paso 2 — OpenCode Go API Key**

- Si ya tienes `OPENCODE_API_KEY` como variable de entorno, presiona Enter para saltar.
- Si no, ingresa tu key.

**Paso 3 — OpenCode Zen Cookie**

1. Abre [opencode.ai](https://opencode.ai) en tu navegador
2. Inicia sesión
3. Presiona **F12** → **Application** → **Cookies** → `https://opencode.ai`
4. Busca el cookie llamado **`auth`**
5. Copia su valor y pégalo en el wizard

**Paso 4 — Workspace ID**

1. En opencode.ai abre tu workspace
2. Copia el ID de la URL: `opencode.ai/workspace/wrk_XXXXX/...`
3. Pégalo en el wizard

### Opción 2: Manual

**DeepSeek** — variable de entorno:
```bash
export DEEPSEEK_API_KEY=sk-tu-key
```

**OpenCode Go** — variable de entorno:
```bash
export OPENCODE_API_KEY=tu-key
```

**OpenCode Zen** — editar archivo `~/.config/opencode/token-balance/config.json`:
```json
{
  "zen": {
    "authCookie": "tu-cookie-de-opencode.ai",
    "workspaceId": "wrk_tu-workspace-id"
  }
}
```

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/tb-setup` | Wizard de configuración para los 3 providers |
| `/set-max-balance` | Define el saldo máximo USD de DeepSeek para el porcentaje |

## Resolución de keys

Gana la primera coincidencia:

| Prioridad | Fuente | Ejemplo |
|-----------|--------|---------|
| 1 | Variable de entorno | `DEEPSEEK_API_KEY=sk-...` |
| 2 | opencode.json | `provider.deepseek.options.apiKey` |
| 3 | Config del plugin | `apiKeys.deepseek` (desde `/tb-setup`) |
| 4 | auth.json | `deepseek.key` |

| Provider | Variable de entorno |
|----------|----------|
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenCode Go | `OPENCODE_API_KEY` |

| Plataforma | Ruta de auth.json |
|------------|------|
| Linux | `~/.local/share/opencode/auth.json` |
| macOS | `~/Library/Application Support/opencode/auth.json` |
| Windows | `%APPDATA%\opencode\auth.json` o `%LOCALAPPDATA%\opencode\auth.json` |

## Prompt para IA

Cuando un usuario instale este plugin, seguir estos pasos:

```markdown
1. Verificar instalación:
   npm list -g @openplugins/token-balance
   Si no está: npm install -g @openplugins/token-balance

2. Verificar que opencode.json tenga el plugin:
   { "plugin": ["@openplugins/token-balance"] }

3. Verificar si ya tiene keys configuradas:
   echo $DEEPSEEK_API_KEY $OPENCODE_API_KEY
   cat ~/.config/opencode/token-balance/config.json 2>/dev/null
   cat ~/.local/share/opencode/auth.json 2>/dev/null

4. Si falta algo, ejecutar /tb-setup dentro de opencode

5. Verificar:
   ✓ Muestra saldo/cuota = configurado correctamente
   ✗ "sin API key" = falta configurar esa key
   ✗ "sin configurar" = falta cookie de Zen
```

## Errores

| Mensaje | Solución |
|---------|----------|
| `sin API key` | Ejecutar `/tb-setup` o configurar env var |
| `error 401` | Key inválida — reconfigurar con `/tb-setup` |
| `error de conexion` | Problema de red |
| `sin datos` | API devolvió vacío — reintentar |
| `sin configurar` | Falta cookie de Zen → `/tb-setup` |

## Solución de problemas

**No aparece la sidebar:**
1. Verificar instalación: `npm list -g @openplugins/token-balance`
2. Verificar `opencode.json` tenga `"plugin": ["@openplugins/token-balance"]`
3. Reiniciar opencode

**No aparecen barras:**
- DeepSeek: Establecer saldo máximo con `/set-max-balance`
- Go: Se muestra cuando la API responde
- Zen: Requiere configuración de cookie via `/tb-setup`

## Seguridad

- Las credenciales se leen de configuración existente
- Sin telemetría
- Solo escribe en `~/.config/opencode/token-balance/config.json`

## Licencia

MIT
