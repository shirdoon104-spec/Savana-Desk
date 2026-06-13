import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { hasValidClerkPublishableKey } from "../components/clerk-config";
import { ClerkUnavailable } from "../(auth)/components/clerk-unavailable";

export default function SsoCallbackPage() {
  if (!hasValidClerkPublishableKey()) {
    return <ClerkUnavailable action="complete SSO" />;
  }

  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/app"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/onboarding"
      signUpUrl="/sign-up"
    />
  );
}
