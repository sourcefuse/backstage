import React, { createContext, useContext } from 'react';
import { useTabSettings } from './useTabSettings';

type TabSettingsValue = ReturnType<typeof useTabSettings>;

const TabSettingsContext = createContext<TabSettingsValue | null>(null);

export function TabSettingsProvider({ children }: { children: React.ReactNode }) {
  const value = useTabSettings();
  return (
    <TabSettingsContext.Provider value={value}>
      {children}
    </TabSettingsContext.Provider>
  );
}

export function useSharedTabSettings(): TabSettingsValue {
  const ctx = useContext(TabSettingsContext);
  if (!ctx) {
    throw new Error('useSharedTabSettings must be used within TabSettingsProvider');
  }
  return ctx;
}
