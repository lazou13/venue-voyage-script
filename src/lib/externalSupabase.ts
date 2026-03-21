import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://xaccaoedtbwywjotqhih.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhY2Nhb2VkdGJ3eXdqb3RxaGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzM4NjAsImV4cCI6MjA4OTYwOTg2MH0.awTgCuN5L-9egD_aTLz8YCvNSQiXlSbgbxRacxn8nZo';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
