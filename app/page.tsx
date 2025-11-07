"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const featureCards = [
  {
    title: "AI Daily Standups",
    description:
      "Gemini-powered summaries capture commits, PRs, reviews, and discussions—no manual updates required.",
    accent: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100",
    icon: "🤖",
  },
  {
    title: "Semantic Search",
    description:
      "Voyage embeddings let you ask natural-language questions across your entire GitHub history.",
    accent:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-100",
    icon: "🔎",
  },
  {
    title: "KPI Dashboards",
    description:
      "Real-time KPIs for PR throughput, reviews, contributors, and repo health backed by Convex.",
    accent:
      "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-100",
    icon: "📊",
  },
  {
    title: "Citations & Traceability",
    description:
      "Every insight links directly to the GitHub event, so you can audit and share with confidence.",
    accent: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100",
    icon: "📝",
  },
  {
    title: "Secure Authentication",
    description:
      "Clerk OAuth keeps PATs out of source. Connect repos once and let GitPulse handle the rest.",
    accent:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100",
    icon: "🔐",
  },
  {
    title: "Automated Schedules",
    description:
      "Ship daily standups or weekly retros automatically at 9am, plus ad-hoc reports on demand.",
    accent:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100",
    icon: "⏰",
  },
];

const steps = [
  {
    title: "Connect Your Repositories",
    text: "Add repos via the dashboard. We ingest commits, PRs, reviews, and issues with full metadata.",
  },
  {
    title: "We Monitor Activity",
    text: "Convex jobs keep KPIs, embeddings, and timelines up to date the moment your team ships.",
  },
  {
    title: "Reports Arrive Automatically",
    text: "Read human-grade standups and retros—complete with charts, highlights, and citations.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white text-gray-900 transition-colors dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-slate-100">
      {/* Navigation */}
      <nav className="fixed inset-x-0 top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard/reports" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-semibold text-white">
              G
            </div>
            <span className="text-lg font-semibold">GitPulse</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-neutral-800"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="space-y-24 pt-32 sm:space-y-28">
        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              GitHub Reports, Automated
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Daily standups & retros straight from your GitHub timeline
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-slate-300 sm:text-xl">
              Connect repos once. GitPulse watches commits, PRs, and reviews,
              then delivers AI-written updates with KPIs, charts, and citations
              every morning at 9am.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
              >
                Start Free
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-8 py-3 text-lg font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-100 dark:hover:bg-neutral-900"
              >
                See Features
              </Link>
            </div>
            <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-lg dark:border-white/5 dark:bg-white/10">
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50 p-6 dark:border-neutral-800 dark:from-slate-900 dark:to-slate-800">
                <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-slate-400">
                  Preview
                </div>
                <div className="space-y-4">
                  <div className="h-6 w-3/4 rounded bg-white shadow-sm dark:bg-neutral-800" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-20 rounded-lg bg-white shadow-sm dark:bg-neutral-800"
                      />
                    ))}
                  </div>
                  <div className="h-44 rounded-xl bg-white shadow-sm dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section
          id="features"
          className="px-4 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Platform
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Everything you need to understand engineering momentum
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${feature.accent}`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Workflow
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              From GitHub event to human-readable insight in three steps
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-5xl space-y-8">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-start"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-3xl bg-gradient-to-br from-blue-600 to-blue-500 px-8 py-12 text-white shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100/80">
              Ship clarity
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Ready to stop copy/pasting status updates?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Join teams using GitPulse to automate standups, retros, and KPI
              reviews straight from GitHub.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="rounded-xl bg-white px-6 py-3 text-center text-base font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
              >
                Create Account
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/60 px-6 py-3 text-center text-base font-semibold text-white hover:bg-white/10"
              >
                View Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-gray-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-semibold text-white">
              G
            </div>
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              GitPulse
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-white">
              Dashboard
            </Link>
            <Link href="#features" className="hover:text-gray-900 dark:hover:text-white">
              Features
            </Link>
            <Link href="/sign-in" className="hover:text-gray-900 dark:hover:text-white">
              Support
            </Link>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} GitPulse. Automated GitHub analytics for modern teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
