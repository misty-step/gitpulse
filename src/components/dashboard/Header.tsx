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
    <header>
      <div>
        <div>
          <div></div>
          <h1>PULSE</h1>
          {showCommandTerminal && (
            <div>
              <span>COMMAND TERMINAL</span>
            </div>
          )}
        </div>

        {userImage && (
          <div>
            {userName && (
              <div>
                USER: {userName.toUpperCase()}
              </div>
            )}
            <div>
              <div></div>
              <Image
                src={userImage}
                alt={userName || 'User'}
                width={36}
                height={36}
               
              />
            </div>
            <button
              onClick={handleSignOut}
            >
              <span>DISCONNECT</span>
              <span>EXIT</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}