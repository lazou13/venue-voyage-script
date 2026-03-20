-- ============================================================
-- MIGRATION: Device lock sécurisé
-- Ajoute fingerprint_hash + last_seen_at + index sur quest_instance_devices
-- ============================================================

-- Ajouter les colonnes de fingerprinting
ALTER TABLE public.quest_instance_devices
  ADD COLUMN IF NOT EXISTS fingerprint_hash  text,
  ADD COLUMN IF NOT EXISTS user_agent        text,
  ADD COLUMN IF NOT EXISTS last_seen_at      timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempt_count     integer DEFAULT 1;

-- Index pour lookups rapides par device_id seul (ex: vérif cross-instances)
CREATE INDEX IF NOT EXISTS idx_qid_device_id
  ON public.quest_instance_devices (device_id);

-- Index sur fingerprint pour détecter les réutilisations suspectes
CREATE INDEX IF NOT EXISTS idx_qid_fingerprint
  ON public.quest_instance_devices (fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;

-- Trigger: mettre à jour last_seen_at + attempt_count à chaque accès
CREATE OR REPLACE FUNCTION public.update_device_seen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.last_seen_at := now();
  -- On conflict update: incrémenter le compteur
  IF TG_OP = 'UPDATE' THEN
    NEW.attempt_count := COALESCE(OLD.attempt_count, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_device_seen ON public.quest_instance_devices;
CREATE TRIGGER trg_device_seen
  BEFORE INSERT OR UPDATE ON public.quest_instance_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_device_seen();

-- Vue de sécurité : appareils suspects (même fingerprint, instances différentes)
-- Utilisée par l'admin pour détecter les contournements
CREATE OR REPLACE VIEW public.suspicious_devices AS
SELECT
  d.fingerprint_hash,
  count(DISTINCT d.quest_instance_id) AS instance_count,
  count(*) AS total_accesses,
  max(d.last_seen_at) AS last_seen,
  array_agg(DISTINCT d.device_id) AS device_ids,
  array_agg(DISTINCT d.quest_instance_id) AS instance_ids
FROM public.quest_instance_devices d
WHERE d.fingerprint_hash IS NOT NULL
GROUP BY d.fingerprint_hash
HAVING count(DISTINCT d.quest_instance_id) > 1
ORDER BY instance_count DESC, last_seen DESC;
