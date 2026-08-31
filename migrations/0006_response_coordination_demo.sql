CREATE TABLE IF NOT EXISTS response_partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('local', 'regional', 'national')),
  summary TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  areas TEXT NOT NULL,
  response_status TEXT NOT NULL CHECK (response_status IN ('active', 'standby')),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('confirmed', 'self_reported')),
  verification_note TEXT NOT NULL,
  contact_channel TEXT NOT NULL,
  local_led INTEGER NOT NULL DEFAULT 0,
  route_dependency TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS response_shortlists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  need TEXT NOT NULL CHECK (need IN ('water', 'shelter', 'food', 'medical', 'transport', 'communications')),
  area TEXT NOT NULL,
  partner_ids TEXT NOT NULL,
  rationale TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS response_coordination_requests (
  id TEXT PRIMARY KEY,
  shortlist_id TEXT NOT NULL,
  objective TEXT NOT NULL,
  available_resources TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved')),
  field_verification_required INTEGER NOT NULL DEFAULT 1,
  uncertainty TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  FOREIGN KEY (shortlist_id) REFERENCES response_shortlists(id)
);

CREATE INDEX IF NOT EXISTS idx_response_shortlists_created ON response_shortlists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_requests_created ON response_coordination_requests(created_at DESC);

INSERT OR REPLACE INTO response_partners VALUES
  ('partner-high-country', 'High Country Community Response', 'local',
   'Locally led distribution teams coordinating water and shelter supplies from Boone.',
   '["water","shelter","food"]', '["Watauga Relief Corridor","Watauga County","Mountain Shelter B"]',
   'active', 'confirmed', 'Operations check-in confirmed at the Boone Staging Hub.',
   'operations@highcountry.example', 1, 'Watauga Relief Corridor', CURRENT_TIMESTAMP),
  ('partner-blue-ridge-water', 'Blue Ridge Water Network', 'regional',
   'Mobile potable-water storage, purification, and distribution support.',
   '["water","transport"]', '["Watauga Relief Corridor","Watauga County","Avery County"]',
   'active', 'confirmed', 'Capacity report lists two mobile treatment units available.',
   'dispatch@blueridgewater.example', 0, 'Watauga Relief Corridor', CURRENT_TIMESTAMP),
  ('partner-mountain-shelter', 'Mountain Shelter Alliance', 'local',
   'Temporary shelter setup, accessibility support, and resident intake coordination.',
   '["shelter","communications"]', '["Watauga Relief Corridor","Mountain Shelter B","Boone"]',
   'active', 'self_reported', 'Partner update reports capacity for 60 additional residents.',
   'coordination@mountainshelter.example', 1, 'Watauga Relief Corridor', CURRENT_TIMESTAMP),
  ('partner-appalachian-medical', 'Appalachian Mobile Health Team', 'regional',
   'Mobile first-aid stations and non-emergency medical logistics.',
   '["medical","transport"]', '["Watauga Relief Corridor","Watauga County"]',
   'standby', 'confirmed', 'Regional coordinator confirmed standby status.',
   'fielddesk@apphealth.example', 0, 'Watauga Relief Corridor', CURRENT_TIMESTAMP);
