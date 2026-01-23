import Link from "next/link";

const PREVIEWS = [
  {
    name: "Onboarding Flow",
    description: "3-step onboarding with GitHub connection, repo discovery, and settings",
    href: "/preview/onboarding",
    status: "ready",
  },
];

export default function PreviewIndexPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">UI Previews</h1>
        <p className="text-[#8b949e]">
          Browse and test UI components without authentication.
        </p>
      </div>

      <div className="grid gap-4">
        {PREVIEWS.map((preview) => (
          <Link
            key={preview.href}
            href={preview.href}
            className="group block p-6 bg-[#0d1117] border border-[#30363d] rounded-xl hover:border-[#8250df]/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white group-hover:text-[#8250df] transition-colors">
                  {preview.name}
                </h2>
                <p className="text-sm text-[#8b949e] mt-1">
                  {preview.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-mono bg-[#2ea44f]/20 text-[#2ea44f] rounded">
                  {preview.status}
                </span>
                <svg
                  className="w-5 h-5 text-[#8b949e] group-hover:text-[#8250df] group-hover:translate-x-1 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
