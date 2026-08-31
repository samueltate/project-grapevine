import { requestTypes, type RequestType } from "./schemas";
import { handleResponseRequest } from "./responseServer";

type DbSpot = {
  place_id: string;
  name: string;
  address: string;
  hours: string;
  popular_times_now: string;
  rating: number;
  lat: number;
  lng: number;
  is_seeded: number;
  updated_at: string;
};

type DbSource = {
  id: string;
  handle: string;
  trust_score: number;
  place_id: string;
  location_name: string;
  source_kind: "human" | "system";
  verification_label: string;
  lat: number;
  lng: number;
  offered: string;
  online: number;
  checked_in_at: string;
  last_active: string;
  display_name: string;
  source_profile: "human" | "sensor" | "drone";
  channel_label: string;
  availability_label: string;
  battery_percent: number | null;
  mission_status: string | null;
  image_url: string | null;
  telemetry: string;
};

type DbDroneMission = {
  id: string; source_id: string; target_name: string; objective: string;
  target_lat: number | null; target_lng: number | null;
  status: "pending_approval" | "completed"; result_note: string | null;
  image_url: string | null; created_at: string; approved_at: string | null;
};

type DbSession = {
  id: string;
  source_id: string;
  requester_label: string;
  place_id: string;
  spot_name: string;
  request_type: RequestType;
  question: string;
  status: "pending_approval" | "sent" | "answered" | "rated";
  answer_value: string | null;
  answer_note: string | null;
  photo_url: string | null;
  stars: number | null;
  created_at: string;
  answered_at: string | null;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

function notFound() {
  return json({ error: "Not found" }, 404);
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parseOffered(value: string): RequestType[] {
  try {
    const offered = JSON.parse(value);
    return Array.isArray(offered)
      ? offered.filter((item): item is RequestType =>
          requestTypes.includes(item as RequestType)
        )
      : [];
  } catch {
    return [];
  }
}

function presentSpot(spot: DbSpot) {
  return {
    place_id: spot.place_id,
    name: spot.name,
    address: spot.address,
    baseline_status: spot.hours,
    baseline_detail: spot.popular_times_now,
    confidence: spot.rating,
    lat: spot.lat,
    lng: spot.lng,
    is_seeded: Boolean(spot.is_seeded),
    as_of: spot.updated_at
  };
}

function presentSource(source: DbSource, distance_m = 0) {
  return {
    id: source.id,
    handle: source.handle,
    trust_score: source.trust_score,
    place_id: source.place_id,
    location_name: source.location_name,
    source_kind: source.source_kind,
    verification_label: source.verification_label,
    lat: source.lat,
    lng: source.lng,
    offered: parseOffered(source.offered),
    online: Boolean(source.online),
    checked_in_at: source.checked_in_at,
    last_active: source.last_active,
    distance_m,
    display_name: source.display_name || source.handle,
    source_profile: source.source_profile,
    channel_label: source.channel_label,
    availability_label: source.availability_label,
    battery_percent: source.battery_percent,
    mission_status: source.mission_status,
    image_url: source.image_url,
    telemetry: (() => { try { return JSON.parse(source.telemetry || "{}"); } catch { return {}; } })()
  };
}

function sourceIdentity(source: Pick<DbSource, "handle" | "place_id">) {
  return `${normalize(source.handle)}\u0000${source.place_id}`;
}

export function collapseSourceIdentities(sources: DbSource[]) {
  const canonical = new Map<string, DbSource>();
  for (const source of sources) {
    const key = sourceIdentity(source);
    const current = canonical.get(key);
    if (!current || source.last_active > current.last_active) {
      canonical.set(key, source);
    }
  }
  return [...canonical.values()];
}

function presentSession(session: DbSession, source?: DbSource) {
  return {
    id: session.id,
    source_id: session.source_id,
    requester_label: session.requester_label,
    place_id: session.place_id,
    spot_name: session.spot_name,
    request_type: session.request_type,
    question: session.question,
    status: session.status,
    answer_value: session.answer_value,
    answer_note: session.answer_note,
    photo_url: session.photo_url,
    stars: session.stars,
    created_at: session.created_at,
    answered_at: session.answered_at,
    source: source ? presentSource(source) : undefined
  };
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const earthRadius = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

async function resolveSpot(db: D1Database, query: string) {
  const cleaned = normalize(query);
  const exact = await db
    .prepare(
      `SELECT * FROM spots
       WHERE lower(place_id) = ? OR lower(name) = ?
       ORDER BY is_seeded DESC, updated_at DESC
       LIMIT 1`
    )
    .bind(cleaned, cleaned)
    .first<DbSpot>();
  if (exact) return exact;

  const fuzzy = await db
    .prepare("SELECT * FROM spots WHERE lower(name) LIKE ? ORDER BY is_seeded DESC, updated_at DESC LIMIT 1")
    .bind(`%${cleaned}%`)
    .first<DbSpot>();
  if (fuzzy) return fuzzy;

  return db.prepare("SELECT * FROM spots ORDER BY is_seeded DESC, name LIMIT 1").first<DbSpot>();
}

async function handleState(env: Env) {
  const [spots, sources, sessions] = await Promise.all([
    env.DB.prepare("SELECT * FROM spots ORDER BY is_seeded DESC, name").all<DbSpot>(),
    env.DB.prepare(
      "SELECT * FROM sources WHERE online = 1 ORDER BY checked_in_at DESC"
    ).all<DbSource>(),
    env.DB.prepare(
      "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 12"
    ).all<DbSession>()
  ]);
  const visibleSources = collapseSourceIdentities(sources.results);
  const sourceById = new Map(sources.results.map((source) => [source.id, source]));

  return json({
    spots: spots.results.map(presentSpot),
    sources: visibleSources.map((source) => presentSource(source)),
    sessions: sessions.results.map((session) =>
      presentSession(session, sourceById.get(session.source_id))
    )
  });
}

async function handleFindSources(request: Request, env: Env) {
  const body = (await readJson(request)) as { near?: string; radius_m?: number };
  const near = typeof body.near === "string" ? body.near : "";
  const radius = typeof body.radius_m === "number" ? body.radius_m : 1500;
  const spot = await resolveSpot(env.DB, near);
  if (!spot) return json({ spot: null, sources: [] });

  const rows = await env.DB.prepare("SELECT * FROM sources WHERE online = 1").all<DbSource>();
  const sources = collapseSourceIdentities(rows.results)
    .map((source) =>
      presentSource(
        source,
        source.place_id === spot.place_id
          ? 0
          : distanceMeters(spot, { lat: source.lat, lng: source.lng })
      )
    )
    .filter((source) => source.place_id === spot.place_id || source.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m || b.trust_score - a.trust_score);

  return json({ spot: presentSpot(spot), sources, radius_m: radius });
}

async function handleBaseline(request: Request, env: Env) {
  const body = (await readJson(request)) as { spot?: string };
  const spot = await resolveSpot(env.DB, typeof body.spot === "string" ? body.spot : "");
  if (!spot) return json({ error: "No seeded baseline is available." }, 404);
  return json(presentSpot(spot));
}

async function handleCheckIn(request: Request, env: Env) {
  const body = (await readJson(request)) as Record<string, unknown>;
  const placeId =
    typeof body.place_id === "string" && body.place_id.trim()
      ? body.place_id.trim()
      : id("place");
  const name =
    typeof body.location_name === "string" && body.location_name.trim()
      ? body.location_name.trim()
      : "Watauga Relief Corridor";
  const handle =
    typeof body.handle === "string" && body.handle.trim()
      ? body.handle.trim()
      : "field-responder";
  const displayName = typeof body.display_name === "string" && body.display_name.trim()
    ? body.display_name.trim() : handle;
  const channelLabel = typeof body.channel_label === "string" && body.channel_label.trim()
    ? body.channel_label.trim() : "Radio CH 3";
  const offered = Array.isArray(body.offered)
    ? body.offered.filter((item): item is RequestType =>
        requestTypes.includes(item as RequestType)
      )
    : ["route_status", "supply_access", "hazard_report"];
  const lat = typeof body.lat === "number" ? body.lat : 36.2168;
  const lng = typeof body.lng === "number" ? body.lng : -81.6746;
  const requestedSourceId =
    typeof body.source_id === "string" && body.source_id.trim()
      ? body.source_id.trim()
      : id("src");
  const existingIdentity = await env.DB.prepare(
    `SELECT * FROM sources
     WHERE place_id = ? AND lower(trim(handle)) = lower(trim(?))
     ORDER BY last_active DESC, checked_in_at DESC
     LIMIT 1`
  )
    .bind(placeId, handle)
    .first<DbSource>();
  const sourceId = existingIdentity?.id ?? requestedSourceId;
  const timestamp = now();

  await env.DB.prepare(
    `INSERT INTO spots (
      place_id, name, address, hours, popular_times_now, rating, lat, lng, is_seeded, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(place_id) DO UPDATE SET
      name = excluded.name,
      lat = excluded.lat,
      lng = excluded.lng,
      updated_at = excluded.updated_at`
  )
    .bind(
      placeId,
      name,
      typeof body.address === "string" ? body.address : "Field-verified operational area",
      "No published baseline",
      "Awaiting live verification",
      0,
      lat,
      lng,
      timestamp
    )
    .run();

  await env.DB.prepare(
    `UPDATE sources
     SET online = 0
     WHERE id != ? AND place_id = ? AND lower(trim(handle)) = lower(trim(?))`
  )
    .bind(sourceId, placeId, handle)
    .run();

  await env.DB.prepare(
    `INSERT INTO sources (
      id, handle, trust_score, place_id, location_name, source_kind,
      verification_label, lat, lng, offered, online, checked_in_at, last_active,
      display_name, source_profile, channel_label, availability_label
    ) VALUES (?, ?, ?, ?, ?, 'human', 'Responder check-in confirmed', ?, ?, ?, 1, ?, ?, ?, 'human', ?, 'Available')
    ON CONFLICT(id) DO UPDATE SET
      handle = excluded.handle,
      place_id = excluded.place_id,
      location_name = excluded.location_name,
      source_kind = 'human',
      verification_label = 'Responder check-in confirmed',
      lat = excluded.lat,
      lng = excluded.lng,
      offered = excluded.offered,
      online = 1,
      checked_in_at = excluded.checked_in_at,
      last_active = excluded.last_active,
      display_name = excluded.display_name,
      source_profile = 'human',
      channel_label = excluded.channel_label,
      availability_label = 'Available'`
  )
    .bind(
      sourceId,
      handle,
      typeof body.trust_score === "number" ? body.trust_score : 0.82,
      placeId,
      name,
      lat,
      lng,
      JSON.stringify(offered),
      timestamp,
      timestamp,
      displayName,
      channelLabel
    )
    .run();

  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
    .bind(sourceId)
    .first<DbSource>();
  return json({ source: source ? presentSource(source) : null });
}

async function handleCreateSession(request: Request, env: Env) {
  const body = (await readJson(request)) as Record<string, unknown>;
  const sourceId = typeof body.source_id === "string" ? body.source_id : "";
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
    .bind(sourceId)
    .first<DbSource>();
  if (!source || !source.online) return json({ error: "Source is not available." }, 404);

  const requestType = requestTypes.includes(body.request_type as RequestType)
    ? (body.request_type as RequestType)
    : "route_status";
  const session: DbSession = {
    id: id("ses"),
    source_id: source.id,
    requester_label:
      typeof body.requester_label === "string"
        ? body.requester_label
        : "Board user",
    place_id: source.place_id,
    spot_name: source.location_name,
    request_type: requestType,
    question: typeof body.question === "string" ? body.question.trim() : "",
    status: "pending_approval",
    answer_value: null,
    answer_note: null,
    photo_url: null,
    stars: null,
    created_at: now(),
    answered_at: null
  };

  await env.DB.prepare(
    `INSERT INTO sessions (
      id, source_id, requester_label, place_id, spot_name, request_type, question,
      status, answer_value, answer_note, photo_url, stars, created_at, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      session.id,
      session.source_id,
      session.requester_label,
      session.place_id,
      session.spot_name,
      session.request_type,
      session.question,
      session.status,
      session.answer_value,
      session.answer_note,
      session.photo_url,
      session.stars,
      session.created_at,
      session.answered_at
    )
    .run();

  return json({ session: presentSession(session, source) });
}

async function getSession(env: Env, idValue: string) {
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(idValue)
    .first<DbSession>();
  if (!session) return null;
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
    .bind(session.source_id)
    .first<DbSource>();
  return presentSession(session, source ?? undefined);
}

function machineResponse(requestType: RequestType, sourceHandle: string) {
  if (sourceHandle.includes("recon")) {
    const droneResponses: Record<RequestType, { value: string; note: string }> = {
      route_status: { value: "blocked", note: "Simulated aerial observation: a fallen tree blocks both lanes east of Miles's check-in." },
      flood_depth: { value: "unclear", note: "The recon drone does not provide calibrated flood-depth telemetry." },
      supply_access: { value: "inaccessible", note: "The direct vehicle route is obstructed by a fallen tree." },
      hazard_report: { value: "debris", note: "Simulated image classification detects a large fallen tree across both lanes with 94% confidence." },
      custom: { value: "yes", note: "Latest simulated aerial image and telemetry are available in the drone status panel." }
    };
    return droneResponses[requestType];
  }
  if (sourceHandle.includes("camera")) {
    const cameraResponses: Record<RequestType, { value: string; note: string }> = {
      route_status: {
        value: "caution",
        note: "Simulated roadside image classification detects debris on the shoulder; human confirmation is required before dispatch."
      },
      flood_depth: {
        value: "unclear",
        note: "The simulated roadside camera does not provide a calibrated water-depth reading."
      },
      supply_access: {
        value: "limited",
        note: "Simulated image classification indicates one clear lane for high-clearance aid vehicles."
      },
      hazard_report: {
        value: "debris",
        note: "Simulated image classification identifies debris near the eastbound shoulder."
      },
      custom: {
        value: "unclear",
        note: "The simulated camera does not expose a structured reading for this question."
      }
    };
    return cameraResponses[requestType];
  }
  const responses: Record<RequestType, { value: string; note: string }> = {
    route_status: {
      value: "caution",
      note: "Simulated creek gauge flags rising water. High-clearance aid vehicles only."
    },
    flood_depth: {
      value: "6-12 in",
      note: "Simulated authenticated reading: 8.4 inches and rising 0.6 inches per hour."
    },
    supply_access: {
      value: "limited",
      note: "Simulated telemetry indicates one inbound lane is available for aid vehicles."
    },
    hazard_report: {
      value: "flooding",
      note: "Simulated water-level threshold exceeded at the creek crossing."
    },
    custom: {
      value: "unclear",
      note: "The connected system does not expose a structured reading for this question."
    }
  };
  return responses[requestType];
}

async function handleApprove(env: Env, sessionId: string) {
  await env.DB.prepare(
    "UPDATE sessions SET status = 'sent' WHERE id = ? AND status = 'pending_approval'"
  )
    .bind(sessionId)
    .run();
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first<DbSession>();
  if (!row) return notFound();
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
    .bind(row.source_id)
    .first<DbSource>();

  if (source?.source_kind === "system") {
    const automated = machineResponse(row.request_type, source.handle);
    await env.DB.prepare(
      `UPDATE sessions
       SET status = 'answered', answer_value = ?, answer_note = ?, photo_url = ?, answered_at = ?
       WHERE id = ?`
    )
      .bind(automated.value, automated.note, source.image_url, now(), sessionId)
      .run();
  }

  const session = await getSession(env, sessionId);
  return session ? json({ session }) : notFound();
}

async function handleAnswer(request: Request, env: Env, sessionId: string) {
  const body = (await readJson(request)) as Record<string, unknown>;
  const timestamp = now();
  await env.DB.prepare(
    `UPDATE sessions
     SET status = 'answered', answer_value = ?, answer_note = ?, answered_at = ?
     WHERE id = ? AND status IN ('sent', 'pending_approval')`
  )
    .bind(
      typeof body.answer_value === "string" ? body.answer_value : "unclear",
      typeof body.answer_note === "string" ? body.answer_note.trim() : "",
      timestamp,
      sessionId
    )
    .run();
  const session = await getSession(env, sessionId);
  return session ? json({ session }) : notFound();
}

async function handleRate(request: Request, env: Env, sessionId: string) {
  const body = (await readJson(request)) as { stars?: number };
  const stars = Math.min(5, Math.max(1, Math.round(body.stars ?? 5)));
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first<DbSession>();
  if (!session) return notFound();

  await env.DB.batch([
    env.DB.prepare("UPDATE sessions SET status = 'rated', stars = ? WHERE id = ?")
      .bind(stars, sessionId),
    env.DB.prepare(
      `UPDATE sources
       SET trust_score = min(0.99, max(0.10, ((trust_score * 4) + (? / 5.0)) / 5.0))
       WHERE id = ?`
    ).bind(stars, session.source_id)
  ]);

  const updated = await getSession(env, sessionId);
  return updated ? json({ session: updated }) : notFound();
}

async function handleDriver(env: Env, sourceId: string) {
  if (!sourceId) {
    return json({ source: null, sessions: [] });
  }

  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
    .bind(sourceId)
    .first<DbSource>();
  if (!source) return json({ source: null, sessions: [] });

  const sessions = await env.DB.prepare(
    `SELECT sessions.* FROM sessions
     JOIN sources ON sources.id = sessions.source_id
     WHERE sources.place_id = ?
       AND lower(trim(sources.handle)) = lower(trim(?))
       AND sessions.status = 'sent'
     ORDER BY sessions.created_at DESC LIMIT 8`
  )
    .bind(source.place_id, source.handle)
    .all<DbSession>();

  const canonical = await env.DB.prepare(
    `SELECT * FROM sources
     WHERE place_id = ? AND lower(trim(handle)) = lower(trim(?))
     ORDER BY online DESC, last_active DESC, checked_in_at DESC
     LIMIT 1`
  )
    .bind(source.place_id, source.handle)
    .first<DbSource>();

  return json({
    source: presentSource(canonical ?? source),
    sessions: sessions.results.map((session) => presentSession(session, canonical ?? source))
  });
}

async function handleDroneStatus(env: Env, sourceId: string) {
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ? AND source_profile = 'drone'").bind(sourceId).first<DbSource>();
  if (!source) return json({ error: "Recon drone was not found." }, 404);
  const telemetry = (() => { try { return JSON.parse(source.telemetry || "{}"); } catch { return {}; } })();
  return json({ fictional: true, source: presentSource(source), observation: {
    classification: telemetry.classification ?? "No current classification",
    confidence: telemetry.confidence ?? 0,
    image_url: source.image_url
  }});
}

async function prepareDroneMission(request: Request, env: Env) {
  const body = await readJson(request) as Record<string, unknown>;
  const sourceId = typeof body.source_id === "string" ? body.source_id : "";
  const source = await env.DB.prepare("SELECT id FROM sources WHERE id = ? AND source_profile = 'drone'").bind(sourceId).first();
  if (!source) return json({ error: "Recon drone was not found." }, 404);
  const mission: DbDroneMission = {
    id: id("mission"), source_id: sourceId,
    target_name: typeof body.target_name === "string" ? body.target_name.trim() : "Mountain Shelter B",
    objective: typeof body.objective === "string" ? body.objective.trim() : "Capture updated aerial evidence.",
    target_lat: typeof body.target_lat === "number" ? body.target_lat : 36.2193,
    target_lng: typeof body.target_lng === "number" ? body.target_lng : -81.6804,
    status: "pending_approval", result_note: null, image_url: null, created_at: now(), approved_at: null
  };
  await env.DB.prepare(`INSERT INTO drone_missions (id,source_id,target_name,objective,target_lat,target_lng,status,result_note,image_url,created_at,approved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(...Object.values(mission)).run();
  return json({ mission, approval_required: true, real_device_moved: false });
}

async function approveDroneMission(env: Env, missionId: string) {
  const mission = await env.DB.prepare("SELECT * FROM drone_missions WHERE id = ?").bind(missionId).first<DbDroneMission>();
  if (!mission) return json({ error: "Drone mission was not found." }, 404);
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE drone_missions SET status='completed', result_note=?, image_url=?, approved_at=? WHERE id=? AND status='pending_approval'")
      .bind("Simulated reposition complete. Fallen tree confirmed across both lanes.", "/drone-tree-obstruction.png", timestamp, missionId),
    env.DB.prepare("UPDATE sources SET lat=?, lng=?, battery_percent=61, mission_status='Survey complete', availability_label='Returning', last_active=? WHERE id=?")
      .bind(mission.target_lat, mission.target_lng, timestamp, mission.source_id)
  ]);
  const updated = await env.DB.prepare("SELECT * FROM drone_missions WHERE id = ?").bind(missionId).first<DbDroneMission>();
  return json({ mission: updated, simulated_reposition: true, real_device_moved: false });
}

async function handleRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/")) return notFound();
  if (path.startsWith("/api/response/")) return handleResponseRequest(request, env);
  if (request.method === "GET" && path === "/api/state") return handleState(env);
  if (request.method === "POST" && path === "/api/sources/find") {
    return handleFindSources(request, env);
  }
  if (request.method === "POST" && path === "/api/baseline") {
    return handleBaseline(request, env);
  }
  if (request.method === "POST" && path === "/api/drive/check-in") {
    return handleCheckIn(request, env);
  }
  if (request.method === "GET" && path === "/api/driver") {
    return handleDriver(env, url.searchParams.get("source_id") ?? "");
  }
  const droneMatch = path.match(/^\/api\/drones\/([^/]+)$/);
  if (request.method === "GET" && droneMatch) return handleDroneStatus(env, droneMatch[1]);
  if (request.method === "POST" && path === "/api/drone-missions") return prepareDroneMission(request, env);
  const missionMatch = path.match(/^\/api\/drone-missions\/([^/]+)\/approve$/);
  if (request.method === "POST" && missionMatch) return approveDroneMission(env, missionMatch[1]);
  if (request.method === "POST" && path === "/api/sessions") {
    return handleCreateSession(request, env);
  }

  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)(?:\/([^/]+))?$/);
  if (sessionMatch && request.method === "GET" && !sessionMatch[2]) {
    const session = await getSession(env, sessionMatch[1]);
    return session ? json({ session }) : notFound();
  }
  if (sessionMatch && request.method === "POST" && sessionMatch[2] === "approve") {
    return handleApprove(env, sessionMatch[1]);
  }
  if (sessionMatch && request.method === "POST" && sessionMatch[2] === "answer") {
    return handleAnswer(request, env, sessionMatch[1]);
  }
  if (sessionMatch && request.method === "POST" && sessionMatch[2] === "rate") {
    return handleRate(request, env, sessionMatch[1]);
  }

  return notFound();
}

export default {
  fetch(request, env) {
    return handleRequest(request, env).catch((error: unknown) =>
      json(
        {
          error:
            error instanceof Error ? error.message : "Unexpected server error."
        },
        500
      )
    );
  }
} satisfies ExportedHandler<Env>;
