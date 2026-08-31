INSERT INTO sources (
  id, handle, trust_score, place_id, location_name, source_kind,
  verification_label, lat, lng, offered, online, checked_in_at, last_active
) VALUES
  (
    'src-creek-gauge', 'demo-creek-gauge-7', 0.95,
    'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'system',
    'Authenticated creek-depth telemetry', 36.2140, -81.6700,
    '["flood_depth","route_status","hazard_report"]',
    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'src-road-camera', 'watauga-road-camera-2', 0.92,
    'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'system',
    'Roadside image classification', 36.2205, -81.6668,
    '["route_status","supply_access","hazard_report"]',
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
  online = 1,
  checked_in_at = excluded.checked_in_at,
  last_active = excluded.last_active;
