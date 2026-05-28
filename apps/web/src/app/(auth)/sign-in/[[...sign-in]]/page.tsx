import { SignIn } from "@clerk/nextjs";
import { ClerkUnavailable } from "../../components/clerk-unavailable";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <ClerkUnavailable action="sign in" />;
  }

  return (
    <main className="auth-page">
      <SignIn
        fallbackRedirectUrl="/app"
        oauthFlow="redirect"
        path="/sign-in"
        routing="path"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      />
    </main>
  );
}
