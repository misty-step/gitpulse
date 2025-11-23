"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { AuthStatusIndicator } from "@/components/AuthStatusIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MinimalHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200/80 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-neutral-950 dark:border-neutral-800/80 dark:supports-[backdrop-filter]:bg-neutral-950/70 z-50 transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/dashboard/reports" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            G
          </div>
          <span className="hidden sm:block text-xl font-semibold text-gray-900 dark:text-slate-100">
            GitPulse
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {/* Settings Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-slate-200 dark:hover:bg-neutral-800"
            >
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                  },
                }}
              />
              {/* Settings icon for mobile, text for desktop */}
              <svg
                className="block sm:hidden w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="hidden sm:inline">Settings</span>
              <svg
                className={`hidden sm:block w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <div className="py-1">
                  <Link
                    href="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-neutral-800"
                    onClick={() => setIsOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/dashboard/settings/repositories"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-neutral-800"
                    onClick={() => setIsOpen(false)}
                  >
                    Manage Repositories
                  </Link>

                  {/* Divider */}
                  <div className="my-1 border-t border-gray-200 dark:border-neutral-700" />

                  {/* Auth Status Indicator */}
                  <div className="px-4 py-2">
                    <AuthStatusIndicator variant="inline" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
