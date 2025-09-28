'use client';

import useProtectedRoute from '@/hooks/useProtectedRoute';

// Protected route layout for dashboard and other authenticated pages
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use our custom hook to protect this route
  const { isLoading, isAuthenticated } = useProtectedRoute({
    redirectTo: '/',
    loadingDelay: 250
  });
  
  // Show loading screen while checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <div className="loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 'var(--space)'
      }}>
        <h2>Accessing Dashboard</h2>
        <p style={{ color: 'var(--muted)' }}>Verifying security credentials...</p>
      </div>
    );
  }
  
  // Render children only when authenticated
  return children;
}