/**
 * @openplugins/token-balance — Server plugin entry.
 *
 * Registers slash commands for quota display.
 */

import type { PluginModule } from "@opencode-ai/plugin";

const pluginModule: PluginModule = {
  id: "@openplugins/token-balance",

  async server(input) {
    return {
      dispose: async () => {},
    };
  },
};

export default pluginModule;
