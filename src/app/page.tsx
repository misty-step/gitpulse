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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(var(--space) / 4)',
      background: 'var(--gradient-bg)'
    }}>
      {/* Terminal-like Header */}
      <div style={{
        width: '100%',
        maxWidth: '42rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'calc(var(--space) * 1.5)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid var(--neon-green)',
          padding: 'calc(var(--space) / 2)',
          borderRadius: '4px'
        }}>
          <span style={{
            fontSize: '0.75rem',
            padding: '0 calc(var(--space) / 2)',
            color: 'var(--neon-green)'
          }}>SYSTEM STATUS: ONLINE</span>
          <div style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            marginLeft: 'calc(var(--space) / 2)',
            animation: 'pulse 2s infinite',
            backgroundColor: 'var(--neon-green)'
          }}></div>
        </div>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          color: 'var(--neon-green)',
          textShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
        }}>
          GITPULSE
        </h1>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'calc(var(--space) / 2)'
        }}>
          <div style={{ height: '1px', width: '4rem', backgroundColor: 'var(--electric-blue)' }}></div>
          <span style={{ color: 'var(--electric-blue)' }}>COMMIT ANALYSIS SYSTEM</span>
          <div style={{ height: '1px', width: '4rem', backgroundColor: 'var(--electric-blue)' }}></div>
        </div>
      </div>

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: '28rem',
        padding: 'calc(var(--space) * 1.5)',
        marginTop: 'calc(var(--space) * 2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(var(--space) * 2)',
        backgroundColor: 'rgba(249, 250, 251, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
        border: '2px solid var(--neon-green)',
        borderRadius: '4px'
      }}>
        {/* Screen-like display area */}
        <div style={{
          padding: 'calc(var(--space) / 4)',
          border: '1px solid var(--electric-blue)',
          borderRadius: '4px',
          backgroundColor: 'rgba(249, 250, 251, 0.8)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'calc(var(--space) * 0.75)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--space) / 2)' }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: 'var(--neon-green)'
              }}></div>
              <p style={{ fontSize: '0.875rem', color: 'var(--neon-green)' }}>
                &gt; SYSTEM READY
              </p>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
              &gt; Initializing GitHub commit analysis module...
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
              &gt; Secure sign-in required to access repository data.
            </p>
            <p style={{ fontSize: '0.875rem', animation: 'pulse 2s infinite', color: 'var(--electric-blue)' }}>
              &gt; Awaiting authorization...
            </p>
          </div>
        </div>

        {/* Show appropriate messaging based on auth state */}
        {status === 'unauthenticated' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--neon-green)' }}>
              Sign in with GitHub to access your repositories and analyze commits.
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--electric-blue)' }}>
              Loading authentication status...
            </p>
          </div>
        )}

        {/* Command Button */}
        <button
          onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
          disabled={status === 'loading'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'calc(var(--space) * 1.5) calc(var(--space) / 4)',
            borderRadius: '4px',
            transition: 'all 0.2s',
            backgroundColor: 'var(--dark-slate)',
            color: 'var(--neon-green)',
            border: '2px solid var(--neon-green)',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
            cursor: status === 'loading' ? 'default' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            gap: 'calc(var(--space) / 2)'
          }}
          onMouseOver={(e) => {
            if (status !== 'loading') {
              e.currentTarget.style.backgroundColor = 'var(--neon-green)';
              e.currentTarget.style.color = 'var(--dark-slate)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
            e.currentTarget.style.color = 'var(--neon-green)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {status === 'loading' ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '1rem',
                height: '1rem',
                border: '2px solid var(--neon-green)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              INITIALIZING...
            </>
          ) : (
            <>
              <svg style={{ height: '1.25rem', width: '1.25rem' }} fill="currentColor" viewBox="0 0 24 24">
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
      <footer style={{
        marginTop: 'calc(var(--space) * 2)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0'
        }}>
          <div style={{ height: '1px', width: '2rem', backgroundColor: 'var(--electric-blue)' }}></div>
          <div style={{ height: '1px', width: '4rem', backgroundColor: 'var(--neon-green)' }}></div>
          <div style={{ height: '1px', width: '2rem', backgroundColor: 'var(--electric-blue)' }}></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 4)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--electric-blue)' }}>SECURE AUTH PROTOCOL: GITHUB OAUTH</p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>NO DATA PERSISTENCE BEYOND SESSION SCOPE</p>
        </div>
      </footer>
    </div>
  );
}