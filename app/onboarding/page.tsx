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
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                G
              </div>
              <span className="text-xl font-semibold text-gray-900">
                GitPulse
              </span>
            </div>
            <span className="text-sm text-gray-500">
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
                  step <= currentStep ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Connect GitHub */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Connect Your GitHub Account
              </h1>
              <p className="text-lg text-gray-600">
                We&apos;ll automatically discover all your repositories and
                start generating daily reports.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              {isGitHubConnected ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Connected as @
                      {convexUser.githubUsername ?? convexUser.ghLogin}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Your GitHub account is connected and ready
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <p className="text-gray-600">
                    Authorize GitPulse to access your GitHub repositories
                  </p>
                  <button
                    onClick={handleConnectGitHub}
                    className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-blue-600 text-xl flex-shrink-0">ℹ️</div>
                <div className="flex-1 text-sm text-blue-700">
                  <p className="font-medium mb-1">What we&apos;ll access:</p>
                  <ul className="space-y-1">
                    <li>
                      • Read access to your public and private repositories
                    </li>
                    <li>• Pull requests, commits, and code review data</li>
                    <li>• Your GitHub profile information</li>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Your Repositories
              </h1>
              <p className="text-lg text-gray-600">
                All your repositories will be automatically tracked for reports.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📦</span>
              </div>
              <p className="text-gray-600 mb-6">
                We&apos;ll automatically discover and sync all repositories you
                have access to. No manual selection needed!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!canProceedToStep3}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Confirm Your Settings
              </h1>
              <p className="text-lg text-gray-600">
                Review your report schedule and timezone
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <p className="text-xs text-gray-500 mt-1">
                  Detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>

              {/* Report Schedule */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Report Schedule
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Daily Standups
                      </p>
                      <p className="text-xs text-gray-500">
                        Every day at midnight
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Weekly Retros
                      </p>
                      <p className="text-xs text-gray-500">
                        Every Sunday at midnight
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCompleting ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-green-600 text-xl flex-shrink-0">✨</div>
                <div className="flex-1 text-sm text-green-700">
                  <p className="font-medium mb-1">You&apos;re all set!</p>
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
