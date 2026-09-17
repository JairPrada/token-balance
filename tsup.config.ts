import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      tui: "src/tui.tsx",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      "@opencode-ai/plugin",
      "@opentui/core",
      "@opentui/solid",
      "solid-js",
    ],
    esbuildOptions(options) {
      options.jsx = "automatic";
      options.jsxImportSource = "@opentui/solid";
    },
  },
]);
