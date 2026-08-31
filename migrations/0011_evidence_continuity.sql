UPDATE sources SET verification_label = 'Authenticated creek-depth telemetry'
WHERE id = 'src-creek-gauge';

UPDATE sources SET verification_label = 'Roadside image classification'
WHERE id = 'src-road-camera';

UPDATE sources SET verification_label = 'Authenticated aerial telemetry'
WHERE id = 'src-recon-drone';

UPDATE response_partners SET
  verification_note = 'Operations check-in confirmed at the Boone Staging Hub.'
WHERE id = 'partner-high-country';

UPDATE response_partners SET
  verification_note = 'Capacity report lists two mobile treatment units available.'
WHERE id = 'partner-blue-ridge-water';

UPDATE response_partners SET
  verification_note = 'Partner update reports capacity for 60 additional residents.'
WHERE id = 'partner-mountain-shelter';

UPDATE response_partners SET
  verification_note = 'Regional coordinator confirmed standby status.'
WHERE id = 'partner-appalachian-medical';

UPDATE response_partners SET
  verification_note = 'Crew check-in confirms one saw team and utility vehicle available.',
  contact_channel = 'Radio OPS 7'
WHERE id = 'partner-high-country-sawyers';

INSERT OR REPLACE INTO sessions (
  id, source_id, requester_label, place_id, spot_name, request_type, question,
  status, answer_value, answer_note, photo_url, stars, created_at, answered_at
) VALUES (
  'ses-reference-route-blocked', 'src-boone-field', 'Relief Operations',
  'demo-watauga-relief-corridor', 'Watauga Relief Corridor', 'route_status',
  'Is a fallen tree blocking vehicle access to Mountain Shelter B?',
  'answered', 'blocked',
  'Miles confirms a fallen tree is blocking both lanes near the Mountain Shelter B access road.',
  NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

UPDATE response_coordination_requests
SET field_verification_required = 0,
    uncertainty = 'The obstruction is confirmed; coordinator approval is required before crew dispatch.'
WHERE shortlist_id IN (
  SELECT id FROM response_shortlists WHERE need = 'debris_clearance'
);
