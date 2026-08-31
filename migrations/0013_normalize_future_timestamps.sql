UPDATE spots
SET updated_at = CURRENT_TIMESTAMP
WHERE datetime(updated_at) > datetime('now');

UPDATE sources
SET checked_in_at = CURRENT_TIMESTAMP,
    last_active = CURRENT_TIMESTAMP
WHERE datetime(checked_in_at) > datetime('now')
   OR datetime(last_active) > datetime('now');

UPDATE sessions
SET created_at = CURRENT_TIMESTAMP,
    answered_at = CASE WHEN answered_at IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
WHERE datetime(created_at) > datetime('now')
   OR datetime(answered_at) > datetime('now');

UPDATE response_partners
SET updated_at = CURRENT_TIMESTAMP
WHERE datetime(updated_at) > datetime('now');

UPDATE response_shortlists
SET created_at = CURRENT_TIMESTAMP
WHERE datetime(created_at) > datetime('now');

UPDATE response_coordination_requests
SET created_at = CURRENT_TIMESTAMP,
    approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
WHERE datetime(created_at) > datetime('now')
   OR datetime(approved_at) > datetime('now');

UPDATE response_inventory
SET updated_at = CURRENT_TIMESTAMP
WHERE datetime(updated_at) > datetime('now');

UPDATE response_public_drafts
SET created_at = CURRENT_TIMESTAMP
WHERE datetime(created_at) > datetime('now');

UPDATE drone_missions
SET created_at = CURRENT_TIMESTAMP,
    approved_at = CASE WHEN approved_at IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
WHERE datetime(created_at) > datetime('now')
   OR datetime(approved_at) > datetime('now');
