import Link from "next/link";
import { Building2, LayoutDashboard, Settings, Utensils } from "lucide-react";
import { AccountControls } from "./components/account-controls";

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
        <nav>
          <Link href="/app">
            <LayoutDashboard aria-hidden="true" />
            Dashboard
          </Link>
          <Link href="/app/properties">
            <Building2 aria-hidden="true" />
            Properties
          </Link>
          <Link href="/app/restaurants">
            <Utensils aria-hidden="true" />
            Restaurants
          </Link>
          <Link href="/app/settings">
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </nav>
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
