import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      tui: "src/tui.tsx",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      "@opencode-ai/plugin",
      "@opencode-ai/plugin/tui",
      "@opentui/core",
      "@opentui/solid",
      "solid-js",
    ],
  },
]);
