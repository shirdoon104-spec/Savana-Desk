"use client";

import { useAuth } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const userButtonWithoutSignOutAppearance = {
  elements: {
    userButtonPopoverActionButton__signOut: {
      display: "none",
    },
  },
};

export function SafeSignOutButton() {
  const router = useRouter();
  const { isLoaded } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (!isLoaded || isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    router.push("/sign-out");
  }

  return (
    <button
      className="safe-sign-out-button"
      disabled={!isLoaded || isSigningOut}
      onClick={handleSignOut}
      type="button"
    >
      <LogOut aria-hidden="true" />
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
