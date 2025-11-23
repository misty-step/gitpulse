import { useState } from "react";
import clsx from "clsx";

interface CitationDrawerProps {
  citations: string[];
  label?: string;
}

export function CitationDrawer({
  citations,
  label = "Citations",
}: CitationDrawerProps) {
  const [open, setOpen] = useState(false);

  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-neutral-800 sm:px-6"
      >
        <span>
          {label} ({citations.length})
        </span>
        <span
          className={clsx(
            "ml-3 inline-flex items-center text-xs uppercase tracking-wide",
            open ? "text-blue-600 dark:text-blue-400" : "text-gray-400",
          )}
        >
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 text-sm dark:border-neutral-800 sm:px-6">
          <div className="space-y-2">
            {citations.map((citation, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                  [{idx + 1}]
                </span>
                <a
                  href={citation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {citation}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
