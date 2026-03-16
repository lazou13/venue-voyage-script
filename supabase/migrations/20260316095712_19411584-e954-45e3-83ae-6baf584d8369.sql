UPDATE app_configs 
SET payload = jsonb_set(
  payload, 
  '{enums,project_types}', 
  (payload->'enums'->'project_types') || '[{"id":"library","label":"Bibliothèque","name_label":"Nom de la bibliothèque"}]'::jsonb
),
updated_at = now()
WHERE key = 'capabilities' AND status = 'published';