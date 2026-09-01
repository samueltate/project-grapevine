INSERT OR REPLACE INTO response_inventory VALUES
  ('inv-hygiene-kits', 'Hygiene kits', 'cases', 96, 72, 'adequate', 'Boone Staging Hub',
   'Shelter teams have enough hygiene kits for the next distribution window.',
   'https://donate.example/watauga-relief/hygiene', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('inv-tarps', 'Heavy-duty tarps', 'units', 210, 160, 'adequate', 'Boone Staging Hub',
   'Roofing crews have enough tarps for currently scheduled repairs.',
   'https://donate.example/watauga-relief/tarps', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('inv-work-gloves', 'Work gloves', 'pairs', 280, 180, 'surplus', 'Boone Staging Hub',
   'Cleanup teams report glove stock exceeds near-term assignments.',
   'https://donate.example/watauga-relief/gloves', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
