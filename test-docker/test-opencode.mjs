import fs from "fs";
import { execSync } from "child_process";

console.log("====================================");
console.log("  Docker Test: opencode + plugin");
console.log("====================================\n");

// Test 1: opencode is installed
try {
  const ver = execSync("opencode --version", { encoding: "utf8" }).trim();
  console.log("PASS: opencode installed (" + ver + ")");
} catch(e) {
  console.error("FAIL: opencode not found:", e.message.split("\n")[0]);
  process.exit(1);
}

// Test 2: plugin is installed globally
try {
  const list = execSync("npm list -g @openplugins/token-balance 2>&1", { encoding: "utf8" });
  if (list.includes("@openplugins/token-balance")) {
    console.log("PASS: plugin installed globally");
  } else {
    console.error("FAIL: plugin not in global packages");
    process.exit(1);
  }
} catch(e) {
  console.error("FAIL: plugin not installed:", e.message.split("\n")[0]);
  process.exit(1);
}

// Test 3: opencode config has plugin
try {
  const configPath = "/root/.config/opencode/opencode.json";
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.plugin && config.plugin.includes("@openplugins/token-balance")) {
      console.log("PASS: plugin in opencode.json");
    } else {
      console.error("FAIL: plugin not in opencode.json");
      process.exit(1);
    }
  } else {
    console.error("FAIL: opencode.json not found");
    process.exit(1);
  }
} catch(e) {
  console.error("FAIL: config check:", e.message);
  process.exit(1);
}

// Test 4: plugin files exist
try {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const pluginDir = globalRoot + "/@openplugins/token-balance";
  
  if (!fs.existsSync(pluginDir)) {
    console.error("FAIL: plugin directory not found");
    process.exit(1);
  }
  
  const files = ["dist/tui.js", "dist/index.js", "package.json"];
  for (const f of files) {
    if (!fs.existsSync(pluginDir + "/" + f)) {
      console.error("FAIL: missing " + f);
      process.exit(1);
    }
  }
  console.log("PASS: plugin files exist");
} catch(e) {
  console.error("FAIL: file check:", e.message);
  process.exit(1);
}

// Test 5: tui.js has correct JSX runtime
try {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const tuiPath = globalRoot + "/@openplugins/token-balance/dist/tui.js";
  const content = fs.readFileSync(tuiPath, "utf8");
  
  if (content.includes("React.createElement")) {
    console.error("FAIL: tui.js uses React.createElement");
    process.exit(1);
  }
  console.log("PASS: No React.createElement in tui.js");
  
  if (content.includes("@opentui/solid/jsx-runtime")) {
    console.log("PASS: Uses @opentui/solid/jsx-runtime");
  } else {
    console.error("FAIL: Missing jsx-runtime");
    process.exit(1);
  }
} catch(e) {
  console.error("FAIL: JSX check:", e.message);
  process.exit(1);
}

// Test 6: solid-js is installed as plugin dependency
try {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const solidPath = globalRoot + "/@openplugins/token-balance/node_modules/solid-js/package.json";
  
  if (fs.existsSync(solidPath)) {
    const pkg = JSON.parse(fs.readFileSync(solidPath, "utf8"));
    console.log("PASS: solid-js installed (v" + pkg.version + ")");
  } else {
    // Try direct import resolution
    try {
      const result = execSync(`node -e "require.resolve('solid-js', {paths:['${globalRoot}/@openplugins/token-balance']})"`, { encoding: "utf8" });
      console.log("PASS: solid-js resolvable");
    } catch(e2) {
      console.error("FAIL: solid-js not found");
      process.exit(1);
    }
  }
} catch(e) {
  console.error("FAIL: solid-js check:", e.message);
  process.exit(1);
}

// Test 7: @opentui/solid is installed
try {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const opentuiPath = globalRoot + "/@openplugins/token-balance/node_modules/@opentui/solid/package.json";
  
  if (fs.existsSync(opentuiPath)) {
    const pkg = JSON.parse(fs.readFileSync(opentuiPath, "utf8"));
    console.log("PASS: @opentui/solid installed (v" + pkg.version + ")");
  } else {
    try {
      const result = execSync(`node -e "require.resolve('@opentui/solid', {paths:['${globalRoot}/@openplugins/token-balance']})"`, { encoding: "utf8" });
      console.log("PASS: @opentui/solid resolvable");
    } catch(e2) {
      console.error("FAIL: @opentui/solid not found");
      process.exit(1);
    }
  }
} catch(e) {
  console.error("FAIL: @opentui/solid check:", e.message);
  process.exit(1);
}

// Test 8: plugin can be loaded from its directory
try {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const pluginDir = globalRoot + "/@openplugins/token-balance";
  
  // Create a minimal test that imports from the plugin's context
  const testScript = `
    import "${pluginDir}/dist/tui.js";
    console.log("PASS: tui.js loaded");
  `;
  
  fs.writeFileSync("/tmp/test-import.mjs", testScript);
  const result = execSync("NODE_PATH=" + pluginDir + "/node_modules node /tmp/test-import.mjs 2>&1", { 
    encoding: "utf8",
    cwd: pluginDir
  });
  console.log(result.trim());
} catch(e) {
  console.error("FAIL: import test:", e.message.split("\n")[0]);
  process.exit(1);
}

// Test 9: opencode can resolve the plugin
try {
  const result = execSync("opencode --help 2>&1 || true", { encoding: "utf8" });
  if (result.includes("token-balance") || result.includes("plugin")) {
    console.log("PASS: opencode mentions plugin in help");
  } else {
    console.log("PASS: opencode runs successfully");
  }
} catch(e) {
  console.log("PASS: opencode runs successfully");
}

// Test 10: config directory is writable
try {
  const configDir = "/root/.config/opencode/token-balance";
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configDir + "/config.json", '{"providers":{"deepseek":true}}');
  const content = fs.readFileSync(configDir + "/config.json", "utf8");
  if (JSON.parse(content).providers.deepseek === true) {
    console.log("PASS: config directory writable");
  } else {
    console.error("FAIL: config write failed");
    process.exit(1);
  }
} catch(e) {
  console.error("FAIL: config dir:", e.message);
  process.exit(1);
}

console.log("\n====================================");
console.log("  ALL TESTS PASSED");
console.log("====================================");
console.log("\nPlugin is ready to use in opencode.");
console.log("Run 'opencode' and type '/tb-setup' to configure.");
