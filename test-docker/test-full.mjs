import fs from "fs";
import { execSync } from "child_process";

console.log("====================================");
console.log("  FULL FUNCTIONALITY TEST");
console.log("  opencode + @openplugins/token-balance");
console.log("====================================\n");

const PASS = [];
const FAIL = [];

function test(name, fn) {
  try {
    fn();
    PASS.push(name);
    console.log(`✅ ${name}`);
  } catch(e) {
    FAIL.push(`${name}: ${e.message.split("\n")[0]}`);
    console.log(`❌ ${name}: ${e.message.split("\n")[0]}`);
  }
}

const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
const pluginDir = `${globalRoot}/@openplugins/token-balance`;
const tuiPath = `${pluginDir}/dist/tui.js`;
const home = process.env.HOME || "/root";
const configDir = `${home}/.config/opencode`;
const pluginConfigDir = `${home}/.config/opencode/token-balance`;

// ═══════════════════════════════════════════════════════════════════
// 1. INSTALLATION
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 1. INSTALLATION ──");

test("opencode is installed", () => {
  const ver = execSync("opencode --version", { encoding: "utf8" }).trim();
  if (!ver) throw new Error("no version");
});

test("plugin installed globally", () => {
  const list = execSync("npm list -g @openplugins/token-balance 2>&1", { encoding: "utf8" });
  if (!list.includes("@openplugins/token-balance")) throw new Error("not found");
});

test("plugin files exist", () => {
  for (const f of ["dist/tui.js", "dist/index.js", "package.json"]) {
    if (!fs.existsSync(`${pluginDir}/${f}`)) throw new Error(`missing ${f}`);
  }
});

test("package.json has version field", () => {
  const pkg = JSON.parse(fs.readFileSync(`${pluginDir}/package.json`, "utf8"));
  if (!pkg.version) throw new Error("missing version");
});

test("package.json has oc-plugin field", () => {
  const pkg = JSON.parse(fs.readFileSync(`${pluginDir}/package.json`, "utf8"));
  if (!pkg["oc-plugin"]) throw new Error("missing oc-plugin");
  if (!pkg["oc-plugin"].includes("tui")) throw new Error("missing tui in oc-plugin");
});

test("package.json has exports", () => {
  const pkg = JSON.parse(fs.readFileSync(`${pluginDir}/package.json`, "utf8"));
  if (!pkg.exports?.["."]?.default) throw new Error("missing . export");
  if (!pkg.exports?.["./tui"]?.default) throw new Error("missing ./tui export");
});

// ═══════════════════════════════════════════════════════════════════
// 2. BUILD OUTPUT
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 2. BUILD OUTPUT ──");

test("tui.js has NO React.createElement", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (content.includes("React.createElement")) throw new Error("uses React.createElement");
});

test("tui.js uses @opentui/solid/jsx-runtime", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("@opentui/solid/jsx-runtime")) throw new Error("missing jsx-runtime");
});

test("tui.js has no syntax errors", () => {
  execSync(`node --check ${tuiPath}`, { encoding: "utf8" });
});

test("index.js has no syntax errors", () => {
  execSync(`node --check ${pluginDir}/dist/index.js`, { encoding: "utf8" });
});

// ═══════════════════════════════════════════════════════════════════
// 3. DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 3. DEPENDENCIES ──");

test("solid-js installed", () => {
  const solidPath = `${pluginDir}/node_modules/solid-js/package.json`;
  if (!fs.existsSync(solidPath)) throw new Error("not found");
  const pkg = JSON.parse(fs.readFileSync(solidPath, "utf8"));
  console.log(`    v${pkg.version}`);
});

test("@opentui/solid installed", () => {
  const path = `${pluginDir}/node_modules/@opentui/solid/package.json`;
  if (!fs.existsSync(path)) throw new Error("not found");
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  console.log(`    v${pkg.version}`);
});

test("@opentui/core installed", () => {
  const path = `${pluginDir}/node_modules/@opentui/core/package.json`;
  if (!fs.existsSync(path)) throw new Error("not found");
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  console.log(`    v${pkg.version}`);
});

test("xdg-basedir installed", () => {
  const path = `${pluginDir}/node_modules/xdg-basedir/package.json`;
  if (!fs.existsSync(path)) throw new Error("not found");
});

// ═══════════════════════════════════════════════════════════════════
// 4. OPCODE CONFIG
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 4. OPENCODE CONFIG ──");

test("opencode.json exists", () => {
  if (!fs.existsSync(`${configDir}/opencode.json`)) throw new Error("not found");
});

test("opencode.json has plugin", () => {
  const config = JSON.parse(fs.readFileSync(`${configDir}/opencode.json`, "utf8"));
  if (!config.plugin?.includes("@openplugins/token-balance")) throw new Error("plugin not in config");
});

