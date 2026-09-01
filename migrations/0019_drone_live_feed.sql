ALTER TABLE sources ADD COLUMN video_url TEXT;

UPDATE sources SET video_url = 'https://www.youtube.com/watch?v=qgIcpFxHocQ'
WHERE id = 'src-recon-drone';
