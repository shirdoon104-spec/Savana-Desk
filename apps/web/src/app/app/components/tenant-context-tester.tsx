"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useState } from "react";

type RequestState = "idle" | "loading" | "success" | "error";

export function TenantContextTester() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <section className="notice-panel tenant-test">
        <div>
          <p className="eyebrow">Auth test</p>
          <h2>Tenant context</h2>
          <p>Add real Clerk keys to enable the end-to-end auth test.</p>
        </div>
        <pre data-state="idle">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing in apps/web/.env.local.
        </pre>
      </section>
    );
  }

  return <TenantContextTesterInner />;
}

function TenantContextTesterInner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [state, setState] = useState<RequestState>("idle");
  const [result, setResult] = useState<string>(
    "Sign in with Clerk, select or create an organization, then test the API context.",
  );

  async function testTenantContext() {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      setState("error");
      setResult("Clerk publishable key is missing in apps/web/.env.local.");
      return;
    }

    if (!isLoaded || !isSignedIn) {
      setState("error");
      setResult("You must be signed in before testing tenant context.");
      return;
    }

    setState("loading");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Clerk did not return a session token.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tenancy/context`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(payload, null, 2));
      }

      setState("success");
      setResult(JSON.stringify(payload, null, 2));
    } catch (error) {
      setState("error");
      setResult(error instanceof Error ? error.message : "Unknown API error.");
    }
  }

  return (
    <section className="notice-panel tenant-test">
      <div>
        <p className="eyebrow">Auth test</p>
        <h2>Tenant context</h2>
        <p>
          Active organization:{" "}
          <strong>{organization?.name ?? "No organization selected"}</strong>
        </p>
      </div>
      <button type="button" onClick={testTenantContext} disabled={state === "loading"}>
        {state === "loading" ? "Testing..." : "Test tenant context"}
      </button>
      <pre data-state={state}>{result}</pre>
    </section>
  );
}
