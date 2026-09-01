UPDATE sources
SET location_name = 'Junaluska Community road access',
    lat = 36.2181,
    lng = -81.6764,
    last_active = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'src-boone-field';

UPDATE sources
SET location_name = 'Above Junaluska Community',
    lat = 36.2208,
    lng = -81.6723,
    mission_status = 'Holding 0.3 mi northeast of Miles Carter',
    telemetry = '{"connection":"Strong","flight_time_remaining_min":24,"wind_mph":7,"gps_accuracy_m":2,"classification":"Fallen tree blocks both lanes on the Mountain Shelter B access route"}',
    last_active = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'src-recon-drone';
