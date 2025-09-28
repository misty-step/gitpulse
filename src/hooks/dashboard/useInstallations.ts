/**
 * Custom hook for managing GitHub App installations
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Installation } from '@/types/dashboard';

interface UseInstallationsOptions {
  readonly fetchRepositories: (installationId?: number) => Promise<boolean>;
}

/**
 * Custom hook for managing GitHub App installations
 * 
 * @param options - Options object containing the fetchRepositories function
 * @returns An object with installation state and functions to manage installations
 */
export function useInstallations(options: UseInstallationsOptions) {
  const { fetchRepositories } = options;
  const { data: session } = useSession();
  
  // State for all available installations
  const [installations, setInstallationsState] = useState<Installation[] | readonly Installation[]>([]);
  
  // State for currently active installations
  const [currentInstallations, setCurrentInstallations] = useState<Installation[] | readonly Installation[]>([]);
  
  // State for active installation IDs
  const [installationIds, setInstallationIds] = useState<number[] | readonly number[]>([]);
  
  // State for whether GitHub App installation is needed
  const [needsInstallation, setNeedsInstallation] = useState(false);


  /**
   * Set the available installations and update cache
   * 
   * @param newInstallations - Array of GitHub App installations
   */
  const setInstallations = useCallback((newInstallations: Installation[] | readonly Installation[]) => {
    setInstallationsState(newInstallations);
  }, []);

  /**
   * Add a new installation to the list of current installations
   * 
   * @param installation - Installation to add
   */
  const addCurrentInstallation = useCallback((installation: Installation) => {
    setCurrentInstallations(prev => {
      // Check if this installation is already in the array
      const exists = prev.some(inst => inst.id === installation.id);
      
      if (!exists) {
        const newInstallations = [...prev, installation];

        // Update installation IDs
        setInstallationIds(newInstallations.map(inst => inst.id));

        return newInstallations;
      }
      
      return prev;
    });
  }, []);

  /**
   * Switch to different installations and fetch their repositories
   * 
   * @param installIds - Array of installation IDs to switch to
   */
  const switchInstallations = useCallback((installIds: number[]) => {
    // Check if the installation selection has changed
    const currentIds = currentInstallations.map(inst => inst.id);
    const hasSelectionChanged = 
      installIds.length !== currentIds.length || 
      installIds.some(id => !currentIds.includes(id));
    
    if (hasSelectionChanged) {
      console.log('Switching to installation IDs:', installIds);
      
      // Get the selected installations' account logins
      const selectedInstallations = installations.filter(inst => installIds.includes(inst.id));
      
      // If no installations are selected, don't fetch anything
      if (installIds.length === 0) {
        return;
      }
      
      // For now, we'll use the first selected installation ID for fetching
      // This will need to be updated in the API to support multiple installation IDs
      const primaryInstallId = installIds[0];
      
      fetchRepositories(primaryInstallId).then(success => {
        // If we successfully switched, update the current installations
        if (success) {
          // Update the current installations
          setCurrentInstallations(selectedInstallations);

          // Update the installation IDs state
          setInstallationIds(installIds);

          // Clear installation needed flag
          setNeedsInstallation(false);
        }
      });
    }
  }, [currentInstallations, fetchRepositories, installations]);

  return {
    installations,
    currentInstallations,
    installationIds,
    needsInstallation,
    switchInstallations,
    setInstallations,
    addCurrentInstallation,
    setNeedsInstallation
  };
}