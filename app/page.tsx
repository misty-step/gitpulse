"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    title: "Daily Intelligence",
    description: "Automated standups derived from commit graphs.",
    metric: "9AM",
    unit: "Delivery",
  },
  {
    title: "Semantic Search",
    description: "Query your codebase history with natural language.",
    metric: "0.4s",
    unit: "Latency",
  },
  {
    title: "KPI Extraction",
    description: "Real-time throughput and velocity tracking.",
    metric: "100%",
    unit: "Coverage",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      {/* Navigation - "The Glass Strip" */}
      <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
          <Link href="/dashboard/reports" className="flex items-center gap-2 group">
            <div className="h-3 w-3 rounded-sm bg-foreground transition-transform group-hover:scale-90" />
            <span className="font-semibold tracking-tight text-sm">GitPulse</span>
          </Link>
          
          <div className="flex items-center gap-6 text-sm font-medium">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="text-foreground-muted transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-foreground px-4 py-1.5 text-background transition-transform hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section - "The Manifest" */}
        <section className="relative pt-32 pb-16 sm:pt-48 sm:pb-32 px-6">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              
              {/* Left: The Statement */}
              <div className="lg:col-span-8">
                <h1 className="text-6xl sm:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.9] mb-8 text-foreground">
                  Engineering <br />
                  <span className="text-foreground-muted">Visible.</span>
                </h1>
                <p className="max-w-xl text-xl text-foreground-muted leading-relaxed">
                  GitPulse transforms raw GitHub signals into human-readable narratives. 
                  No more manual standups. Just clear, automated intelligence.
                </p>
                
                <div className="mt-10 flex flex-wrap gap-4">
                  <Link
                    href="/sign-up"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-semibold text-background transition-transform hover:-translate-y-1"
                  >
                    Start Integration
                  </Link>
                  <Link
                    href="#manifesto"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium transition-colors hover:bg-surface-muted"
                  >
                    Read Manifesto
                  </Link>
                </div>
              </div>

              {/* Right: The Artifact (Abstract Visualization) */}
              <div className="lg:col-span-4 lg:h-full flex flex-col justify-end">
                <div className="border-l border-border pl-8 space-y-8">
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-muted uppercase tracking-widest">Status</div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">System Operational</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-muted uppercase tracking-widest">Version</div>
                    <div className="font-mono">2.0.1 (Stable)</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-muted uppercase tracking-widest">Latency</div>
                    <div className="font-mono">24ms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features - "The Grid" */}
        <section id="manifesto" className="border-t border-border px-6 py-24 bg-surface-muted/30">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-16">
              <h2 className="text-3xl font-semibold tracking-tight">System Capabilities</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
              {features.map((feature, i) => (
                <div key={i} className="bg-background p-8 md:p-12 hover:bg-surface-muted transition-colors">
                  <div className="flex flex-col h-full justify-between min-h-[200px]">
                    <div>
                      <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                      <p className="text-foreground-muted text-sm leading-relaxed">{feature.description}</p>
                    </div>
                    <div className="mt-8 flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tracking-tighter">{feature.metric}</span>
                      <span className="text-xs font-mono uppercase text-muted">{feature.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interface Preview - "The Slab" */}
        <section className="px-6 py-24">
           <div className="mx-auto max-w-[1400px]">
             <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-zinc-200/50 dark:shadow-none overflow-hidden">
               <div className="border-b border-border bg-surface-muted/50 px-4 py-3 flex items-center gap-2">
                 <div className="flex gap-1.5">
                   <div className="w-3 h-3 rounded-full bg-zinc-300" />
                   <div className="w-3 h-3 rounded-full bg-zinc-300" />
                   <div className="w-3 h-3 rounded-full bg-zinc-300" />
                 </div>
               </div>
               <div className="aspect-[16/10] bg-surface flex items-center justify-center relative">
                 <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 dark:opacity-10" />
                 
                 {/* Mock UI Content */}
                 <div className="w-full max-w-3xl p-12 space-y-8 relative z-10">
                    <div className="flex items-baseline justify-between border-b border-border pb-6">
                      <h2 className="text-3xl font-bold tracking-tight">Morning Standup</h2>
                      <span className="font-mono text-sm text-muted">09:00 AM</span>
                    </div>
                    <div className="space-y-4">
                       <div className="h-4 w-3/4 bg-surface-muted rounded" />
                       <div className="h-4 w-full bg-surface-muted rounded" />
                       <div className="h-4 w-5/6 bg-surface-muted rounded" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                       <div className="h-24 border border-border rounded-lg bg-surface-muted/30" />
                       <div className="h-24 border border-border rounded-lg bg-surface-muted/30" />
                       <div className="h-24 border border-border rounded-lg bg-surface-muted/30" />
                    </div>
                 </div>
               </div>
             </div>
           </div>
        </section>

        {/* Footer - "The Appendix" */}
        <footer className="border-t border-border py-12 px-6">
          <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row justify-between items-end gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-sm bg-foreground" />
                <span className="font-bold tracking-tight">GitPulse</span>
              </div>
              <p className="text-sm text-muted max-w-xs">
                Engineering intelligence for high-performance teams.
                <br />
                © {new Date().getFullYear()} Misty Step Inc.
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <Link href="/docs" className="hover:underline">Documentation</Link>
              <Link href="/status" className="hover:underline">Status</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
