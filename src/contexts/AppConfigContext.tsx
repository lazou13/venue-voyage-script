import { createContext, useContext, type ReactNode } from 'react';
import { useAppConfig } from '@/hooks/useAppConfig';
import type { CapabilitiesPayload } from '@/hooks/useCapabilities';

// Re-export the return type shape
interface AppConfigContextValue {
  draftPayload: CapabilitiesPayload | null;
  publishedPayload: CapabilitiesPayload | null;
  draftVersion: number;
  publishedVersion: number;
  draftId: string | null;
  publishedId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  updateDraft: (updater: (prev: CapabilitiesPayload) => CapabilitiesPayload) => void;
  saveDraft: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  discardChanges: () => void;
  refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const value = useAppConfig();
  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfigContext(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error('useAppConfigContext must be used within an AppConfigProvider');
  }
  return ctx;
}
