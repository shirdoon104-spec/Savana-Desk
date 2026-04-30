export function ClerkUnavailable({ action }: { action: string }) {
  return (
    <main className="auth-page">
      <section className="notice-panel">
        <p className="eyebrow">Auth setup needed</p>
        <h1>Clerk is not configured yet</h1>
        <p>
          Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to the
          web app environment before trying to {action}.
        </p>
      </section>
    </main>
  );
}
