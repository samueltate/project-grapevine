UPDATE sources
SET telemetry = json_remove(telemetry, '$.confidence')
WHERE telemetry IS NOT NULL AND json_valid(telemetry);
