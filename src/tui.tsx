/** @jsxImportSource @opentui/solid */
/**
 * @openplugins/token-balance — TUI plugin entry.
 *
 * Registers the sidebar panel showing token balances for all providers.
 */

import type { TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot } from "solid-js";
import { SidebarView } from "./ui/sidebar.js";

const id = "@openplugins/token-balance";
const SIDEBAR_ORDER = 151;

const tui: TuiPluginModule["tui"] = async (api) => {
  const dispose = createRoot((disposeRoot) => {
    api.slots.register({
      order: SIDEBAR_ORDER,
      slots: {
        sidebar_content(_ctx, props) {
          return <SidebarView api={api} sessionID={props.session_id} />;
        },
      },
    });

    return disposeRoot;
  });

  api.lifecycle.onDispose(dispose);
};

const pluginModule: TuiPluginModule & { id: string } = { id, tui };

export default pluginModule;
