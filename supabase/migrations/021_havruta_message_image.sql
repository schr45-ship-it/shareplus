-- 021: Havruta — image attachments on messages
ALTER TABLE havruta_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
