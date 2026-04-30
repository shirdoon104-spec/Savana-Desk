import type { PaymentProvider, PaymentStatus, TenantScope } from "@rayaan/shared";

export interface MoneyAmount {
  amount: number;
  currency: "USD" | "SOS";
}

export interface PaymentRequest extends TenantScope, MoneyAmount {
  provider: PaymentProvider;
  customerPhone?: string;
  customerEmail?: string;
  orderId?: string;
  folioId?: string;
  description?: string;
  idempotencyKey: string;
}

export interface PaymentResult {
  provider: PaymentProvider;
  providerTransactionId?: string;
  status: PaymentStatus;
  raw?: unknown;
}

export interface PaymentProviderAdapter {
  provider: PaymentProvider;
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>;
  checkStatus(providerTransactionId: string): Promise<PaymentResult>;
  handleWebhook(payload: unknown, signature?: string): Promise<PaymentResult>;
}
