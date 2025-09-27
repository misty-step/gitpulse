import { useCallback } from 'react';
import { ActivityMode, DateRange } from '@/types/dashboard';

const STORAGE_KEY = 'gitpulse_last_generation';

export interface LastGenerationParams {
  activityMode: ActivityMode;
  dateRange: DateRange;
  selectedRepositoryIds: readonly string[];
  organizations: readonly string[];
  contributors: readonly string[];
  timestamp: number;
}

/**
 * Hook to manage the last generation parameters for quick re-generation
 * Stores the exact parameters used in the last summary generation
 */
export function useLastGenerationParams() {
  /**
   * Load last generation parameters from localStorage
   */
  const loadLastGeneration = useCallback((): LastGenerationParams | null => {
    try {
      if (typeof window === 'undefined') return null;

      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const params = JSON.parse(stored);

      // Check if params are not too old (24 hours)
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - params.timestamp > dayInMs) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return params;
    } catch (error) {
      console.error('Failed to load last generation params from localStorage:', error);
      return null;
    }
  }, []);

  /**
   * Save last generation parameters to localStorage
   */
  const saveLastGeneration = useCallback((params: Omit<LastGenerationParams, 'timestamp'>) => {
    try {
      if (typeof window === 'undefined') return;

      const paramsWithTimestamp: LastGenerationParams = {
        ...params,
        timestamp: Date.now()
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paramsWithTimestamp));
    } catch (error) {
      console.error('Failed to save last generation params to localStorage:', error);
    }
  }, []);

  /**
   * Clear last generation parameters from localStorage
   */
  const clearLastGeneration = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;

      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear last generation params from localStorage:', error);
    }
  }, []);

  return {
    loadLastGeneration,
    saveLastGeneration,
    clearLastGeneration
  };
}