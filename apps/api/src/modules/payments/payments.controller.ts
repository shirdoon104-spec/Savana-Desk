import { Body, Controller, Post } from "@nestjs/common";
import {
  ManualMobileMoneyProvider,
  StripeProvider,
  type PaymentRequest,
} from "@rayaan/payments";

@Controller("payments")
export class PaymentsController {
  @Post("initiate")
  async initiate(@Body() request: PaymentRequest) {
    const provider =
      request.provider === "stripe"
        ? new StripeProvider()
        : new ManualMobileMoneyProvider();

    return provider.initiatePayment(request);
  }
}
