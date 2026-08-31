ALTER TABLE sources ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'human'
  CHECK (source_kind IN ('human', 'system'));
ALTER TABLE sources ADD COLUMN verification_label TEXT NOT NULL DEFAULT 'Field responder check-in';

DROP TABLE sessions;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  requester_label TEXT NOT NULL,
  place_id TEXT NOT NULL,
  spot_name TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (
    request_type IN (
      'route_status',
      'flood_depth',
      'supply_access',
      'hazard_report',
      'custom'
    )
  ),
  question TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (
    status IN ('pending_approval', 'sent', 'answered', 'rated')
  ),
  answer_value TEXT,
  answer_note TEXT,
  photo_url TEXT,
  stars INTEGER CHECK (stars IS NULL OR (stars >= 1 AND stars <= 5)),
  created_at TEXT NOT NULL,
  answered_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id),
  FOREIGN KEY (place_id) REFERENCES spots(place_id)
);

CREATE INDEX idx_sessions_source_status
  ON sessions(source_id, status, created_at);

DELETE FROM sources;
DELETE FROM spots;

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
);

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
  );
