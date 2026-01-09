"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { trackFunnel } from "@/lib/analytics";

const features = [
  {
    title: "Daily Standups",
    description:
      "Wake up to a summary of yesterday's work, ready for standup. No more scrambling to remember what you did.",
  },
  {
    title: "Weekly Retros",
    description:
      "See your weekly impact across all repos. Perfect for 1:1s, performance reviews, or just keeping track.",
  },
  {
    title: "Citation-Backed",
    description:
      "Every claim links to the GitHub source—PRs, commits, reviews. No hallucinations, just facts.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      {/* Navigation */}
      <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
          <Link
            href="/dashboard/reports"
            className="flex items-center gap-2 group"
          >
            <div className="h-3 w-3 rounded-sm bg-foreground transition-transform group-hover:scale-90" />
            <span className="font-semibold tracking-tight text-sm">
              GitPulse
            </span>
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
              onClick={() => trackFunnel("signup_started", { source: "nav" })}
              className="rounded-full bg-foreground px-4 py-1.5 text-background transition-transform hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-16 sm:pt-48 sm:pb-32 px-6">
          <div className="mx-auto max-w-[1400px]">
            <div className="max-w-3xl">
              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] mb-8 text-foreground">
                Standups,
                <br />
                <span className="text-foreground-muted">Automated.</span>
              </h1>
              <p className="max-w-xl text-xl text-foreground-muted leading-relaxed">
                No more scrambling to remember what you did yesterday. GitPulse
                transforms your PRs, commits, and reviews into ready-to-share
                daily standups and weekly retros.
              </p>

              <div className="mt-10">
                <Link
                  href="/sign-up"
                  onClick={() =>
                    trackFunnel("signup_started", { source: "hero" })
                  }
                  className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-semibold text-background transition-transform hover:-translate-y-1"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border px-6 py-24 bg-surface-muted/30">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-16">
              <h2 className="text-3xl font-semibold tracking-tight">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="bg-background p-8 md:p-12 hover:bg-surface-muted transition-colors"
                >
                  <div className="flex flex-col h-full min-h-[160px]">
                    <h3 className="text-lg font-medium mb-3">{feature.title}</h3>
                    <p className="text-foreground-muted text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
