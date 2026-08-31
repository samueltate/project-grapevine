import * as z from "zod/mini";

z.config(z.locales.en());

export const requestTypes = [
  "route_status",
  "flood_depth",
  "supply_access",
  "hazard_report",
  "custom"
] as const;

export const answerOptions = {
  route_status: ["passable", "caution", "blocked", "unknown"],
  flood_depth: ["clear", "under 6 in", "6-12 in", "over 12 in"],
  supply_access: ["accessible", "limited", "inaccessible", "unknown"],
  hazard_report: ["none", "debris", "downed lines", "flooding"],
  custom: ["yes", "no", "unclear"]
} as const;

export const nearSchema = z
  .string()
  .check(z.trim(), z.minLength(1, "An operational area is required."));

export const spotSchema = z
  .string()
  .check(z.trim(), z.minLength(1, "An operational area is required."));

export const sourceIdSchema = z
  .string()
  .check(z.trim(), z.minLength(1, "A source ID is required."));

export const sessionIdSchema = z
  .string()
  .check(z.trim(), z.minLength(1, "A session ID is required."));

export const emptyArgsSchema = z.object({});

export const findAvailableSourcesArgsSchema = z.object({
  near: nearSchema.check(
    z.describe("An operational area, route, facility, or incident site.")
  ),
  radius_m: z.optional(
    z
      .number()
      .check(
        z.minimum(50),
        z.maximum(10000),
        z.describe("Search radius in meters. Defaults to 1500.")
      )
  )
});

export const getWebBaselineArgsSchema = z.object({
  spot: spotSchema.check(z.describe("The operational area whose baseline should be read."))
});

export const prepareSourceRequestArgsSchema = z.object({
  source_id: sourceIdSchema.check(
    z.describe("The source ID returned by find_available_sources.")
  ),
  request_type: z.enum(requestTypes).check(
    z.describe(
      "One of route_status, flood_depth, supply_access, hazard_report, or custom."
    )
  ),
  question: z.optional(
    z
      .string()
      .check(
        z.trim(),
        z.maxLength(240, "Questions must be 240 characters or fewer."),
        z.describe("Optional human-readable question for the source.")
      )
  )
});

export const getResponseArgsSchema = z.object({
  session_id: sessionIdSchema.check(
    z.describe("The session ID returned by prepare_source_request.")
  )
});

export const sendSourceRequestArgsSchema = z.object({
  session_id: sessionIdSchema.check(
    z.describe("The pending session ID returned by prepare_source_request. Call only after the user explicitly approves sending it.")
  )
});

export const getDroneStatusArgsSchema = z.object({
  source_id: sourceIdSchema.check(z.describe("The drone source ID returned by find_available_sources."))
});

export const prepareDroneMissionArgsSchema = z.object({
  source_id: sourceIdSchema,
  target_name: z.string().check(z.trim(), z.minLength(1), z.maxLength(120)),
  objective: z.string().check(z.trim(), z.minLength(1), z.maxLength(240)),
  target_lat: z.optional(z.number()),
  target_lng: z.optional(z.number())
});

export const toolInputSchemas = {
  empty: z.toJSONSchema(emptyArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  findAvailableSources: z.toJSONSchema(findAvailableSourcesArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  getWebBaseline: z.toJSONSchema(getWebBaselineArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  prepareSourceRequest: z.toJSONSchema(prepareSourceRequestArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  sendSourceRequest: z.toJSONSchema(sendSourceRequestArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  getResponse: z.toJSONSchema(getResponseArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  getDroneStatus: z.toJSONSchema(getDroneStatusArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  prepareDroneMission: z.toJSONSchema(prepareDroneMissionArgsSchema, {
    target: "draft-07",
    io: "input"
  })
} as const;

export type RequestType = (typeof requestTypes)[number];
export type AnswerValue = (typeof answerOptions)[RequestType][number];

export type Spot = {
  place_id: string;
  name: string;
  address: string;
  baseline_status: string;
  baseline_detail: string;
  lat: number;
  lng: number;
  is_seeded: boolean;
  as_of?: string;
};

export type Source = {
  id: string;
  handle: string;
  place_id: string;
  location_name: string;
  source_kind: "human" | "system";
  verification_label: string;
  lat: number;
  lng: number;
  offered: RequestType[];
  online: boolean;
  checked_in_at: string;
  last_active: string;
  distance_m?: number;
  display_name: string;
  source_profile: "human" | "sensor" | "drone";
  channel_label: string;
  availability_label: string;
  battery_percent: number | null;
  mission_status: string | null;
  image_url: string | null;
  telemetry: Record<string, string | number>;
};

export type DroneMission = {
  id: string; source_id: string; target_name: string; objective: string;
  target_lat: number | null; target_lng: number | null;
  status: "pending_approval" | "completed"; result_note: string | null;
  image_url: string | null; created_at: string; approved_at: string | null;
};

export type DroneStatus = {
  source: Source;
  observation: { classification: string; image_url: string | null };
};

export type SessionStatus =
  | "pending_approval"
  | "sent"
  | "answered"
  | "rated";

export type Session = {
  id: string;
  source_id: string;
  requester_label: string;
  place_id: string;
  spot_name: string;
  request_type: RequestType;
  question: string;
  status: SessionStatus;
  answer_value: string | null;
  answer_note: string | null;
  photo_url: string | null;
  stars: number | null;
  created_at: string;
  answered_at: string | null;
  source?: Source;
};

export type AppState = {
  spots: Spot[];
  sources: Source[];
  sessions: Session[];
};

export function parseArgs<Schema extends z.ZodMiniType>(
  schema: Schema,
  input: unknown
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}
