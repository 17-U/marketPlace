import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PAYMENT_PROVIDER } from "./payment-provider.interface";
import { MockPaymentProvider } from "./mock-payment.provider";

@Module({
  providers: [
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (config: ConfigService, mockProvider: MockPaymentProvider) => {
        const provider = config.get<string>("payment.provider");
        switch (provider) {
          case "mock":
          default:
            return mockProvider;
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
