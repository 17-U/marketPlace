import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { ListingsModule } from "../listings/listings.module";
import { ReviewsModule } from "../reviews/reviews.module";

@Module({
  imports: [ListingsModule, ReviewsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
