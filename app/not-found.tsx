"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative h-screen w-full flex items-center justify-center bg-background overflow-hidden selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Massive background watermark */}
      <h1 className="font-mono text-[30vw] leading-none font-bold tracking-tighter text-foreground/[0.02] dark:text-foreground/[0.05] select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        404
      </h1>

      <div className="relative z-10 flex flex-col items-start space-y-8 p-6">
        <div className="space-y-2 text-left">
          <h2 className="text-lg font-medium tracking-tight text-foreground">
            Page not found
          </h2>
          <p className="text-sm text-muted max-w-[250px] leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="text-xs font-mono uppercase tracking-wider border-b border-transparent hover:border-foreground transition-all pb-0.5 text-foreground/60 hover:text-foreground"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
