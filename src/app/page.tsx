'use client';

import { signIn } from "next-auth/react";
import Image from "next/image";
import useProtectedRoute from "@/hooks/useProtectedRoute";
import AuthLoadingScreen from "@/components/ui/AuthLoadingScreen";

export default function Home() {
  // Use the protected route hook in reverse - redirect to dashboard if authenticated
  const { isLoading, status } = useProtectedRoute({
    redirectTo: '/dashboard',
    redirectIfFound: true,
    loadingDelay: 250
  });
  
  // Show loading screen when we're redirecting to dashboard
  if (isLoading && status === 'authenticated') {
    return <AuthLoadingScreen 
      message="Authenticated" 
      subMessage="Redirecting to your dashboard..."
    />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-1.5" style={{ background: 'var(--gradient-bg)' }}>
      {/* Terminal-like Header */}
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <div className="inline-flex items-center border border-neon-green p-2 rounded-md mb-3" style={{ borderColor: 'var(--neon-green)' }}>
          <span className="text-xs px-2" style={{ color: 'var(--neon-green)' }}>SYSTEM STATUS: ONLINE</span>
          <div className="w-2 h-2 rounded-full ml-2 animate-pulse" style={{ backgroundColor: 'var(--neon-green)' }}></div>
        </div>
        <h1 className="text-5xl font-bold mb-3" style={{ 
          color: 'var(--neon-green)', 
          textShadow: '0 0 10px rgba(16, 185, 129, 0.5)' 
        }}>
          GITPULSE
        </h1>
        
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="h-px w-16" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <span style={{ color: 'var(--electric-blue)' }}>COMMIT ANALYSIS SYSTEM</span>
          <div className="h-px w-16" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card w-full max-w-md p-3 space-y-8 border-2" style={{ 
        backgroundColor: 'rgba(249, 250, 251, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
        borderColor: 'var(--neon-green)'
      }}>
        {/* Screen-like display area */}
        <div className="space-y-6 p-1.5 border border-opacity-50 rounded-md" style={{ 
          borderColor: 'var(--electric-blue)',
          backgroundColor: 'rgba(249, 250, 251, 0.8)'
        }}>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: 'var(--neon-green)' }}></div>
              <p className="text-sm" style={{ color: 'var(--neon-green)' }}>
                &gt; SYSTEM READY
              </p>
            </div>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              &gt; Initializing GitHub commit analysis module...
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              &gt; Secure sign-in required to access repository data.
            </p>
            <p className="text-sm animate-pulse" style={{ color: 'var(--electric-blue)' }}>
              &gt; Awaiting authorization...
            </p>
          </div>
        </div>

        {/* Show appropriate messaging based on auth state */}
        {status === 'unauthenticated' && (
          <div className="text-center mb-4">
            <p className="text-sm" style={{ color: 'var(--neon-green)' }}>
              Sign in with GitHub to access your repositories and analyze commits.
            </p>
          </div>
        )}
        
        {status === 'loading' && (
          <div className="text-center mb-4">
            <p className="text-sm" style={{ color: 'var(--electric-blue)' }}>
              Loading authentication status...
            </p>
          </div>
        )}

        {/* Command Button */}
        <button
          onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center py-3 px-1.5 rounded-md transition-all duration-200"
          style={{ 
            backgroundColor: 'var(--dark-slate)',
            color: 'var(--neon-green)',
            border: '2px solid var(--neon-green)',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--neon-green)';
            e.currentTarget.style.color = 'var(--dark-slate)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
            e.currentTarget.style.color = 'var(--neon-green)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {status === 'loading' ? (
            <>
              <span className="mr-2 inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
              INITIALIZING...
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" 
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" 
                  clipRule="evenodd" 
                />
              </svg>
              AUTHENTICATE WITH GITHUB
            </>
          )}
        </button>
      </div>
      
      {/* Footer with cyber-style separator */}
      <footer className="mt-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="h-px w-8" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <div className="h-px w-16" style={{ backgroundColor: 'var(--neon-green)' }}></div>
          <div className="h-px w-8" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
        </div>
        <p className="text-sm mb-1" style={{ color: 'var(--electric-blue)' }}>SECURE AUTH PROTOCOL: GITHUB OAUTH</p>
        <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>NO DATA PERSISTENCE BEYOND SESSION SCOPE</p>
      </footer>
    </div>
  );
}
