-- Add JSONB config columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS quest_config jsonb NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS title_i18n jsonb NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS story_i18n jsonb NOT NULL DEFAULT '{}';

-- Add JSONB step_config column to pois table
ALTER TABLE public.pois 
ADD COLUMN IF NOT EXISTS step_config jsonb NOT NULL DEFAULT '{}';