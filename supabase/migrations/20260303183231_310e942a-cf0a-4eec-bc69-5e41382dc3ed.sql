
-- Add device-related columns to quest_instances for device locking
ALTER TABLE public.quest_instances
  ADD COLUMN devices_allowed integer NOT NULL DEFAULT 1,
  ADD COLUMN device_id text,
  ADD COLUMN device_uses integer NOT NULL DEFAULT 0;
