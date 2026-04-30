import Link from "next/link";

async function getApiSetupStatus() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/setup/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<{
      api: {
        ready: boolean;
      };
      nextSteps: string[];
    }>;
  } catch {
    return null;
  }
}

export default async function SetupPage() {
  const apiStatus = await getApiSetupStatus();
  const webClerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  return (
    <main className="onboarding-page">
      <section className="notice-panel setup-status">
        <p className="eyebrow">Phase 1 setup</p>
        <h1>Connect Clerk authentication</h1>
        <p>
          Paste your Clerk keys into the local env files, restart both servers,
          then use this page to confirm the setup is loaded.
        </p>

        <div className="checklist">
          <SetupCheck
            done={webClerkConfigured}
            label="Web publishable key"
            detail="NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/web/.env.local"
          />
          <SetupCheck
            done={Boolean(apiStatus)}
            label="API reachable"
            detail="GET /api/setup/status"
          />
          <SetupCheck
            done={Boolean(apiStatus?.api.ready)}
            label="API environment"
            detail="Required API environment variables are configured"
          />
        </div>

        <div className="setup-actions">
          <Link className="button-link" href="/sign-up">
            Sign up
          </Link>
          <Link className="secondary-link" href="/app">
            Open app
          </Link>
        </div>
      </section>
    </main>
  );
}

function SetupCheck({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="setup-check" data-done={done}>
      <strong>{done ? "Ready" : "Needs setup"}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}
