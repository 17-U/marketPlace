import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import configuration from "./config/configuration";
import { envValidationSchema } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CitiesModule } from "./modules/cities/cities.module";
import { StorageModule } from "./modules/storage/storage.module";
import { SearchModule } from "./modules/search/search.module";
import { ListingsModule } from "./modules/listings/listings.module";
import { PhotosModule } from "./modules/photos/photos.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { DisputesModule } from "./modules/disputes/disputes.module";
import { SellerVerificationModule } from "./modules/seller-verification/seller-verification.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>("redis.url")!);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    CitiesModule,
    StorageModule,
    SearchModule,
    ListingsModule,
    PhotosModule,
    FavoritesModule,
    MessagingModule,
    SettingsModule,
    PaymentsModule,
    OrdersModule,
    NotificationsModule,
    ReviewsModule,
    DisputesModule,
    SellerVerificationModule,
    ReportsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
