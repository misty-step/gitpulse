export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#010409]">
        <div className="min-h-screen p-8">
          <div className="max-w-5xl mx-auto">
            {/* Preview Environment Banner */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-[#8250df]/20 border border-[#8250df]/40 rounded-full">
                  <span className="text-xs font-mono text-[#8250df] uppercase tracking-wider">
                    Preview Mode
                  </span>
                </div>
                <span className="text-sm text-[#8b949e]">
                  UI components rendered with mock data
                </span>
              </div>
              <a
                href="/preview"
                className="text-sm text-[#8b949e] hover:text-white transition-colors"
              >
                &larr; All Previews
              </a>
            </div>

            {/* Content Area */}
            <div className="border border-dashed border-[#30363d] rounded-xl p-6 relative">
              <div className="absolute -top-3 left-4 px-2 bg-[#010409]">
                <span className="text-xs font-mono text-[#8b949e]">
                  Component Preview
                </span>
              </div>
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
