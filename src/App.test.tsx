import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (args: unknown) => Promise<unknown>;
};

const spot = {
  place_id: "demo-watauga-relief-corridor",
  name: "Watauga Relief Corridor",
  address: "Boone Staging Hub to Mountain Shelter B, Watauga County, NC",
  baseline_status: "Regional route feed: passable",
  baseline_detail: "Network update delayed; field verification required",
  lat: 36.2168,
  lng: -81.6746,
  is_seeded: true,
  as_of: new Date().toISOString()
};

const source = {
  id: "src-boone-field",
  handle: "miles828",
  trust_score: 0.91,
  place_id: spot.place_id,
  location_name: "Junaluska Community road access",
  source_kind: "human" as const,
  verification_label: "Field responder check-in",
  lat: spot.lat,
  lng: spot.lng,
  offered: ["route_status", "supply_access", "hazard_report"],
  online: true,
  checked_in_at: new Date().toISOString(),
  last_active: new Date().toISOString(),
  distance_m: 0,
  display_name: "Miles Carter", source_profile: "human" as const,
  channel_label: "Radio CH 3", availability_label: "Available",
  battery_percent: null, mission_status: null, image_url: null, telemetry: {}
};

const machineSource = {
  ...source,
  id: "src-creek-gauge",
  handle: "demo-creek-gauge-7",
  display_name: "Creek depth sensor",
  trust_score: 0.95,
  source_kind: "system" as const,
  source_profile: "sensor" as const,
  verification_label: "Authenticated sensor feed",
  offered: ["flood_depth", "route_status", "hazard_report"]
};

const session = {
  id: "ses-demo",
  source_id: source.id,
  requester_label: "Board user",
  place_id: spot.place_id,
  spot_name: spot.name,
  request_type: "route_status",
  question: "Can aid vehicles safely reach Mountain Shelter B from Boone?",
  status: "pending_approval",
  answer_value: null,
  answer_note: null,
  photo_url: null,
  stars: null,
  created_at: new Date().toISOString(),
  answered_at: null,
  source
};

const responsePartner = {
  id: "partner-high-country",
  name: "High Country Community Response",
  organization_type: "local" as const,
  summary: "Locally led distribution teams coordinating water and shelter supplies from Boone.",
  capabilities: ["water", "shelter", "food"],
  areas: ["Watauga Relief Corridor", "Watauga County"],
  response_status: "active" as const,
  verification_status: "confirmed" as const,
  verification_note: "Operations check-in confirmed at the Boone Staging Hub.",
  contact_channel: "operations@highcountry.example",
  local_led: true,
  route_dependency: "Watauga Relief Corridor",
  updated_at: new Date().toISOString()
};

const responseBundle = {
  incident: {
    id: "helene-watauga-reference",
    name: "Watauga County Relief Coordination",
    area: "Watauga Relief Corridor",
    operational_need: "Move water and temporary shelter supplies from Boone to Mountain Shelter B.",
    published_status: "An earlier route update says the corridor is passable.",
    uncertainty: "Current passability must be confirmed before dispatch.",
    updated_at: new Date().toISOString()
  },
  partners: [responsePartner],
  shortlists: [],
  requests: [],
  field_verification: null,
  inventory: [{ id: "inv-yellow-jacket", item_name: "Yellow-jacket repellent", unit: "cases", on_hand: 18, requested: 60, status: "shortage" as const, location: "Boone Staging Hub", field_signal: "Field teams report increased yellow-jacket activity.", donation_url: "https://donate.example/watauga-relief/repellent", updated_at: new Date().toISOString() }],
  public_drafts: []
};

function installModelContext(synchronous = false) {
  const tools = new Map<string, RegisteredTool>();
  const modelContext = {
    registerTool(
      tool: RegisteredTool,
      options: { signal?: AbortSignal } = {}
    ) {
      tools.set(tool.name, tool);
      options.signal?.addEventListener("abort", () => {
        if (tools.get(tool.name) === tool) tools.delete(tool.name);
      });
      return synchronous ? undefined : Promise.resolve();
    }
  };

  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: modelContext
  });

  return tools;
}

function installFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (url === "/api/state") {
      return Response.json({ spots: [spot], sources: [source, machineSource], sessions: [] });
    }
    if (url === "/api/baseline") return Response.json(spot);
    if (url === "/api/sources/find") {
      return Response.json({ spot, sources: [source, machineSource], radius_m: body.radius_m });
    }
    if (url === "/api/sessions") return Response.json({ session });
    if (url === "/api/sessions/ses-demo/approve") {
      return Response.json({ session: { ...session, status: "sent" } });
    }
    if (url === "/api/sessions/ses-demo/rate") {
      return Response.json({
        session: { ...session, status: "rated", stars: body.stars }
      });
    }
    if (url === "/api/driver?source_id=src-boone-field") {
      return Response.json({ source, sessions: [{ ...session, status: "sent" }] });
    }
    if (url === "/api/drive/check-in") {
      return Response.json({ source: { ...source, id: "src-boone-field" } });
    }
    return Response.json({ session }, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installResponseFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/response/state") return Response.json(responseBundle);
    if (url === "/api/response/incident") return Response.json(responseBundle.incident);
    if (url === "/api/response/partners/find") return Response.json({ partners: [responsePartner], matching_need: body.need, area: body.area });
    if (url === "/api/response/partners/partner-high-country") return Response.json(responsePartner);
    if (url === "/api/response/shortlists") return Response.json({ shortlist: { id: "shortlist-1", ...body, created_at: new Date().toISOString(), partners: [responsePartner] } });
    if (url === "/api/response/requests") return Response.json({ request: { id: "coord-1", ...body, status: "pending_approval", field_verification_required: true, uncertainty: responseBundle.incident.uncertainty, created_at: new Date().toISOString(), approved_at: null }, approval_required: true, recommended_next_step: { page: "/", tool: "find_available_sources" } });
    if (url === "/api/response/work-request/reset") return Response.json({ reset: true, workspace: responseBundle });
    if (url === "/api/response/inventory") return Response.json({ inventory: responseBundle.inventory });
    if (url === "/api/response/appeals") return Response.json({ draft: { id: "draft-1", item_id: body.item_id, channel: "social", copy: "Draft appeal", donation_url: responseBundle.inventory[0].donation_url, status: "draft", created_at: new Date().toISOString() } });
    return Response.json(responseBundle);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("https://example.test/")
  });
});

describe("Grapevine board", () => {
  it("loads the seeded baseline and source picker", async () => {
    installFetch();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Watauga Relief Corridor" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Watauga Relief Corridor")).toBeInTheDocument();
    expect((await screen.findAllByText("Miles Carter")).length).toBeGreaterThan(0);
    expect(screen.getByText("Field responder · Junaluska Community road access")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fallen tree blocking the Mountain Shelter B access route" })).toBeInTheDocument();
    expect(screen.getByText("Creek depth sensor")).toBeInTheDocument();
    expect(screen.getByText("Earlier update says the route was open")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Field inbox" })).toHaveAttribute("href", "/drive");
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument();
  });

  it("creates an approval-gated request by hand", async () => {
    installFetch();
    render(<App />);

    await screen.findAllByText("Miles Carter");
    fireEvent.click(screen.getAllByRole("button", { name: "Request" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Prepare question" }));

    expect(await screen.findByText("pending approval")).toBeInTheDocument();
    expect(screen.getByText("Send question")).toBeInTheDocument();
  });
});

describe("Grapevine routing", () => {
  it("shows a neutral page with no site tools for unknown routes", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://example.test/retired-demo")
    });
    const tools = installModelContext();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(tools.size).toBe(0);
  });
});

describe("Grapevine field inbox", () => {
  it("keeps the human responder view inside the shared demo navigation", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://example.test/drive") });
    localStorage.setItem("grapevine.logistics_source_id", "src-boone-field");
    installFetch();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Field Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Human responder")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Operations Team" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Partner Directory" })).toHaveAttribute("href", "/response");
    expect(screen.getByRole("link", { name: "Warehouse" })).toHaveAttribute("href", "/warehouse");
    expect(screen.queryByText(/sensor registration/i)).not.toBeInTheDocument();
  });
});

