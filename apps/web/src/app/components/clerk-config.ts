export function hasValidClerkPublishableKey() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!publishableKey) {
    return false;
  }

  if (publishableKey.toLowerCase().includes("placeholder")) {
    return false;
  }

  return (
    publishableKey.length > 32 &&
    (publishableKey.startsWith("pk_test_") ||
      publishableKey.startsWith("pk_live_"))
  );
}

