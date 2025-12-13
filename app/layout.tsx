import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { ConvexClientProvider } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitPulse - GitHub Activity Analytics",
  description:
    "Natural language-powered GitHub analytics with semantic search and AI-generated reports",

  // Icon configuration
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // Web App Manifest
  manifest: '/manifest.json',

  // Apple Web App configuration
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GitPulse',
  },
};

// Theme color moved to viewport export (Next.js 16+)
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors`}
      >
        <ThemeProvider>
          <ClerkProvider
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            appearance={{
              variables: {
                colorPrimary: "#000000",
                colorText: "#000000",
                colorBackground: "#ffffff",
                colorInputBackground: "#f4f4f5",
                colorInputText: "#000000",
                borderRadius: "0.5rem",
              },
              elements: {
                card: "shadow-none border border-zinc-200 bg-white rounded-xl",
                navbarButton: "text-zinc-600 hover:text-black",
                formButtonPrimary: "bg-black hover:bg-zinc-800 text-white",
                footerActionLink: "text-zinc-600 hover:text-black",
              },
            }}
          >
            <ConvexClientProvider>{children}</ConvexClientProvider>
            <Analytics />
            <Toaster position="top-right" richColors theme="system" />
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
