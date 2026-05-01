import Link from "next/link";
import { Building2 } from "lucide-react";
import { AccountControls } from "./components/account-controls";
import { AppNav } from "./components/app-nav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
