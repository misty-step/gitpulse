"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID;

const features = [
  "Daily standups",
  "Weekly retrospectives",
  "Citation-backed insights",
  "Unlimited repos",
  "GitHub App sync",
];

type Plan = {
  name: string;
  price: string;
  period: string;
  priceId?: string;
  cta: string;
  badge?: string;
  highlight?: boolean;
};

const plans: Plan[] = [
  {
    name: "Monthly",
    price: "$12",
    period: "/mo",
    priceId: MONTHLY_PRICE_ID,
    cta: "Start monthly trial",
  },
  {
    name: "Yearly",
    price: "$120",
    period: "/yr",
    priceId: YEARLY_PRICE_ID,
    cta: "Start yearly trial",
    badge: "2 months free",
    highlight: true,
  },
];

export default function PricingPage() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (plan: Plan) => {
    if (!plan.priceId) {
      setError("Pricing not configured. Contact support.");
      return;
    }

    setError(null);
    setLoadingPriceId(plan.priceId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.priceId }),
      });

      if (response.status === 401) {
        setError("Sign in required to start checkout.");
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Checkout failed");
      }

      if (!payload?.url) {
        throw new Error("Checkout URL missing");
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-3 w-3 rounded-sm bg-foreground transition-transform group-hover:scale-110 logo-pulse" />
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
              className="rounded-full bg-foreground px-4 py-1.5 text-background transition-all hover:scale-105 hover:shadow-md hover:shadow-foreground/20 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="px-6 pt-28 pb-24">
        <div className="mx-auto max-w-4xl space-y-12">
          <div className="space-y-3 border-b border-border pb-6">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">
              Pricing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Simple pricing. Zero surprises.
            </h1>
            <p className="text-sm text-muted">
              14-day free trial on every plan. Checkout requires sign-in.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => {
              const isLoading = loadingPriceId === plan.priceId;
              return (
                <div
                  key={plan.name}
                  className={`border border-border bg-surface p-6 space-y-6 ${
                    plan.highlight ? "border-foreground" : ""
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                        {plan.name}
                      </h2>
                      {plan.badge ? (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-sm text-muted">{plan.period}</span>
                    </div>
                    <p className="text-xs text-muted">
                      14-day free trial. Cancel anytime.
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm text-muted">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={!plan.priceId || isLoading}
                    className="w-full bg-foreground text-background px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    aria-busy={isLoading}
                  >
                    {isLoading ? "Redirecting..." : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {error ? (
            <div className="text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2">
              {error}{" "}
              <Link href="/sign-in" className="underline">
                Sign in
              </Link>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
