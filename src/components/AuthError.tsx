'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

interface AuthErrorProps {
  error?: string;
  message?: string;
  code?: string;
  signOutRequired?: boolean;
  onRetry?: () => void;
}

/**
 * Component for displaying authentication errors with appropriate actions
 */
export function AuthError({ 
  error = 'Authentication Error', 
  message = 'Your session is invalid or expired.', 
  code = 'AUTH_ERROR',
  signOutRequired = false,
  onRetry 
}: AuthErrorProps) {
  
  const [countdown, setCountdown] = useState(signOutRequired ? 5 : 0);
  
  useEffect(() => {
    // If sign out is required, start a countdown and then sign out
    if (signOutRequired && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    if (signOutRequired && countdown === 0) {
      signOut({ redirect: true, callbackUrl: window.location.origin + '/' })
        .catch(error => {
          console.error('Error during sign out:', error);
        });
    }
  }, [countdown, signOutRequired]);
  
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-1.5 my-4 rounded shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
              clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{error}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{message}</p>
            {code && <p className="mt-1 text-xs text-red-600">Error code: {code}</p>}
            
            {signOutRequired && countdown > 0 && (
              <p className="mt-2 text-sm font-medium">
                Signing out in {countdown} seconds...
              </p>
            )}
          </div>
          
          <div className="mt-4">
            {onRetry && !signOutRequired && (
              <button
                type="button"
                onClick={onRetry}
                className="mr-2 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
              >
                Try Again
              </button>
            )}
            
            <button
              type="button"
              onClick={() => signOut({ redirect: true, callbackUrl: window.location.origin + '/' })}
              className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
            >
              Sign Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}