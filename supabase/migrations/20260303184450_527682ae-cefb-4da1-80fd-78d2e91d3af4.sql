
CREATE TABLE public.quest_instance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_instance_id uuid NOT NULL REFERENCES public.quest_instances(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quest_instance_id, device_id)
);

ALTER TABLE public.quest_instance_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quest_instance_devices"
  ON public.quest_instance_devices
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
