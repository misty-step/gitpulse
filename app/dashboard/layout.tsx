import { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { MinimalHeader } from "@/components/MinimalHeader";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        {/* Minimal Header */}
        <Suspense
          fallback={
            <div className="h-16 border-b border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950" />
          }
        >
          <MinimalHeader />
        </Suspense>

        {/* Main content - Wrap in Suspense for page-level loading */}
        <div className="pt-16">
          <main className="p-8">
            <Suspense
              fallback={
                <div className="space-y-6">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </OnboardingGuard>
  );
}
