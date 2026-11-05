import { Body, Controller, Param, Post } from "@nestjs/common";
import { ReviewDto } from "@marketplace/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";

@Controller("orders/:id/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") orderId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.create(user.id, orderId, dto);
  }
}
