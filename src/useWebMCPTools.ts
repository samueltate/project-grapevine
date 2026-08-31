import { useEffect, useMemo, useState } from "react";
import {
  askSourceArgsSchema,
  findAvailableSourcesArgsSchema,
  getResponseArgsSchema,
  getDroneStatusArgsSchema,
  getWebBaselineArgsSchema,
  parseArgs,
  prepareDroneMissionArgsSchema,
  toolInputSchemas
} from "./schemas";
import type { GrapevineActions } from "./useGrapevine";

const annotations = {
  readOnlyHint: false,
  untrustedContentHint: true
};

export type WebMCPToolsState = {
  supported: boolean;
  registered: boolean;
  error: Error | null;
  count: number;
};

type ToolRegistration = {
  name: string;
  error: Error | null;
  registered: boolean;
  supported: boolean;
};

function useWebMCPTool(tool: WebMCPTool): ToolRegistration {
  const [state, setState] = useState<ToolRegistration>({
    name: tool.name,
    supported: false,
    registered: false,
    error: null
  });

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setState({
        name: tool.name,
        supported: false,
        registered: false,
        error: null
      });
      return;
    }

    const controller = new AbortController();
    setState({
      name: tool.name,
      supported: true,
      registered: false,
      error: null
    });

    void modelContext
      .registerTool(tool, { signal: controller.signal })
      .then(() => {
        if (!controller.signal.aborted) {
          setState({
            name: tool.name,
            supported: true,
            registered: true,
            error: null
          });
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            name: tool.name,
            supported: true,
            registered: false,
            error:
              caught instanceof Error
                ? caught
                : new Error("WebMCP tool registration failed.")
          });
        }
      });

    return () => controller.abort();
  }, [tool]);

  return state;
}

export function useWebMCPTools(actions: GrapevineActions): WebMCPToolsState {
  const tools = useMemo(
    () => ({
      findAvailableSources: {
        name: "find_available_sources",
        description:
          "Find available human responders and authenticated machine sources near an operational area.",
        inputSchema: toolInputSchemas.findAvailableSources,
        annotations: { ...annotations, readOnlyHint: true },
        async execute(args: unknown) {
          const { near, radius_m = 1500 } = parseArgs(
            findAvailableSourcesArgsSchema,
            args
          );
          return actions.findAvailableSources(near, radius_m);
        }
      } satisfies WebMCPTool,
      getWebBaseline: {
        name: "get_web_baseline",
        description:
          "Get the published operational baseline before requesting live ground truth.",
        inputSchema: toolInputSchemas.getWebBaseline,
        annotations: { ...annotations, readOnlyHint: true },
        async execute(args: unknown) {
          const { spot } = parseArgs(getWebBaselineArgsSchema, args);
          return actions.getWebBaseline(spot);
        }
      } satisfies WebMCPTool,
      askSource: {
        name: "ask_source",
        description:
          "Prepare a structured request for a human or machine source. The request requires user authorization before dispatch.",
        inputSchema: toolInputSchemas.askSource,
        annotations,
        async execute(args: unknown) {
          const { source_id, request_type, question = "" } = parseArgs(
            askSourceArgsSchema,
            args
          );
          return actions.askSource(source_id, request_type, question);
        }
      } satisfies WebMCPTool,
      getResponse: {
        name: "get_response",
        description:
          "Poll for the structured answer to an authorized source request, waiting up to 10 seconds.",
        inputSchema: toolInputSchemas.getResponse,
        annotations: { ...annotations, readOnlyHint: true },
        async execute(args: unknown) {
          const { session_id } = parseArgs(getResponseArgsSchema, args);
          return actions.getResponse(session_id);
        }
      } satisfies WebMCPTool,
      getDroneStatus: {
        name: "get_drone_status",
        description:
          "Read simulated recon-drone battery, connection, position, mission status, and latest aerial observation.",
        inputSchema: toolInputSchemas.getDroneStatus,
        annotations: { ...annotations, readOnlyHint: true },
        async execute(args: unknown) {
          const { source_id } = parseArgs(getDroneStatusArgsSchema, args);
          return actions.getDroneStatus(source_id);
        }
      } satisfies WebMCPTool,
      prepareDroneMission: {
        name: "prepare_drone_mission",
        description:
          "Stage a simulated drone repositioning mission for visible human approval. This never moves a real device.",
        inputSchema: toolInputSchemas.prepareDroneMission,
        annotations,
        async execute(args: unknown) {
          return actions.prepareDroneMission(parseArgs(prepareDroneMissionArgsSchema, args));
        }
      } satisfies WebMCPTool
    }),
    [actions]
  );

  const registrations = [
    useWebMCPTool(tools.findAvailableSources),
    useWebMCPTool(tools.getWebBaseline),
    useWebMCPTool(tools.askSource),
    useWebMCPTool(tools.getResponse),
    useWebMCPTool(tools.getDroneStatus),
    useWebMCPTool(tools.prepareDroneMission)
  ];

  const error = registrations.find((item) => item.error)?.error ?? null;
  const supported = registrations.some((item) => item.supported);
  const registered =
    registrations.length > 0 && registrations.every((item) => item.registered);

  return {
    supported,
    registered,
    error,
    count: registrations.filter((item) => item.registered).length
  };
}
