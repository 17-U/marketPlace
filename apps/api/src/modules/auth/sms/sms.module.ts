import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SMS_PROVIDER } from "./sms-provider.interface";
import { ConsoleSmsProvider } from "./console-sms.provider";

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>("smsProvider");
        switch (provider) {
          case "console":
          default:
            return new ConsoleSmsProvider();
        }
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
