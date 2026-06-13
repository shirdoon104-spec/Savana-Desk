"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { hasValidClerkPublishableKey } from "../components/clerk-config";

function clearClientClerkState() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);

      if (key?.toLowerCase().includes("clerk")) {
        storage.removeItem(key);
      }
    }
  }
}

export default function SignOutPage() {
  if (!hasValidClerkPublishableKey()) {
    return <SignOutFallback />;
  }

  return <ClerkSignOut />;
}

function ClerkSignOut() {
  const clerk = useClerk();

  useEffect(() => {
    let isMounted = true;

    async function signOutEverySession() {
      try {
        await clerk.signOut();
      } catch {
        // Keep the redirect behavior deterministic even if Clerk is already signed out.
      } finally {
        clearClientClerkState();

        if (isMounted) {
          window.location.replace("/sign-in");
        }
      }
    }

    void signOutEverySession();

    return () => {
      isMounted = false;
    };
  }, [clerk]);

  return (
    <main className="auth-page">
      <section className="sign-out-status" aria-live="polite">
        <h1>Signing out...</h1>
      </section>
    </main>
  );
}

function SignOutFallback() {
  useEffect(() => {
    window.location.replace("/sign-in");
  }, []);

  return (
    <main className="auth-page">
      <section className="sign-out-status" aria-live="polite">
        <h1>Signing out...</h1>
      </section>
    </main>
  );
}