// ═══════════════════════════════════════════════════════════════════
// 5. PLUGIN CAN BE LOADED
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 5. PLUGIN LOADING ──");

test("tui.js can be imported", () => {
  const script = `import "${tuiPath}"; console.log("OK");`;
  fs.writeFileSync("/tmp/test-load.mjs", script);
  const result = execSync(`NODE_PATH=${pluginDir}/node_modules node /tmp/test-load.mjs 2>&1`, { encoding: "utf8" });
  if (!result.includes("OK")) throw new Error(result);
});

test("plugin exports correct structure", () => {
  const script = `
    import m from "${tuiPath}";
    if (!m.id) throw new Error("missing id");
    if (!m.tui) throw new Error("missing tui function");
    if (m.id !== "@openplugins/token-balance") throw new Error("wrong id: " + m.id);
    console.log("OK");
  `;
  fs.writeFileSync("/tmp/test-exports.mjs", script);
  const result = execSync(`NODE_PATH=${pluginDir}/node_modules node /tmp/test-exports.mjs 2>&1`, { encoding: "utf8" });
  if (!result.includes("OK")) throw new Error(result);
});

// ═══════════════════════════════════════════════════════════════════
// 6. COMMANDS IN TUI.JS
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 6. COMMANDS REGISTRATION ──");

test("tui.js registers /tb-setup command", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("tb-setup")) throw new Error("missing tb-setup");
});

test("tui.js registers /quota-toggle command", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("quota-toggle")) throw new Error("missing quota-toggle");
});

test("tui.js registers /set-max-balance command", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("set-max-balance")) throw new Error("missing set-max-balance");
});

test("tui.js registers /toggle-provider command", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("toggle-provider")) throw new Error("missing toggle-provider");
});

// ═══════════════════════════════════════════════════════════════════
// 7. AUTH RESOLUTION
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 7. AUTH RESOLUTION ──");

test("resolveKey function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("resolveKey")) throw new Error("missing resolveKey");
});

test("resolves from DEEPSEEK_API_KEY env var", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("DEEPSEEK_API_KEY")) throw new Error("missing DEEPSEEK_API_KEY");
});

test("resolves from OPENCODE_API_KEY env var", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("OPENCODE_API_KEY")) throw new Error("missing OPENCODE_API_KEY");
});

test("resolves from opencode.json provider config", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("provider")) throw new Error("missing provider lookup");
  if (!content.includes("apiKey")) throw new Error("missing apiKey lookup");
});

test("resolves from token-balance config.json", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("readPluginConfig")) throw new Error("missing readPluginConfig");
  if (!content.includes("apiKeys")) throw new Error("missing apiKeys");
});

test("resolves from auth.json", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("readAuth")) throw new Error("missing readAuth");
});

test("supports {env:VAR} template", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("{env:")) throw new Error("missing {env: template");
});

// ═══════════════════════════════════════════════════════════════════
// 8. PROVIDER VISIBILITY
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 8. PROVIDER VISIBILITY ──");

test("toggle-provider logic exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("token-balance.providers")) throw new Error("missing providers kv");
});

test("provider names defined", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("DeepSeek")) throw new Error("missing DeepSeek");
  if (!content.includes("OpenCode Go")) throw new Error("missing OpenCode Go");
  if (!content.includes("OpenCode Zen")) throw new Error("missing OpenCode Zen");
});

// ═══════════════════════════════════════════════════════════════════
// 9. SIDEBAR RENDERING
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 9. SIDEBAR RENDERING ──");

test("sidebar_content slot registered", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("sidebar_content")) throw new Error("missing sidebar_content");
});

test("DeepSeek section in sidebar", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("DeepSeek")) throw new Error("missing DeepSeek");
});

test("OpenCode Go section in sidebar", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("OpenCode Go")) throw new Error("missing OpenCode Go");
});

test("OpenCode Zen section in sidebar", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("OpenCode Zen")) throw new Error("missing OpenCode Zen");
});

test("bar rendering function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("makeBar")) throw new Error("missing makeBar");
});

test("percentage calculation exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("percentRemaining") && !content.includes("pct")) throw new Error("missing pct");
});

// ═══════════════════════════════════════════════════════════════════
// 10. SETUP WIZARD
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 10. SETUP WIZARD ──");

test("runSetupWizard function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("runSetupWizard")) throw new Error("missing runSetupWizard");
});

test("promptDeepSeek exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("promptDeepSeek")) throw new Error("missing promptDeepSeek");
});

test("promptGo exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("promptGo")) throw new Error("missing promptGo");
});

test("promptZenCookie exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("promptZenCookie")) throw new Error("missing promptZenCookie");
});

