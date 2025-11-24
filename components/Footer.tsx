"use client";

import Link from "next/link";
import { toast } from "sonner";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const handleSupportClick = async () => {
    try {
      // Note: Email is intentionally exposed in client bundle - it's already
      // public on the website and scraper protection is not a priority
      await navigator.clipboard.writeText("hello@mistystep.io");
      toast.success("Email copied to clipboard");
    } catch (err) {
      // Graceful fallback to mailto
      window.location.href = "mailto:hello@mistystep.io";
    }
  };

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* Left: Brand Attribution */}
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2.5 w-2.5 rounded-sm bg-foreground" />
              <span className="font-semibold tracking-tight text-sm">
                GitPulse
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-md">
              Engineering intelligence for high-performance teams.
            </p>
            <div className="pt-2 space-y-1">
              <Link
                href="https://mistystep.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors group"
              >
                <span>A</span>
                <span className="font-semibold group-hover:underline underline-offset-2">
                  Misty Step
                </span>
                <span>Project</span>
                <svg
                  className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Link>
              <p className="text-xs font-mono text-muted">
                © {currentYear} Misty Step LLC
              </p>
            </div>
          </div>

          {/* Right: Navigation */}
          <nav className="md:col-span-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5">
              <li>
                <button
                  type="button"
                  onClick={handleSupportClick}
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors hover:underline underline-offset-2 cursor-pointer"
                  aria-label="Copy support email to clipboard"
                >
                  Support
                </button>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors hover:underline underline-offset-2"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors hover:underline underline-offset-2"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
