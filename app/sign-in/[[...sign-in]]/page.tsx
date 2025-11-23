"use client";

import { SignIn } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <div className="flex justify-end px-6 pt-6">
        <ThemeToggle />
      </div>
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4 pb-12">
        <div className="rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-2xl backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-10">
          <SignIn
            signUpUrl="/sign-up"
            appearance={{ elements: { card: "bg-transparent shadow-none" } }}
          />
        </div>
      </div>
    </div>
  );
}
