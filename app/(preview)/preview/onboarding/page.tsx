"use client";

import { useState } from "react";

type Step = 1 | 2 | 3;

// Mock user data for preview
const mockConvexUser = {
  githubUsername: "octocat",
  ghLogin: "octocat",
  githubAccessToken: "mock-token",
  timezone: "America/Los_Angeles",
  onboardingCompleted: false,
};

export default function OnboardingPreviewPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [timezone, setTimezone] = useState("America/Los_Angeles");

  return (
    <div className="space-y-6">
      {/* Preview Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8b949e]">Step:</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                onClick={() => setCurrentStep(step as Step)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  currentStep === step
                    ? "bg-[#8250df] text-white"
                    : "bg-[#0d1117] text-[#8b949e] hover:text-white border border-[#30363d]"
                }`}
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-[#30363d]" />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isGitHubConnected}
            onChange={(e) => setIsGitHubConnected(e.target.checked)}
            className="w-4 h-4 rounded border-[#30363d] bg-[#0d1117] text-[#8250df] focus:ring-[#8250df]"
          />
          <span className="text-sm text-[#8b949e]">GitHub Connected</span>
        </label>
      </div>

      {/* Simulated Onboarding UI */}
      <div className="bg-gradient-to-b from-[#0d1117] to-[#010409] rounded-xl overflow-hidden">
        {/* Header */}
        <nav className="border-b border-[#30363d] bg-[#0d1117]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#8250df] rounded-lg flex items-center justify-center text-white font-bold">
                  G
                </div>
                <span className="text-xl font-semibold text-white">
                  GitPulse
                </span>
              </div>
              <span className="text-sm text-[#8b949e]">
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
                    step <= currentStep ? "bg-[#8250df]" : "bg-[#30363d]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Step 1: Connect GitHub */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-3">
                  Connect Your GitHub Account
                </h1>
                <p className="text-lg text-[#8b949e]">
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
                          @{mockConvexUser.githubUsername}
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
                      onClick={() => setIsGitHubConnected(true)}
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
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 text-sm text-[#8b949e]">
                    <p className="font-semibold text-white mb-2">
                      Transparency & Security
                    </p>
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

          {/* Step 2: Repositories */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-3">
                  Your Repositories
                </h1>
                <p className="text-lg text-[#8b949e]">
                  All your repositories will be automatically tracked for reports.
                </p>
              </div>

              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-10 shadow-2xl text-center">
                <div className="w-20 h-20 bg-[#8250df]/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-[#8250df]/30">
                  <svg
                    className="w-10 h-10 text-[#8250df]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
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
                    className="flex-1 px-6 py-4 bg-[#8250df] text-white rounded-lg hover:bg-[#7645ca] font-bold shadow-[0_0_20px_-5px_rgba(130,80,223,0.5)] hover:shadow-[0_0_30px_-5px_rgba(130,80,223,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
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
                <h1 className="text-3xl font-bold text-white mb-3">
                  Confirm Your Settings
                </h1>
                <p className="text-lg text-[#8b949e]">
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
                    Detected: America/Los_Angeles
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
                    onClick={() => alert("Preview: Would complete onboarding")}
                    className="flex-1 px-6 py-4 bg-[#2ea44f] text-white rounded-lg hover:bg-[#2c974b] font-bold shadow-[0_0_20px_-5px_rgba(46,164,79,0.5)] hover:shadow-[0_0_30px_-5px_rgba(46,164,79,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    Complete Setup
                  </button>
                </div>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
                <div className="flex gap-4">
                  <div className="text-[#2ea44f] flex-shrink-0 pt-0.5">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 text-sm text-[#8b949e]">
                    <p className="font-semibold text-white mb-1">
                      You&apos;re all set!
                    </p>
                    <p>
                      Your first report will be generated at midnight tonight (
                      {timezone.split("/").pop()?.replace(/_/g, " ")} time). You can
                      also generate reports manually anytime from your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
