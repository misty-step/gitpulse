"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";
import { trackFunnel, trackOnce } from "@/lib/analytics";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { clerkUser, convexUser, isLoading } = useAuthenticatedConvexUser();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [timezone, setTimezone] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const isGitHubConnected = !!convexUser?.githubAccessToken;

  // Auto-detect timezone from browser
  useEffect(() => {
    if (!timezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(detected || "America/Los_Angeles");
      } catch {
        setTimezone("America/Los_Angeles");
      }
    }
  }, [timezone]);

  // Prefer stored timezone once Convex data arrives
  useEffect(() => {
    if (convexUser?.timezone && convexUser.timezone !== timezone) {
      setTimezone(convexUser.timezone);
    }
  }, [convexUser, timezone]);

  // Track signup_completed when convexUser exists (trackOnce handles deduplication)
  useEffect(() => {
    if (convexUser && clerkUser?.id) {
      trackOnce("signup_completed", { clerkUserId: clerkUser.id });
    }
  }, [convexUser, clerkUser?.id]);

  // Track github_install_completed when connected (trackOnce handles deduplication)
  useEffect(() => {
    if (isGitHubConnected) {
      trackOnce("github_install_completed");
    }
  }, [isGitHubConnected]);

  // Redirect if already completed onboarding
  useEffect(() => {
    if (convexUser?.onboardingCompleted) {
      router.push("/dashboard");
    }
  }, [convexUser, router]);

  // Bounce unauthenticated users back to sign-in once loading settles
  useEffect(() => {
    if (!isLoading && !clerkUser) {
      router.push("/sign-in");
    }
  }, [clerkUser, isLoading, router]);

  const handleConnectGitHub = () => {
    trackFunnel("github_install_started");
    // Redirect to GitHub OAuth
    window.location.href = "/api/auth/github";
  };

  const handleComplete = async () => {
    if (!clerkUser?.id) {
      toast.error("Please sign in to complete onboarding");
      return;
    }
    if (!convexUser) {
      toast.error("Connect your GitHub account before completing setup");
      return;
    }

    setIsCompleting(true);
    try {
      await completeOnboarding({
        clerkId: clerkUser.id,
        timezone,
      });

      toast.success("Setup complete! Redirecting to your dashboard...");

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete setup",
      );
      setIsCompleting(false);
    }
  };

  const canProceedToStep2 = isGitHubConnected;
  const canProceedToStep3 = canProceedToStep2; // For now, no repo selection required

  if (isLoading || !clerkUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-muted to-background">
      {/* Header */}
      <nav className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo rounded-lg flex items-center justify-center text-white font-bold">
                G
              </div>
              <span className="text-xl font-semibold text-foreground">
                GitPulse
              </span>
            </div>
            <span className="text-sm text-muted">
              Step {currentStep} of 3
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step <= currentStep ? "bg-indigo" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Connect GitHub */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Connect Your GitHub Account
              </h1>
              <p className="text-lg text-foreground-muted">
                We&apos;ll automatically discover all your repositories and
                start generating daily reports.
              </p>
            </div>

            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-10 shadow-2xl">
              {isGitHubConnected ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-[#2ea44f]/20 rounded-full flex items-center justify-center mx-auto ring-1 ring-[#2ea44f]/50 shadow-[0_0_30px_-5px_rgba(46,164,79,0.4)]">
                    <svg
                      className="w-10 h-10 text-[#2ea44f]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">
                      Connected as{" "}
                      <span className="text-[#2ea44f]">
                        @{convexUser.githubUsername ?? convexUser.ghLogin}
                      </span>
                    </p>
                    <p className="text-[#8b949e] mt-2">
                      Your GitHub account is successfully linked
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full px-6 py-4 bg-[#2ea44f] text-white rounded-lg hover:bg-[#2c974b] font-bold text-lg shadow-[0_0_20px_-5px_rgba(46,164,79,0.5)] hover:shadow-[0_0_30px_-5px_rgba(46,164,79,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <svg
                    className="w-20 h-20 mx-auto text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <p className="text-[#8b949e] text-lg">
                    Authorize GitPulse to access your GitHub repositories
                  </p>
                  <button
                    onClick={handleConnectGitHub}
                    className="group w-full px-6 py-4 bg-[#8250df] text-white rounded-lg hover:bg-[#7645ca] font-bold text-lg flex items-center justify-center gap-3 shadow-[0_0_20px_-5px_rgba(130,80,223,0.5)] hover:shadow-[0_0_30px_-5px_rgba(130,80,223,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 ring-1 ring-white/10"
                  >
                    <svg
                      className="w-6 h-6 transition-transform group-hover:rotate-12"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Connect GitHub Account
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="flex gap-4">
                <div className="text-[#8b949e] flex-shrink-0 pt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1 text-sm text-[#8b949e]">
                  <p className="font-semibold text-white mb-2">Transparency & Security</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-[#2ea44f]">&#10003;</span>
                      Read-only access to repositories (public & private)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#2ea44f]">&#10003;</span>
                      Pull requests, commits, and code review data
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#2ea44f]">&#10003;</span>
                      Your GitHub profile information
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Repositories (placeholder for now) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Your Repositories
              </h1>
              <p className="text-lg text-foreground-muted">
                All your repositories will be automatically tracked for reports.
              </p>
            </div>

            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-10 shadow-2xl text-center">
              <div className="w-20 h-20 bg-[#8250df]/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-[#8250df]/30">
                <svg className="w-10 h-10 text-[#8250df]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-[#8b949e] mb-8 text-lg">
                We&apos;ll automatically discover and sync all repositories you
                have access to. No manual selection needed!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 px-6 py-4 border border-[#30363d] text-[#8b949e] rounded-lg hover:bg-[#161b22] hover:text-white transition-all duration-200 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!canProceedToStep3}
                  className="flex-1 px-6 py-4 bg-[#8250df] text-white rounded-lg hover:bg-[#7645ca] font-bold shadow-[0_0_20px_-5px_rgba(130,80,223,0.5)] hover:shadow-[0_0_30px_-5px_rgba(130,80,223,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Settings */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Confirm Your Settings
              </h1>
              <p className="text-lg text-foreground-muted">
                Review your report schedule and timezone
              </p>
            </div>

            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-8 space-y-6 shadow-2xl">
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-[#8b949e] mb-2">
                  Your Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-lg text-white focus:ring-2 focus:ring-[#8250df] focus:border-[#8250df] transition-colors"
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Central European Time</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                  <option value="UTC">UTC</option>
                </select>
                <p className="text-xs text-[#8b949e] mt-2">
                  Detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>

              {/* Report Schedule */}
              <div className="border-t border-[#30363d] pt-6">
                <h3 className="text-sm font-medium text-white mb-4">
                  Report Schedule
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Daily Standups
                      </p>
                      <p className="text-xs text-[#8b949e]">
                        Every day at midnight
                      </p>
                    </div>
                    <div className="w-2.5 h-2.5 bg-[#2ea44f] rounded-full shadow-[0_0_8px_rgba(46,164,79,0.5)]" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Weekly Retros
                      </p>
                      <p className="text-xs text-[#8b949e]">
                        Every Sunday at midnight
                      </p>
                    </div>
                    <div className="w-2.5 h-2.5 bg-[#2ea44f] rounded-full shadow-[0_0_8px_rgba(46,164,79,0.5)]" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-[#30363d]">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 px-6 py-4 border border-[#30363d] text-[#8b949e] rounded-lg hover:bg-[#161b22] hover:text-white transition-all duration-200 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="flex-1 px-6 py-4 bg-[#2ea44f] text-white rounded-lg hover:bg-[#2c974b] font-bold shadow-[0_0_20px_-5px_rgba(46,164,79,0.5)] hover:shadow-[0_0_30px_-5px_rgba(46,164,79,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  {isCompleting ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="flex gap-4">
                <div className="text-[#2ea44f] flex-shrink-0 pt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className="flex-1 text-sm text-[#8b949e]">
                  <p className="font-semibold text-white mb-1">You&apos;re all set!</p>
                  <p>
                    Your first report will be generated at midnight tonight{" "}
                    {timezone
                      ? `(${timezone.split("/").pop()?.replace(/_/g, " ")} time)`
                      : ""}
                    . You can also generate reports manually anytime from your
                    dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
