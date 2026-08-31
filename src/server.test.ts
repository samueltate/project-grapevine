import { describe, expect, it } from "vitest";
import { collapseSourceIdentities } from "./server";

function source(id: string, handle: string, last_active: string) {
  return {
    id,
    handle,
    trust_score: 0.82,
    place_id: "demo-watauga-relief-corridor",
    location_name: "Watauga Relief Corridor",
    source_kind: "human" as const,
    verification_label: "Field responder check-in",
    lat: 36.2168,
    lng: -81.6746,
    offered: '["route_status"]',
    online: 1,
    checked_in_at: last_active,
    last_active,
    display_name: handle,
    source_profile: "human" as const,
    channel_label: "Radio CH 3",
    availability_label: "Available",
    battery_percent: null,
    mission_status: null,
    image_url: null,
    telemetry: "{}"
  };
}

describe("driver identity", () => {
  it("keeps only the latest check-in for a handle at a place", () => {
    const result = collapseSourceIdentities([
      source("src-old", "sam-on-site", "2026-08-29T13:20:00.000Z"),
      source("src-new", "SAM-ON-SITE", "2026-08-29T13:30:00.000Z"),
      source("src-ava", "ava-on-hargett", "2026-08-29T13:25:00.000Z")
    ]);

    expect(result.map(({ id }) => id).sort()).toEqual(["src-ava", "src-new"]);
  });
});
