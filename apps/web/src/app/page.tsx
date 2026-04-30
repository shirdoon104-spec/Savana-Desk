import {
  Building2,
  CreditCard,
  Hotel,
  RefreshCcw,
  Utensils,
} from "lucide-react";
import Link from "next/link";

const modules = [
  { name: "Hotel Operations", icon: Hotel, detail: "Rooms, reservations, folios" },
  { name: "Restaurant POS", icon: Utensils, detail: "Tables, orders, KDS" },
  { name: "Offline Sync", icon: RefreshCcw, detail: "Queued actions and conflict review" },
  { name: "Payments", icon: CreditCard, detail: "Stripe plus Somalia mobile money" },
];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Building2 aria-hidden="true" />
          <span>Rayaan</span>
        </div>
        <nav>
          <a href="#">Dashboard</a>
          <a href="#">Properties</a>
          <a href="#">Rooms</a>
          <a href="#">Restaurant</a>
          <a href="#">Payments</a>
          <a href="#">Sync</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">SaaS scaffold</p>
            <h1>Hotel and restaurant command center</h1>
          </div>
          <Link className="button-link" href="/app" prefetch={false}>
            Open app
          </Link>
          <Link className="secondary-link" href="/sign-up">
            Sign up
          </Link>
          <Link className="secondary-link" href="/setup">
            Setup
          </Link>
        </header>

        <section className="status-grid" aria-label="System status">
          <div>
            <span>Tenancy</span>
            <strong>Clerk Organizations</strong>
          </div>
          <div>
            <span>Backend</span>
            <strong>NestJS API</strong>
          </div>
          <div>
            <span>Data</span>
            <strong>PostgreSQL + Redis</strong>
          </div>
          <div>
            <span>Market</span>
            <strong>Somalia ready</strong>
          </div>
        </section>

        <section className="module-grid" aria-label="Modules">
          {modules.map((module) => (
            <article key={module.name} className="module-card">
              <module.icon aria-hidden="true" />
              <h2>{module.name}</h2>
              <p>{module.detail}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
