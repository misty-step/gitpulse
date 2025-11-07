"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Simple light/dark toggle. Defaults to cycling between light/dark while respecting system mode.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Standard next-themes pattern to prevent hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = (resolvedTheme ?? "light") === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-200 dark:hover:border-neutral-500 dark:hover:text-white ${className ?? ""}`}
    >
      <span className="sr-only">{label}</span>
      {mounted ? (
        isDark ? (
          <MoonIcon className="h-5 w-5" />
        ) : (
          <SunIcon className="h-5 w-5" />
        )
      ) : (
        <span className="h-3 w-3 rounded-full bg-gray-300 dark:bg-neutral-700" />
      )}
    </button>
  );
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="4.5" strokeWidth="1.5" />
      <path
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M12 4V2M12 22v-2M5.64 5.64 4.22 4.22M19.78 19.78 18.36 18.36M4 12H2M22 12h-2M5.64 18.36 4.22 19.78M19.78 4.22 18.36 5.64"
      />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
      />
    </svg>
  );
}
