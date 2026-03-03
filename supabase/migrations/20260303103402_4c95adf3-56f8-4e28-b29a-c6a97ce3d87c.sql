
CREATE OR REPLACE FUNCTION public.find_catalog_project(p_slug text)
RETURNS TABLE(id uuid, quest_config jsonb, title_i18n jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.quest_config, p.title_i18n
  FROM projects p
  WHERE (p.quest_config->'catalog'->>'is_public')::boolean = true
    AND p.quest_config->'catalog'->>'slug' = p_slug
  LIMIT 1;
$$;