test("promptZenWorkspace exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("promptZenWorkspace")) throw new Error("missing promptZenWorkspace");
});

test("showSetupDone exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("showSetupDone")) throw new Error("missing showSetupDone");
});

test("writePluginConfig exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("writePluginConfig")) throw new Error("missing writePluginConfig");
});

test("config dir creation exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("mkdirSync")) throw new Error("missing mkdirSync");
});

// ═══════════════════════════════════════════════════════════════════
// 11. CONFIG PATHS (MULTI-PLATFORM)
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 11. CONFIG PATHS ──");

test("Linux auth.json path", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes('".local"') || !content.includes('"share"')) throw new Error("missing Linux path");
});

test("macOS auth.json path", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes('"Library"') || !content.includes('"Application Support"')) throw new Error("missing macOS path");
});

test("Windows auth.json path", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("AppData")) throw new Error("missing Windows path");
});

test("OPENCODE_CONFIG_DIR env var support", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("OPENCODE_CONFIG_DIR")) throw new Error("missing OPENCODE_CONFIG_DIR");
});

// ═══════════════════════════════════════════════════════════════════
// 12. ZEN CONFIG
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 12. ZEN CONFIG ──");

test("zen workspaceId support", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("workspaceId")) throw new Error("missing workspaceId");
});

test("zen authCookie support", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("authCookie")) throw new Error("missing authCookie");
});

test("old opencode-quota config fallback", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("opencode-quota")) throw new Error("missing old config fallback");
});

// ═══════════════════════════════════════════════════════════════════
// 13. FETCHERS
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 13. FETCHERS ──");

test("fetchDS function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("fetchDS")) throw new Error("missing fetchDS");
});

test("fetchGo function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("fetchGo")) throw new Error("missing fetchGo");
});

test("fetchZen function exists", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("fetchZen")) throw new Error("missing fetchZen");
});

test("DeepSeek API endpoint", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("api.deepseek.com")) throw new Error("missing DeepSeek API");
});

test("OpenCode Go API endpoint", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("opencode.ai/zen/go")) throw new Error("missing Go API");
});

test("Zen billing endpoint", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("billing")) throw new Error("missing billing endpoint");
});

// ═══════════════════════════════════════════════════════════════════
// 14. AUTO-REFRESH
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 14. AUTO-REFRESH ──");

test("refresh interval defined", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("60000") && !content.includes("REFRESH_MS")) throw new Error("missing refresh interval");
});

test("setInterval for auto-refresh", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("setInterval")) throw new Error("missing setInterval");
});

// ═══════════════════════════════════════════════════════════════════
// 15. DEEPSEEK MAX BALANCE
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 15. DEEPSEEK MAX BALANCE ──");

test("deepseekMaxBalance option", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("deepseekMaxBalance")) throw new Error("missing deepseekMaxBalance");
});

test("set-max-balance dialog", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("Set DeepSeek Max Balance")) throw new Error("missing set-max-balance dialog");
});

// ═══════════════════════════════════════════════════════════════════
// 16. KV STORE
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 16. KV STORE ──");

test("kv store for quotaOpen", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("token-balance.quotaOpen")) throw new Error("missing quotaOpen kv");
});

test("kv store for providers", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("token-balance.providers")) throw new Error("missing providers kv");
});

test("kv store for deepseekMaxBalance", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("token-balance.deepseekMaxBalance")) throw new Error("missing maxBalance kv");
});

// ═══════════════════════════════════════════════════════════════════
// 17. ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 17. ERROR HANDLING ──");

test("sin API key message", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("sin API key")) throw new Error("missing sin API key");
});

test("sin datos message", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("sin datos")) throw new Error("missing sin datos");
});

test("error de conexion message", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("error de conexion")) throw new Error("missing error de conexion");
});

test("sin configurar message", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("sin configurar")) throw new Error("missing sin configurar");
});

// ═══════════════════════════════════════════════════════════════════
// 18. LIFECYCLE
// ═══════════════════════════════════════════════════════════════════
console.log("\n── 18. LIFECYCLE ──");

test("createRoot for cleanup", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("createRoot")) throw new Error("missing createRoot");
});

test("onDispose registered", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("onDispose")) throw new Error("missing onDispose");
});

test("clearInterval on cleanup", () => {
  const content = fs.readFileSync(tuiPath, "utf8");
  if (!content.includes("clearInterval")) throw new Error("missing clearInterval");
});

// ═══════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════
console.log("\n====================================");
console.log(`  RESULTS: ${PASS.length} passed, ${FAIL.length} failed`);
console.log("====================================");

if (FAIL.length > 0) {
  console.log("\n❌ FAILED:");
  FAIL.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}

console.log("\n✅ ALL TESTS PASSED");
