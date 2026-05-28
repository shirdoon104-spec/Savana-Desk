import { SignUp } from "@clerk/nextjs";
import { ClerkUnavailable } from "../../components/clerk-unavailable";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <ClerkUnavailable action="sign up" />;
  }

  return (
    <main className="auth-page">
      <SignUp
        fallbackRedirectUrl="/onboarding"
        oauthFlow="redirect"
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </main>
  );
}
