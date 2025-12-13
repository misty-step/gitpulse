"use client";

import Link from "next/link";
import { toast } from "sonner";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const handleSupportClick = async () => {
    try {
      await navigator.clipboard.writeText("hello@mistystep.io");
      toast.success("Email copied to clipboard");
    } catch {
      toast("Opening your email client...");
      window.location.assign("mailto:hello@mistystep.io");
    }
  };

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-4">
          
          {/* Left: Brand & Misty Step */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-sm text-foreground">
                GitPulse
              </span>
              <span className="text-muted text-xs">by</span>
              <Link
                href="https://mistystep.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:text-foreground transition-colors relative group"
              >
                Misty Step
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
              </Link>
            </div>
            <p className="text-xs text-muted">
              © {currentYear} Misty Step LLC
            </p>
          </div>

          {/* Right: Essential Utility Links */}
          <nav className="flex items-center gap-6">
            <button
              onClick={handleSupportClick}
              className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Support
            </button>
            <Link
              href="/privacy"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
