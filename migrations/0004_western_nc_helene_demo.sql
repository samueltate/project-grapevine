UPDATE sources SET online = 0;

INSERT INTO spots (
  place_id, name, address, hours, popular_times_now, rating,
  lat, lng, is_seeded, updated_at
) VALUES (
  'demo-watauga-relief-corridor',
  'Watauga Relief Corridor',
  'Boone Staging Hub to Mountain Shelter B, Watauga County, NC',
  'Regional route feed: passable',
  'Network update delayed; field verification required',
  0.62,
  36.2168,
  -81.6746,
  1,
  CURRENT_TIMESTAMP
) ON CONFLICT(place_id) DO UPDATE SET
  name = excluded.name,
  address = excluded.address,
  hours = excluded.hours,
  popular_times_now = excluded.popular_times_now,
  rating = excluded.rating,
  lat = excluded.lat,
  lng = excluded.lng,
  is_seeded = excluded.is_seeded,
  updated_at = excluded.updated_at;

INSERT INTO sources (
  id, handle, trust_score, place_id, location_name, source_kind,
  verification_label, lat, lng, offered, online, checked_in_at, last_active
) VALUES
  (
    'src-boone-field', 'boone-field-team', 0.91,
    'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'human',
    'Boone field responder check-in', 36.2168, -81.6746,
    '["route_status","supply_access","hazard_report"]',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'src-mountain-convoy', 'mountain-convoy-3', 0.86,
    'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'human',
    'Mountain aid convoy GPS check-in', 36.2190, -81.6800,
    '["route_status","supply_access","hazard_report"]',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'src-creek-gauge', 'demo-creek-gauge-7', 0.95,
    'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'system',
    'Authenticated sensor feed', 36.2140, -81.6700,
    '["flood_depth","route_status","hazard_report"]',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT(id) DO UPDATE SET
  handle = excluded.handle,
  trust_score = excluded.trust_score,
  place_id = excluded.place_id,
  location_name = excluded.location_name,
  source_kind = excluded.source_kind,
  verification_label = excluded.verification_label,
  lat = excluded.lat,
  lng = excluded.lng,
  offered = excluded.offered,
  online = excluded.online,
  checked_in_at = excluded.checked_in_at,
  last_active = excluded.last_active;
