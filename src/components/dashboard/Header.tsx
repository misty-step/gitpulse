'use client';

import Image from 'next/image';
import { signOut } from 'next-auth/react';

export interface HeaderProps {
  /**
   * Name of the current user
   */
  userName?: string | null;
  
  /**
   * URL of the user's profile image
   */
  userImage?: string | null;
  
  /**
   * Callback URL to navigate to after signing out
   */
  signOutCallbackUrl?: string;
  
  /**
   * Whether to show the command terminal label
   */
  showCommandTerminal?: boolean;
}

/**
 * Dashboard header component with user info and sign out button
 */
export default function Header({
  userName,
  userImage,
  signOutCallbackUrl = '/',
  showCommandTerminal = true
}: HeaderProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: signOutCallbackUrl });
  };
  
  return (
    <header className="border-b shadow-lg" style={{ 
      borderColor: 'var(--neon-green)',
      backgroundColor: 'rgba(27, 43, 52, 0.9)',
      boxShadow: '0 4px 6px -1px rgba(0, 255, 135, 0.1), 0 2px 4px -1px rgba(0, 255, 135, 0.06)'
    }}>
      <div className="max-w-7xl mx-auto py-1.5 px-1.5 sm:px-2 lg:px-3 flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-3 animate-pulse" style={{ backgroundColor: 'var(--neon-green)' }}></div>
          <h1 className="text-2xl font-bold" style={{ 
            color: 'var(--neon-green)',
            textShadow: '0 0 5px rgba(0, 255, 135, 0.3)'
          }}>PULSE</h1>
          {showCommandTerminal && (
            <div className="ml-4 px-2 py-1 text-xs rounded flex items-center" style={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.3)', 
              border: '1px solid var(--electric-blue)',
              color: 'var(--electric-blue)'
            }}>
              <span>COMMAND TERMINAL</span>
            </div>
          )}
        </div>
        
        {userImage && (
          <div className="flex items-center">
            {userName && (
              <div className="mr-3 px-3 py-1 text-xs rounded" style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                border: '1px solid var(--neon-green)',
                color: 'var(--neon-green)'
              }}>
                USER: {userName.toUpperCase()}
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-0 rounded-full" style={{ 
                border: '2px solid var(--neon-green)',
                boxShadow: '0 0 5px rgba(0, 255, 135, 0.5)',
                transform: 'scale(1.1)'
              }}></div>
              <Image
                src={userImage}
                alt={userName || 'User'}
                width={36}
                height={36}
                className="rounded-full"
              />
            </div>
            <button
              onClick={handleSignOut}
              className="ml-4 px-3 py-1 text-sm transition-all duration-200 rounded"
              style={{ 
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                color: 'var(--crimson-red)',
                border: '1px solid var(--crimson-red)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--crimson-red)';
                e.currentTarget.style.color = 'var(--dark-slate)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
                e.currentTarget.style.color = 'var(--crimson-red)';
              }}
            >
              DISCONNECT
            </button>
          </div>
        )}
      </div>
    </header>
  );
}