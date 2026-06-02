"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import {
  SafeSignOutButton,
  userButtonWithoutSignOutAppearance,
} from "../../components/safe-sign-out-button";

const accountControlAppearance = {
  elements: {
    organizationSwitcherTrigger: "account-control-trigger",
    organizationSwitcherTriggerIcon: "account-control-trigger-icon",
    organizationPreview: "account-control-preview",
    organizationPreviewAvatarBox: "account-control-avatar",
    organizationPreviewMainIdentifier: "account-control-label",
    organizationSwitcherPopoverActionButton: "account-popover-action",
    organizationSwitcherPopoverActionButtonText: "account-popover-action-text",
    organizationSwitcherPopoverActionButtonIcon: "account-popover-action-icon",
    organizationSwitcherPopoverActions: "account-popover-actions",
    organizationSwitcherPopoverCard: "account-popover-card",
    organizationSwitcherPopoverFooter: "account-popover-footer",
    userButtonAvatarBox: "account-user-avatar",
  },
};

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
        appearance={accountControlAppearance}
      />
      <UserButton
        appearance={{
          elements: {
            ...userButtonWithoutSignOutAppearance.elements,
            userButtonAvatarBox: "account-user-avatar",
          },
        }}
        signInUrl="/sign-in"
      />
      <SafeSignOutButton />
    </div>
  );
}
