import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { CapabilitiesPayload } from './useCapabilities';
import type { Json } from '@/integrations/supabase/types';

// ============= Types =============
interface AppConfigRow {
  id: string;
  key: string;
  version: number;
  status: string;
  payload: CapabilitiesPayload;
  created_at: string;
  updated_at: string;
}

interface UseAppConfigReturn {
  // Data
  draftPayload: CapabilitiesPayload | null;
  publishedPayload: CapabilitiesPayload | null;
  draftVersion: number;
  publishedVersion: number;
  draftId: string | null;
  publishedId: string | null;
  
  // State
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  
  // Actions
  updateDraft: (updater: (prev: CapabilitiesPayload) => CapabilitiesPayload) => void;
  saveDraft: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  discardChanges: () => void;
  refresh: () => Promise<void>;
}

const CONFIG_KEY = 'capabilities';

// ============= Hook =============
export function useAppConfig(): UseAppConfigReturn {
  const queryClient = useQueryClient();
  
  // Server data
  const [publishedRow, setPublishedRow] = useState<AppConfigRow | null>(null);
  const [draftRow, setDraftRow] = useState<AppConfigRow | null>(null);
  
  // Local editing state (tracks unsaved changes)
  const [localPayload, setLocalPayload] = useState<CapabilitiesPayload | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!localPayload) return false;
    const serverPayload = draftRow?.payload || publishedRow?.payload;
    if (!serverPayload) return true;
    return JSON.stringify(localPayload) !== JSON.stringify(serverPayload);
  }, [localPayload, draftRow, publishedRow]);

  // Fetch configs from database
  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('app_configs')
        .select('id, created_at, updated_at, key, status, version, payload')
        .eq('key', CONFIG_KEY)
        .in('status', ['published', 'draft'])
        .order('version', { ascending: false });
      
      if (fetchError) throw new Error(fetchError.message);
      
      const rows = (data || []) as unknown as AppConfigRow[];
      const published = rows.find(r => r.status === 'published') || null;
      const draft = rows.find(r => r.status === 'draft') || null;
      
      setPublishedRow(published);
      setDraftRow(draft);
      
      // Initialize local payload from draft or published
      const basePayload = draft?.payload || published?.payload || null;
      setLocalPayload(basePayload);
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      console.error('Failed to fetch app configs:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Update local draft (no DB call)
  const updateDraft = useCallback((updater: (prev: CapabilitiesPayload) => CapabilitiesPayload) => {
    setLocalPayload(prev => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  // Save draft to database
  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!localPayload) {
      setError('Aucune configuration à sauvegarder');
      return false;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      if (draftRow) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from('app_configs')
          .update({ 
            payload: localPayload as unknown as Json,
            updated_at: new Date().toISOString()
          })
          .eq('id', draftRow.id);
        
        if (updateError) throw new Error(updateError.message);
        
        // Update local state
        setDraftRow(prev => prev ? { ...prev, payload: localPayload } : null);
      } else {
        // Create new draft from published
        const newVersion = (publishedRow?.version || 0) + 1;
        const { data, error: insertError } = await supabase
          .from('app_configs')
          .insert({
            key: CONFIG_KEY,
            status: 'draft',
            version: newVersion,
            payload: localPayload as unknown as Json,
          })
          .select()
          .single();
        
        if (insertError) throw new Error(insertError.message);
        
        setDraftRow(data as unknown as AppConfigRow);
      }
      
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde';
      setError(msg);
      console.error('Failed to save draft:', msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localPayload, draftRow, publishedRow]);

  // Publish draft
  const publish = useCallback(async (): Promise<boolean> => {
    if (!draftRow) {
      setError('Aucun brouillon à publier. Sauvegardez d\'abord vos modifications.');
      return false;
    }
    
    setIsPublishing(true);
    setError(null);
    
    try {
      const newVersion = (publishedRow?.version || 0) + 1;
      
      // Step 1: Archive current published (if exists)
      if (publishedRow) {
        const { error: archiveError } = await supabase
          .from('app_configs')
          .update({ status: 'archived' })
          .eq('id', publishedRow.id);
        
        if (archiveError) throw new Error(`Archivage échoué: ${archiveError.message}`);
      }
      
      // Step 2: Promote draft to published
      const { error: promoteError } = await supabase
        .from('app_configs')
        .update({ 
          status: 'published',
          version: newVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', draftRow.id);
      
      if (promoteError) throw new Error(`Publication échouée: ${promoteError.message}`);
      
      // Step 3: Update local state
      const newPublished: AppConfigRow = {
        ...draftRow,
        status: 'published',
        version: newVersion,
      };
      setPublishedRow(newPublished);
      setDraftRow(null);
      setLocalPayload(newPublished.payload);
      
      // Step 4: Invalidate capabilities cache so frontend picks up new values
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      localStorage.removeItem('app_capabilities_cache');
      
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la publication';
      setError(msg);
      console.error('Failed to publish:', msg);
      return false;
    } finally {
      setIsPublishing(false);
    }
  }, [draftRow, publishedRow, queryClient]);

  // Discard local changes
  const discardChanges = useCallback(() => {
    const basePayload = draftRow?.payload || publishedRow?.payload || null;
    setLocalPayload(basePayload);
    setError(null);
  }, [draftRow, publishedRow]);

  return {
    draftPayload: localPayload,
    publishedPayload: publishedRow?.payload || null,
    draftVersion: draftRow?.version || (publishedRow?.version || 0) + 1,
    publishedVersion: publishedRow?.version || 0,
    draftId: draftRow?.id || null,
    publishedId: publishedRow?.id || null,
    isLoading,
    isSaving,
    isPublishing,
    hasUnsavedChanges,
    error,
    updateDraft,
    saveDraft,
    publish,
    discardChanges,
    refresh: fetchConfigs,
  };
}
