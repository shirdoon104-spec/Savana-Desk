import { SignIn } from "@clerk/nextjs";
import { AuthAutocompleteGuard } from "../../components/auth-autocomplete-guard";
import { ClerkUnavailable } from "../../components/clerk-unavailable";
import { hasValidClerkPublishableKey } from "../../../components/clerk-config";

export default function SignInPage() {
  if (!hasValidClerkPublishableKey()) {
    return <ClerkUnavailable action="sign in" />;
  }

  return (
    <main className="auth-page">
      <AuthAutocompleteGuard />
      <SignIn
        fallbackRedirectUrl="/app"
        oidcPrompt="select_account"
        oauthFlow="redirect"
        path="/sign-in"
        routing="path"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      />
    </main>
  );
}
