'use client';

/**
 * Loading component for dashboard content
 */
export default function DashboardLoadingState() {
  return (
    <div className="h-screen flex flex-col">
      {/* Animated header */}
      <div className="p-1.5 border-b" style={{ borderColor: 'var(--neon-green)', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
        <div className="animate-pulse h-8 w-40 rounded" style={{ backgroundColor: 'rgba(0, 255, 135, 0.2)' }}></div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Animated sidebar */}
        <div className="w-64 p-1.5 border-r" style={{ borderColor: 'var(--electric-blue)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <div className="space-y-4">
            <div className="animate-pulse h-6 w-32 rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.2)' }}></div>
            <div className="space-y-2">
              <div className="animate-pulse h-4 w-full rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
              <div className="animate-pulse h-4 w-3/4 rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
              <div className="animate-pulse h-4 w-5/6 rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
            </div>
            <div className="animate-pulse h-32 w-full rounded mt-6" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
          </div>
        </div>
        
        {/* Animated main content */}
        <div className="flex-1 p-2 overflow-auto">
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
              <div className="animate-pulse h-8 w-64 rounded" style={{ backgroundColor: 'rgba(0, 255, 135, 0.15)' }}></div>
              <div className="animate-pulse h-8 w-32 rounded" style={{ backgroundColor: 'rgba(0, 255, 135, 0.15)' }}></div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-1.5 border rounded-md" style={{ borderColor: 'var(--electric-blue)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                  <div className="animate-pulse h-4 w-3/4 rounded mb-3" style={{ backgroundColor: 'rgba(45, 145, 255, 0.2)' }}></div>
                  <div className="animate-pulse h-10 w-full rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
                </div>
              ))}
            </div>
            
            <div className="border rounded-md p-5" style={{ borderColor: 'var(--neon-green)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
              <div className="animate-pulse h-6 w-48 rounded mb-4" style={{ backgroundColor: 'rgba(0, 255, 135, 0.2)' }}></div>
              
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="animate-pulse h-8 w-8 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(45, 145, 255, 0.2)' }}></div>
                    <div className="space-y-2 flex-1">
                      <div className="animate-pulse h-4 w-full rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
                      <div className="animate-pulse h-4 w-5/6 rounded" style={{ backgroundColor: 'rgba(45, 145, 255, 0.1)' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}