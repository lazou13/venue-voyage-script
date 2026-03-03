
-- =============================================
-- PATCH 3: orders + quest_instances
-- =============================================

-- Table: orders
CREATE TABLE public.orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_name   text NOT NULL DEFAULT '',
  customer_email  text,
  experience_mode text NOT NULL DEFAULT 'game' CHECK (experience_mode IN ('visit','game')),
  party_size      int NOT NULL DEFAULT 2,
  locale          text NOT NULL DEFAULT 'fr',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_project ON public.orders(project_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select orders"  ON public.orders FOR SELECT  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert orders"  ON public.orders FOR INSERT  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update orders"  ON public.orders FOR UPDATE  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete orders"  ON public.orders FOR DELETE  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: quest_instances
CREATE TABLE public.quest_instances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  access_token  text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','started','completed','expired')),
  ttl_minutes   int NOT NULL DEFAULT 240,
  starts_at     timestamptz,
  expires_at    timestamptz,
  score         jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qi_order   ON public.quest_instances(order_id);
CREATE INDEX idx_qi_project ON public.quest_instances(project_id);

CREATE TRIGGER update_quest_instances_updated_at
  BEFORE UPDATE ON public.quest_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quest_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select quest_instances" ON public.quest_instances FOR SELECT  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert quest_instances" ON public.quest_instances FOR INSERT  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update quest_instances" ON public.quest_instances FOR UPDATE  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete quest_instances" ON public.quest_instances FOR DELETE  USING (has_role(auth.uid(), 'admin'::app_role));
