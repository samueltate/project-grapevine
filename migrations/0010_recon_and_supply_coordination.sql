ALTER TABLE sources ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN source_profile TEXT NOT NULL DEFAULT 'human'
  CHECK (source_profile IN ('human', 'sensor', 'drone'));
ALTER TABLE sources ADD COLUMN channel_label TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN availability_label TEXT NOT NULL DEFAULT 'Available';
ALTER TABLE sources ADD COLUMN battery_percent INTEGER;
ALTER TABLE sources ADD COLUMN mission_status TEXT;
ALTER TABLE sources ADD COLUMN image_url TEXT;
ALTER TABLE sources ADD COLUMN telemetry TEXT NOT NULL DEFAULT '{}';

UPDATE sources SET source_profile = 'sensor' WHERE source_kind = 'system';
UPDATE sources SET online = 0 WHERE source_kind = 'human';

UPDATE sources SET
  handle = 'miles828', display_name = 'Miles Carter', source_profile = 'human',
  verification_label = 'Responder check-in confirmed', channel_label = 'Radio CH 3',
  availability_label = 'Available', lat = 36.2181, lng = -81.6764,
  offered = '["route_status","supply_access","hazard_report"]', online = 1,
  checked_in_at = '2030-09-28T13:41:00.000Z', last_active = '2030-09-28T13:41:00.000Z'
WHERE id = 'src-boone-field';

UPDATE sources SET
  display_name = 'Convoy 12', source_profile = 'human', channel_label = 'VHF CH 5',
  availability_label = 'En route', online = 1
WHERE id = 'src-mountain-convoy';

UPDATE sources SET display_name = 'Creek depth sensor', source_profile = 'sensor',
  channel_label = 'LoRa telemetry', availability_label = 'Streaming'
WHERE id = 'src-creek-gauge';

UPDATE sources SET display_name = 'Road conditions camera', source_profile = 'sensor',
  channel_label = 'Image feed', availability_label = 'Streaming'
WHERE id = 'src-road-camera';

INSERT INTO sources (
  id, handle, trust_score, place_id, location_name, source_kind, verification_label,
  lat, lng, offered, online, checked_in_at, last_active, display_name, source_profile,
  channel_label, availability_label, battery_percent, mission_status, image_url, telemetry
) VALUES (
  'src-recon-drone', 'watauga-recon-1', 0.94, 'demo-watauga-relief-corridor',
  'Watauga Relief Corridor', 'system', 'Authenticated aerial telemetry',
  36.2208, -81.6723, '["route_status","supply_access","hazard_report"]', 1,
  '2030-09-28T13:42:00.000Z', '2030-09-28T13:42:00.000Z',
  'Watauga Recon 1', 'drone', 'Mesh link · strong', 'Available', 68,
  'Holding over relief corridor', '/drone-tree-obstruction.png',
  '{"connection":"Strong","flight_time_remaining_min":24,"wind_mph":7,"gps_accuracy_m":2,"classification":"Fallen tree blocks both lanes"}'
) ON CONFLICT(id) DO UPDATE SET
  handle = excluded.handle, display_name = excluded.display_name,
  source_profile = excluded.source_profile, verification_label = excluded.verification_label,
  lat = excluded.lat, lng = excluded.lng, offered = excluded.offered, online = 1,
  checked_in_at = excluded.checked_in_at, last_active = excluded.last_active,
  channel_label = excluded.channel_label, availability_label = excluded.availability_label,
  battery_percent = excluded.battery_percent, mission_status = excluded.mission_status,
  image_url = excluded.image_url, telemetry = excluded.telemetry;

CREATE TABLE IF NOT EXISTS drone_missions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_lat REAL,
  target_lng REAL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'completed')),
  result_note TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

ALTER TABLE response_coordination_requests RENAME TO response_coordination_requests_legacy;
ALTER TABLE response_shortlists RENAME TO response_shortlists_legacy;

