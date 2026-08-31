import { useEffect, useMemo, useState } from "react";
import { parseResponseArgs, responseArgSchemas, responseToolSchemas } from "./responseSchemas";
import type { ResponseActions } from "./useResponse";

export type WarehouseWebMCPState = { supported: boolean; registered: boolean; count: number; error: Error | null };

const readOnly = { readOnlyHint: true, untrustedContentHint: true };
const controlled = { readOnlyHint: false, untrustedContentHint: true };

const warehouseActionCatalog = [
  { tool: "list_available_actions", description: "List every WebMCP action available on the Warehouse page and explain what each one does." },
  { tool: "get_supply_inventory", description: "Read inventory and identify shortages, adequate stock, and oversupply." },
  { tool: "draft_supply_appeal", description: "Draft a reviewable social appeal for a verified shortage without publishing it." }
] as const;

export function useWarehouseWebMCPTools(actions: ResponseActions): WarehouseWebMCPState {
  const [state, setState] = useState<WarehouseWebMCPState>({ supported: false, registered: false, count: 0, error: null });
  const tools = useMemo<WebMCPTool[]>(() => [
    {
      name: "list_available_actions",
      description: "List all WebMCP actions available on this Warehouse page with a one-sentence description of each.",
      inputSchema: responseToolSchemas.empty,
      annotations: readOnly,
      async execute(args) {
        parseResponseArgs(responseArgSchemas.empty, args);
        return { page: "Warehouse", actions: warehouseActionCatalog };
      }
    },
    {
      name: "get_supply_inventory",
      description: "Read relief inventory and distinguish verified shortages, adequate stock, and oversupply.",
      inputSchema: responseToolSchemas.inventory,
      annotations: readOnly,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.inventory, args);
        return actions.getSupplyInventory(input.status);
      }
    },
    {
      name: "draft_supply_appeal",
      description: "Create a reviewable social appeal for a verified shortage. This saves a draft and never publishes it.",
      inputSchema: responseToolSchemas.appeal,
      annotations: controlled,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.appeal, args);
        return actions.draftSupplyAppeal(input.item_id);
      }
    }
  ], [actions]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setState({ supported: false, registered: false, count: 0, error: null });
      return;
    }
    const controller = new AbortController();
    let count = 0;
    setState({ supported: true, registered: false, count: 0, error: null });
    void Promise.all(tools.map(async (tool) => {
      await modelContext.registerTool(tool, { signal: controller.signal });
      count += 1;
      if (!controller.signal.aborted) setState({ supported: true, registered: count === tools.length, count, error: null });
    })).catch((caught: unknown) => {
      if (!controller.signal.aborted) setState({ supported: true, registered: false, count, error: caught instanceof Error ? caught : new Error("Warehouse WebMCP registration failed.") });
    });
    return () => controller.abort();
  }, [tools]);

  return state;
}
