import { SignUp } from "@clerk/nextjs";
import { AuthAutocompleteGuard } from "../../components/auth-autocomplete-guard";
import { ClerkUnavailable } from "../../components/clerk-unavailable";
import { hasValidClerkPublishableKey } from "../../../components/clerk-config";

export default function SignUpPage() {
  if (!hasValidClerkPublishableKey()) {
    return <ClerkUnavailable action="sign up" />;
  }

  return (
    <main className="auth-page">
      <AuthAutocompleteGuard />
      <SignUp
        fallbackRedirectUrl="/onboarding"
        oidcPrompt="select_account"
        oauthFlow="redirect"
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </main>
  );
}
