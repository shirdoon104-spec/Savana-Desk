"use client";

import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignedInInviteState() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "this account";

  return (
    <div className="invite-accept-card">
      <div className="brand-mark">
        <Building2 aria-hidden="true" />
        <span>Rayaan</span>
      </div>
      <p className="eyebrow">Invitation</p>
      <h1>Continue to your workspace</h1>
      <p>
        You are signed in as {email}. Continue if this is the invited account,
        or sign out and open the invitation again with the invited email.
      </p>
      <div className="invite-actions">
        <Link className="button-link" href="/app">
          Continue to Rayaan
        </Link>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const clerkStatus = searchParams.get("__clerk_status");
  const shouldSignIn = clerkStatus === "sign_in";

  return (
    <main className="auth-brand-page">
      <div className="auth-brand-panel">
        <section className="auth-brand-copy">
          <div className="brand-mark">
            <Building2 aria-hidden="true" />
            <span>Rayaan</span>
          </div>
          <h1>Join your hotel workspace</h1>
          <p>
            Accept the invitation with the same email address that received the
            invite. Rayaan will connect your account to the hotel team after
            Clerk verifies the organization invitation.
          </p>
          <div className="onboarding-points">
            <span>Use the invited email address</span>
            <span>Complete Clerk sign up or sign in</span>
            <span>Land in the Rayaan workspace</span>
          </div>
        </section>

        <section className="auth-task-card">
          <SignedOut>
            {shouldSignIn ? (
              <SignIn
                fallbackRedirectUrl="/app"
                forceRedirectUrl="/app"
                routing="hash"
                signUpFallbackRedirectUrl="/app"
                signUpForceRedirectUrl="/app"
              />
            ) : (
              <SignUp
                fallbackRedirectUrl="/app"
                forceRedirectUrl="/app"
                routing="hash"
                signInFallbackRedirectUrl="/app"
                signInForceRedirectUrl="/app"
              />
            )}
          </SignedOut>
          <SignedIn>
            <SignedInInviteState />
          </SignedIn>
        </section>
      </div>
    </main>
  );
}
