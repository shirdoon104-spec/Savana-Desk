import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/app"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/onboarding"
      signUpUrl="/sign-up"
    />
  );
}
