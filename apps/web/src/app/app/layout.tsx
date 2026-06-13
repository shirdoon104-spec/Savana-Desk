import Link from "next/link";
import { Building2 } from "lucide-react";
import { hasValidClerkPublishableKey } from "../components/clerk-config";
import { AccountControls } from "./components/account-controls";
import { AppNav } from "./components/app-nav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!hasValidClerkPublishableKey()) {
    return (
      <main className="shell">
        <aside className="sidebar">
          <Link className="brand" href="/">
            <Building2 aria-hidden="true" />
            <span>Rayaan</span>
          </Link>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">Tenant workspace</p>
              <h1>Operations dashboard</h1>
            </div>
            <span className="env-pill">Clerk env missing</span>
          </header>
          <div className="empty-state">
            Add a real Clerk publishable key to open the operations workspace.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/app">
          <Building2 aria-hidden="true" />
          <span>Rayaan</span>
        </Link>
        <AppNav />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Tenant workspace</p>
            <h1>Operations dashboard</h1>
          </div>
          <AccountControls />
        </header>
        {children}
      </section>
    </main>
  );
}
