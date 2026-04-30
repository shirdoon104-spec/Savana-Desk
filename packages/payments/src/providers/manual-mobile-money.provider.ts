import type {
  PaymentProviderAdapter,
  PaymentRequest,
  PaymentResult,
} from "../types";

export class ManualMobileMoneyProvider implements PaymentProviderAdapter {
  provider = "manual_mobile_money" as const;

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    return {
      provider: this.provider,
      status: "pending",
      raw: {
        note: "Record pending mobile money collection and reconcile manually.",
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

  async handleWebhook(): Promise<PaymentResult> {
    return {
      provider: this.provider,
      status: "pending",
    };
  }
}
