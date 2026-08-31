UPDATE spots
SET is_seeded = 0
WHERE place_id != 'demo-watauga-relief-corridor';

UPDATE spots
SET
  name = 'Watauga Relief Corridor',
  address = 'Boone Staging Hub to Mountain Shelter B, Watauga County, NC',
  hours = 'Regional route feed: passable',
  popular_times_now = 'Network update delayed; field verification required',
  rating = 0.62,
  lat = 36.2168,
  lng = -81.6746,
  is_seeded = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE place_id = 'demo-watauga-relief-corridor';

UPDATE sources
SET online = 0
WHERE place_id != 'demo-watauga-relief-corridor';
