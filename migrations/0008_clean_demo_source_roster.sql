UPDATE sources
SET online = 0
WHERE source_kind = 'human';

UPDATE sources
SET
  online = 1,
  checked_in_at = CURRENT_TIMESTAMP,
  last_active = CURRENT_TIMESTAMP
WHERE id IN ('src-boone-field', 'src-mountain-convoy');
