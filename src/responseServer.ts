import { responseNeeds, type ResponseNeed } from "./responseSchemas";

type DbPartner = {
  id: string;
  name: string;
  organization_type: "local" | "regional" | "national";
  summary: string;
  capabilities: string;
  areas: string;
  response_status: "active" | "standby";
  verification_status: "confirmed" | "self_reported";
  verification_note: string;
  contact_channel: string;
  local_led: number;
  route_dependency: string | null;
  updated_at: string;
};

type DbShortlist = {
  id: string;
  title: string;
  need: ResponseNeed;
  area: string;
  partner_ids: string;
  rationale: string;
  created_at: string;
};

type DbCoordinationRequest = {
  id: string;
  shortlist_id: string;
  objective: string;
  available_resources: string;
  status: "pending_approval" | "approved";
  field_verification_required: number;
  uncertainty: string;
  created_at: string;
  approved_at: string | null;
};

type DbFieldVerification = {
  id: string;
  answer_value: string;
  answer_note: string | null;
  answered_at: string;
  source_name: string;
};

type DbInventory = { id: string; item_name: string; unit: string; on_hand: number; requested: number; status: "shortage" | "adequate" | "surplus"; location: string; field_signal: string; donation_url: string; updated_at: string };
type DbDraft = { id: string; item_id: string; channel: string; copy: string; donation_url: string; status: "draft"; created_at: string };

const incident = {
  id: "helene-watauga-reference",
  name: "Watauga County Relief Coordination",
  area: "Watauga Relief Corridor",
  operational_need: "Clear a fallen tree blocking access to Mountain Shelter B, then coordinate priority supplies.",
  published_status: "Miles reported a fallen tree; simulated aerial evidence can confirm the obstruction before a crew is assigned.",
  uncertainty: "The obstruction and exact work site must be confirmed before a debris-clearance crew is dispatched.",
  updated_at: "2030-09-28T13:30:00.000Z"
};

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

async function readJson(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return {}; }
}

function stringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function presentPartner(partner: DbPartner) {
  return {
    ...partner,
    capabilities: stringList(partner.capabilities) as ResponseNeed[],
    areas: stringList(partner.areas),
    local_led: Boolean(partner.local_led)
  };
}

function presentShortlist(shortlist: DbShortlist, partners: DbPartner[] = []) {
  const partnerIds = stringList(shortlist.partner_ids);
  return {
    ...shortlist,
    partner_ids: partnerIds,
    partners: partners.filter((partner) => partnerIds.includes(partner.id)).map(presentPartner)
  };
}

function presentRequest(request: DbCoordinationRequest) {
  return { ...request, field_verification_required: Boolean(request.field_verification_required) };
}

async function getBundle(env: Env) {
  const [partners, shortlists, requests, fieldVerification, inventory, drafts] = await Promise.all([
    env.DB.prepare("SELECT * FROM response_partners ORDER BY local_led DESC, response_status, name").all<DbPartner>(),
    env.DB.prepare("SELECT * FROM response_shortlists ORDER BY created_at DESC LIMIT 6").all<DbShortlist>(),
    env.DB.prepare("SELECT * FROM response_coordination_requests ORDER BY created_at DESC LIMIT 6").all<DbCoordinationRequest>(),
    env.DB.prepare(`SELECT sessions.id, sessions.answer_value, sessions.answer_note, sessions.answered_at,
      sources.handle AS source_name FROM sessions JOIN sources ON sources.id = sessions.source_id
      WHERE sessions.place_id = 'demo-watauga-relief-corridor'
        AND sessions.request_type = 'route_status'
        AND sources.source_profile = 'human'
        AND sessions.status IN ('answered', 'rated')
        AND sessions.answer_value IS NOT NULL
      ORDER BY sessions.answered_at DESC LIMIT 1`).first<DbFieldVerification>(),
    env.DB.prepare("SELECT * FROM response_inventory ORDER BY CASE status WHEN 'shortage' THEN 0 WHEN 'adequate' THEN 1 ELSE 2 END, item_name").all<DbInventory>(),
    env.DB.prepare("SELECT * FROM response_public_drafts ORDER BY created_at DESC LIMIT 6").all<DbDraft>()
  ]);
  return {
    fictional: true as const,
    incident,
    partners: partners.results.map(presentPartner),
    shortlists: shortlists.results.map((item) => presentShortlist(item, partners.results)),
    requests: requests.results.map(presentRequest),
    field_verification: fieldVerification ? {
      session_id: fieldVerification.id,
      answer_value: fieldVerification.answer_value,
      answer_note: fieldVerification.answer_note,
      source_name: fieldVerification.source_name.replaceAll("-", " "),
      answered_at: fieldVerification.answered_at
    } : null,
    inventory: inventory.results,
    public_drafts: drafts.results
  };
}

