import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============= Types =============
export interface EnumItem {
  id: string;
  label: string;
  name_label?: string;
}

export interface DecisionItem {
  id: string;
  label: string;
}

export interface ScoringDefaults {
  points: number;
  hint_penalty: number;
  fail_penalty: number;
}

export interface HintRulesDefaults {
  maxHints: number;
  autoRevealAfterSec: number;
}

export interface CapabilitiesPayload {
  enums: {
    step_types: EnumItem[];
    validation_modes: EnumItem[];
    target_audiences: EnumItem[];
    play_modes: EnumItem[];
    quest_types: EnumItem[];
    languages: EnumItem[];
    project_types: EnumItem[];
    avatar_styles: EnumItem[];
    avatar_ages: EnumItem[];
    avatar_personas: EnumItem[];
    avatar_outfits: EnumItem[];
    difficulty_levels: EnumItem[];
    risk_levels: EnumItem[];
    wifi_strengths: EnumItem[];
    competition_modes: EnumItem[];
    photo_validation_types: EnumItem[];
  };
  decisions: DecisionItem[];
  fields: {
    scoring_defaults: ScoringDefaults;
    hint_rules_defaults: HintRulesDefaults;
  };
}

interface CachedCapabilities {
  version: number;
  payload: CapabilitiesPayload;
  cachedAt: string;
}

const CACHE_KEY = 'app_capabilities_cache';

// ============= Helper to convert enum array to Record =============
export function enumToRecord<T extends string>(items: EnumItem[]): Record<T, string> {
  return items.reduce((acc, item) => {
    acc[item.id as T] = item.label;
    return acc;
  }, {} as Record<T, string>);
}

// ============= Hook =============
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<CapabilitiesPayload | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage cache
  const loadFromCache = useCallback((): CachedCapabilities | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as CachedCapabilities;
      }
    } catch (e) {
      console.warn('Failed to load capabilities from cache:', e);
    }
    return null;
  }, []);

  // Save to localStorage cache
  const saveToCache = useCallback((version: number, payload: CapabilitiesPayload) => {
    try {
      const cacheData: CachedCapabilities = {
        version,
        payload,
        cachedAt: new Date().toISOString(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save capabilities to cache:', e);
    }
  }, []);

  // Validate payload structure
  const isValidPayload = useCallback((payload: unknown): payload is CapabilitiesPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    
    // Check required top-level keys
    if (!p.enums || typeof p.enums !== 'object') return false;
    if (!p.decisions || !Array.isArray(p.decisions)) return false;
    if (!p.fields || typeof p.fields !== 'object') return false;
    
    // Check required enum keys
    const enums = p.enums as Record<string, unknown>;
    const requiredEnumKeys = [
      'step_types', 'validation_modes', 'target_audiences', 'play_modes',
      'quest_types', 'languages', 'project_types'
    ];
    for (const key of requiredEnumKeys) {
      if (!Array.isArray(enums[key])) return false;
    }
    
    // Check enum items have id and label
    for (const key of requiredEnumKeys) {
      const items = enums[key] as unknown[];
      for (const item of items) {
        if (!item || typeof item !== 'object') return false;
        const i = item as Record<string, unknown>;
        if (typeof i.id !== 'string' || typeof i.label !== 'string') return false;
      }
    }
    
    // Check ASCII snake_case for all enum ids
    for (const key of Object.keys(enums)) {
      const items = enums[key] as EnumItem[];
      for (const item of items) {
        if (!/^[a-z][a-z0-9_]*$/.test(item.id)) {
          console.warn(`Invalid enum id format: ${item.id} in ${key}`);
          return false;
        }
      }
    }
    
    return true;
  }, []);

  // Fetch from database
  const fetchCapabilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('app_configs')
        .select('*')
        .eq('key', 'capabilities')
        .eq('status', 'published')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }
      
      if (data && isValidPayload(data.payload)) {
        setCapabilities(data.payload as CapabilitiesPayload);
        setVersion(data.version);
        saveToCache(data.version, data.payload as CapabilitiesPayload);
      } else if (data) {
        throw new Error('Invalid capabilities payload structure');
      } else {
        // No published config found, use cache
        const cached = loadFromCache();
        if (cached && isValidPayload(cached.payload)) {
          setCapabilities(cached.payload);
          setVersion(cached.version);
          console.warn('No published capabilities found, using cache');
        } else {
          throw new Error('No capabilities configuration available');
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch capabilities:', errorMessage);
      
      // Fallback to cache
      const cached = loadFromCache();
      if (cached && isValidPayload(cached.payload)) {
        setCapabilities(cached.payload);
        setVersion(cached.version);
        console.log('Falling back to cached capabilities v' + cached.version);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isValidPayload, loadFromCache, saveToCache]);

  // Initial load
  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  return {
    capabilities,
    version,
    isLoading,
    error,
    refresh: fetchCapabilities,
  };
}

// ============= Singleton for non-hook usage =============
let cachedCapabilities: CapabilitiesPayload | null = null;

export function getCapabilitiesSync(): CapabilitiesPayload | null {
  if (cachedCapabilities) return cachedCapabilities;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedCapabilities;
      cachedCapabilities = parsed.payload;
      return cachedCapabilities;
    }
  } catch (e) {
    console.warn('Failed to get sync capabilities:', e);
  }
  
  return null;
}

export function setCapabilitiesSync(payload: CapabilitiesPayload) {
  cachedCapabilities = payload;
}
