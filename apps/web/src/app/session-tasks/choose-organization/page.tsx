import { TaskChooseOrganization } from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import { hasValidClerkPublishableKey } from "../../components/clerk-config";
import { ClerkUnavailable } from "../../(auth)/components/clerk-unavailable";

export default function ChooseOrganizationTaskPage() {
  if (!hasValidClerkPublishableKey()) {
    return <ClerkUnavailable action="choose an organization" />;
  }

  return (
    <main className="auth-brand-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-copy">
          <div className="brand-mark">
            <Building2 aria-hidden="true" />
            <span>Rayaan Hotel SaaS</span>
          </div>
          <p className="eyebrow">Workspace setup</p>
          <h1>Create your hotel company workspace</h1>
          <p>
            This organization becomes the secure tenant boundary for your hotel,
            restaurants, staff roles, payments, and offline devices.
          </p>
          <div className="onboarding-points">
            <span>Hotel group account</span>
            <span>Clerk organization security</span>
            <span>Tenant-scoped data access</span>
          </div>
        </div>

        <div className="auth-task-card">
          <TaskChooseOrganization redirectUrlComplete="/onboarding" />
        </div>
      </section>
    </main>
  );
}