async function findPartners(request: Request, env: Env) {
  const body = await readJson(request);
  const need = responseNeeds.includes(body.need as ResponseNeed) ? body.need as ResponseNeed : "water";
  const area = typeof body.area === "string" && body.area.trim() ? body.area.trim() : incident.area;
  const localOnly = body.local_led_only === true;
  const result = await env.DB.prepare(`SELECT * FROM response_partners
    WHERE capabilities LIKE ? AND areas LIKE ? ${localOnly ? "AND local_led = 1" : ""}
    ORDER BY local_led DESC, response_status, name`)
    .bind(`%\"${need}\"%`, `%${area}%`)
    .all<DbPartner>();
  return json({
    fictional: true,
    matching_need: need,
    area,
    partners: result.results.map(presentPartner),
    caveat: "Directory matches are simulated and are not endorsements. Review evidence and current conditions before coordination."
  });
}

async function createShortlist(request: Request, env: Env) {
  const body = await readJson(request);
  const partnerIds = Array.isArray(body.partner_ids) ? body.partner_ids.filter((item): item is string => typeof item === "string").slice(0, 4) : [];
  if (partnerIds.length === 0) return json({ error: "At least one partner is required." }, 400);
  const valid = await env.DB.prepare(`SELECT * FROM response_partners WHERE id IN (${partnerIds.map(() => "?").join(",")})`)
    .bind(...partnerIds).all<DbPartner>();
  if (valid.results.length !== partnerIds.length) return json({ error: "One or more partners were not found." }, 400);
  const shortlist: DbShortlist = {
    id: id("shortlist"),
    title: typeof body.title === "string" ? body.title.trim() : "Response shortlist",
    need: responseNeeds.includes(body.need as ResponseNeed) ? body.need as ResponseNeed : "water",
    area: typeof body.area === "string" ? body.area.trim() : incident.area,
    partner_ids: JSON.stringify(partnerIds),
    rationale: typeof body.rationale === "string" ? body.rationale.trim() : "Matched by capability and operating area.",
    created_at: now()
  };
  await env.DB.prepare(`INSERT INTO response_shortlists (id, title, need, area, partner_ids, rationale, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(shortlist.id, shortlist.title, shortlist.need, shortlist.area, shortlist.partner_ids, shortlist.rationale, shortlist.created_at).run();
  return json({ shortlist: presentShortlist(shortlist, valid.results), persisted: true });
}

async function prepareCoordination(request: Request, env: Env) {
  const body = await readJson(request);
  const shortlistId = typeof body.shortlist_id === "string" ? body.shortlist_id : "";
  const shortlist = await env.DB.prepare("SELECT * FROM response_shortlists WHERE id = ?").bind(shortlistId).first<DbShortlist>();
  if (!shortlist) return json({ error: "Response shortlist was not found." }, 404);
  const timestamp = now();
  const item: DbCoordinationRequest = {
    id: id("coord"),
    shortlist_id: shortlistId,
    objective: typeof body.objective === "string" ? body.objective.trim() : incident.operational_need,
    available_resources: typeof body.available_resources === "string" ? body.available_resources.trim() : "Relief supplies",
    status: "pending_approval",
    field_verification_required: 1,
    uncertainty: incident.uncertainty,
    created_at: timestamp,
    approved_at: null
  };
  await env.DB.prepare(`INSERT INTO response_coordination_requests
    (id, shortlist_id, objective, available_resources, status, field_verification_required, uncertainty, created_at, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(item.id, item.shortlist_id, item.objective, item.available_resources, item.status, item.field_verification_required, item.uncertainty, item.created_at, item.approved_at).run();
  return json({
    request: presentRequest(item),
    approval_required: true,
    external_contact_made: false,
    recommended_next_step: {
      reason: "The selected partners depend on the Watauga Relief Corridor, whose published status may be stale.",
      page: "/",
      tool: "find_available_sources",
      near: incident.area,
      follow_with: "prepare_source_request using request_type route_status, then send_source_request after explicit user approval"
    }
  });
}

async function approveCoordination(env: Env, requestId: string) {
  const requestItem = await env.DB.prepare(`SELECT response_coordination_requests.*, response_shortlists.need AS need
    FROM response_coordination_requests JOIN response_shortlists ON response_shortlists.id = response_coordination_requests.shortlist_id
    WHERE response_coordination_requests.id = ?`).bind(requestId).first<DbCoordinationRequest & { need: ResponseNeed }>();
  if (!requestItem) return json({ error: "Coordination request was not found." }, 404);
  const verification = await env.DB.prepare(`SELECT sessions.answer_value FROM sessions
    JOIN sources ON sources.id = sessions.source_id
    WHERE sessions.place_id = 'demo-watauga-relief-corridor' AND sessions.request_type = 'route_status'
      AND sources.source_profile = 'human'
      AND sessions.status IN ('answered', 'rated') AND sessions.answer_value IS NOT NULL
    ORDER BY sessions.answered_at DESC LIMIT 1`).first<{ answer_value: string }>();
  const evidenceReady = requestItem.need === "debris_clearance"
    ? ["blocked", "caution"].includes(verification?.answer_value ?? "")
    : verification?.answer_value === "passable";
  if (!evidenceReady) {
    return json({ error: requestItem.need === "debris_clearance" ? "A current obstruction report is required before crew approval." : "A current passable field report is required before dispatch approval." }, 409);
  }
  const timestamp = now();
  await env.DB.prepare("UPDATE response_coordination_requests SET status = 'approved', approved_at = ? WHERE id = ? AND status = 'pending_approval'")
    .bind(timestamp, requestId).run();
  const item = await env.DB.prepare("SELECT * FROM response_coordination_requests WHERE id = ?").bind(requestId).first<DbCoordinationRequest>();
  return item ? json({ request: presentRequest(item), external_contact_made: false, result: "Coordination plan approved for the simulation. Field verification remains required before dispatch." }) : json({ error: "Coordination request was not found." }, 404);
}

async function getInventory(request: Request, env: Env) {
  const body = await readJson(request);
  const status = typeof body.status === "string" ? body.status : "";
  const result = status
    ? await env.DB.prepare("SELECT * FROM response_inventory WHERE status = ? ORDER BY item_name").bind(status).all<DbInventory>()
    : await env.DB.prepare("SELECT * FROM response_inventory ORDER BY item_name").all<DbInventory>();
  return json({ fictional: true, inventory: result.results });
}

async function draftAppeal(request: Request, env: Env) {
  const body = await readJson(request);
  const itemId = typeof body.item_id === "string" ? body.item_id : "";
  const item = await env.DB.prepare("SELECT * FROM response_inventory WHERE id = ?").bind(itemId).first<DbInventory>();
  if (!item) return json({ error: "Inventory item was not found." }, 404);
  if (item.status !== "shortage") return json({ error: "Public appeals are only drafted for verified shortages in this simulation." }, 409);
  const draft: DbDraft = {
    id: id("draft"), item_id: item.id, channel: "social",
    copy: `Watauga County relief teams need ${item.item_name.toLowerCase()}. ${item.field_signal} Current stock is ${item.on_hand} ${item.unit} against a request for ${item.requested}. Help fill this verified gap: ${item.donation_url}`,
    donation_url: item.donation_url, status: "draft", created_at: now()
  };
  await env.DB.prepare("INSERT INTO response_public_drafts (id,item_id,channel,copy,donation_url,status,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(draft.id,draft.item_id,draft.channel,draft.copy,draft.donation_url,draft.status,draft.created_at).run();
  return json({ draft, review_required: true, published: false });
}

export async function handleResponseRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/response/state") return json(await getBundle(env));
  if (request.method === "GET" && path === "/api/response/incident") return json({ fictional: true, ...incident });
  if (request.method === "POST" && path === "/api/response/partners/find") return findPartners(request, env);
  const partnerMatch = path.match(/^\/api\/response\/partners\/([^/]+)$/);
  if (request.method === "GET" && partnerMatch) {
    const partner = await env.DB.prepare("SELECT * FROM response_partners WHERE id = ?").bind(partnerMatch[1]).first<DbPartner>();
    return partner ? json(presentPartner(partner)) : json({ error: "Response partner was not found." }, 404);
  }
  if (request.method === "POST" && path === "/api/response/shortlists") return createShortlist(request, env);
  if (request.method === "POST" && path === "/api/response/requests") return prepareCoordination(request, env);
  if (request.method === "POST" && path === "/api/response/inventory") return getInventory(request, env);
  if (request.method === "POST" && path === "/api/response/appeals") return draftAppeal(request, env);
  const approvalMatch = path.match(/^\/api\/response\/requests\/([^/]+)\/approve$/);
  if (request.method === "POST" && approvalMatch) return approveCoordination(env, approvalMatch[1]);
  return json({ error: "Response coordination endpoint not found." }, 404);
}
