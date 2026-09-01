UPDATE spots
SET name = 'Watauga Relief Corridor',
    address = 'Boone Staging Hub to Mountain Shelter B, Watauga County, NC',
    lat = 36.2168,
    lng = -81.6746,
    is_seeded = 1
WHERE place_id = 'demo-watauga-relief-corridor';

UPDATE spots
SET name = 'North River Supply Corridor'
WHERE place_id = 'demo-north-river-corridor';

UPDATE sources
SET online = 1
WHERE id IN (
  'src-boone-field',
  'src-mountain-convoy',
  'src-creek-gauge',
  'src-road-camera',
  'src-recon-drone'
);

UPDATE sources
SET location_name = 'Junaluska Community road access',
    lat = 36.2181,
    lng = -81.6764
WHERE id = 'src-boone-field';
