import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitPulse Agentic",
  description: "Agentic command center for git activity across repos, orgs, teams, and contributors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
