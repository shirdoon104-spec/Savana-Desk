import type {
  PaymentProviderAdapter,
  PaymentRequest,
  PaymentResult,
} from "../types";

interface PaystackProviderOptions {
  callbackUrl?: string;
  secretKey: string;
}

interface PaystackInitializeResponse {
  data?: {
    access_code?: string;
    authorization_url?: string;
    reference?: string;
  };
  message: string;
  status: boolean;
}

interface PaystackVerifyResponse {
  data?: {
    amount?: number;
    currency?: string;
    gateway_response?: string;
    reference?: string;
    status?: string;
  };
  message: string;
  status: boolean;
}

const paystackBaseUrl = "https://api.paystack.co";

export class PaystackProvider implements PaymentProviderAdapter {
  provider = "paystack" as const;

  constructor(private readonly options: PaystackProviderOptions) {}

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    const reference = this.referenceFromIdempotencyKey(request.idempotencyKey);
    const response = await this.paystackRequest<PaystackInitializeResponse>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          amount: this.toSubunitAmount(request.amount),
          callback_url: this.options.callbackUrl,
          currency: request.currency,
          email: request.customerEmail,
          metadata: {
            description: request.description,
            folioId: request.folioId,
            orderId: request.orderId,
            propertyId: request.propertyId,
            restaurantId: request.restaurantId,
            tenantId: request.tenantId,
          },
          reference,
        }),
      },
    );

    if (!response.status || !response.data?.reference) {
      throw new Error(response.message || "Unable to initialize Paystack payment.");
    }

    return {
      provider: this.provider,
      providerTransactionId: response.data.reference,
      status: "requires_customer_action",
      raw: response.data,
    };
  }

  async checkStatus(providerTransactionId: string): Promise<PaymentResult> {
    const response = await this.paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(providerTransactionId)}`,
      { method: "GET" },
    );

    if (!response.status || !response.data?.reference) {
      throw new Error(response.message || "Unable to verify Paystack payment.");
    }

    return {
      provider: this.provider,
      providerTransactionId: response.data.reference,
      status: this.mapStatus(response.data.status),
      raw: response.data,
    };
  }

  async handleWebhook(payload: unknown): Promise<PaymentResult> {
    const event = payload as {
      data?: { reference?: string; status?: string };
      event?: string;
    };

    return {
      provider: this.provider,
      providerTransactionId: event.data?.reference,
      status:
        event.event === "charge.success" ? "paid" : this.mapStatus(event.data?.status),
      raw: payload,
    };
  }

  private mapStatus(status: string | undefined): PaymentResult["status"] {
    if (status === "success") {
      return "paid";
    }

    if (status === "failed") {
      return "failed";
    }

    if (status === "abandoned") {
      return "cancelled";
    }

    if (status === "reversed") {
      return "reversed";
    }

    return "pending";
  }

  private referenceFromIdempotencyKey(idempotencyKey: string) {
    return idempotencyKey.replace(/[^A-Za-z0-9.\-=]/g, "-").slice(0, 100);
  }

  private async paystackRequest<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${paystackBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const payload = (await response.json()) as T;

    if (!response.ok) {
      const message =
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Paystack request failed.";

      throw new Error(message);
    }

    return payload;
  }

  private toSubunitAmount(amount: number) {
    return Math.round(amount * 100);
  }
}
