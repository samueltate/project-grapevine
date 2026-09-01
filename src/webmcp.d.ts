export {};

// These declarations cover the experimental WebMCP imperative-registration
// surface used by this demo until the browser API ships in TypeScript's DOM types.
declare global {
  interface WebMCPTool {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: {
      readOnlyHint?: boolean;
      untrustedContentHint?: boolean;
    };
    execute(input: unknown): Promise<unknown>;
  }

  interface WebMCPRegisterToolOptions {
    signal?: AbortSignal;
  }

  interface Document {
    readonly modelContext?: {
      registerTool(
        tool: WebMCPTool,
        options?: WebMCPRegisterToolOptions
      ): void | Promise<void>;
    };
  }
}
