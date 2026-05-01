"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type VerifyState = "idle" | "verifying" | "paid" | "pending" | "error";

async function readApiMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    return message ?? fallback;
  } catch {
    return fallback;
  }
}

function PaystackCallbackContent() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [message, setMessage] = useState("Confirming payment with Paystack.");
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");

  useEffect(() => {
    async function verifyPayment() {
      if (!isLoaded || verifyState !== "idle") {
        return;
      }

      if (!isSignedIn) {
        setVerifyState("error");
        setMessage("Sign in again to confirm this payment.");
        return;
      }

      if (!reference) {
        setVerifyState("error");
        setMessage("Paystack did not return a payment reference.");
        return;
      }

      setVerifyState("verifying");
      const token = await getToken();

      if (!token) {
        setVerifyState("error");
        setMessage("Could not confirm your workspace session.");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/paystack/verify/${reference}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        setVerifyState("error");
        setMessage(await readApiMessage(response, "Payment verification failed."));
        return;
      }

      const payment = (await response.json()) as { status?: string };

      if (payment.status === "paid") {
        setVerifyState("paid");
        setMessage("Payment confirmed.");
        return;
      }

      setVerifyState("pending");
      setMessage(`Payment is ${payment.status ?? "pending"}.`);
    }

    void verifyPayment();
  }, [getToken, isLoaded, isSignedIn, reference, verifyState]);

  return (
    <main className="app-shell">
      <section className="notice-panel">
        <p className="eyebrow">Paystack</p>
        <h1>{verifyState === "paid" ? "Payment received" : "Payment status"}</h1>
        <p>{message}</p>
        <Link className="button-link" href="/app/restaurants">
          Back to restaurants
        </Link>
      </section>
    </main>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="notice-panel">
            <p className="eyebrow">Paystack</p>
            <h1>Payment status</h1>
            <p>Preparing payment confirmation.</p>
          </section>
        </main>
      }
    >
      <PaystackCallbackContent />
    </Suspense>
  );
}
