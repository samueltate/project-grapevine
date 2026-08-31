import { useEffect, useMemo, useState } from "react";
import { parseResponseArgs, responseArgSchemas, responseToolSchemas } from "./responseSchemas";
import type { ResponseActions } from "./useResponse";

export type ResponseWebMCPState = { supported: boolean; registered: boolean; count: number; error: Error | null };

const readOnly = { readOnlyHint: true, untrustedContentHint: true };
const controlled = { readOnlyHint: false, untrustedContentHint: true };

const responseActionCatalog = [
  { tool: "list_available_actions", description: "List every WebMCP action available on the Partner Directory page and explain what each one does." },
  { tool: "get_crisis_brief", description: "Read the simulated Western North Carolina incident brief and its known uncertainty." },
  { tool: "find_response_partners", description: "Find simulated relief partners by area, capability, and local leadership." },
  { tool: "get_partner_details", description: "Inspect a partner's capabilities, evidence, contact channel, and route dependency." },
  { tool: "create_response_shortlist", description: "Save a transparent partner shortlist without contacting or endorsing an organization." },
  { tool: "prepare_coordination_request", description: "Stage a simulated crew coordination request for human approval." },
  { tool: "get_supply_inventory", description: "Read simulated inventory and identify shortages, adequate stock, and oversupply." },
  { tool: "draft_supply_appeal", description: "Draft a reviewable social appeal for a verified shortage without publishing it." }
] as const;

export function useResponseWebMCPTools(actions: ResponseActions): ResponseWebMCPState {
  const [state, setState] = useState<ResponseWebMCPState>({ supported: false, registered: false, count: 0, error: null });
  const tools = useMemo<WebMCPTool[]>(() => [
    {
      name: "list_available_actions",
      description: "List all WebMCP actions available on this Partner Directory page with a one-sentence description of each.",
      inputSchema: responseToolSchemas.empty,
      annotations: readOnly,
      async execute(args) {
        parseResponseArgs(responseArgSchemas.empty, args);
        return { page: "Partner Directory", actions: responseActionCatalog };
      }
    },
    {
      name: "get_crisis_brief",
      description: "Read the simulated Western North Carolina incident brief, including the published status and known uncertainty.",
      inputSchema: responseToolSchemas.empty,
      annotations: readOnly,
      async execute(args) {
        parseResponseArgs(responseArgSchemas.empty, args);
        return actions.getIncidentBrief();
      }
    },
    {
      name: "find_response_partners",
      description: "Find simulated relief partners by operational area, capability, and locally led status.",
      inputSchema: responseToolSchemas.findPartners,
      annotations: readOnly,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.findPartners, args);
        return actions.findPartners(input.need, input.area, input.local_led_only);
      }
    },
    {
      name: "get_partner_details",
      description: "Inspect a simulated partner's capabilities, operating areas, verification evidence, contact channel, and route dependency.",
      inputSchema: responseToolSchemas.partnerDetails,
      annotations: readOnly,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.partnerDetails, args);
        return actions.getPartnerDetails(input.partner_id);
      }
    },
    {
      name: "create_response_shortlist",
      description: "Save a transparent partner shortlist in the coordinator workspace. This does not contact or endorse an organization.",
      inputSchema: responseToolSchemas.shortlist,
      annotations: controlled,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.shortlist, args);
        return actions.createShortlist(input);
      }
    },
    {
      name: "prepare_coordination_request",
      description: "Stage a simulated partner coordination request for human approval. If route evidence is uncertain, the result directs the coordinator to live field verification in Demo 1.",
      inputSchema: responseToolSchemas.coordination,
      annotations: controlled,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.coordination, args);
        return actions.prepareCoordination(input);
      }
    },
    {
      name: "get_supply_inventory",
      description: "Read simulated relief inventory and distinguish verified shortages, adequate stock, and oversupply.",
      inputSchema: responseToolSchemas.inventory,
      annotations: readOnly,
      async execute(args) {
        const input = parseResponseArgs(responseArgSchemas.inventory, args);
        return actions.getSupplyInventory(input.status);
      }
    },
    {
      name: "draft_supply_appeal",
      description: "Create a reviewable social appeal for a verified simulated shortage. This saves a draft and never publishes it.",
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
      if (!controller.signal.aborted) setState({ supported: true, registered: false, count, error: caught instanceof Error ? caught : new Error("Response WebMCP registration failed.") });
    });
    return () => controller.abort();
  }, [tools]);

  return state;
}
