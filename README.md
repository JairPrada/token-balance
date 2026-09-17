# @openplugins/token-balance

Plugin de sidebar para OpenCode: muestra saldos de DeepSeek, OpenCode Go y OpenCode Zen en un solo panel.

![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/npm/v/@openplugins/token-balance)

## Funcionalidades

- **DeepSeek** — Saldo en USD con barra de uso
- **OpenCode Go** — Cuotas de 5 horas, semanal y mensual con countdown
- **OpenCode Zen** — Estado de disponibilidad
- **Auth múltiple** — Variables de entorno, `opencode.json` o `auth.json`
- **Wizard de setup** — `/tb-setup` para configuración paso a paso
- **Control de providers** — Mostrar/ocultar vía config o `/toggle-provider`
- **Auto-refresh** — Se actualiza cada 60 segundos

## Preview

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

## Instalación rápida

```bash
# 1. Instalar
npm install -g @openplugins/token-balance

# 2. Agregar a ~/.config/opencode/opencode.json
{ "plugin": ["@openplugins/token-balance"] }

# 3. Reiniciar opencode y ejecutar el wizard
/tb-setup
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/tb-setup` | Wizard de configuración para todos los providers |
| `/quota-toggle` | Colapsar/expandir el panel de Quota |
| `/set-max-balance` | Establecer el saldo máximo USD de DeepSeek para la barra de porcentaje |
| `/toggle-provider` | Mostrar u ocultar un provider |

## Guía para agentes de IA

Cuando un usuario instale este plugin, seguir estos pasos:

### 1. Verificar instalación

```bash
npm list -g @openplugins/token-balance
```

Si no está instalado:
```bash
npm install -g @openplugins/token-balance
```

Agregar a `~/.config/opencode/opencode.json`:
```json
{ "plugin": ["@openplugins/token-balance"] }
```

### 2. Verificar configuración existente

Antes de pedir keys, verificar si ya está configurado:

```bash
# Variables de entorno
echo $DEEPSEEK_API_KEY $OPENCODE_API_KEY

# opencode.json
cat ~/.config/opencode/opencode.json | grep -A2 "provider"

# auth.json
cat ~/.local/share/opencode/auth.json 2>/dev/null
```

### 3. Configurar providers faltantes

**DeepSeek:**
- "¿Tienes una API key de DeepSeek? (platform.deepseek.com)"
- Si → `/tb-setup` → Paso 1
- No → Crear cuenta en platform.deepseek.com

**OpenCode Go:**
- "¿Usas OpenCode Go?"
- Si → `/tb-setup` → Paso 2
- No → Saltar

**OpenCode Zen:**
- "¿Usas facturación de OpenCode Zen?"
- Si → `/tb-setup` → Paso 3 (cookie + workspace ID)
- No → Saltar

### 4. Verificar

- ✅ Muestra saldo/cuota = configurado
- ❌ "sin API key" = falta key
- ❌ "sin configurar" = falta cookie de Zen

### 5. Opcional: saldo máximo DeepSeek

Preguntar: "¿Cuánto USD cargaste en DeepSeek?"
Luego: `/set-max-balance` → ingresar monto

## Resolución de keys

Gana la primera coincidencia:

| Prioridad | Fuente | Ejemplo |
|-----------|--------|---------|
| 1 | Variable de entorno | `DEEPSEEK_API_KEY=sk-...` |
| 2 | opencode.json | `provider.deepseek.apiKey` |
| 3 | config del plugin | `apiKeys.deepseek` (desde `/tb-setup`) |
| 4 | auth.json | `deepseek.key` |

### Variables de entorno

| Provider | Variable |
|----------|----------|
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenCode Go | `OPENCODE_API_KEY` |
| OpenCode Zen | `OPENCODE_API_KEY` |

### Rutas de auth.json

| Plataforma | Ruta |
|------------|------|
| Linux | `~/.local/share/opencode/auth.json` |
| macOS | `~/Library/Application Support/opencode/auth.json` |
| Windows | `%APPDATA%\opencode\auth.json` o `%LOCALAPPDATA%\opencode\auth.json` |

## Mensajes de error

| Mensaje | Solución |
|---------|----------|
| `sin API key` | Ejecutar `/tb-setup` o configurar env var/opencode.json |
| `error 401` | Key inválida → re-login |
| `error de conexion` | Problema de red |
| `sin datos` | API devolvió vacío → reintentar |
| `sin configurar` | Falta cookie de Zen → `/tb-setup` |

## Solución de problemas

**No aparece la sidebar:**
1. `npm list -g @openplugins/token-balance`
2. Verificar que `opencode.json` tenga el plugin
3. Reiniciar opencode

**No aparecen las barras:**
- DeepSeek: Establecer saldo máximo con `/set-max-balance`
- Go: Se muestra cuando la API responde
- Zen: Requiere configuración de cookie

## Seguridad

- Las credenciales se leen de configuración existente (no se guardan por el plugin)
- Sin telemetría
- Solo escribe en `~/.config/opencode/token-balance/config.json`

## Licencia

MIT
