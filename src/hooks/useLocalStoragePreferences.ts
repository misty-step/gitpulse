import { useEffect, useCallback } from 'react';
import { ActivityMode, DateRange } from '@/types/dashboard';

const STORAGE_KEY = 'gitpulse_preferences';

export interface UserPreferences {
  activityMode?: ActivityMode;
  dateRange?: DateRange;
  selectedRepositoryIds?: readonly string[];
}

/**
 * Hook to persist and restore user preferences from localStorage
 * Saves activity mode, date range, and selected repositories
 */
export function useLocalStoragePreferences() {
  /**
   * Load preferences from localStorage
   */
  const loadPreferences = useCallback((): UserPreferences | null => {
    try {
      if (typeof window === 'undefined') return null;

      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load preferences from localStorage:', error);
      return null;
    }
  }, []);

  /**
   * Save preferences to localStorage
   */
  const savePreferences = useCallback((preferences: UserPreferences) => {
    try {
      if (typeof window === 'undefined') return;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  }, []);

  /**
   * Clear preferences from localStorage
   */
  const clearPreferences = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;

      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear preferences from localStorage:', error);
    }
  }, []);

  return {
    loadPreferences,
    savePreferences,
    clearPreferences
  };
}