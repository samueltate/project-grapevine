import * as z from "zod/mini";

z.config(z.locales.en());

export const responseNeeds = [
  "water",
  "shelter",
  "food",
  "medical",
  "transport",
  "communications"
  ,"debris_clearance"
] as const;

export type ResponseNeed = (typeof responseNeeds)[number];

export type ResponsePartner = {
  id: string;
  name: string;
  organization_type: "local" | "regional" | "national";
  summary: string;
  capabilities: ResponseNeed[];
  areas: string[];
  response_status: "active" | "standby";
  verification_status: "confirmed" | "self_reported";
  verification_note: string;
  contact_channel: string;
  local_led: boolean;
  route_dependency: string | null;
  updated_at: string;
};

export type ResponseShortlist = {
  id: string;
  title: string;
  need: ResponseNeed;
  area: string;
  partner_ids: string[];
  rationale: string;
  created_at: string;
  partners?: ResponsePartner[];
};

export type CoordinationRequest = {
  id: string;
  shortlist_id: string;
  objective: string;
  available_resources: string;
  status: "pending_approval" | "approved";
  field_verification_required: boolean;
  uncertainty: string;
  created_at: string;
  approved_at: string | null;
};

export type SupplyInventoryItem = {
  id: string; item_name: string; unit: string; on_hand: number; requested: number;
  status: "shortage" | "adequate" | "surplus"; location: string;
  field_signal: string; donation_url: string; updated_at: string;
};

export type PublicAppealDraft = {
  id: string; item_id: string; channel: string; copy: string;
  donation_url: string; status: "draft"; created_at: string;
};

export type ResponseBundle = {
  fictional: true;
  incident: {
    id: string;
    name: string;
    area: string;
    operational_need: string;
    published_status: string;
    uncertainty: string;
    updated_at: string;
  };
  partners: ResponsePartner[];
  shortlists: ResponseShortlist[];
  requests: CoordinationRequest[];
  field_verification: null | {
    session_id: string;
    answer_value: string;
    answer_note: string | null;
    source_name: string;
    answered_at: string;
  };
  inventory: SupplyInventoryItem[];
  public_drafts: PublicAppealDraft[];
};

const requiredText = (label: string) => z.string().check(z.trim(), z.minLength(1, `${label} is required.`));

export const responseArgSchemas = {
  empty: z.object({}),
  findPartners: z.object({
    need: z.enum(responseNeeds).check(z.describe("The relief capability needed.")),
    area: requiredText("An operational area").check(z.describe("A county, corridor, shelter, or incident area.")),
    local_led_only: z.optional(z.boolean().check(z.describe("Return only locally led organizations.")))
  }),
  partnerDetails: z.object({
    partner_id: requiredText("A partner ID").check(z.describe("A partner ID returned by find_response_partners."))
  }),
  shortlist: z.object({
    title: requiredText("A shortlist title").check(z.describe("A concise name for the response shortlist.")),
    need: z.enum(responseNeeds),
    area: requiredText("An operational area"),
    partner_ids: z.array(requiredText("A partner ID")).check(z.minLength(1), z.maxLength(4)),
    rationale: requiredText("A rationale").check(z.maxLength(400))
  }),
  coordination: z.object({
    shortlist_id: requiredText("A shortlist ID"),
    objective: requiredText("An objective").check(z.maxLength(300)),
    available_resources: requiredText("Available resources").check(z.maxLength(300))
  }),
  inventory: z.object({
    status: z.optional(z.enum(["shortage", "adequate", "surplus"]))
  }),
  appeal: z.object({
    item_id: requiredText("An inventory item ID")
  })
} as const;

export const responseToolSchemas = {
  empty: z.toJSONSchema(responseArgSchemas.empty, { target: "draft-07", io: "input" }),
  findPartners: z.toJSONSchema(responseArgSchemas.findPartners, { target: "draft-07", io: "input" }),
  partnerDetails: z.toJSONSchema(responseArgSchemas.partnerDetails, { target: "draft-07", io: "input" }),
  shortlist: z.toJSONSchema(responseArgSchemas.shortlist, { target: "draft-07", io: "input" }),
  coordination: z.toJSONSchema(responseArgSchemas.coordination, { target: "draft-07", io: "input" }),
  inventory: z.toJSONSchema(responseArgSchemas.inventory, { target: "draft-07", io: "input" }),
  appeal: z.toJSONSchema(responseArgSchemas.appeal, { target: "draft-07", io: "input" })
} as const;

export function parseResponseArgs<Schema extends z.ZodMiniType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(z.prettifyError(result.error));
  return result.data;
}