CREATE TABLE response_shortlists (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  need TEXT NOT NULL CHECK (need IN ('water','shelter','food','medical','transport','communications','debris_clearance')),
  area TEXT NOT NULL, partner_ids TEXT NOT NULL, rationale TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE response_coordination_requests (
  id TEXT PRIMARY KEY, shortlist_id TEXT NOT NULL, objective TEXT NOT NULL,
  available_resources TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending_approval','approved')),
  field_verification_required INTEGER NOT NULL DEFAULT 1, uncertainty TEXT NOT NULL,
  created_at TEXT NOT NULL, approved_at TEXT,
  FOREIGN KEY (shortlist_id) REFERENCES response_shortlists(id)
);

INSERT INTO response_shortlists (id,title,need,area,partner_ids,rationale,created_at)
SELECT id,title,need,area,partner_ids,rationale,created_at FROM response_shortlists_legacy;

INSERT INTO response_coordination_requests
  (id,shortlist_id,objective,available_resources,status,field_verification_required,uncertainty,created_at,approved_at)
SELECT id,shortlist_id,objective,available_resources,status,field_verification_required,uncertainty,created_at,approved_at
FROM response_coordination_requests_legacy;

DROP TABLE response_coordination_requests_legacy;
DROP TABLE response_shortlists_legacy;

CREATE INDEX IF NOT EXISTS idx_response_shortlists_created ON response_shortlists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_requests_created ON response_coordination_requests(created_at DESC);

INSERT OR REPLACE INTO response_partners VALUES (
  'partner-high-country-sawyers', 'High Country Sawyer Team', 'local',
  'Volunteer chainsaw crew trained for storm debris clearance and access restoration.',
  '["debris_clearance","transport"]', '["Watauga Relief Corridor","Watauga County","Mountain Shelter B"]',
  'active', 'confirmed', 'Crew check-in confirms one saw team and utility vehicle available.',
  'Radio OPS 7', 1, 'Watauga Relief Corridor', '2030-09-28T13:43:00.000Z'
);

CREATE TABLE IF NOT EXISTS response_inventory (
  id TEXT PRIMARY KEY, item_name TEXT NOT NULL, unit TEXT NOT NULL,
  on_hand INTEGER NOT NULL, requested INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('shortage','adequate','surplus')),
  location TEXT NOT NULL, field_signal TEXT NOT NULL, donation_url TEXT NOT NULL, updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO response_inventory VALUES
  ('inv-yellow-jacket', 'Yellow-jacket repellent', 'cases', 18, 60, 'shortage', 'Boone Staging Hub',
   'Field teams report increased yellow-jacket activity near cleanup and shelter sites.',
   'https://donate.example/watauga-relief/repellent', '2030-09-28T13:44:00.000Z'),
  ('inv-water', 'Bottled water', 'pallets', 8, 24, 'shortage', 'Boone Staging Hub',
   'Shelter consumption is outpacing the next scheduled delivery.',
   'https://donate.example/watauga-relief/water', '2030-09-28T13:44:00.000Z'),
  ('inv-meals', 'Shelf-stable meals', 'cases', 320, 280, 'adequate', 'Boone Staging Hub',
   'Current inventory covers the next operational period.',
   'https://donate.example/watauga-relief/meals', '2030-09-28T13:44:00.000Z'),
  ('inv-blankets', 'Blankets', 'units', 460, 120, 'surplus', 'Boone Staging Hub',
   'Donations exceed the current shelter request.',
   'https://donate.example/watauga-relief/blankets', '2030-09-28T13:44:00.000Z');

CREATE TABLE IF NOT EXISTS response_public_drafts (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, channel TEXT NOT NULL,
  copy TEXT NOT NULL, donation_url TEXT NOT NULL, status TEXT NOT NULL CHECK (status = 'draft'),
  created_at TEXT NOT NULL, FOREIGN KEY (item_id) REFERENCES response_inventory(id)
);
