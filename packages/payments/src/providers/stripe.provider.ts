import type {
  PaymentProviderAdapter,
  PaymentRequest,
  PaymentResult,
} from "../types";

export class StripeProvider implements PaymentProviderAdapter {
  provider = "stripe" as const;

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    return {
      provider: this.provider,
      status: "pending",
      raw: {
        note: "Wire this adapter to Stripe PaymentIntents in implementation.",
        request,
      },
    };
  }

  async checkStatus(providerTransactionId: string): Promise<PaymentResult> {
    return {
      provider: this.provider,
      providerTransactionId,
      status: "pending",
    };
  }

  async handleWebhook(payload: unknown): Promise<PaymentResult> {
    return {
      provider: this.provider,
      status: "pending",
      raw: payload,
    };
  }
}
