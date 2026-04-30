"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export function AccountControls() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <span className="env-pill">Clerk env missing</span>;
  }

  return (
    <div className="account-controls">
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/onboarding"
        afterLeaveOrganizationUrl="/"
        afterSelectOrganizationUrl="/app"
      />
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
