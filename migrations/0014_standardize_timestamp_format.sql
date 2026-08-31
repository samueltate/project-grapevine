UPDATE spots
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

UPDATE sources
SET checked_in_at = strftime('%Y-%m-%dT%H:%M:%fZ', checked_in_at),
    last_active = strftime('%Y-%m-%dT%H:%M:%fZ', last_active);

UPDATE sessions
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
    answered_at = CASE WHEN answered_at IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', answered_at) END;

UPDATE response_partners
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

UPDATE response_shortlists
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at);

UPDATE response_coordination_requests
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
    approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', approved_at) END;

UPDATE response_inventory
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

UPDATE response_public_drafts
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at);

UPDATE drone_missions
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
    approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', approved_at) END;