describe("Grapevine WebMCP tools", () => {
  it("registers every tool when the browser registration API returns synchronously", async () => {
    installFetch();
    const tools = installModelContext(true);
    render(<App />);

    await waitFor(() => expect(tools.size).toBe(8));
    expect(tools.has("list_available_actions")).toBe(true);
    expect(tools.has("prepare_source_request")).toBe(true);
  });

  it("registers the eight required tools", async () => {
    installFetch();
    const tools = installModelContext();
    render(<App />);

    await waitFor(() => expect(tools.size).toBe(8));
    expect([...tools.keys()].sort()).toEqual([
      "find_available_sources",
      "get_drone_status",
      "get_response",
      "get_web_baseline",
      "list_available_actions",
      "prepare_drone_mission",
      "prepare_source_request",
      "send_source_request"
    ]);
  });

  it("routes tool calls through the Grapevine API actions", async () => {
    installFetch();
    const tools = installModelContext();
    render(<App />);
    await waitFor(() => expect(tools.size).toBe(8));

    const catalog = await tools.get("list_available_actions")!.execute({}) as { actions: Array<{ tool: string; description: string }> };
    expect(catalog.actions).toHaveLength(8);
    expect(catalog.actions.every((action) => action.description.length > 0)).toBe(true);

    const found = (await tools.get("find_available_sources")!.execute({
      near: "Watauga Relief Corridor"
    })) as { sources: Array<{ id: string }> };
    expect(found.sources[0].id).toBe("src-boone-field");

    let created!: { id: string; status: string };
    await act(async () => {
      const prepared = (await tools.get("prepare_source_request")!.execute({
        source_id: "src-boone-field",
        request_type: "route_status",
        question: "Can the aid convoy pass?"
      })) as { request: { id: string; status: string }; approval_required: boolean; sent: boolean };
      expect(prepared.approval_required).toBe(true);
      expect(prepared.sent).toBe(false);
      created = prepared.request;
    });
    expect(created.status).toBe("pending_approval");

    const sent = await tools.get("send_source_request")!.execute({ session_id: created.id }) as { request: { status: string }; sent: boolean };
    expect(sent.sent).toBe(true);
    expect(sent.request.status).toBe("sent");
  });
});

describe("Grapevine resource coordination", () => {
  it("presents the partner workflow and registers only its six WebMCP tools", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://example.test/response") });
    installResponseFetch();
    const tools = installModelContext();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Resource Coordination" })).toBeInTheDocument();
    expect(await screen.findByText("High Country Community Response")).toBeInTheDocument();
    await waitFor(() => expect(tools.size).toBe(6));
    expect([...tools.keys()].sort()).toEqual([
      "create_response_shortlist",
      "find_response_partners",
      "get_crisis_brief",
      "get_partner_details",
      "list_available_actions",
      "prepare_work_request"
    ]);
    expect(screen.getByRole("heading", { name: "Work request" })).toBeInTheDocument();
    expect(screen.queryByText("Active coordination scenario")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Supply gaps, not donation volume" })).not.toBeInTheDocument();
    expect(tools.has("find_available_sources")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/response/work-request/reset", expect.objectContaining({ method: "POST" })));
  });

  it("returns a field-verification handoff after staging coordination", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://example.test/response") });
    installResponseFetch();
    const tools = installModelContext();
    render(<App />);
    await waitFor(() => expect(tools.size).toBe(6));

    const result = await tools.get("prepare_work_request")!.execute({
      shortlist_id: "shortlist-1",
      objective: "Move water to Mountain Shelter B.",
      available_resources: "Two truckloads of bottled water."
    }) as { recommended_next_step: { tool: string } };
    expect(result.recommended_next_step.tool).toBe("find_available_sources");
  });
});

describe("Grapevine warehouse", () => {
  it("presents inventory and registers only its three WebMCP tools", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://example.test/warehouse") });
    installResponseFetch();
    const tools = installModelContext();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Warehouse" })).toBeInTheDocument();
    expect(await screen.findByText("Yellow-jacket repellent")).toBeInTheDocument();
    await waitFor(() => expect(tools.size).toBe(3));
    expect([...tools.keys()].sort()).toEqual([
      "draft_supply_appeal",
      "get_supply_inventory",
      "list_available_actions"
    ]);
    expect(tools.has("find_response_partners")).toBe(false);

    const catalog = await tools.get("list_available_actions")!.execute({}) as { page: string; actions: unknown[] };
    expect(catalog.page).toBe("Warehouse");
    expect(catalog.actions).toHaveLength(3);
  });
});
